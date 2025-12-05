import { NextRequest, NextResponse } from 'next/server';
import { ClobClient, Side, OrderType } from '@polymarket/clob-client';
import { BuilderApiKeyCreds } from '@polymarket/builder-signing-sdk';
import { ethers as ethersV6 } from 'ethers';
import { Wallet as WalletV5, providers as providersV5 } from 'ethers-v5';
import { sanitizeBase64Secret } from '@/lib/utils/config';

// SignatureType enum value for POLY_PROXY
const SignatureType = { POLY_PROXY: 1 };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { price, size, side, tokenID, typedData, signature, signerAddress } = body;

    // ============================================
    // 1. VALIDATE REQUIRED PARAMS
    // ============================================
    if (!price || !size || !side || !tokenID) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: price, size, side, tokenID' },
        { status: 400 }
      );
    }

    if (!typedData || !signature || !signerAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing signature data: typedData, signature, or signerAddress' },
        { status: 400 }
      );
    }

    // Validate typedData structure (ethers v6 format)
    if (!typedData.domain || !typedData.types || !typedData.message || !typedData.primaryType) {
      console.error('[Signature Validation] Invalid typedData structure', {
        hasDomain: !!typedData.domain,
        hasTypes: !!typedData.types,
        hasMessage: !!typedData.message,
        hasPrimaryType: !!typedData.primaryType,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid typedData: missing required fields (domain, types, message, or primaryType)' },
        { status: 400 }
      );
    }

    // ============================================
    // 2. VERIFY SIGNATURE (ethers v6)
    // ============================================
    try {
      // Client sends typedData with EIP712Domain in types (for MetaMask)
      // ethers v6 requires types WITHOUT EIP712Domain
      // Extract only the Order type for verification
      const { EIP712Domain, ...otherTypes } = typedData.types;

      // Convert string values to BigInt for verification
      const normalizedMessage = {
        maker: typedData.message.maker,
        price: BigInt(typedData.message.price),
        size: BigInt(typedData.message.size),
        side: BigInt(typedData.message.side),
        tokenID: BigInt(typedData.message.tokenID),
      };

      const recovered = ethersV6.verifyTypedData(
        typedData.domain,
        otherTypes, // Types WITHOUT EIP712Domain
        normalizedMessage, // BigInt values
        signature
      );

      if (recovered.toLowerCase() !== signerAddress.toLowerCase()) {
        console.error('[Signature Verification] Mismatch', {
          recovered,
          signerAddress,
          domainChainId: typedData.domain.chainId,
          domainContract: typedData.domain.verifyingContract,
        });
        return NextResponse.json(
          { success: false, error: 'Signature verification failed' },
          { status: 400 }
        );
      }

      console.log('✓ Signature verified for address:', signerAddress);
    } catch (err: any) {
      console.error('[Signature Verification] Error:', err.message);
      return NextResponse.json(
        { success: false, error: 'Signature verification error', details: err.message },
        { status: 400 }
      );
    }

    // ============================================
    // 3. VALIDATE ENVIRONMENT VARIABLES
    // ============================================
    const requiredEnvVars = [
      'POLY_WALLET_PRIVATE_KEY',
      'POLY_BUILDER_API_KEY',
      'POLY_BUILDER_SECRET',
      'POLY_BUILDER_PASSPHRASE',
      'POLY_HOST',
      'POLY_CHAIN_ID',
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.error(`Missing env var: ${envVar}`);
        return NextResponse.json(
          { success: false, error: `Server configuration error: missing ${envVar} ` },
          { status: 500 }
        );
      }
    }

    // ============================================
    // 4. INITIALIZE BUILDER API CREDENTIALS
    // ============================================
    // Sanitize the base64 secret to handle whitespace and invalid characters
    const rawSecret = process.env.POLY_BUILDER_SECRET!;
    console.log('[BuilderConfig] Raw secret length:', rawSecret?.length || 0);
    console.log('[BuilderConfig] Raw secret preview:', rawSecret ? `${rawSecret.substring(0, 20)}...` : 'undefined');
    
    let sanitizedSecret: string;
    try {
      sanitizedSecret = sanitizeBase64Secret(rawSecret);
      console.log('[BuilderConfig] Sanitized secret length:', sanitizedSecret.length);
      console.log('[BuilderConfig] Sanitized secret preview:', `${sanitizedSecret.substring(0, 20)}...`);
    } catch (error: any) {
      console.error('[BuilderConfig] Secret sanitization failed:', error.message);
      console.error('[BuilderConfig] Raw secret (first 50 chars):', rawSecret?.substring(0, 50));
      return NextResponse.json(
        { 
          success: false, 
          error: 'Builder API secret is invalid',
          details: error.message 
        },
        { status: 500 }
      );
    }

    const builderCreds: BuilderApiKeyCreds = {
      key: process.env.POLY_BUILDER_API_KEY!,
      secret: sanitizedSecret,
      passphrase: process.env.POLY_BUILDER_PASSPHRASE!,
    };

    // Validate builder creds are not empty
    if (!builderCreds.key || !builderCreds.secret || !builderCreds.passphrase) {
      console.error('[BuilderConfig] Missing credentials');
      return NextResponse.json(
        { success: false, error: 'Builder API credentials are incomplete' },
        { status: 500 }
      );
    }

    console.log('[Builder Credentials] Initialized successfully');
    console.log('[DEBUG Creds]', {
      key: builderCreds.key.substring(0, 10) + '...',
      secret: builderCreds.secret.substring(0, 10) + '...',
      passphrase: builderCreds.passphrase.substring(0, 10) + '...',
    });

    // ============================================
    // 5. CREATE ETHERS V5 WALLET FOR CLOB CLIENT
    // ============================================
    const polygonRpcUrl = process.env.POLY_RPC_URL || process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new providersV5.JsonRpcProvider(polygonRpcUrl);
    const wallet = new WalletV5(process.env.POLY_WALLET_PRIVATE_KEY!, provider);

    console.log('[Server Wallet] Address:', wallet.address);

    // Verify wallet has _signTypedData method
    if (typeof wallet._signTypedData !== 'function') {
      console.error('[Signer Error] Wallet does not have _signTypedData method');
      return NextResponse.json(
        { success: false, error: 'Server wallet incompatible with ClobClient signer API' },
        { status: 500 }
      );
    }

    // ============================================
    // 6. INITIALIZE CLOB CLIENT (CURRENT SIGNATURE)
    // ============================================
    // Constructor signature (8 parameters):
    // new ClobClient(host, chainId, signer, apiCreds, signatureType, funderAddress, provider, debug)
    const clobClient = new ClobClient(
      'https://clob.polymarket.com',  // 1. host
      137,                             // 2. chainId
      wallet as any,                   // 3. signer
      builderCreds as any,             // 4. apiCreds (BuilderApiKeyCreds, NOT null)
      SignatureType.POLY_PROXY,        // 5. signatureType
      wallet.address,                  // 6. funderAddress
      provider as any,                 // 7. provider
      false                            // 8. debug
    );

    console.log('[CLOB Client] Initialized with Builder API Credentials');
    console.log('[CLOB Client] Configuration:', {
      host: 'https://clob.polymarket.com',
      chainId: 137,
      funderAddress: wallet.address,
      signatureType: 'POLY_PROXY',
      hasApiCreds: !!builderCreds,
    });

    // ============================================
    // 7. CREATE ORDER
    // ============================================
    // Validate and normalize all input parameters
    if (!tokenID || typeof tokenID !== 'string') {
      console.error('[Order Validation] Invalid tokenID:', tokenID);
      return NextResponse.json(
        { success: false, error: 'Invalid tokenID: must be a non-empty string' },
        { status: 400 }
      );
    }

    const priceFloat = Number(price);
    const sizeFloat = Number(size);

    if (isNaN(priceFloat) || priceFloat <= 0) {
      console.error('[Order Validation] Invalid price:', price);
      return NextResponse.json(
        { success: false, error: 'Invalid price: must be a positive number' },
        { status: 400 }
      );
    }

    if (isNaN(sizeFloat) || sizeFloat <= 0) {
      console.error('[Order Validation] Invalid size:', size);
      return NextResponse.json(
        { success: false, error: 'Invalid size: must be a positive number' },
        { status: 400 }
      );
    }

    if (!side || (side.toUpperCase() !== 'BUY' && side.toUpperCase() !== 'SELL')) {
      console.error('[Order Validation] Invalid side:', side);
      return NextResponse.json(
        { success: false, error: 'Invalid side: must be BUY or SELL' },
        { status: 400 }
      );
    }

    // Normalize side to uppercase
    const normalizedSide = side.toUpperCase() as Side;

    console.log('[CLOB Client] Creating order with parameters:');
    console.log('[DEBUG] tokenID:', tokenID, '(type:', typeof tokenID, ')');
    console.log('[DEBUG] price:', priceFloat, '(type:', typeof priceFloat, ')');
    console.log('[DEBUG] size:', sizeFloat, '(type:', typeof sizeFloat, ')');
    console.log('[DEBUG] side:', normalizedSide, '(type:', typeof normalizedSide, ')');

    // Create normalized order fields
    const orderParams = {
      tokenID: String(tokenID),
      price: Number(priceFloat),
      size: Number(sizeFloat),
      side: normalizedSide,
      feeRateBps: 0,
      nonce: 0,
    };

    console.log('[CLOB Client] Normalized order params:', orderParams);

    const order = await clobClient.createOrder(orderParams);

    console.log('[CLOB Client] Order created:', order);

    // ============================================
    // 8. POST ORDER WITH ORDER TYPE
    // ============================================
    const result = await clobClient.postOrder(order, OrderType.GTC);

    console.log('[CLOB Client] Order posted result:', result);

    // Check if the result indicates a Cloudflare block
    const isCloudflareBlock = 
      (result && typeof result === 'object' && 
       ((result.error && typeof result.error === 'string' && 
         (result.error.includes('Cloudflare') || result.error.includes('<!DOCTYPE html>'))) ||
        result.status === 403));

    if (isCloudflareBlock) {
      console.error('[CLOB Client] Cloudflare blocked the request');
      
      // Extract Cloudflare Ray ID if available
      let cloudflareRayId = 'unknown';
      if (result.error && typeof result.error === 'string') {
        const rayIdMatch = result.error.match(/Ray ID: <strong[^>]*>([^<]+)<\/strong>/);
        if (rayIdMatch && rayIdMatch[1]) {
          cloudflareRayId = rayIdMatch[1];
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Cloudflare blocked the request',
          message: 'The request to Polymarket API was blocked by Cloudflare protection. This is a common issue with automated requests.',
          suggestions: [
            'Contact Polymarket support to whitelist your server IP address',
            'Use a proxy or VPN service to route requests',
            'Check if your server IP has been flagged by Cloudflare',
            'Consider using Polymarket\'s Builder Signing Server for production use',
            'Verify your server is not making too many requests (rate limiting)',
          ],
          order: order, // Return the created order even though posting failed
          cloudflareRayId: cloudflareRayId,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      order: order,
      result: result,
    });

  } catch (error: any) {
    console.error('[Place Order] Error:', error);
    console.error('[Place Order] Error stack:', error.stack);

    // Check if the error is a Cloudflare block
    const errorMessage = error?.message || String(error);
    const errorResponse = error?.response || error?.data || error?.body;
    const isCloudflareBlock = 
      errorMessage.includes('Cloudflare') ||
      errorMessage.includes('403') ||
      error?.status === 403 ||
      (typeof errorResponse === 'string' && errorResponse.includes('Cloudflare')) ||
      (errorResponse && typeof errorResponse === 'object' && errorResponse.error && 
       typeof errorResponse.error === 'string' && errorResponse.error.includes('Cloudflare'));

    if (isCloudflareBlock) {
      console.error('[Place Order] Cloudflare blocked the request (exception)');
      
      // Try to extract Cloudflare Ray ID
      let cloudflareRayId = 'unknown';
      const errorText = typeof errorResponse === 'string' 
        ? errorResponse 
        : (errorResponse?.error || errorMessage || '');
      
      if (typeof errorText === 'string') {
        const rayIdMatch = errorText.match(/Ray ID: <strong[^>]*>([^<]+)<\/strong>/);
        if (rayIdMatch && rayIdMatch[1]) {
          cloudflareRayId = rayIdMatch[1];
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Cloudflare blocked the request',
          message: 'The request to Polymarket API was blocked by Cloudflare protection. This is a common issue with automated requests.',
          suggestions: [
            'Contact Polymarket support to whitelist your server IP address',
            'Use a proxy or VPN service to route requests',
            'Check if your server IP has been flagged by Cloudflare',
            'Consider using Polymarket\'s Builder Signing Server for production use',
            'Verify your server is not making too many requests (rate limiting)',
          ],
          cloudflareRayId: cloudflareRayId,
          details: errorMessage,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to place order',
        message: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
        details: process.env.NODE_ENV === 'development' ? error?.toString() : undefined,
      },
      { status: 500 }
    );
  }
}
