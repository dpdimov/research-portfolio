import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Fetching papers from database...');
    
    // Fetch all papers with their associated themes
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

    console.log(`Found ${papersWithThemes.length} papers and ${allThemes.rows.length} themes`);

    return NextResponse.json({
      success: true,
      data: {
        papers: papersWithThemes.map(formatPaperForClient),
        themes: allThemes.rows.map(formatThemeForClient)
      }
    });

  } catch (error) {
    console.error('Error fetching papers:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch papers: ' + error.message
    }, { status: 500 });
  }
}

function formatPaperForClient(paper) {
  // PostgreSQL JSONB returns already parsed data, so no need to JSON.parse
  let authors = paper.authors;
  let keywords = paper.keywords;
  
  // Ensure authors is an array
  if (!Array.isArray(authors)) {
    authors = authors ? [authors] : ['Unknown Author'];
  }
  
  // Ensure keywords is an array
  if (!Array.isArray(keywords)) {
    keywords = keywords ? [keywords] : ['research'];
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