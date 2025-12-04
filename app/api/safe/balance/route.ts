import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { fetchSafeInfo } from '@/lib/wallet/safe';
import { config } from '@/lib/utils/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const safeAddress = searchParams.get('address');

    if (!safeAddress) {
      return NextResponse.json(
        { error: 'Safe address is required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!ethers.isAddress(safeAddress)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }

    const provider = new ethers.JsonRpcProvider(config.polygon.rpcUrl);
    const safeInfo = await fetchSafeInfo(provider, safeAddress);

    return NextResponse.json(safeInfo);
  } catch (error) {
    console.error('Error fetching Safe balance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

