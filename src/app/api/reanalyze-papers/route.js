import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// Re-analyze existing papers with AI
export async function POST() {
  try {
    console.log('Starting re-analysis of existing papers...');
    
    // Check if ANTHROPIC_API_KEY is available
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'ANTHROPIC_API_KEY is not configured'
      }, { status: 500 });
    }

    // Get all existing papers that need re-analysis
    const papers = await sql`
      SELECT id, title, dropbox_path, full_text 
      FROM papers 
      WHERE full_text IS NOT NULL AND LENGTH(full_text) > 100
      ORDER BY id
    `;

    console.log(`Found ${papers.rows.length} papers to re-analyze`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const paper of papers.rows) {
      try {
        console.log(`Re-analyzing paper: ${paper.title}`);
        console.log(`Full text length: ${paper.full_text ? paper.full_text.length : 'NULL'} characters`);
        console.log(`Full text preview: ${paper.full_text ? paper.full_text.substring(0, 200) + '...' : 'NO TEXT'}`);
        
        // Extract filename from dropbox_path or use title
        const filename = paper.dropbox_path ? 
          paper.dropbox_path.split('/').pop() : 
          `${paper.title}.pdf`;

        // Use AI to analyze the paper
        const aiAnalysis = await analyzeResearchPaper(paper.full_text, filename);

        // ONLY update AI-generated fields, preserve original CSV data
        await sql`
          UPDATE papers 
          SET 
            summary = ${aiAnalysis.summary},
            theme_id = ${aiAnalysis.themeId},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${paper.id}
        `;

        updatedCount++;
        console.log(`Successfully updated: ${aiAnalysis.title}`);

      } catch (error) {
        console.error(`Error re-analyzing paper ${paper.id}:`, error.message);
        errorCount++;
      }
    }

    // Get updated data to return
    const allPapers = await sql`
      SELECT p.*, t.name as theme_name, t.color as theme_color
      FROM papers p
      LEFT JOIN themes t ON p.theme_id = t.id
      ORDER BY p.year DESC, p.title ASC
    `;

    const allThemes = await sql`
      SELECT t.*, COUNT(p.id) as paper_count
      FROM themes t
      LEFT JOIN papers p ON t.id = p.theme_id
      GROUP BY t.id, t.name, t.description, t.color
      ORDER BY paper_count DESC, t.name ASC
    `;

    return NextResponse.json({
      success: true,
      updatedCount,
      errorCount,
      totalProcessed: papers.rows.length,
      data: {
        papers: allPapers.rows.map(formatPaperForClient),
        themes: allThemes.rows.map(formatThemeForClient)
      }
    });

  } catch (error) {
    console.error('Re-analysis error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to re-analyze papers: ' + error.message
    }, { status: 500 });
  }
}

