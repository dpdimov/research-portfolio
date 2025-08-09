import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { question, context } = await request.json();

    if (!question || !question.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Get relevant papers from database with full text for context
    const relevantPapers = await findRelevantPapers(question);
    
    // Generate response using Claude API
    const answer = await generateResearchAnswer(question, relevantPapers, context);

    return NextResponse.json({
      success: true,
      answer,
      relevantPapers: relevantPapers.map(p => ({
        id: p.id,
        title: p.title,
        year: p.year
      }))
    });

  } catch (error) {
    console.error('Q&A error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process question: ' + error.message
    }, { status: 500 });
  }
}

async function findRelevantPapers(question) {
  // For now, we'll use simple keyword matching
  // In a production version, you'd use vector embeddings for semantic search
  
  const keywords = extractKeywords(question);
  
  if (keywords.length === 0) {
    // If no specific keywords, return recent papers
    const papers = await sql`
      SELECT * FROM papers 
      ORDER BY year DESC, title ASC 
      LIMIT 5
    `;
    return papers.rows;
  }

  // Build a query to find papers matching keywords
  const searchPattern = keywords.map(kw => `%${kw.toLowerCase()}%`);
  
  try {
    const papers = await sql`
      SELECT *, 
             (CASE 
              WHEN LOWER(title) LIKE ANY(ARRAY[${searchPattern.join(',')}]) THEN 3
              WHEN LOWER(summary) LIKE ANY(ARRAY[${searchPattern.join(',')}]) THEN 2  
              WHEN LOWER(full_text) LIKE ANY(ARRAY[${searchPattern.join(',')}]) THEN 1
              ELSE 0
             END) as relevance_score
      FROM papers 
      WHERE LOWER(title) LIKE ANY(ARRAY[${searchPattern.join(',')}])
         OR LOWER(summary) LIKE ANY(ARRAY[${searchPattern.join(',')}])
         OR LOWER(full_text) LIKE ANY(ARRAY[${searchPattern.join(',')}])
      ORDER BY relevance_score DESC, year DESC
      LIMIT 10
    `;
    return papers.rows;
  } catch (error) {
    console.error('Search error:', error);
    // Fallback to recent papers
    const papers = await sql`
      SELECT * FROM papers 
      ORDER BY year DESC, title ASC 
      LIMIT 5
    `;
    return papers.rows;
  }
}

function extractKeywords(question) {
  // Simple keyword extraction - remove common words
  const stopWords = new Set([
    'what', 'how', 'why', 'when', 'where', 'who', 'which', 'that', 'this',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'can', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
    'for', 'of', 'with', 'by', 'about', 'your', 'my', 'me', 'you', 'i'
  ]);

  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10); // Limit to prevent overly complex queries
}

async function generateResearchAnswer(question, relevantPapers, portfolioContext) {
  // Build context from relevant papers
  const paperContext = relevantPapers.map(paper => `
Paper: "${paper.title}" (${paper.year})
Authors: ${JSON.parse(paper.authors).join(', ')}
Summary: ${paper.summary}
Keywords: ${JSON.parse(paper.keywords).join(', ')}
`).join('\n\n');

  const prompt = `
You are an AI assistant helping visitors explore a researcher's portfolio. Answer questions about their research based on the provided context.

RESEARCH PORTFOLIO CONTEXT:
The researcher has published ${portfolioContext?.papers?.length || 'several'} papers across ${portfolioContext?.themes?.length || 'multiple'} research themes including: ${portfolioContext?.themes?.map(t => t.name).join(', ') || 'various areas'}.

RELEVANT PAPERS FOR THIS QUESTION:
${paperContext}

QUESTION: "${question}"

Instructions:
- Answer based on the research papers provided above
- Be specific and reference actual papers when relevant
- If the question can't be answered from the available papers, say so honestly
- Keep responses conversational but informative
- Highlight key findings and methodological approaches
- If multiple papers are relevant, compare or synthesize their approaches

Provide a helpful, accurate response:
`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error);
    
    // Fallback response
    if (relevantPapers.length > 0) {
      return `Based on the available research, I found ${relevantPapers.length} relevant paper(s) that might help answer your question about "${question}". The most relevant appears to be "${relevantPapers[0].title}" (${relevantPapers[0].year}), which focuses on ${relevantPapers[0].summary}. Would you like me to provide more specific details about any particular paper?`;
    } else {
      return `I couldn't find specific papers in the portfolio that directly address "${question}". You might want to try rephrasing your question or asking about specific research areas like the main themes in the portfolio.`;
    }
  }
}