import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('Starting theme consolidation v2...');

    // Clear all existing themes and recreate with the 8 target themes
    await sql`DELETE FROM themes`;

    // Create the 8 target themes
    const targetThemes = [
      { name: 'Entrepreneurial Opportunities', color: 'bg-blue-100 text-blue-800' },
      { name: 'Venture Capital', color: 'bg-green-100 text-green-800' },
      { name: 'Corporate Entrepreneurship and Innovation', color: 'bg-purple-100 text-purple-800' },
      { name: 'Entrepreneurial Thinking and Action', color: 'bg-orange-100 text-orange-800' },
      { name: 'Entrepreneurship as Design', color: 'bg-red-100 text-red-800' },
      { name: 'Entrepreneurship Education', color: 'bg-indigo-100 text-indigo-800' },
      { name: 'Philosophy of Entrepreneurship', color: 'bg-yellow-100 text-yellow-800' },
      { name: 'Entrepreneurial Process', color: 'bg-pink-100 text-pink-800' }
    ];

    // Insert the target themes
    const createdThemes = [];
    for (let i = 0; i < targetThemes.length; i++) {
      const theme = targetThemes[i];
      const result = await sql`
        INSERT INTO themes (name, description, color)
        VALUES (
          ${theme.name},
          ${`Research focusing on ${theme.name.toLowerCase()}`},
          ${theme.color}
        )
        RETURNING *
      `;
      createdThemes.push(result.rows[0]);
      console.log(`Created theme: ${theme.name} with ID: ${result.rows[0].id}`);
    }

    // Get all papers with their keywords
    const allPapers = await sql`SELECT id, title, keywords, summary FROM papers`;
    console.log(`Processing ${allPapers.rows.length} papers...`);

    let updateCount = 0;

    // Assign each paper to the most appropriate theme based on keywords and content
    for (const paper of allPapers.rows) {
      const themeId = assignPaperToTheme(paper, createdThemes);
      
      await sql`
        UPDATE papers 
        SET theme_id = ${themeId}
        WHERE id = ${paper.id}
      `;
      updateCount++;
    }

    console.log(`Updated ${updateCount} papers with new theme assignments`);

    // Get final data
    const finalPapers = await sql`
      SELECT p.*, t.name as theme_name, t.color as theme_color
      FROM papers p
      LEFT JOIN themes t ON p.theme_id = t.id
      ORDER BY p.year DESC, p.title ASC
    `;

    const finalThemes = await sql`
      SELECT t.*, COUNT(p.id) as paper_count
      FROM themes t
      LEFT JOIN papers p ON t.id = p.theme_id
      GROUP BY t.id, t.name, t.description, t.color
      ORDER BY paper_count DESC, t.name ASC
    `;

    return NextResponse.json({
      success: true,
      message: `Theme consolidation completed! Created 8 themes and reassigned ${updateCount} papers.`,
      data: {
        papers: finalPapers.rows.map(formatPaperForClient),
        themes: finalThemes.rows.map(formatThemeForClient)
      },
      stats: {
        themeCount: finalThemes.rows.length,
        updatedPapers: updateCount
      }
    });

  } catch (error) {
    console.error('Theme consolidation v2 error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to consolidate themes: ' + error.message
    }, { status: 500 });
  }
}

function assignPaperToTheme(paper, themes) {
  // Extract keywords and text for analysis
  let keywords = [];
  if (paper.keywords) {
    try {
      keywords = typeof paper.keywords === 'string' ? JSON.parse(paper.keywords) : paper.keywords;
    } catch {
      keywords = [];
    }
  }

  const textToAnalyze = `${paper.title} ${keywords.join(' ')} ${paper.summary || ''}`.toLowerCase();

  // Theme assignment rules based on Dimo's research areas
  
  // Entrepreneurial Opportunities
  if (textToAnalyze.includes('opportunity') || textToAnalyze.includes('opportunities') || 
      textToAnalyze.includes('opportunity recognition') || textToAnalyze.includes('opportunity identification') ||
      textToAnalyze.includes('opportunity evaluation') || textToAnalyze.includes('opportunity creation')) {
    return themes.find(t => t.name === 'Entrepreneurial Opportunities').id;
  }

  // Venture Capital
  if (textToAnalyze.includes('venture capital') || textToAnalyze.includes('vc') || 
      textToAnalyze.includes('funding') || textToAnalyze.includes('investment') ||
      textToAnalyze.includes('financing') || textToAnalyze.includes('angel') || 
      textToAnalyze.includes('investor') || textToAnalyze.includes('capital')) {
    return themes.find(t => t.name === 'Venture Capital').id;
  }

  // Corporate Entrepreneurship and Innovation
  if (textToAnalyze.includes('corporate entrepreneurship') || textToAnalyze.includes('intrapreneurship') ||
      textToAnalyze.includes('corporate innovation') || textToAnalyze.includes('innovation') ||
      textToAnalyze.includes('spin-off') || textToAnalyze.includes('spin off') ||
      textToAnalyze.includes('corporate venture') || textToAnalyze.includes('r&d')) {
    return themes.find(t => t.name === 'Corporate Entrepreneurship and Innovation').id;
  }

  // Entrepreneurial Thinking and Action
  if (textToAnalyze.includes('entrepreneurial thinking') || textToAnalyze.includes('cognition') ||
      textToAnalyze.includes('cognitive') || textToAnalyze.includes('thinking') ||
      textToAnalyze.includes('decision') || textToAnalyze.includes('action') ||
      textToAnalyze.includes('behavior') || textToAnalyze.includes('psychology') ||
      textToAnalyze.includes('mindset') || textToAnalyze.includes('mental')) {
    return themes.find(t => t.name === 'Entrepreneurial Thinking and Action').id;
  }

  // Entrepreneurship as Design
  if (textToAnalyze.includes('design') || textToAnalyze.includes('venture design') ||
      textToAnalyze.includes('business design') || textToAnalyze.includes('design thinking') ||
      textToAnalyze.includes('design science') || textToAnalyze.includes('artifact') ||
      textToAnalyze.includes('designing') || textToAnalyze.includes('design methodology')) {
    return themes.find(t => t.name === 'Entrepreneurship as Design').id;
  }

  // Entrepreneurship Education
  if (textToAnalyze.includes('education') || textToAnalyze.includes('teaching') ||
      textToAnalyze.includes('learning') || textToAnalyze.includes('pedagogy') ||
      textToAnalyze.includes('curriculum') || textToAnalyze.includes('student') ||
      textToAnalyze.includes('classroom') || textToAnalyze.includes('academic') ||
      textToAnalyze.includes('university') || textToAnalyze.includes('business school')) {
    return themes.find(t => t.name === 'Entrepreneurship Education').id;
  }

  // Philosophy of Entrepreneurship
  if (textToAnalyze.includes('philosophy') || textToAnalyze.includes('philosophical') ||
      textToAnalyze.includes('epistemology') || textToAnalyze.includes('ontology') ||
      textToAnalyze.includes('theory') || textToAnalyze.includes('theoretical') ||
      textToAnalyze.includes('conceptual') || textToAnalyze.includes('framework') ||
      textToAnalyze.includes('paradigm') || textToAnalyze.includes('perspective')) {
    return themes.find(t => t.name === 'Philosophy of Entrepreneurship').id;
  }

  // Default to Entrepreneurial Process (catch-all)
  return themes.find(t => t.name === 'Entrepreneurial Process').id;
}

// Formatting functions
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

function formatThemeForClient(theme) {
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    paperCount: parseInt(theme.paper_count) || 0,
    color: theme.color,
    lastUpdated: theme.last_updated
  };
}