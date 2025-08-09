import { Dropbox } from 'dropbox';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

// Configure Dropbox to use node-fetch
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = fetch;
}

// Dynamically import pdf-parse only when needed to avoid build-time issues
const getPDFParse = async () => {
  const PDFParse = (await import('pdf-parse')).default;
  return PDFParse;
};

export async function POST() {
  try {
    // Check if access token is configured
    if (!process.env.DROPBOX_ACCESS_TOKEN) {
      console.error('DROPBOX_ACCESS_TOKEN is not configured');
      return NextResponse.json({
        success: false,
        error: 'Dropbox access token not configured'
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

        console.log(`Downloading ${file.name}...`);
        // Download the PDF file
        const downloadResponse = await dbx.filesDownload({ path: file.path_lower });
        const pdfBuffer = downloadResponse.result.fileBinary;

        console.log(`Extracting text from ${file.name}...`);
        // Extract text from PDF
        const PDFParse = await getPDFParse();
        const pdfData = await PDFParse(pdfBuffer);
        const extractedText = pdfData.text;

        if (!extractedText || extractedText.trim().length === 0) {
          console.warn(`No text extracted from ${file.name}`);
          errorFiles.push({ name: file.name, error: 'No text extracted' });
          continue;
        }

        console.log(`Analyzing ${file.name} with AI...`);
        // Process with Claude AI
        const aiAnalysis = await analyzeResearchPaper(extractedText, file.name);

        console.log(`Storing ${file.name} in database...`);
        // Store in database
        const paperResult = await sql`
          INSERT INTO papers (
            title, authors, year, venue, summary, keywords, 
            theme_id, dropbox_file_id, dropbox_path, full_text
          ) VALUES (
            ${aiAnalysis.title}, ${JSON.stringify(aiAnalysis.authors)}, 
            ${aiAnalysis.year}, ${aiAnalysis.venue}, ${aiAnalysis.summary},
            ${JSON.stringify(aiAnalysis.keywords)}, ${aiAnalysis.themeId},
            ${file.id}, ${file.path_lower}, ${extractedText.substring(0, 10000)}
          ) RETURNING id
        `;

        processedPapers.push({
          id: paperResult.rows[0].id,
          ...aiAnalysis,
          dropboxFileId: file.id
        });

        newPapers++;
        console.log(`Successfully processed ${file.name}`);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        errorFiles.push({ name: file.name, error: error.message });
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
    
    // Assign theme based on research area
    const themeId = await assignTheme(analysis.researchArea, analysis.keywords);
    analysis.themeId = themeId;
    
    return analysis;
  } catch (error) {
    console.error('AI analysis error:', error);
    // Fallback analysis
    return {
      title: filename.replace('.pdf', ''),
      authors: ['Unknown'],
      year: new Date().getFullYear(),
      venue: 'Unknown',
      summary: 'Summary pending - automated analysis failed',
      keywords: ['research'],
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
  return {
    id: paper.id,
    title: paper.title,
    authors: JSON.parse(paper.authors),
    year: paper.year,
    venue: paper.venue,
    summary: paper.summary,
    keywords: JSON.parse(paper.keywords),
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