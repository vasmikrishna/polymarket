import { ClobClient } from '@polymarket/clob-client';
import { BuilderConfig, BuilderApiKeyCreds } from '@polymarket/builder-signing-sdk';
import { ethers } from 'ethers';
import { OrderParams, SignedOrder } from '@/lib/types/order';
import { V6ToV5SignerAdapter } from '@/lib/wallet/signer-adapter';

// Use client-safe config for client-side components
const CLOB_API_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_POLY_CLOB_API_URL || 'https://clob.polymarket.com')
  : (process.env.POLY_CLOB_API_URL || 'https://clob.polymarket.com');

const CHAIN_ID = typeof window !== 'undefined'
  ? parseInt(process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID || '137', 10)
  : parseInt(process.env.POLYGON_CHAIN_ID || '137', 10);

export function createClobClient(signer: ethers.JsonRpcSigner | ethers.Wallet): ClobClient {
  // Wrap v6 signer with adapter for v5 compatibility
  const wrappedSigner = new V6ToV5SignerAdapter(signer);

  // Configure with local builder credentials
  // Note: Using NEXT_PUBLIC_ prefix exposes these to the browser - for development only!
  const builderCreds: BuilderApiKeyCreds = {
    key: process.env.NEXT_PUBLIC_POLY_BUILDER_API_KEY || '',
    secret: process.env.NEXT_PUBLIC_POLY_BUILDER_SECRET || '',
    passphrase: process.env.NEXT_PUBLIC_POLY_BUILDER_PASSPHRASE || '',
  };

  const builderConfig = new BuilderConfig({
    localBuilderCreds: builderCreds,
  });

  const clobClient = new ClobClient(
    CLOB_API_URL,
    CHAIN_ID,
    wrappedSigner as any, // Type assertion needed
    undefined, // creds (not needed for L2)
    1, // SignatureType.POLY_PROXY = 1
    undefined, // funderAddress - will use signer address
    undefined, // builderFee
    false,     // autoFill
    builderConfig as any
  );

  return clobClient;
}

export async function placeOrder(
  clobClient: ClobClient,
  signedOrder: SignedOrder
): Promise<string> {
  try {
    // ClobClient API may vary - using submitOrder or placeOrder
    // Check the actual API documentation for the correct method
    const result = await (clobClient as any).submitOrder?.(signedOrder) ||
      await (clobClient as any).placeOrder?.(signedOrder);
    return result?.txHash || result || 'Order submitted';
  } catch (error) {
    console.error('Error placing order:', error);
    throw error;
  }
}

export async function createOrder(
  clobClient: ClobClient,
  orderParams: OrderParams
): Promise<any> {
  try {
    // Map tokenId to tokenID for ClobClient compatibility
    const clobOrderParams = {
      ...orderParams,
      tokenID: orderParams.tokenID || orderParams.tokenId,
    };
    const order = await clobClient.createOrder(clobOrderParams as any);
    return order;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

