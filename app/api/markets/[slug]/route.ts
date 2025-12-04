import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/utils/config';
import { MarketData } from '@/lib/types/market';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json(
        { error: 'Invalid market slug' },
        { status: 400 }
      );
    }

    const url = `${config.polymarket.gammaApiUrl}/markets/slug/${slug}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch market data: ${errorText}` },
        { status: response.status }
      );
    }

    const data: MarketData = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching market data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

