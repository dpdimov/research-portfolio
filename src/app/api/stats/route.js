import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const papersResult = await sql`SELECT COUNT(*) as count FROM papers`;
    const themesResult = await sql`SELECT COUNT(*) as count FROM themes`;
    
    return NextResponse.json({
      success: true,
      stats: {
        papers: parseInt(papersResult.rows[0].count),
        themes: parseInt(themesResult.rows[0].count),
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch stats'
    }, { status: 500 });
  }
}