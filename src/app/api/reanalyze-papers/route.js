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

        // Use AI to analyze the paper with multi-theme support
        const aiAnalysis = await analyzeResearchPaper(paper.full_text, filename);

        // Validate that theme IDs exist (single query for efficiency)
        let validThemeIds = [];
        if (aiAnalysis.themeIds && aiAnalysis.themeIds.length > 0) {
          const existingThemes = await sql`
            SELECT id FROM themes 
            WHERE id = ANY(${aiAnalysis.themeIds})
          `;
          validThemeIds = existingThemes.rows.map(row => row.id);
        }

        // If no valid themes found, use first available theme as fallback
        if (validThemeIds.length === 0) {
          console.log(`No valid themes found for paper ${paper.id}, using fallback`);
          const fallbackTheme = await sql`SELECT id FROM themes ORDER BY id LIMIT 1`;
          if (fallbackTheme.rows.length > 0) {
            validThemeIds.push(fallbackTheme.rows[0].id);
          } else {
            console.error(`No themes exist in database for paper ${paper.id}`);
            continue; // Skip this paper if no themes exist at all
          }
        }

        // Update AI-generated fields, preserve original CSV data
        await sql`
          UPDATE papers 
          SET 
            summary = ${aiAnalysis.summary},
            theme_id = ${validThemeIds[0]},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${paper.id}
        `;

        // Clear existing theme associations for this paper
        await sql`DELETE FROM paper_themes WHERE paper_id = ${paper.id}`;

        // Add new multi-theme associations (only valid theme IDs)
        for (const themeId of validThemeIds) {
          await sql`
            INSERT INTO paper_themes (paper_id, theme_id)
            VALUES (${paper.id}, ${themeId})
            ON CONFLICT (paper_id, theme_id) DO NOTHING
          `;
        }

        updatedCount++;
        console.log(`Successfully updated: ${aiAnalysis.title}`);

      } catch (error) {
        console.error(`Error re-analyzing paper ${paper.id}:`, error.message);
        errorCount++;
      }
    }

    // Get updated data with multi-theme support
    const allPapers = await sql`
      SELECT p.*
      FROM papers p
      ORDER BY p.year DESC, p.title ASC
    `;

    // Fetch themes for each paper
    const papersWithThemes = await Promise.all(
      allPapers.rows.map(async (paper) => {
        const paperThemes = await sql`
          SELECT t.id, t.name, t.color, t.description
          FROM paper_themes pt
          JOIN themes t ON pt.theme_id = t.id
          WHERE pt.paper_id = ${paper.id}
          ORDER BY t.name
        `;
        
        return {
          ...paper,
          themes: paperThemes.rows
        };
      })
    );

    const allThemes = await sql`
      SELECT t.*, COUNT(pt.paper_id) as paper_count
      FROM themes t
      LEFT JOIN paper_themes pt ON t.id = pt.theme_id
      GROUP BY t.id, t.name, t.description, t.color
      ORDER BY paper_count DESC, t.name ASC
    `;

    return NextResponse.json({
      success: true,
      updatedCount,
      errorCount,
      totalProcessed: papers.rows.length,
      data: {
        papers: papersWithThemes.map(formatPaperForClient),
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
      console.log('Problematic JSON:', analysisText);
      
      // Try multiple fix strategies
      let cleanedText = analysisText;
      
      try {
        // Strategy 1: Fix unescaped quotes in string values
        cleanedText = cleanedText.replace(/: "([^"]*)"([^",}]*)"([^"]*)",/g, ': "$1\\"$2\\"$3",');
        cleanedText = cleanedText.replace(/: "([^"]*)"([^",}]*)"([^"]*)"/g, ': "$1\\"$2\\"$3"');
        
        analysis = JSON.parse(cleanedText);
      } catch {
        console.log('Second strategy failed, trying more aggressive fixes');
        
        // Strategy 2: More aggressive cleaning
        cleanedText = analysisText
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/\\n/g, ' ') // Replace literal \n with space
          .replace(/\\t/g, ' ') // Replace literal \t with space
          .replace(/\n/g, ' ') // Replace actual newlines with space
          .replace(/\r/g, ' ') // Replace carriage returns with space
          .replace(/\t/g, ' ') // Replace tabs with space
          .replace(/  +/g, ' ') // Collapse multiple spaces
          .replace(/",\s*"/g, '", "') // Fix comma spacing
          .trim();
        
        try {
          analysis = JSON.parse(cleanedText);
        } catch (thirdError) {
          console.error('All JSON parsing strategies failed. Raw text:', analysisText);
          throw new Error(`JSON parsing failed: ${thirdError.message}. Raw: ${analysisText.substring(0, 200)}...`);
        }
      }
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
    
    // Assign multiple themes based on research area and keywords
    const themeIds = await assignMultipleThemes(analysis.researchArea, analysis.keywords);
    analysis.themeIds = themeIds;
    
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
      themeIds: [1], // Default theme array
      researchArea: 'General Research'
    };
  }
}

