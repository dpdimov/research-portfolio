import { Dropbox } from 'dropbox';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

// Configure Dropbox to use node-fetch
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = fetch;
}

export async function GET() {
  try {
    console.log('Checking for new papers in Dropbox...');
    
    if (!process.env.DROPBOX_ACCESS_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'Dropbox access token not configured'
      }, { status: 500 });
    }

    // Initialize Dropbox client
    const dbx = new Dropbox({ 
      accessToken: process.env.DROPBOX_ACCESS_TOKEN,
      fetch: fetch
    });

    // List files in Dropbox
    const response = await dbx.filesListFolder({
      path: '', 
      recursive: true
    });

    const pdfFiles = response.result.entries.filter(
      entry => entry['.tag'] === 'file' && entry.name.toLowerCase().endsWith('.pdf')
    );

    console.log(`Found ${pdfFiles.length} PDF files in Dropbox`);

    // Check which files are already in database
    const existingPapers = await sql`
      SELECT dropbox_file_id FROM papers WHERE dropbox_file_id IS NOT NULL
    `;
    
    const existingFileIds = new Set(existingPapers.rows.map(p => p.dropbox_file_id));
    const newFiles = pdfFiles.filter(file => !existingFileIds.has(file.id));

    console.log(`Found ${newFiles.length} new papers not yet in database`);

    return NextResponse.json({
      success: true,
      totalDropboxFiles: pdfFiles.length,
      existingInDatabase: existingFileIds.size,
      newFiles: newFiles.length,
      newFileNames: newFiles.map(f => f.name),
      needsSync: newFiles.length > 0
    });

  } catch (error) {
    console.error('Error checking for new papers:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check for new papers: ' + error.message
    }, { status: 500 });
  }
}