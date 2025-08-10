import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { paperId } = await request.json();

    if (!paperId) {
      return NextResponse.json({
        success: false,
        error: 'Paper ID is required'
      }, { status: 400 });
    }

    console.log(`Starting re-analysis of paper ${paperId}...`);
    
    // Check if ANTHROPIC_API_KEY is available
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'ANTHROPIC_API_KEY is not configured'
      }, { status: 500 });
    }

    // Get the specific paper
    const paper = await sql`
      SELECT id, title, authors, year, venue, keywords, full_text, dropbox_path
      FROM papers 
      WHERE id = ${paperId}
    `;

    if (paper.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Paper not found'
      }, { status: 404 });
    }

    const paperData = paper.rows[0];
    console.log(`Re-analyzing paper: ${paperData.title}`);

    // Extract filename from dropbox_path or use title
    const filename = paperData.dropbox_path ? 
      paperData.dropbox_path.split('/').pop() : 
      `${paperData.title}.pdf`;

    // Use the full_text if available, otherwise use title + keywords for analysis
    let textToAnalyze = paperData.full_text;
    if (!textToAnalyze || textToAnalyze.length < 100) {
      // If no full text, use available metadata
      const authors = typeof paperData.authors === 'string' ? JSON.parse(paperData.authors) : paperData.authors;
      const keywords = typeof paperData.keywords === 'string' ? JSON.parse(paperData.keywords) : paperData.keywords;
      
      textToAnalyze = `Title: ${paperData.title}\nAuthors: ${authors.join(', ')}\nYear: ${paperData.year}\nVenue: ${paperData.venue}\nKeywords: ${keywords.join(', ')}`;
    }

    // Use AI to analyze the paper
    const aiAnalysis = await analyzeResearchPaper(textToAnalyze, filename);

    // ONLY update AI-generated fields, preserve original CSV data
    await sql`
      UPDATE papers 
      SET 
        summary = ${aiAnalysis.summary},
        theme_id = ${aiAnalysis.themeId},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${paperId}
    `;

    console.log(`Successfully updated: ${aiAnalysis.title}`);

    // Get updated paper data to return
    const updatedPaper = await sql`
      SELECT p.*, t.name as theme_name, t.color as theme_color
      FROM papers p
      LEFT JOIN themes t ON p.theme_id = t.id
      WHERE p.id = ${paperId}
    `;

    return NextResponse.json({
      success: true,
      message: `Paper "${paperData.title}" re-analyzed successfully`,
      paper: formatPaperForClient(updatedPaper.rows[0])
    });

  } catch (error) {
    console.error('Single paper re-analysis error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to re-analyze paper: ' + error.message
    }, { status: 500 });
  }
}

// Copy the analysis function from reanalyze-papers route
async function analyzeResearchPaper(text, filename) {
  const prompt = `
    You are analyzing an academic paper by Dr. Dimo Dimov, a Professor of Entrepreneurship and Innovation at University of Bath. His research focuses on entrepreneurial thinking, new venture design, and venture capital funding.

    Paper text: "${text.substring(0, 8000)}"
    Filename: "${filename}"

    IMPORTANT JOURNAL ABBREVIATIONS FOR THIS RESEARCHER:
    - JMS = Journal of Management Studies  
    - JBV = Journal of Business Venturing
    - ETP = Entrepreneurship Theory and Practice
    - JSBM = Journal of Small Business Management
    - JPIM = Journal of Product Innovation Management
    - JMI = Journal of Management Inquiry
    - JBVI = Journal of Business Venturing Insights
    - AMR = Academy of Management Review

    Create a SPECIFIC research area theme based on the main focus. Generate ONLY a summary and research area. DO NOT change existing title, authors, venue, or keywords. Respond ONLY with valid JSON:

    {
      "summary": "2-3 sentence summary highlighting key contributions and findings",
      "researchArea": "Specific research theme like 'Venture Capital Decision Making', 'Entrepreneurial Cognition', 'New Venture Creation', etc."
    }

    BE CONSERVATIVE - only extract information actually present in the text.
  `;

  try {
    console.log('Making Claude API request for single paper re-analysis...');
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response from Claude API');
    }

    let analysisText = data.content[0].text;
    
    // Clean up potential markdown formatting
    analysisText = analysisText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    // Find JSON by looking for opening and closing braces
    const jsonStart = analysisText.indexOf('{');
    const jsonEnd = analysisText.lastIndexOf('}') + 1;
    
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      analysisText = analysisText.substring(jsonStart, jsonEnd);
    }
    
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (firstError) {
      console.log('First parse failed, trying to fix JSON:', firstError.message);
      
      let cleanedText = analysisText;
      cleanedText = cleanedText.replace(/: "([^"]*)"([^",}]*)"([^"]*)",/g, ': "$1\\"$2\\"$3",');
      cleanedText = cleanedText.replace(/: "([^"]*)"([^",}]*)"([^"]*)"/g, ': "$1\\"$2\\"$3"');
      
      analysis = JSON.parse(cleanedText);
    }
    
    // Assign theme based on research area
    const themeId = await assignTheme(analysis.researchArea);
    analysis.themeId = themeId;
    
    return analysis;
    
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      summary: 'AI analysis temporarily unavailable. Please try again.',
      themeId: 1, // Default theme
      researchArea: 'General Research'
    };
  }
}

// Simplified theme assignment
async function assignTheme(researchArea) {
  try {
    const existingThemes = await sql`SELECT * FROM themes`;
    
    // Try to find matching theme
    let bestMatch = existingThemes.rows.find(theme => 
      theme.name.toLowerCase().includes(researchArea.toLowerCase()) ||
      researchArea.toLowerCase().includes(theme.name.toLowerCase())
    );
    
    if (bestMatch) {
      return bestMatch.id;
    }
    
    return 1; // Default theme if no match
  } catch (error) {
    console.error('Theme assignment error:', error);
    return 1;
  }
}

// Formatting function
function formatPaperForClient(paper) {
  let authors = paper.authors;
  if (typeof authors === 'string') {
    try {
      authors = JSON.parse(authors);
    } catch {
      authors = [authors];
    }
  }
  if (!Array.isArray(authors)) {
    authors = [authors || 'Unknown Author'];
  }

  let keywords = paper.keywords;
  if (typeof keywords === 'string') {
    try {
      keywords = JSON.parse(keywords);
    } catch {
      keywords = [keywords];
    }
  }
  if (!Array.isArray(keywords)) {
    keywords = [keywords || 'research'];
  }

  return {
    id: paper.id,
    title: paper.title,
    authors: authors,
    year: paper.year,
    venue: paper.venue,
    summary: paper.summary,
    keywords: keywords,
    themeId: paper.theme_id,
    doi: paper.doi,
    link: paper.link,
    volume: paper.volume,
    issue: paper.issue,
    pageStart: paper.page_start,
    pageEnd: paper.page_end,
    themeName: paper.theme_name,
    themeColor: paper.theme_color
  };
}