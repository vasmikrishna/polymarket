import { NextRequest, NextResponse } from 'next/server';
import { ClobClient, OrderType, ApiKeyCreds } from '@polymarket/clob-client';
import { Wallet, providers } from 'ethers-v5';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenID, price, size, side, userSignature, userAddress } = body;

    // 1. Sanitize Secret (Fixes the "character" error)
    const rawSecret = process.env.POLY_BUILDER_SECRET || "";
    let sanitizedSecret = rawSecret.replace(/-/g, "+").replace(/_/g, "/");
    while (sanitizedSecret.length % 4) {
      sanitizedSecret += '=';
    }

    const creds: ApiKeyCreds = {
      key: process.env.POLY_BUILDER_API_KEY!,
      secret: sanitizedSecret,
      passphrase: process.env.POLY_BUILDER_PASSPHRASE!,
    };

    // 2. Server Wallet
    // (This wallet is only used to initialize the client, 
    // it won't be the "Maker" of the order anymore)
    const rpcUrl = process.env.POLY_RPC_URL || 'https://polygon-rpc.com';
    const provider = new providers.JsonRpcProvider(rpcUrl);
    const serverWallet = new Wallet(process.env.POLY_WALLET_PRIVATE_KEY!, provider);

    // 3. Init Client
    const clobClient = new ClobClient(
      'https://clob.polymarket.com',
      137,
      serverWallet as any,
      creds
    );

    // 4. Construct Order Payload
    // CRITICAL: Explicitly set 'maker' to the User's Address
    const orderPayload = {
      tokenID: String(tokenID),
      price: Number(price),
      size: Number(size),
      side: side.toUpperCase(),
      feeRateBps: 0,
      nonce: 0,
      expiration: 0,
      maker: userAddress,      // <--- ADD THIS (Fixes 401 Error)
      signature: userSignature // <--- Relay the frontend signature
    };

    console.log(`[Place Order] Relaying order for Maker: ${userAddress}`);

    // 5. Post Order
    const result = await clobClient.postOrder(orderPayload as any, OrderType.GTC);

    return NextResponse.json({ success: true, result });

  } catch (error: any) {
    console.error('[Place Order] Error:', error?.message);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to place order',
    }, { status: 500 });
  }
}