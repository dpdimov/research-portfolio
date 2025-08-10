import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('Starting theme consolidation...');

    // Define the target broad themes we want
    const targetThemes = [
      {
        name: 'Venture Capital & Funding',
        description: 'Research on venture capital, funding, investment decisions, and entrepreneurial finance',
        keywords: ['venture capital', 'funding', 'investment', 'financing', 'angel', 'investor', 'capital', 'finance']
      },
      {
        name: 'Entrepreneurial Cognition',
        description: 'Research on entrepreneurial thinking, decision-making, psychology, and cognitive processes',
        keywords: ['cognition', 'cognitive', 'psychology', 'thinking', 'perception', 'bias', 'heuristic', 'decision', 'judgment']
      },
      {
        name: 'Innovation Management',
        description: 'Research on innovation processes, creativity, product development, and R&D management',
        keywords: ['innovation', 'creativity', 'idea', 'product development', 'r&d', 'development', 'creative']
      },
      {
        name: 'New Venture Creation',
        description: 'Research on startup formation, new venture processes, and entrepreneurial ventures',
        keywords: ['startup', 'new venture', 'venture creation', 'business formation', 'entrepreneurial process', 'venture design']
      },
      {
        name: 'Entrepreneurial Networks',
        description: 'Research on entrepreneurial networks, social capital, and business relationships',
        keywords: ['network', 'social capital', 'ties', 'relationship', 'collaboration', 'networking']
      },
      {
        name: 'International Entrepreneurship',
        description: 'Research on cross-border entrepreneurship, global ventures, and international business',
        keywords: ['international', 'cross-border', 'global', 'emerging market', 'developing country']
      },
      {
        name: 'Technology Entrepreneurship',
        description: 'Research on technology ventures, high-tech startups, and digital entrepreneurship',
        keywords: ['technology', 'high-tech', 'biotechnology', 'digital', 'tech']
      },
      {
        name: 'Entrepreneurship and Innovation',
        description: 'General entrepreneurship and innovation research not fitting other categories',
        keywords: ['entrepreneurship', 'innovation', 'general', 'business']
      }
    ];

    // Get all existing themes and papers
    const existingThemes = await sql`SELECT * FROM themes ORDER BY id`;
    const allPapers = await sql`SELECT id, title, keywords, theme_id FROM papers`;

    console.log(`Found ${existingThemes.rows.length} existing themes and ${allPapers.rows.length} papers`);

    // Create mapping from old themes to new themes
    const themeMapping = new Map();

    // First, create or find the target themes
    for (const targetTheme of targetThemes) {
      let existingTargetTheme = existingThemes.rows.find(theme => 
        theme.name.toLowerCase() === targetTheme.name.toLowerCase()
      );

      if (!existingTargetTheme) {
        // Create the target theme
        const result = await sql`
          INSERT INTO themes (name, description, color)
          VALUES (
            ${targetTheme.name},
            ${targetTheme.description},
            ${'bg-blue-100 text-blue-800'}
          )
          RETURNING *
        `;
        existingTargetTheme = result.rows[0];
        console.log(`Created new theme: ${targetTheme.name}`);
      }

      // Map old themes to this target theme
      for (const oldTheme of existingThemes.rows) {
        if (oldTheme.id === existingTargetTheme.id) continue; // Skip self

        // Check if old theme should map to this target theme
        const shouldMap = targetTheme.keywords.some(keyword =>
          oldTheme.name.toLowerCase().includes(keyword) ||
          oldTheme.description.toLowerCase().includes(keyword)
        );

        if (shouldMap) {
          themeMapping.set(oldTheme.id, existingTargetTheme.id);
          console.log(`Mapping "${oldTheme.name}" to "${targetTheme.name}"`);
        }
      }
    }

    // Default theme for unmapped themes
    const defaultTheme = existingThemes.rows.find(theme => 
      theme.name === 'Entrepreneurship and Innovation'
    ) || targetThemes.find(theme => theme.name === 'Entrepreneurship and Innovation');

    // Update papers with new theme assignments
    let updatedCount = 0;
    for (const paper of allPapers.rows) {
      const newThemeId = themeMapping.get(paper.theme_id) || defaultTheme.id;
      
      if (newThemeId !== paper.theme_id) {
        await sql`
          UPDATE papers 
          SET theme_id = ${newThemeId}
          WHERE id = ${paper.id}
        `;
        updatedCount++;
      }
    }

    // Delete unused themes (keep only target themes)
    const targetThemeIds = targetThemes.map(t => 
      existingThemes.rows.find(et => et.name.toLowerCase() === t.name.toLowerCase())?.id
    ).filter(Boolean);

    const deleteResult = await sql`
      DELETE FROM themes 
      WHERE id NOT IN (${targetThemeIds.join(',')})
    `;

    console.log(`Updated ${updatedCount} papers and deleted ${deleteResult.rowCount} unused themes`);

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
      message: `Theme consolidation completed! Consolidated ${existingThemes.rows.length} themes into ${finalThemes.rows.length} themes. Updated ${updatedCount} papers.`,
      data: {
        papers: finalPapers.rows.map(formatPaperForClient),
        themes: finalThemes.rows.map(formatThemeForClient)
      },
      stats: {
        originalThemeCount: existingThemes.rows.length,
        finalThemeCount: finalThemes.rows.length,
        updatedPapers: updatedCount
      }
    });

  } catch (error) {
    console.error('Theme consolidation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to consolidate themes: ' + error.message
    }, { status: 500 });
  }
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