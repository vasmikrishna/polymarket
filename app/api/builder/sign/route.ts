import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/utils/config';
import { OrderParams } from '@/lib/types/order';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const orderParams: OrderParams = await request.json();

    // Validate order parameters
    if (!orderParams.tokenId || !orderParams.price || !orderParams.size || !orderParams.side) {
      return NextResponse.json(
        { error: 'Missing required order parameters' },
        { status: 400 }
      );
    }

    // Check if builder credentials are configured
    if (!config.polymarket.builderApiKey || !config.polymarket.builderSecret || !config.polymarket.builderPassphrase) {
      return NextResponse.json(
        { error: 'Builder credentials not configured' },
        { status: 500 }
      );
    }

    // Create order payload
    const timestamp = Date.now().toString();
    const nonce = orderParams.nonce || Math.floor(Math.random() * 1000000);
    const expiration = orderParams.expiration || Math.floor(Date.now() / 1000) + 86400; // 24 hours default

    const orderPayload = {
      tokenId: orderParams.tokenId,
      price: orderParams.price,
      size: orderParams.size,
      side: orderParams.side,
      feeRateBps: orderParams.feeRateBps || 0,
      nonce,
      expiration,
    };

    // Sign the order using builder credentials
    // Note: This is a simplified signing approach. The actual PolyMarket signing
    // may require specific cryptographic operations. You may need to use their SDK
    // or follow their exact signing specification.
    
    const message = JSON.stringify(orderPayload);
    const signature = signWithBuilderCredentials(message);

    return NextResponse.json({
      order: orderPayload,
      signature,
      signer: config.polymarket.builderApiKey,
    });
  } catch (error) {
    console.error('Error signing order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function signWithBuilderCredentials(message: string): string {
  // This is a placeholder. You'll need to implement the actual signing logic
  // based on PolyMarket's builder signing specification.
  // This typically involves creating an HMAC or using the builder secret to sign the message.
  
  const hmac = crypto.createHmac('sha256', config.polymarket.builderSecret);
  hmac.update(message);
  return hmac.digest('hex');
}

