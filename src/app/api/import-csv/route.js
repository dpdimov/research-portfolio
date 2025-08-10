import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.log('Starting CSV import...');

    const formData = await request.formData();
    const file = formData.get('csvFile');
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No CSV file provided'
      }, { status: 400 });
    }

    // Read and parse CSV
    const csvText = await file.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = parseCSVLine(lines[0]);
    
    console.log('CSV headers:', headers);
    console.log(`Found ${lines.length - 1} data rows`);

    let importCount = 0;
    let errorCount = 0;
    const errors = [];

    // Check if we should clear existing papers (from form data)
    const clearExisting = formData.get('clearExisting') === 'true';
    if (clearExisting) {
      await sql`DELETE FROM papers`;
      console.log('Cleared existing papers');
    } else {
      console.log('Keeping existing papers - adding new ones');
    }

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      try {
        const rowData = parseCSVLine(lines[i]);
        if (rowData.length < headers.length) continue; // Skip incomplete rows
        
        const paper = parseRowData(headers, rowData);
        
        // Enhanced analysis with Claude using abstracts
        let aiAnalysis = null;
        if (paper.abstract && paper.abstract.trim() && paper.abstract !== '[No abstract available]') {
          aiAnalysis = await analyzeAbstractWithClaude(paper);
        }

        // Insert into database
        await insertPaper(paper, aiAnalysis);
        importCount++;
        
        if (importCount % 10 === 0) {
          console.log(`Imported ${importCount} papers...`);
        }

      } catch (error) {
        console.error(`Error processing row ${i}:`, error.message);
        errors.push({ row: i, error: error.message });
        errorCount++;
      }
    }

    // Get updated data to return
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
      ORDER BY paper_count DESC, t.name ASC
    `;

    return NextResponse.json({
      success: true,
      importCount,
      errorCount,
      errors: errors.slice(0, 5), // Return first 5 errors
      data: {
        papers: allPapers.rows.map(formatPaperForClient),
        themes: allThemes.rows.map(formatThemeForClient)
      }
    });

  } catch (error) {
    console.error('CSV import error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to import CSV: ' + error.message
    }, { status: 500 });
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseRowData(headers, row) {
  const paper = {};
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const value = row[i] || '';
    
    switch (header) {
      case 'Authors':
        paper.authors = value;
        break;
      case 'Title':
        paper.title = value;
        break;
      case 'Year':
        paper.year = parseInt(value) || new Date().getFullYear();
        break;
      case 'Source title':
        paper.venue = value;
        break;
      case 'DOI':
        paper.doi = value;
        break;
      case 'Link':
        paper.link = value;
        break;
      case 'Abstract':
        paper.abstract = value;
        break;
      case 'Author Keywords':
        paper.keywords = value;
        break;
      case 'Volume':
        paper.volume = value;
        break;
      case 'Issue':
        paper.issue = value;
        break;
      case 'Page start':
        paper.pageStart = value;
        break;
      case 'Page end':
        paper.pageEnd = value;
        break;
    }
  }
  
  return paper;
}

async function analyzeAbstractWithClaude(paper) {
  const prompt = `
    You are analyzing an academic paper by Dr. Dimo Dimov, a Professor of Entrepreneurship and Innovation at University of Bath. His research focuses on entrepreneurial thinking, new venture design, and venture capital funding.

    Paper Details:
    Title: "${paper.title}"
    Authors: "${paper.authors}"
    Year: ${paper.year}
    Venue: "${paper.venue}"
    Abstract: "${paper.abstract}"
    Original Keywords: "${paper.keywords}"

    IMPORTANT JOURNAL ABBREVIATIONS FOR THIS RESEARCHER:
    - JMS = Journal of Management Studies  
    - JBV = Journal of Business Venturing
    - ETP = Entrepreneurship Theory and Practice
    - JSBM = Journal of Small Business Management
    - JPIM = Journal of Product Innovation Management
    - JMI = Journal of Management Inquiry
    - JBVI = Journal of Business Venturing Insights
    - AMR = Academy of Management Review

    Generate an enhanced summary and keywords based on the abstract. Create a SPECIFIC research area theme based on the main focus. Respond ONLY with valid JSON:

    {
      "summary": "2-3 sentence summary highlighting key contributions and findings from the abstract",
      "keywords": ["5-8 relevant keywords", "extracted from abstract", "related to the paper's specific focus"],
      "researchArea": "Specific research theme like 'Venture Capital Decision Making', 'Entrepreneurial Cognition', 'New Venture Creation', 'Innovation Management', etc. - NOT just 'Entrepreneurship and Innovation'"
    }

    BE CONSERVATIVE - only extract information actually present in the abstract.
  `;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    let analysisText = data.content[0].text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    // Find JSON by looking for opening and closing braces
    const jsonStart = analysisText.indexOf('{');
    const jsonEnd = analysisText.lastIndexOf('}') + 1;
    
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      analysisText = analysisText.substring(jsonStart, jsonEnd);
    }
    
    console.log('Attempting to parse Claude response:', analysisText.substring(0, 200) + '...');
    
    let analysis;
    try {
      // Try parsing the original text first
      analysis = JSON.parse(analysisText);
    } catch (firstError) {
      console.log('First parse failed, trying to fix JSON:', firstError.message);
      
      // Try to fix common JSON issues
      let cleanedText = analysisText;
      
      // Fix unescaped quotes in title and other string values
      cleanedText = cleanedText.replace(/: "([^"]*)"([^",}]*)"([^"]*)",/g, ': "$1\\"$2\\"$3",');
      cleanedText = cleanedText.replace(/: "([^"]*)"([^",}]*)"([^"]*)"/g, ': "$1\\"$2\\"$3"');
      
      console.log('Trying with cleaned text:', cleanedText.substring(0, 200) + '...');
      analysis = JSON.parse(cleanedText);
    }
    
    return analysis;
    
  } catch (error) {
    console.error('Claude analysis error:', error);
    return null;
  }
}

async function insertPaper(paper, aiAnalysis) {
  // Parse authors array
  let authorsArray = [];
  if (paper.authors) {
    authorsArray = paper.authors.split(';').map(author => 
      author.split(',')[0].trim() // Take first part before comma
    ).filter(author => author.length > 0);
  }

  // Parse keywords array
  let keywordsArray = [];
  if (aiAnalysis?.keywords) {
    keywordsArray = aiAnalysis.keywords;
  } else if (paper.keywords) {
    keywordsArray = paper.keywords.split(';').map(k => k.trim()).filter(k => k);
  }

  // Use AI summary or create basic one
  const summary = aiAnalysis?.summary || 
    (paper.abstract && paper.abstract !== '[No abstract available]' ? 
      paper.abstract.substring(0, 300) + '...' : 
      'No abstract available');

  // Use AI-determined theme or assign based on keywords
  let themeId = 1; // Default theme
  
  // Prioritize author-provided keywords from CSV over AI-generated ones
  const authorKeywords = paper.keywords ? paper.keywords.split(';').map(k => k.trim()).filter(k => k) : [];
  const allKeywords = [...authorKeywords, ...keywordsArray];
  
  if (aiAnalysis?.researchArea) {
    themeId = await assignTheme(aiAnalysis.researchArea, allKeywords, authorKeywords);
  }

  await sql`
    INSERT INTO papers (
      title, authors, year, venue, summary, keywords, theme_id,
      doi, link, volume, issue, page_start, page_end, full_text
    ) VALUES (
      ${paper.title},
      ${JSON.stringify(authorsArray)},
      ${paper.year},
      ${paper.venue},
      ${summary},
      ${JSON.stringify(keywordsArray)},
      ${themeId},
      ${paper.doi || null},
      ${paper.link || null},
      ${paper.volume || null},
      ${paper.issue || null},
      ${paper.pageStart || null},
      ${paper.pageEnd || null},
      ${paper.abstract || null}
    )
  `;
}

// Formatting functions (reuse from existing code)
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
    themeName: paper.theme_name,
    themeColor: paper.theme_color
  };
}

async function assignTheme(researchArea, allKeywords, authorKeywords = []) {
  // Create more specific themes based on keywords if research area is too generic
  let themeArea = researchArea;
  let themeKeywords = allKeywords;
  
  // Enhanced keyword themes mapping - prioritize author keywords
  const keywordThemes = {
    // Venture Capital & Funding
    'venture capital': 'Venture Capital & Funding',
    'funding': 'Venture Capital & Funding', 
    'investor': 'Venture Capital & Funding',
    'investment': 'Venture Capital & Funding',
    'financing': 'Venture Capital & Funding',
    'angel investor': 'Venture Capital & Funding',
    
    // Entrepreneurial Cognition & Psychology
    'cognition': 'Entrepreneurial Cognition',
    'cognitive': 'Entrepreneurial Cognition',
    'psychology': 'Entrepreneurial Psychology',
    'perception': 'Entrepreneurial Psychology',
    'bias': 'Entrepreneurial Psychology',
    'heuristic': 'Entrepreneurial Psychology',
    
    // Decision Making
    'decision': 'Entrepreneurial Decision Making',
    'choice': 'Entrepreneurial Decision Making',
    'judgment': 'Entrepreneurial Decision Making',
    
    // Opportunity & Innovation
    'opportunity': 'Opportunity Recognition',
    'opportunity recognition': 'Opportunity Recognition',
    'innovation': 'Innovation Management',
    'creativity': 'Innovation & Creativity',
    'idea': 'Innovation & Creativity',
    
    // Networks & Social Capital
    'network': 'Entrepreneurial Networks',
    'social capital': 'Entrepreneurial Networks',
    'ties': 'Entrepreneurial Networks',
    'relationship': 'Entrepreneurial Networks',
    
    // Business Types
    'family business': 'Family Business',
    'family firm': 'Family Business',
    'startup': 'New Venture Creation',
    'new venture': 'New Venture Creation',
    'venture creation': 'New Venture Creation',
    'spin-off': 'Corporate Entrepreneurship',
    'corporate entrepreneurship': 'Corporate Entrepreneurship',
    
    // Performance & Strategy
    'performance': 'Venture Performance',
    'growth': 'Business Growth & Scaling',
    'strategy': 'Entrepreneurial Strategy',
    'competitive advantage': 'Entrepreneurial Strategy',
    
    // Technology & Industry
    'technology': 'Technology Entrepreneurship',
    'high-tech': 'Technology Entrepreneurship',
    'biotechnology': 'Technology Entrepreneurship',
    'digital': 'Digital Entrepreneurship',
    
    // International & Context
    'international': 'International Entrepreneurship',
    'cross-border': 'International Entrepreneurship',
    'emerging market': 'Emerging Markets',
    'developing country': 'Emerging Markets',
    
    // Learning & Knowledge
    'learning': 'Entrepreneurial Learning',
    'knowledge': 'Knowledge & Learning',
    'experience': 'Entrepreneurial Experience',
    'capability': 'Dynamic Capabilities',
    
    // Gender & Demographics  
    'gender': 'Gender & Entrepreneurship',
    'women': 'Gender & Entrepreneurship',
    'female': 'Gender & Entrepreneurship'
  };
  
  // If Claude returns generic area or no specific area, create theme from keywords
  if (!researchArea || researchArea.toLowerCase().includes('entrepreneurship and innovation') || researchArea.toLowerCase().includes('general')) {
    // First check author-provided keywords (more reliable)
    for (const [keyword, theme] of Object.entries(keywordThemes)) {
      if (authorKeywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))) {
        themeArea = theme;
        console.log(`Using author keyword "${keyword}" to assign theme: ${theme}`);
        break;
      }
    }
    
    // If no match in author keywords, check all keywords
    if (themeArea === researchArea) {
      for (const [keyword, theme] of Object.entries(keywordThemes)) {
        if (allKeywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))) {
          themeArea = theme;
          console.log(`Using keyword "${keyword}" to assign theme: ${theme}`);
          break;
        }
      }
    }
  }
  
  // First, try to find an existing theme that matches
  const existingThemes = await sql`SELECT * FROM themes`;
  
  const matchScore = (theme, area, kw) => {
    let score = 0;
    // Exact name match gets high score
    if (theme.name.toLowerCase() === area.toLowerCase()) score += 5;
    // Partial name match
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
    const score = matchScore(theme, themeArea, themeKeywords);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = theme;
    }
  });

  // If we found a good match (score > 4), use it
  if (bestMatch && bestScore > 4) {
    return bestMatch.id;
  }

  // Map specific areas to broader themes
  const broadThemeMapping = {
    'Venture Capital & Funding': ['venture capital', 'funding', 'investment', 'financing', 'angel', 'investor'],
    'Entrepreneurial Cognition': ['cognition', 'cognitive', 'psychology', 'thinking', 'perception', 'bias', 'heuristic', 'decision'],
    'Innovation Management': ['innovation', 'creativity', 'idea', 'product development', 'r&d'],
    'New Venture Creation': ['startup', 'new venture', 'venture creation', 'business formation', 'entrepreneurial process'],
    'Entrepreneurial Networks': ['network', 'social capital', 'ties', 'relationship', 'collaboration'],
    'International Entrepreneurship': ['international', 'cross-border', 'global', 'emerging market'],
    'Technology Entrepreneurship': ['technology', 'high-tech', 'biotechnology', 'digital'],
    'Family Business': ['family business', 'family firm'],
    'Corporate Entrepreneurship': ['corporate entrepreneurship', 'spin-off', 'intrapreneurship'],
    'Entrepreneurial Learning': ['learning', 'knowledge', 'experience', 'education'],
    'Entrepreneurship and Innovation': [] // Default catch-all
  };

  // Try to map to a broader theme
  for (const [broadTheme, keywords] of Object.entries(broadThemeMapping)) {
    if (keywords.some(keyword => 
      themeArea.toLowerCase().includes(keyword) || 
      themeKeywords.some(k => k.toLowerCase().includes(keyword))
    )) {
      // Find or create the broad theme
      let existingBroadTheme = existingThemes.rows.find(theme => 
        theme.name.toLowerCase() === broadTheme.toLowerCase()
      );
      
      if (existingBroadTheme) {
        return existingBroadTheme.id;
      } else {
        const newBroadTheme = await createNewTheme(broadTheme, keywords);
        return newBroadTheme.id;
      }
    }
  }

  // Default to general theme if no specific match
  let generalTheme = existingThemes.rows.find(theme => 
    theme.name.toLowerCase() === 'entrepreneurship and innovation'
  );
  
  if (generalTheme) {
    return generalTheme.id;
  } else {
    const newGeneralTheme = await createNewTheme('Entrepreneurship and Innovation', ['entrepreneurship', 'innovation']);
    return newGeneralTheme.id;
  }
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

function formatThemeForClient(theme) {
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    paperCount: parseInt(theme.paper_count) || 0,
    color: theme.color,
    lastUpdated: theme.last_updated
  };
}