// AI analysis function (copied from sync-dropbox route)
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

    Extract information as JSON. BE CONSERVATIVE - use "Unknown" if you're not certain:

    {
      "title": "extracted title from text (or 'Unknown' if not found)",
      "authors": ["list only authors found in text", "or empty array if none found"],
      "year": "year from text or filename (or null if uncertain)",
      "venue": "full journal/conference name (use abbreviations above, or 'Unknown')",
      "summary": "factual summary from abstract/content (or 'Content not available for analysis')",
      "keywords": ["only keywords found in text", "related to entrepreneurship/innovation"],
      "researchArea": "Entrepreneurship and Innovation"
    }

    DO NOT make up author names, venues, or specific details not in the text. Respond ONLY with valid JSON.
  `;

  try {
    console.log('Making Claude API request for re-analysis...');
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    console.log('Claude API response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error response:', errorText);
      console.error('API Key present:', !!process.env.ANTHROPIC_API_KEY);
      console.error('API Key starts with:', process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...' : 'MISSING');
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
    
    console.log('Attempting to parse Claude response:', analysisText.substring(0, 200) + '...');
    
    let analysis;
    try {
      // Try parsing the original text first
      analysis = JSON.parse(analysisText);
    } catch (firstError) {
      console.log('First parse failed, trying to fix JSON:', firstError.message);
      
      // Try to fix common JSON issues
      let cleanedText = analysisText;
      
      // Fix unescaped quotes in title and other string values
      cleanedText = cleanedText.replace(/: "([^"]*)"([^",}]*)"([^"]*)",/g, ': "$1\\"$2\\"$3",');
      cleanedText = cleanedText.replace(/: "([^"]*)"([^",}]*)"([^"]*)"/g, ': "$1\\"$2\\"$3"');
      
      console.log('Trying with cleaned text:', cleanedText.substring(0, 200) + '...');
      analysis = JSON.parse(cleanedText);
    }
    
    // Ensure authors and keywords are arrays
    if (typeof analysis.authors === 'string') {
      analysis.authors = [analysis.authors];
    }
    if (!Array.isArray(analysis.authors)) {
      analysis.authors = ['Unknown Author'];
    }
    
    if (typeof analysis.keywords === 'string') {
      analysis.keywords = analysis.keywords.split(',').map(k => k.trim());
    }
    if (!Array.isArray(analysis.keywords)) {
      analysis.keywords = ['research'];
    }
    
    // Assign theme based on research area
    const themeId = await assignTheme(analysis.researchArea, analysis.keywords);
    analysis.themeId = themeId;
    
    return analysis;
  } catch (error) {
    console.error('AI analysis error:', error);
    // Enhanced fallback analysis - extract better info from filename
    const nameWithoutExt = filename.replace(/\.pdf$/i, '');
    
    // Extract year from filename
    const yearMatch = filename.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
    
    // Create readable title from filename
    const titleParts = nameWithoutExt.split(/[_\-\s]+/);
    const title = titleParts
      .filter(part => part && !part.match(/^\d{4}$/) && part.length > 1)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ') || nameWithoutExt;
    
    // Extract potential keywords from title
    const keywords = titleParts
      .filter(part => part && part.length > 3 && !part.match(/^\d{4}$/) && !['paper', 'book'].includes(part.toLowerCase()))
      .map(part => part.toLowerCase());
    
    return {
      title: title,
      authors: ['Unknown Author'],
      year: year,
      venue: 'Unknown Venue',
      summary: `Research paper: ${title}. AI analysis failed, information extracted from filename.`,
      keywords: keywords.length > 0 ? keywords : ['research'],
      themeId: 1, // Default theme
      researchArea: 'General Research'
    };
  }
}

// Theme assignment function (simplified version)
async function assignTheme(researchArea, keywords) {
  try {
    // First, try to find an existing theme that matches
    const existingThemes = await sql`SELECT * FROM themes`;
    
    const matchScore = (theme, area, kw) => {
      let score = 0;
      if (theme.name.toLowerCase().includes(area.toLowerCase())) score += 3;
      if (theme.description.toLowerCase().includes(area.toLowerCase())) score += 2;
      
      kw.forEach(keyword => {
        if (theme.name.toLowerCase().includes(keyword.toLowerCase())) score += 1;
        if (theme.description.toLowerCase().includes(keyword.toLowerCase())) score += 0.5;
      });
      
      return score;
    };

    let bestMatch = null;
    let bestScore = 0;

    existingThemes.rows.forEach(theme => {
      const score = matchScore(theme, researchArea, keywords);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = theme;
      }
    });

    // If we found a good match (score > 2), use it
    if (bestMatch && bestScore > 2) {
      return bestMatch.id;
    }

    // Otherwise, return default theme
    return 1;
  } catch (error) {
    console.error('Theme assignment error:', error);
    return 1; // Default theme
  }
}

// Formatting functions
function formatPaperForClient(paper) {
  // Handle JSONB data (already parsed by PostgreSQL)
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


function formatThemeForClient(theme) {
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    paperCount: parseInt(theme.paper_count),
    color: theme.color,
    lastUpdated: theme.updated_at ? new Date(theme.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  };
}