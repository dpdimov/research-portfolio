import { Dropbox } from 'dropbox';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

// Configure Dropbox to use node-fetch
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = fetch;
}

// Fallback PDF processing - create basic metadata from filename
const processPDFBasic = async (filename, pdfBuffer) => {
  console.log(`Processing PDF ${filename} - using filename-based analysis`);
  
  // Extract basic info from filename
  const nameWithoutExt = filename.replace(/\.pdf$/i, '');
  const parts = nameWithoutExt.split(/[_\-\s]+/);
  
  // Try to extract year from filename
  const yearMatch = filename.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
  
  // Create basic title from filename
  const title = parts
    .filter(part => part && !part.match(/^\d{4}$/) && part.length > 2)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') || nameWithoutExt;
  
  console.log(`Generated title: ${title}, year: ${year}`);
  
  return {
    title: title,
    extractedText: `PDF file: ${filename}. File size: ${pdfBuffer.length} bytes. Generated from filename analysis.`,
    basicInfo: true // Flag to indicate this is basic processing
  };
};

// Create basic analysis without AI
const createBasicAnalysis = async (pdfProcessResult, filename) => {
  // Extract potential year from filename
  const yearMatch = filename.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
  
  // Generate basic keywords from title
  const titleWords = pdfProcessResult.title.toLowerCase().split(' ');
  const keywords = titleWords.filter(word => word.length > 3 && !['paper', 'research', 'study'].includes(word));
  
  return {
    title: pdfProcessResult.title,
    authors: ['Unknown Author'],
    year: year,
    venue: 'Unknown Venue',
    summary: `Research paper: ${pdfProcessResult.title}. Processed from filename analysis.`,
    keywords: keywords.length > 0 ? keywords : ['research'],
    themeId: 1, // Default theme
    researchArea: 'General Research'
  };
};

