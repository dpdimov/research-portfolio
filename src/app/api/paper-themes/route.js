import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// Add themes to a paper
export async function POST(request) {
  try {
    const { paperId, themeIds } = await request.json();
    
    if (!paperId || !Array.isArray(themeIds)) {
      return NextResponse.json({
        success: false,
        error: 'Paper ID and theme IDs array are required'
      }, { status: 400 });
    }

    console.log(`Adding themes ${themeIds.join(', ')} to paper ${paperId}`);

    // Clear existing themes for this paper
    await sql`DELETE FROM paper_themes WHERE paper_id = ${paperId}`;

    // Add new theme associations
    for (const themeId of themeIds) {
      await sql`
        INSERT INTO paper_themes (paper_id, theme_id)
        VALUES (${paperId}, ${themeId})
        ON CONFLICT (paper_id, theme_id) DO NOTHING
      `;
    }

    return NextResponse.json({
      success: true,
      message: `Updated themes for paper ${paperId}`
    });

  } catch (error) {
    console.error('Paper themes update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update paper themes: ' + error.message
    }, { status: 500 });
  }
}

// Get themes for a specific paper
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const paperId = url.searchParams.get('paperId');
    
    if (!paperId) {
      return NextResponse.json({
        success: false,
        error: 'Paper ID is required'
      }, { status: 400 });
    }

    const paperThemes = await sql`
      SELECT t.id, t.name, t.color, t.description
      FROM paper_themes pt
      JOIN themes t ON pt.theme_id = t.id
      WHERE pt.paper_id = ${paperId}
      ORDER BY t.name
    `;

    return NextResponse.json({
      success: true,
      themes: paperThemes.rows
    });

  } catch (error) {
    console.error('Get paper themes error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get paper themes: ' + error.message
    }, { status: 500 });
  }
}

// Remove a theme from a paper
export async function DELETE(request) {
  try {
    const { paperId, themeId } = await request.json();
    
    if (!paperId || !themeId) {
      return NextResponse.json({
        success: false,
        error: 'Paper ID and theme ID are required'
      }, { status: 400 });
    }

    await sql`
      DELETE FROM paper_themes 
      WHERE paper_id = ${paperId} AND theme_id = ${themeId}
    `;

    return NextResponse.json({
      success: true,
      message: `Removed theme ${themeId} from paper ${paperId}`
    });

  } catch (error) {
    console.error('Remove paper theme error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to remove paper theme: ' + error.message
    }, { status: 500 });
  }
}