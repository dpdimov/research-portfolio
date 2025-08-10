import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Fetching papers from database...');
    
    // Fetch all current data to return
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

    console.log(`Found ${allPapers.rows.length} papers and ${allThemes.rows.length} themes`);

    return NextResponse.json({
      success: true,
      data: {
        papers: allPapers.rows.map(formatPaperForClient),
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