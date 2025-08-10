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

    // Get all PDF files from Dropbox
    const response = await dbx.filesListFolder({
      path: '', // App folder root
      recursive: true
    });

    const pdfFiles = response.result.entries.filter(
      entry => entry['.tag'] === 'file' && entry.name.toLowerCase().endsWith('.pdf')
    );

    // Get all papers from database
    const papers = await sql`
      SELECT id, title, authors, year, venue, dropbox_path, dropbox_file_id
      FROM papers 
      ORDER BY year DESC, title ASC
    `;

    // Create suggestions for renaming
    const suggestions = [];

    for (const paper of papers.rows) {
      const authors = typeof paper.authors === 'string' ? JSON.parse(paper.authors) : paper.authors;
      const firstAuthor = authors && authors.length > 0 ? authors[0].split(',')[0].trim() : 'Unknown';
      
      // Clean title - get first few meaningful words
      const titleWords = paper.title
        .replace(/[^\w\s]/g, ' ')
        .split(' ')
        .filter(word => word.length > 2 && !['the', 'and', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by'].includes(word.toLowerCase()))
        .slice(0, 3);

      const titlePart = titleWords.map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join('-');

      // Suggest multiple filename formats
      const suggestedNames = [
        `${firstAuthor}-${paper.year}-${titlePart}.pdf`,
        `${paper.year}-${firstAuthor}-${titlePart}.pdf`,
        `${paper.year}-${titlePart}.pdf`
      ];

      // Try to find current file match
      let currentFile = null;
      if (paper.dropbox_path) {
        currentFile = pdfFiles.find(f => f.path_lower === paper.dropbox_path.toLowerCase());
      }
      
      // If no current match, try basic matching
      if (!currentFile) {
        currentFile = findBestMatch(pdfFiles, paper.title, paper.year, firstAuthor);
      }

      suggestions.push({
        paperId: paper.id,
        paperTitle: paper.title,
        paperYear: paper.year,
        paperAuthors: authors,
        currentFile: currentFile ? {
          name: currentFile.name,
          path: currentFile.path_lower,
          id: currentFile.id
        } : null,
        suggestedNames,
        recommendedName: suggestedNames[0] // Default to first option
      });
    }

    // Also include unmatched PDF files
    const matchedFileIds = suggestions
      .map(s => s.currentFile?.id)
      .filter(id => id);

    const unmatchedFiles = pdfFiles
      .filter(file => !matchedFileIds.includes(file.id))
      .map(file => ({
        name: file.name,
        path: file.path_lower,
        id: file.id
      }));

    return NextResponse.json({
      success: true,
      suggestions,
      unmatchedFiles,
      totalPapers: papers.rows.length,
      totalPdfFiles: pdfFiles.length,
      conventions: [
        {
          name: "Author-Year-Title",
          example: "Dimov-2020-Opportunity-Recognition.pdf",
          description: "Most common academic convention"
        },
        {
          name: "Year-Author-Title", 
          example: "2020-Dimov-Opportunity-Recognition.pdf",
          description: "Good for chronological sorting"
        },
        {
          name: "Year-Title",
          example: "2020-Opportunity-Recognition-Entrepreneurship.pdf", 
          description: "Simple, focuses on content and date"
        }
      ]
    });

  } catch (error) {
    console.error('Filename suggestion error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate suggestions: ' + error.message
    }, { status: 500 });
  }
}

function findBestMatch(pdfFiles, paperTitle, paperYear, firstAuthor) {
  let bestMatch = null;
  let bestScore = 0;

  for (const file of pdfFiles) {
    const filename = file.name.toLowerCase();
    let score = 0;
    
    // Year matching
    if (filename.includes(paperYear.toString())) {
      score += 5;
    }
    
    // Author matching
    if (firstAuthor && filename.includes(firstAuthor.toLowerCase())) {
      score += 3;
    }
    
    // Title word matching
    const titleWords = paperTitle.toLowerCase().split(' ').filter(word => word.length > 3);
    for (const word of titleWords) {
      if (filename.includes(word)) {
        score += 1;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = file;
    }
  }
  
  return bestScore > 3 ? bestMatch : null;
}