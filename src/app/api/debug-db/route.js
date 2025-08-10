import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get raw database data for first paper
    const result = await sql`SELECT id, title, authors, keywords FROM papers LIMIT 1`;
    
    return NextResponse.json({
      success: true,
      rawData: result.rows[0]
    });

  } catch (error) {
    console.error('Error querying database:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to query database: ' + error.message
    }, { status: 500 });
  }
}