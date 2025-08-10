import { Dropbox } from 'dropbox';
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

// Configure Dropbox to use node-fetch
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = fetch;
}

export async function POST(request) {
  try {
    const { paperTitle, paperYear, paperAuthors } = await request.json();
    
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

    console.log(`Looking for PDF for paper: ${paperTitle} (${paperYear})`);

    // List all PDF files in Dropbox
    const response = await dbx.filesListFolder({
      path: '', // App folder root
      recursive: true
    });

    const pdfFiles = response.result.entries.filter(
      entry => entry['.tag'] === 'file' && entry.name.toLowerCase().endsWith('.pdf')
    );

    console.log(`Found ${pdfFiles.length} PDF files in Dropbox`);

    // Try to match the paper to a PDF file using different strategies
    let matchedFile = null;
    let matchScore = 0;

    for (const file of pdfFiles) {
      const filename = file.name.toLowerCase();
      const score = calculateMatchScore(filename, paperTitle, paperYear, paperAuthors);
      
      if (score > matchScore) {
        matchScore = score;
        matchedFile = file;
      }
    }

    if (matchedFile && matchScore > 2) {
      // Create a temporary download link
      try {
        const downloadResponse = await dbx.filesGetTemporaryLink({
          path: matchedFile.path_lower
        });

        console.log(`Found matching PDF: ${matchedFile.name} (score: ${matchScore})`);
        
        return NextResponse.json({
          success: true,
          downloadUrl: downloadResponse.result.link,
          filename: matchedFile.name,
          matchScore
        });

      } catch (linkError) {
        console.error('Error creating download link:', linkError);
        return NextResponse.json({
          success: false,
          error: 'Could not create download link'
        }, { status: 500 });
      }
    } else {
      // No good match found
      console.log(`No matching PDF found for: ${paperTitle} (best score: ${matchScore})`);
      return NextResponse.json({
        success: false,
        error: 'PDF not found in Dropbox',
        availableFiles: pdfFiles.map(f => f.name).slice(0, 5) // Return first 5 filenames for debugging
      }, { status: 404 });
    }

  } catch (error) {
    console.error('PDF link generation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get PDF link: ' + error.message
    }, { status: 500 });
  }
}

function calculateMatchScore(filename, paperTitle, paperYear, paperAuthors) {
  let score = 0;
  
  // Remove file extension and clean filename  
  const cleanFilename = filename.replace('.pdf', '').toLowerCase();
  const cleanTitle = paperTitle.toLowerCase();
  
  // Check for conventional filename patterns first
  const year = paperYear.toString();
  const firstAuthor = paperAuthors && paperAuthors.length > 0 ? 
    paperAuthors[0].split(',')[0].trim().toLowerCase() : '';
  
  // Pattern 1: Author-Year-Title (e.g., "Dimov-2020-Opportunity")
  if (firstAuthor && cleanFilename.includes(firstAuthor) && cleanFilename.includes(year)) {
    score += 15; // High score for conventional naming
  }
  
  // Pattern 2: Year-Author-Title (e.g., "2020-Dimov-Opportunity") 
  if (cleanFilename.startsWith(year) && firstAuthor && cleanFilename.includes(firstAuthor)) {
    score += 15;
  }
  
  // Pattern 3: Year-Title (e.g., "2020-Opportunity-Recognition")
  if (cleanFilename.startsWith(year)) {
    score += 10;
  }
  
  // Year matching (always important)
  if (cleanFilename.includes(year)) {
    score += 8;
  }
  
  // Author surname matching
  if (firstAuthor && cleanFilename.includes(firstAuthor)) {
    score += 5;
  }
  
  // Title word matching (key words from title)
  const titleWords = cleanTitle
    .replace(/[^\w\s]/g, ' ')
    .split(' ')
    .filter(word => word.length > 3 && 
      !['the', 'and', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'that', 'this'].includes(word)
    );
  
  let titleMatches = 0;
  for (const word of titleWords) {
    if (cleanFilename.includes(word.toLowerCase())) {
      titleMatches++;
      score += 2;
    }
  }
  
  // Bonus for multiple title word matches
  if (titleMatches >= 2) {
    score += titleMatches * 2;
  }
  
  // Penalty for very different lengths (likely wrong match)
  const lengthDiff = Math.abs(cleanFilename.length - cleanTitle.length);
  if (lengthDiff > cleanTitle.length * 2) {
    score -= 3;
  }
  
  console.log(`Matching "${filename}" against "${paperTitle}" (${year}): score = ${score}`);
  
  return score;
}