import { Dropbox } from 'dropbox';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

// Configure Dropbox to use node-fetch
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = fetch;
}

export async function POST(request) {
  try {
    const { oldPath, newName, paperId } = await request.json();

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

    // Ensure new name ends with .pdf
    const cleanNewName = newName.endsWith('.pdf') ? newName : newName + '.pdf';
    const newPath = '/' + cleanNewName;

    console.log(`Renaming: ${oldPath} -> ${newPath}`);

    try {
      // Rename the file in Dropbox
      const moveResponse = await dbx.filesMoveV2({
        from_path: oldPath,
        to_path: newPath
      });

      console.log('File renamed successfully:', moveResponse.result.metadata.path_lower);

      // Update the database with the new path
      if (paperId) {
        await sql`
          UPDATE papers 
          SET dropbox_path = ${moveResponse.result.metadata.path_lower},
              dropbox_file_id = ${moveResponse.result.metadata.id}
          WHERE id = ${paperId}
        `;
        console.log(`Updated paper ${paperId} with new path`);
      }

      return NextResponse.json({
        success: true,
        oldPath,
        newPath: moveResponse.result.metadata.path_lower,
        message: `File renamed to ${cleanNewName}`
      });

    } catch (dropboxError) {
      console.error('Dropbox rename error:', dropboxError);
      
      if (dropboxError.status === 409) {
        return NextResponse.json({
          success: false,
          error: `A file named "${cleanNewName}" already exists. Please choose a different name.`
        }, { status: 409 });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Failed to rename file in Dropbox: ' + dropboxError.message
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Rename PDF error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to rename PDF: ' + error.message
    }, { status: 500 });
  }
}