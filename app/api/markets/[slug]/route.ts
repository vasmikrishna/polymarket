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

    const data: any = await response.json();

    // Parse JSON strings if necessary
    if (typeof data.outcomes === 'string') {
      try {
        data.outcomes = JSON.parse(data.outcomes);
      } catch (e) {
        console.error('Failed to parse outcomes:', e);
        data.outcomes = [];
      }
    }

    if (typeof data.outcomePrices === 'string') {
      try {
        data.outcomePrices = JSON.parse(data.outcomePrices);
      } catch (e) {
        console.error('Failed to parse outcomePrices:', e);
        data.outcomePrices = [];
      }
    }

    if (typeof data.clobTokenIds === 'string') {
      try {
        data.clobTokenIds = JSON.parse(data.clobTokenIds);
      } catch (e) {
        console.error('Failed to parse clobTokenIds:', e);
        data.clobTokenIds = [];
      }
    }

    return NextResponse.json(data as MarketData);
  } catch (error) {
    console.error('Error fetching market data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