// Multi-theme assignment function
async function assignMultipleThemes(researchArea, keywords) {
  try {
    const matchingThemes = new Set();
    
    // Get all existing themes
    const existingThemes = await sql`SELECT * FROM themes`;
    
    // Enhanced keyword matching for multiple themes
    const keywordThemes = {
      'venture capital': ['venture capital', 'funding', 'investment', 'financing'],
      'entrepreneurial cognition': ['cognition', 'cognitive', 'psychology', 'thinking'],
      'innovation': ['innovation', 'creativity', 'idea', 'product development'],
      'new venture creation': ['startup', 'new venture', 'venture creation', 'business formation'],
      'entrepreneurial networks': ['network', 'social capital', 'ties', 'relationship'],
      'international': ['international', 'cross-border', 'global'],
      'technology': ['technology', 'high-tech', 'biotechnology', 'digital'],
      'design': ['design', 'user experience', 'product design', 'interface'],
      'education': ['education', 'teaching', 'learning', 'curriculum', 'pedagogy'],
      'strategy': ['strategy', 'strategic', 'planning', 'competitive advantage'],
      'marketing': ['marketing', 'branding', 'advertising', 'promotion'],
      'finance': ['finance', 'financial', 'investment', 'capital'],
      'opportunity': ['opportunity', 'opportunities', 'recognition']
    };

    // Check all themes that match the keywords
    for (const [themeType, themeKeywords] of Object.entries(keywordThemes)) {
      if (keywords.some(keyword => 
        themeKeywords.some(tk => keyword.toLowerCase().includes(tk.toLowerCase()))
      )) {
        // Try to find existing theme
        const existingTheme = existingThemes.rows.find(theme =>
          theme.name.toLowerCase().includes(themeType.split(' ')[0]) ||
          theme.description.toLowerCase().includes(themeType)
        );
        
        if (existingTheme) {
          matchingThemes.add(existingTheme.id);
        }
      }
    }

    // Also check research area for theme matches
    if (researchArea && researchArea !== 'Entrepreneurship and Innovation') {
      const areaTheme = existingThemes.rows.find(theme =>
        theme.name.toLowerCase().includes(researchArea.toLowerCase()) ||
        theme.description.toLowerCase().includes(researchArea.toLowerCase())
      );
      
      if (areaTheme) {
        matchingThemes.add(areaTheme.id);
      }
    }

    // Return found themes, or default if none found
    const themeIdsArray = Array.from(matchingThemes);
    if (themeIdsArray.length > 0) {
      return themeIdsArray;
    }

    // Get default theme if no matches
    const defaultTheme = await sql`SELECT id FROM themes ORDER BY id LIMIT 1`;
    return defaultTheme.rows.length > 0 ? [defaultTheme.rows[0].id] : [1];
    
  } catch (error) {
    console.error('Multi-theme assignment error:', error);
    return [1]; // Default theme array
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
    themes: paper.themes || [],
    // Legacy fields for backward compatibility
    themeId: paper.themes && paper.themes.length > 0 ? paper.themes[0].id : paper.theme_id,
    themeName: paper.themes && paper.themes.length > 0 ? paper.themes[0].name : null,
    themeColor: paper.themes && paper.themes.length > 0 ? paper.themes[0].color : null,
    doi: paper.doi,
    link: paper.link,
    volume: paper.volume,
    issue: paper.issue,
    pageStart: paper.page_start,
    pageEnd: paper.page_end,
    type: paper.type || 'other'
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