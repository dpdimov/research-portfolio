import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const paperData = await request.json();
    
    console.log('Adding new paper:', paperData.title);

    // Validate required fields
    if (!paperData.title || !paperData.authors || !paperData.venue) {
      return NextResponse.json({
        success: false,
        error: 'Title, authors, and venue are required fields'
      }, { status: 400 });
    }

    // Parse authors array
    let authorsArray = [];
    if (paperData.authors) {
      authorsArray = paperData.authors.split(';').map(author => 
        author.trim()
      ).filter(author => author.length > 0);
    }

    // Parse keywords array
    let keywordsArray = [];
    if (paperData.keywords) {
      keywordsArray = paperData.keywords.split(';').map(k => k.trim()).filter(k => k);
    }

    // Use provided summary/abstract or create a placeholder
    const summary = paperData.abstract || 'No abstract provided';

    // Get suitable themes based on keywords - now supports multiple themes
    const defaultTheme = await sql`SELECT id FROM themes ORDER BY id LIMIT 1`;
    let themeIds = [defaultTheme.rows.length > 0 ? defaultTheme.rows[0].id : 1];

    // Try to find multiple suitable themes based on keywords
    if (keywordsArray.length > 0) {
      themeIds = await assignMultipleThemesBasedOnKeywords(keywordsArray, themeIds[0]);
    }

    // Validate type
    const validTypes = ['book', 'article', 'chapter', 'report', 'other'];
    const type = validTypes.includes(paperData.type) ? paperData.type : 'other';

    // Insert the new paper (keeping theme_id for backward compatibility)
    const result = await sql`
      INSERT INTO papers (
        title, authors, year, venue, summary, keywords, theme_id,
        doi, link, volume, issue, page_start, page_end, full_text, type
      ) VALUES (
        ${paperData.title},
        ${JSON.stringify(authorsArray)},
        ${parseInt(paperData.year) || new Date().getFullYear()},
        ${paperData.venue},
        ${summary},
        ${JSON.stringify(keywordsArray)},
        ${themeIds[0]}, 
        ${paperData.doi || null},
        ${paperData.link || null},
        ${paperData.volume || null},
        ${paperData.issue || null},
        ${paperData.pageStart || null},
        ${paperData.pageEnd || null},
        ${paperData.abstract || null},
        ${type}
      )
      RETURNING *
    `;

    const newPaper = result.rows[0];

    // Add theme associations to junction table
    for (const themeId of themeIds) {
      await sql`
        INSERT INTO paper_themes (paper_id, theme_id)
        VALUES (${newPaper.id}, ${themeId})
        ON CONFLICT (paper_id, theme_id) DO NOTHING
      `;
    }

    // Get the paper with all its themes
    const paperThemes = await sql`
      SELECT t.id, t.name, t.color, t.description
      FROM paper_themes pt
      JOIN themes t ON pt.theme_id = t.id
      WHERE pt.paper_id = ${newPaper.id}
      ORDER BY t.name
    `;

    const paperWithThemes = {
      ...newPaper,
      themes: paperThemes.rows
    };

    // Return success with the formatted paper data
    return NextResponse.json({
      success: true,
      message: 'Paper added successfully',
      paper: formatPaperForClient(paperWithThemes)
    });

  } catch (error) {
    console.error('Add paper error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to add paper: ' + error.message
    }, { status: 500 });
  }
}

async function assignMultipleThemesBasedOnKeywords(keywords, defaultThemeId) {
  // Enhanced theme assignment that can return multiple themes
  const foundThemeIds = new Set();
  
  const keywordThemes = {
    'venture capital': ['venture capital', 'funding', 'investment', 'financing'],
    'entrepreneurial cognition': ['cognition', 'cognitive', 'psychology', 'thinking'],
    'innovation management': ['innovation', 'creativity', 'idea', 'product development'],
    'new venture creation': ['startup', 'new venture', 'venture creation', 'business formation'],
    'entrepreneurial networks': ['network', 'social capital', 'ties', 'relationship'],
    'international entrepreneurship': ['international', 'cross-border', 'global'],
    'technology entrepreneurship': ['technology', 'high-tech', 'biotechnology', 'digital'],
    'design': ['design', 'user experience', 'product design', 'interface'],
    'education': ['education', 'teaching', 'learning', 'curriculum', 'pedagogy'],
    'strategy': ['strategy', 'strategic', 'planning', 'competitive advantage'],
    'marketing': ['marketing', 'branding', 'advertising', 'promotion'],
    'finance': ['finance', 'financial', 'investment', 'capital']
  };

  // Check all themes that match the keywords
  for (const [themeType, themeKeywords] of Object.entries(keywordThemes)) {
    if (keywords.some(keyword => 
      themeKeywords.some(tk => keyword.toLowerCase().includes(tk.toLowerCase()))
    )) {
      // Try to find existing theme
      const existingTheme = await sql`
        SELECT id FROM themes 
        WHERE LOWER(name) LIKE ${`%${themeType.split(' ')[0]}%`}
        LIMIT 1
      `;
      
      if (existingTheme.rows.length > 0) {
        foundThemeIds.add(existingTheme.rows[0].id);
      }
    }
  }

  // Return found themes, or default if none found
  const themeIdsArray = Array.from(foundThemeIds);
  return themeIdsArray.length > 0 ? themeIdsArray : [defaultThemeId];
}

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
    themes: paper.themes || [],
    // Legacy fields for backward compatibility
    themeId: paper.themes && paper.themes.length > 0 ? paper.themes[0].id : null,
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