export async function POST() {
  try {
    // Check environment variables
    console.log('Environment check:');
    console.log('- DROPBOX_ACCESS_TOKEN:', process.env.DROPBOX_ACCESS_TOKEN ? 'Set' : 'Missing');
    console.log('- ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'Set' : 'Missing');
    console.log('- POSTGRES_URL:', process.env.POSTGRES_URL ? 'Set' : 'Missing');
    console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
    
    if (!process.env.DROPBOX_ACCESS_TOKEN) {
      console.error('DROPBOX_ACCESS_TOKEN is not configured');
      return NextResponse.json({
        success: false,
        error: 'Dropbox access token not configured'
      }, { status: 500 });
    }

    // Test database connection and create tables if needed
    try {
      console.log('Testing database connection...');
      const testResult = await sql`SELECT 1 as test`;
      console.log('Database connection successful:', testResult);

      // Create tables if they don't exist
      console.log('Creating database tables if needed...');
      await sql`
        CREATE TABLE IF NOT EXISTS themes (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          color VARCHAR(100) DEFAULT 'bg-blue-100 text-blue-800',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS papers (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          authors JSONB NOT NULL DEFAULT '[]',
          year INTEGER,
          venue VARCHAR(255),
          summary TEXT,
          keywords JSONB NOT NULL DEFAULT '[]',
          theme_id INTEGER REFERENCES themes(id),
          dropbox_file_id VARCHAR(255) UNIQUE,
          dropbox_path VARCHAR(500),
          full_text TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create indexes
      await sql`CREATE INDEX IF NOT EXISTS idx_papers_theme_id ON papers(theme_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_papers_dropbox_file_id ON papers(dropbox_file_id)`;

      // Insert default theme if none exist
      await sql`
        INSERT INTO themes (name, description, color) 
        SELECT 'General Research', 'General research papers', 'bg-gray-100 text-gray-800'
        WHERE NOT EXISTS (SELECT 1 FROM themes)
      `;

      console.log('Database tables verified/created successfully');
    } catch (dbError) {
      console.error('Database connection/setup failed:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Database connection failed: ' + dbError.message
      }, { status: 500 });
    }

    // Initialize Dropbox client with explicit fetch
    const dbx = new Dropbox({ 
      accessToken: process.env.DROPBOX_ACCESS_TOKEN,
      fetch: fetch
    });

    console.log('Starting Dropbox sync...');

    // List files in your app folder
    let response;
    try {
      response = await dbx.filesListFolder({
        path: '', // Empty path for app folder root
        recursive: true // Include subfolders to catch all files
      });
      console.log(`Found ${response.result.entries.length} total entries in Dropbox`);
    } catch (dropboxError) {
      console.error('Dropbox API error:', dropboxError);
      return NextResponse.json({
        success: false,
        error: 'Failed to access Dropbox: ' + dropboxError.message
      }, { status: 500 });
    }

    const pdfFiles = response.result.entries.filter(
      entry => entry['.tag'] === 'file' && entry.name.toLowerCase().endsWith('.pdf')
    );

    console.log(`Found ${pdfFiles.length} PDF files:`, pdfFiles.map(f => f.name));

    let newPapers = 0;
    let processedPapers = [];
    let skippedFiles = [];
    let errorFiles = [];

    for (const file of pdfFiles) {
      console.log(`Processing file: ${file.name} (${file.id})`);
      try {
        // Check if we've already processed this file
        const existingPaper = await sql`
          SELECT id FROM papers WHERE dropbox_file_id = ${file.id}
        `;

        if (existingPaper.rows.length > 0) {
          console.log(`File ${file.name} already processed, skipping`);
          skippedFiles.push(file.name);
          continue;
        }

        let pdfBuffer;
        try {
          console.log(`Downloading ${file.name}...`);
          const downloadResponse = await dbx.filesDownload({ path: file.path_lower });
          pdfBuffer = downloadResponse.result.fileBinary;
          console.log(`File ${file.name} downloaded, size: ${pdfBuffer?.length || 0} bytes`);
        } catch (downloadError) {
          console.error(`Download failed for ${file.name}:`, downloadError.message);
          errorFiles.push({ name: file.name, error: downloadError.message, step: 'download' });
          continue;
        }

        let pdfProcessResult;
        try {
          console.log(`Processing PDF ${file.name}...`);
          pdfProcessResult = await processPDFBasic(file.name, pdfBuffer);
          console.log(`Processed ${file.name}: ${pdfProcessResult.title}`);
        } catch (parseError) {
          console.error(`PDF processing failed for ${file.name}:`, parseError.message);
          errorFiles.push({ name: file.name, error: parseError.message, step: 'pdf_parse' });
          continue;
        }

        let aiAnalysis;
        try {
          console.log(`Analyzing ${file.name}...`);
          
          if (!process.env.ANTHROPIC_API_KEY) {
            // Create basic analysis without AI
            console.log(`Creating basic analysis for ${file.name} (no AI key)`);
            aiAnalysis = await createBasicAnalysis(pdfProcessResult, file.name);
          } else {
            // Use AI analysis
            aiAnalysis = await analyzeResearchPaper(pdfProcessResult.extractedText, file.name);
          }
          
          console.log(`Analysis completed for ${file.name}`);
        } catch (aiError) {
          console.error(`Analysis failed for ${file.name}:`, aiError.message);
          errorFiles.push({ name: file.name, error: aiError.message, step: 'ai_analysis' });
          continue;
        }

        try {
          console.log(`Storing ${file.name} in database...`);
          
          const paperResult = await sql`
            INSERT INTO papers (
              title, authors, year, venue, summary, keywords, 
              theme_id, dropbox_file_id, dropbox_path, full_text
            ) VALUES (
              ${aiAnalysis.title}, ${JSON.stringify(aiAnalysis.authors)}, 
              ${aiAnalysis.year}, ${aiAnalysis.venue}, ${aiAnalysis.summary},
              ${JSON.stringify(aiAnalysis.keywords)}, ${aiAnalysis.themeId},
              ${file.id}, ${file.path_lower}, ${pdfProcessResult.extractedText.substring(0, 10000)}
            ) RETURNING id
          `;

          processedPapers.push({
            id: paperResult.rows[0].id,
            ...aiAnalysis,
            dropboxFileId: file.id
          });

          newPapers++;
          console.log(`Successfully processed ${file.name}`);
        } catch (dbError) {
          console.error(`Database insert failed for ${file.name}:`, dbError.message);
          errorFiles.push({ name: file.name, error: dbError.message, step: 'database' });
          continue;
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        errorFiles.push({ 
          name: file.name, 
          error: error.message,
          step: 'unknown'
        });
        // Continue with other files
      }
    }

    // Update themes based on new papers
    const updatedThemes = await updateResearchThemes();

    // Fetch all current data to return
    const allPapers = await sql`
      SELECT p.*, t.name as theme_name, t.color as theme_color
      FROM papers p
      LEFT JOIN themes t ON p.theme_id = t.id
      ORDER BY p.year DESC, p.title ASC
    `;

    const allThemes = await sql`
      SELECT t.*, COUNT(p.id) as paper_count
      FROM themes t
      LEFT JOIN papers p ON t.id = p.theme_id
      GROUP BY t.id, t.name, t.description, t.color
      ORDER BY t.name ASC
    `;

    console.log(`Sync completed. New papers: ${newPapers}, Skipped: ${skippedFiles.length}, Errors: ${errorFiles.length}`);

    return NextResponse.json({
      success: true,
      newPapers,
      themesUpdated: updatedThemes.length,
      summary: {
        totalPdfFiles: pdfFiles.length,
        newPapers,
        skippedFiles: skippedFiles.length,
        errorFiles: errorFiles.length,
        skippedFileNames: skippedFiles,
        errorDetails: errorFiles
      },
      data: {
        papers: allPapers.rows.map(formatPaperForClient),
        themes: allThemes.rows.map(formatThemeForClient)
      }
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to sync with Dropbox: ' + error.message
    }, { status: 500 });
  }
}

async function analyzeResearchPaper(text, filename) {
  const prompt = `
    Analyze this research paper and extract the following information as JSON:

    Paper text: "${text.substring(0, 8000)}"

    Please respond with a JSON object containing:
    {
      "title": "extracted or inferred title",
      "authors": ["author1", "author2"],
      "year": 2024,
      "venue": "journal or conference name",
      "summary": "2-3 sentence summary of key contributions",
      "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
      "researchArea": "primary research area (e.g., 'Machine Learning', 'Statistics', 'Biology')"
    }

    Extract accurate information where possible. If something cannot be determined from the text, make reasonable inferences based on the content and filename: "${filename}".

    IMPORTANT: Respond ONLY with valid JSON. Do not include any other text.
  `;

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.ANTHROPIC_API_KEY}`,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response from Claude API');
    }

    let analysisText = data.content[0].text;
    
    // Clean up potential markdown formatting
    analysisText = analysisText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const analysis = JSON.parse(analysisText);
    
    // Ensure authors and keywords are arrays
    if (typeof analysis.authors === 'string') {
      analysis.authors = [analysis.authors];
    }
    if (!Array.isArray(analysis.authors)) {
      analysis.authors = ['Unknown Author'];
    }
    
    if (typeof analysis.keywords === 'string') {
      analysis.keywords = analysis.keywords.split(',').map(k => k.trim());
    }
    if (!Array.isArray(analysis.keywords)) {
      analysis.keywords = ['research'];
    }
    
    // Assign theme based on research area
    const themeId = await assignTheme(analysis.researchArea, analysis.keywords);
    analysis.themeId = themeId;
    
    return analysis;
  } catch (error) {
    console.error('AI analysis error:', error);
    // Fallback analysis - ensure arrays for authors and keywords
    return {
      title: filename.replace('.pdf', ''),
      authors: ['Unknown Author'], // Ensure this is an array
      year: new Date().getFullYear(),
      venue: 'Unknown Venue',
      summary: 'Summary pending - automated analysis failed',
      keywords: ['research', 'paper'], // Ensure this is an array
      themeId: 1, // Default theme
      researchArea: 'General Research'
    };
  }
}

async function assignTheme(researchArea, keywords) {
  // First, try to find an existing theme that matches
  const existingThemes = await sql`SELECT * FROM themes`;
  
  const matchScore = (theme, area, kw) => {
    let score = 0;
    if (theme.name.toLowerCase().includes(area.toLowerCase())) score += 3;
    if (theme.description.toLowerCase().includes(area.toLowerCase())) score += 2;
    
    kw.forEach(keyword => {
      if (theme.name.toLowerCase().includes(keyword.toLowerCase())) score += 1;
      if (theme.description.toLowerCase().includes(keyword.toLowerCase())) score += 0.5;
    });
    
    return score;
  };

  let bestMatch = null;
  let bestScore = 0;

  existingThemes.rows.forEach(theme => {
    const score = matchScore(theme, researchArea, keywords);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = theme;
    }
  });

  // If we found a good match (score > 2), use it
  if (bestMatch && bestScore > 2) {
    return bestMatch.id;
  }

  // Otherwise, create a new theme
  const newTheme = await createNewTheme(researchArea, keywords);
  return newTheme.id;
}

async function createNewTheme(researchArea, keywords) {
  const colors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800', 
    'bg-purple-100 text-purple-800',
    'bg-orange-100 text-orange-800',
    'bg-red-100 text-red-800',
    'bg-indigo-100 text-indigo-800'
  ];
  
  const existingCount = await sql`SELECT COUNT(*) as count FROM themes`;
  const colorIndex = existingCount.rows[0].count % colors.length;
  
  const result = await sql`
    INSERT INTO themes (name, description, color)
    VALUES (
      ${researchArea},
      ${`Research focusing on ${researchArea.toLowerCase()} with emphasis on ${keywords.slice(0, 3).join(', ')}`},
      ${colors[colorIndex]}
    )
    RETURNING *
  `;
  
  return result.rows[0];
}

