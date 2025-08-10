import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { paperId, dropboxPath, dropboxFileId } = await request.json();

    if (!paperId) {
      return NextResponse.json({
        success: false,
        error: 'Paper ID is required'
      }, { status: 400 });
    }

    // Update the paper with Dropbox file information
    await sql`
      UPDATE papers 
      SET dropbox_path = ${dropboxPath || null}, 
          dropbox_file_id = ${dropboxFileId || null}
      WHERE id = ${paperId}
    `;

    console.log(`Linked paper ${paperId} to Dropbox file: ${dropboxPath}`);

    return NextResponse.json({
      success: true,
      message: 'Paper linked to PDF successfully'
    });

  } catch (error) {
    console.error('Link PDF error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to link PDF: ' + error.message
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get papers without linked PDFs
    const unlinkedPapers = await sql`
      SELECT id, title, authors, year, dropbox_path, dropbox_file_id
      FROM papers 
      WHERE dropbox_path IS NULL OR dropbox_path = ''
      ORDER BY year DESC, title ASC
      LIMIT 20
    `;

    return NextResponse.json({
      success: true,
      papers: unlinkedPapers.rows.map(paper => ({
        id: paper.id,
        title: paper.title,
        authors: typeof paper.authors === 'string' ? JSON.parse(paper.authors) : paper.authors,
        year: paper.year,
        dropboxPath: paper.dropbox_path,
        dropboxFileId: paper.dropbox_file_id
      }))
    });

  } catch (error) {
    console.error('Get unlinked papers error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get unlinked papers: ' + error.message
    }, { status: 500 });
  }
}