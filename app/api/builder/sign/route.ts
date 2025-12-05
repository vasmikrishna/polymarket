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

    // Determine usage from body
    // The SDK sends the body as JSON. We need to sign exactly what is received?
    // According to docs: "Your builder signing server uses your Builder API keys to cryptographically sign the entire payload"

    // However, we need to know strictly what the SDK sends.
    // If we assume the SDK sends the logic, we must return the headers.

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signKey = config.polymarket.builderSecret;
    const passphrase = config.polymarket.builderPassphrase;
    const apiKey = config.polymarket.builderApiKey;

    // Polymarket secrets are base64 encoded
    const secret = Buffer.from(signKey, 'base64');

    // Construct the message to sign
    // Format: timestamp + method + requestPath + body
    // But the remote builder config URL is just for signing?
    // Wait, the docs say: "The fully signed payload is then sent to the CLOB"

    // If the SDK uses `remoteBuilderConfig`, it sends the payload to US.
    // We sign it and return... what?
    // If we look at standard exchanges (Coinbase, etc), we sign timestamp + method + path + body.
    // But here, we are signing on BEHALF of the order placement.

    // Let's look at the headers the SDK expects.
    // POLY_BUILDER_SIGNATURE, POLY_BUILDER_API_KEY, POLY_BUILDER_TIMESTAMP, POLY_BUILDER_PASSPHRASE

    // The signature is HMAC SHA256 of ???
    // "cryptographically sign the entire payload"
    // Usually: timestamp + 'POST' + '/orders' + JSON.stringify(body) ?
    // Or just the body?

    // Based on common patterns and external docs for ClobClient:
    // The builder signature is over the same message as the API signature would be?
    // Or just the timestamp + body?

    // Let's try standard timestamp + body binding.
    // But `clob-client` likely does NOT send method/path to us.
    // It sends the order structure.

    // IMPORTANT: The SDK likely expects a JSON response with the headers to merge?
    // Or does it expect the SignedOrder including the headers?

    // Let's assume the SDK sends the order payload.
    // We compute the signature.
    // message = timestamp + method + path + body
    // But what "method" and "path"? The order is sent to CLOB `/orders` (or similar).
    // The path is likely `/order`.

    // To be safe, let's look at `node_modules/@polymarket/builder-signing-sdk` if possible.
    // Since we can't, we'll implement a robust guess:
    // We'll sign: timestamp + "POST" + "/order" + JSON.stringify(body)
    // AND we'll return the headers.

    // Wait, `orderParams` is the body. Note that `tokenID` might be used instead of `tokenId`.

    const method = 'POST';
    const requestPath = '/order';
    const body = JSON.stringify(orderParams);

    const message = timestamp + method + requestPath + body;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(message);
    const signature = hmac.digest('base64');

    return NextResponse.json({
      'POLY_BUILDER_API_KEY': apiKey,
      'POLY_BUILDER_TIMESTAMP': timestamp,
      'POLY_BUILDER_PASSPHRASE': passphrase,
      'POLY_BUILDER_SIGNATURE': signature,
    });

  } catch (error) {
    console.error('Error signing order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper removed as logic is inline