async function updateResearchThemes() {
  // This could implement more sophisticated theme refinement
  // For now, just return existing themes
  const themes = await sql`SELECT * FROM themes`;
  return themes.rows;
}

function formatPaperForClient(paper) {
  // Safe JSON parsing with fallbacks
  let authors;
  try {
    authors = JSON.parse(paper.authors);
    if (!Array.isArray(authors)) {
      authors = [paper.authors]; // If it's not an array, wrap it
    }
  } catch (error) {
    // If parsing fails, treat as string and wrap in array
    authors = [paper.authors || 'Unknown Author'];
  }

  let keywords;
  try {
    keywords = JSON.parse(paper.keywords);
    if (!Array.isArray(keywords)) {
      keywords = [paper.keywords]; // If it's not an array, wrap it
    }
  } catch (error) {
    // If parsing fails, treat as string and wrap in array
    keywords = [paper.keywords || 'research'];
  }

  return {
    id: paper.id,
    title: paper.title,
    authors: authors,
    year: paper.year,
    venue: paper.venue,
    summary: paper.summary,
    keywords: keywords,
    themeId: paper.theme_id
  };
}

function formatThemeForClient(theme) {
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    paperCount: parseInt(theme.paper_count),
    color: theme.color,
    lastUpdated: theme.updated_at ? new Date(theme.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  };
}