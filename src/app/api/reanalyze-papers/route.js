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
      WHERE full_text IS NOT NULL 
      ORDER BY id 
      LIMIT 10
    `;

    console.log(`Found ${papers.rows.length} papers to re-analyze`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const paper of papers.rows) {
      try {
        console.log(`Re-analyzing paper: ${paper.title}`);
        
        // Extract filename from dropbox_path or use title
        const filename = paper.dropbox_path ? 
          paper.dropbox_path.split('/').pop() : 
          `${paper.title}.pdf`;

        // Use AI to analyze the paper
        const aiAnalysis = await analyzeResearchPaper(paper.full_text, filename);

        // Update the paper in database
        await sql`
          UPDATE papers 
          SET 
            title = ${aiAnalysis.title},
            authors = ${JSON.stringify(aiAnalysis.authors)},
            year = ${aiAnalysis.year},
            venue = ${aiAnalysis.venue},
            summary = ${aiAnalysis.summary},
            keywords = ${JSON.stringify(aiAnalysis.keywords)},
            theme_id = ${aiAnalysis.themeId}
          WHERE id = ${paper.id}
        `;

        updatedCount++;
        console.log(`Successfully updated: ${aiAnalysis.title}`);

      } catch {
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
      ORDER BY t.name ASC
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

  } catch {
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
    Analyze this research paper and extract the following information as JSON:

    Paper text: "${text.substring(0, 8000)}"

    Please respond with a JSON object containing:
    {
      "title": "extracted or inferred title",
      "authors": ["author1", "author2"],
      "year": 2024,
      "venue": "journal or conference name",
      "summary": "2-3 sentence summary of key contributions",
      "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
      "researchArea": "primary research area (e.g., 'Machine Learning', 'Statistics', 'Biology')"
    }

    Extract accurate information where possible. If something cannot be determined from the text, make reasonable inferences based on the content and filename: "${filename}".

    IMPORTANT: Respond ONLY with valid JSON. Do not include any other text.
  `;

  try {
    console.log('Making Claude API request for re-analysis...');
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.ANTHROPIC_API_KEY}`,
        "anthropic-version": "2024-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    console.log('Claude API response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Claude API error response:', errorText);
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response from Claude API');
    }

    let analysisText = data.content[0].text;
    
    // Clean up potential markdown formatting
    analysisText = analysisText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const analysis = JSON.parse(analysisText);
    
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
  } catch {
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
  } catch {
    console.error('Theme assignment error:', error);
    return 1; // Default theme
  }
}

// Formatting functions
function formatPaperForClient(paper) {
  // Safe JSON parsing with fallbacks
  let authors;
  try {
    authors = JSON.parse(paper.authors);
    if (!Array.isArray(authors)) {
      authors = [paper.authors];
    }
  } catch {
    authors = [paper.authors || 'Unknown Author'];
  }

  let keywords;
  try {
    keywords = JSON.parse(paper.keywords);
    if (!Array.isArray(keywords)) {
      keywords = [paper.keywords];
    }
  } catch {
    keywords = [paper.keywords || 'research'];
  }

  return {
    id: paper.id,
    title: paper.title,
    authors: authors,
    year: paper.year,
    venue: paper.venue,
    summary: paper.summary,
    keywords: keywords,
    themeId: paper.theme_id
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