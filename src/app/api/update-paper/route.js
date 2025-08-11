import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { paperId, updates } = await request.json();

    if (!paperId) {
      return NextResponse.json({
        success: false,
        error: 'Paper ID is required'
      }, { status: 400 });
    }

    console.log(`Updating paper ${paperId} with:`, updates);

    // Build dynamic update query based on provided fields
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    // Handle each possible field update
    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramIndex++}`);
      updateValues.push(updates.title);
    }

    if (updates.authors !== undefined) {
      updateFields.push(`authors = $${paramIndex++}`);
      updateValues.push(JSON.stringify(updates.authors));
    }

    if (updates.year !== undefined) {
      updateFields.push(`year = $${paramIndex++}`);
      updateValues.push(parseInt(updates.year));
    }

    if (updates.venue !== undefined) {
      updateFields.push(`venue = $${paramIndex++}`);
      updateValues.push(updates.venue);
    }

    if (updates.abstract !== undefined) {
      updateFields.push(`full_text = $${paramIndex++}`);
      updateValues.push(updates.abstract);
    }

    if (updates.keywords !== undefined) {
      updateFields.push(`keywords = $${paramIndex++}`);
      updateValues.push(JSON.stringify(updates.keywords));
    }

    if (updates.doi !== undefined) {
      updateFields.push(`doi = $${paramIndex++}`);
      updateValues.push(updates.doi || null);
    }

    if (updates.link !== undefined) {
      updateFields.push(`link = $${paramIndex++}`);
      updateValues.push(updates.link || null);
    }

    if (updates.volume !== undefined) {
      updateFields.push(`volume = $${paramIndex++}`);
      updateValues.push(updates.volume || null);
    }

    if (updates.issue !== undefined) {
      updateFields.push(`issue = $${paramIndex++}`);
      updateValues.push(updates.issue || null);
    }

    if (updates.pageStart !== undefined) {
      updateFields.push(`page_start = $${paramIndex++}`);
      updateValues.push(updates.pageStart || null);
    }

    if (updates.pageEnd !== undefined) {
      updateFields.push(`page_end = $${paramIndex++}`);
      updateValues.push(updates.pageEnd || null);
    }

    if (updates.type !== undefined) {
      // Validate type value
      const validTypes = ['book', 'article', 'chapter', 'report', 'other'];
      const type = validTypes.includes(updates.type) ? updates.type : 'other';
      updateFields.push(`type = $${paramIndex++}`);
      updateValues.push(type);
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid fields to update'
      }, { status: 400 });
    }

    // Add updated timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Build and execute the update query
    const query = `
      UPDATE papers 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    updateValues.push(paperId);

    console.log('Executing query:', query);
    console.log('With values:', updateValues);

    const result = await sql.query(query, updateValues);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Paper not found'
      }, { status: 404 });
    }

    // Get updated paper with theme information
    const updatedPaper = await sql`
      SELECT p.*, t.name as theme_name, t.color as theme_color
      FROM papers p
      LEFT JOIN themes t ON p.theme_id = t.id
      WHERE p.id = ${paperId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Paper updated successfully',
      paper: formatPaperForClient(updatedPaper.rows[0])
    });

  } catch (error) {
    console.error('Paper update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update paper: ' + error.message
    }, { status: 500 });
  }
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
    themeId: paper.theme_id,
    doi: paper.doi,
    link: paper.link,
    volume: paper.volume,
    issue: paper.issue,
    pageStart: paper.page_start,
    pageEnd: paper.page_end,
    type: paper.type || 'other',
    themeName: paper.theme_name,
    themeColor: paper.theme_color
  };
}