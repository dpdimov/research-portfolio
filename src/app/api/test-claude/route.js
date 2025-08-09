import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('Testing Claude API key...');
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'ANTHROPIC_API_KEY not found'
      });
    }

    console.log('API Key format check:');
    console.log('- Length:', apiKey.length);
    console.log('- Starts with sk-ant:', apiKey.startsWith('sk-ant'));
    console.log('- First 20 chars:', apiKey.substring(0, 20));
    console.log('- Last 10 chars:', apiKey.substring(apiKey.length - 10));

    // Test with a simple Claude API call
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hello" }]
      })
    });

    console.log('Claude API test response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        message: 'Claude API key is working!',
        responsePreview: data.content?.[0]?.text?.substring(0, 50) || 'Got response'
      });
    } else {
      const errorText = await response.text();
      console.log('Claude API error response:', errorText);
      return NextResponse.json({
        success: false,
        error: `Claude API error: ${response.status}`,
        details: errorText
      });
    }

  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}