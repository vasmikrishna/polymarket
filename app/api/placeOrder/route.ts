import { NextRequest, NextResponse } from 'next/server';
import { ClobClient, OrderType } from '@polymarket/clob-client';
import { BuilderConfig, BuilderApiKeyCreds } from '@polymarket/builder-signing-sdk';
import { ethers as ethersV6 } from 'ethers';
import { Wallet as WalletV5, providers as providersV5 } from 'ethers-v5';
import { sanitizeBase64Secret } from '@/lib/utils/config';

// SignatureType enum - matches @polymarket/clob-client specification
const SignatureType = { EOA: 0, POLY_PROXY: 1 };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order, typedData, signature, signerAddress, tickSize } = body;

    // Validate required params
    if (!order || !typedData || !signature || !signerAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify user signature for authorization
    try {
      const { EIP712Domain, ...otherTypes } = typedData.types;
      const normalizedMessage = {
        maker: typedData.message.maker,
        price: BigInt(typedData.message.price),
        size: BigInt(typedData.message.size),
        side: BigInt(typedData.message.side),
        tokenID: BigInt(typedData.message.tokenID),
        nonce: BigInt(typedData.message.nonce),
        expiration: BigInt(typedData.message.expiration),
      };

      const recovered = ethersV6.verifyTypedData(
        typedData.domain,
        otherTypes,
        normalizedMessage,
        signature
      );

      if (recovered.toLowerCase() !== signerAddress.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: 'User signature verification failed' },
          { status: 400 }
        );
      }
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: 'Signature error: ' + err.message },
        { status: 400 }
      );
    }

    // Initialize server wallet
    if (!process.env.POLY_WALLET_PRIVATE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Server wallet not configured' },
        { status: 500 }
      );
    }

    const provider = new providersV5.JsonRpcProvider(process.env.POLY_RPC_URL || 'https://polygon-rpc.com');
    const serverWallet = new WalletV5(process.env.POLY_WALLET_PRIVATE_KEY!, provider);

    // Get CLOB credentials
    if (!process.env.POLY_CLOB_API_KEY || !process.env.POLY_CLOB_SECRET || !process.env.POLY_CLOB_PASSPHRASE) {
      return NextResponse.json(
        { success: false, error: 'CLOB credentials not configured in .env' },
        { status: 500 }
      );
    }

    const clobCreds = {
      key: process.env.POLY_CLOB_API_KEY,  // Use 'key' to match ApiKeyCreds type
      secret: sanitizeBase64Secret(process.env.POLY_CLOB_SECRET),
      passphrase: process.env.POLY_CLOB_PASSPHRASE,
    };

    // Configure Builder credentials for gasless transactions
    const builderCreds: BuilderApiKeyCreds = {
      key: process.env.POLY_BUILDER_API_KEY || '',
      secret: process.env.POLY_BUILDER_SECRET || '',
      passphrase: process.env.POLY_BUILDER_PASSPHRASE || '',
    };

    const builderConfig = new BuilderConfig({
      localBuilderCreds: builderCreds,
    });

    console.log('[Order Placement] Initializing ClobClient');
    console.log('[Order Placement] Wallet:', serverWallet.address);
    console.log('[Order Placement] API Key:', clobCreds.key);
    console.log('[Order Placement] Builder Enabled:', !!builderCreds.key);

    // Initialize ClobClient with Builder config for gasless transactions
    const clobClient = new ClobClient(
      'https://clob.polymarket.com',
      137,  // Polygon mainnet
      serverWallet as any,
      clobCreds,
      SignatureType.EOA,  // Signature type = 0 (EOA for direct private key wallets)
      serverWallet.address,  // Funder = server wallet address (same as signer for EOA)
      undefined,  // builderFee
      false,  // autoFill
      builderConfig as any  // Builder config for gasless transactions
    );

    // Build order parameters for createAndPostOrder
    const sideString = order.side.toUpperCase();  // Will be 'BUY' or 'SELL'
    const priceNumber = parseFloat(order.price);  // Already in decimal format
    const sizeNumber = parseFloat(order.size);    // Already in decimal format

    console.log('[Order Placement] Creating order with params:');
    console.log('  TokenID:', order.tokenID);
    console.log('  Price:', priceNumber);
    console.log('  Size:', sizeNumber);
    console.log('  Side:', sideString);

    // Use createAndPostOrder - it handles everything
    let result;
    try {
      result = await clobClient.createAndPostOrder(
        {
          tokenID: order.tokenID,
          price: priceNumber,
          size: sizeNumber,
          side: sideString as any,  // Cast to satisfy type checker
        },
        {
          tickSize: tickSize || '0.01',  // Use market's tickSize or default to 0.01
          negRisk: false,
        }
      );

      console.log('[Order Placement] Raw result from createAndPostOrder:', JSON.stringify(result, null, 2));

      // Check if result contains an error
      if (result && typeof result === 'object' && (result as any).error) {
        console.error('[Order Placement] CLOB API returned error in result:', result);
        return NextResponse.json(
          {
            success: false,
            error: 'CLOB API error',
            message: (result as any).error || 'Order rejected by CLOB API',
            details: result,
            userAddress: signerAddress,
            serverAddress: serverWallet.address,
          },
          { status: 400 }
        );
      }

      console.log('[Order Placement] Order posted successfully!');
    } catch (postError: any) {
      console.error('[Order Placement] Exception during createAndPostOrder:', {
        message: postError.message,
        response: postError.response?.data,
        status: postError.response?.status,
        stack: postError.stack,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to post order',
          message: postError.message || 'CLOB API error',
          details: postError.response?.data || postError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      userAddress: signerAddress,  // User who authorized
      serverAddress: serverWallet.address,  // Server that signed
    });

  } catch (error: any) {
    console.error('[Order Placement] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to place order',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
