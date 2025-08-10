import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('Fixing double-nested arrays in database...');
    
    // Get all papers
    const papers = await sql`SELECT id, authors, keywords FROM papers`;
    
    let fixedCount = 0;
    
    for (const paper of papers.rows) {
      let authorsNeedFix = false;
      let keywordsNeedFix = false;
      let fixedAuthors = paper.authors;
      let fixedKeywords = paper.keywords;
      
      // Fix authors if they're double-nested
      try {
        const parsedAuthors = JSON.parse(paper.authors);
        if (Array.isArray(parsedAuthors) && parsedAuthors.length > 0 && Array.isArray(parsedAuthors[0])) {
          fixedAuthors = JSON.stringify(parsedAuthors[0]);
          authorsNeedFix = true;
        }
      } catch {
        // Skip if can't parse
      }
      
      // Fix keywords if they're double-nested
      try {
        const parsedKeywords = JSON.parse(paper.keywords);
        if (Array.isArray(parsedKeywords) && parsedKeywords.length > 0 && Array.isArray(parsedKeywords[0])) {
          fixedKeywords = JSON.stringify(parsedKeywords[0]);
          keywordsNeedFix = true;
        }
      } catch {
        // Skip if can't parse
      }
      
      // Update if needed
      if (authorsNeedFix || keywordsNeedFix) {
        await sql`
          UPDATE papers 
          SET authors = ${fixedAuthors}, keywords = ${fixedKeywords}
          WHERE id = ${paper.id}
        `;
        fixedCount++;
      }
    }
    
    console.log(`Fixed ${fixedCount} papers with double-nested arrays`);
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} papers with double-nested arrays`
    });

  } catch (error) {
    console.error('Error fixing arrays:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fix arrays: ' + error.message
    }, { status: 500 });
  }
}