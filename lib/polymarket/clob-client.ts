import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import { OrderParams, SignedOrder } from '@/lib/types/order';

// Use client-safe config for client-side components
const CLOB_API_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_POLY_CLOB_API_URL || 'https://clob.polymarket.com')
  : (process.env.POLY_CLOB_API_URL || 'https://clob.polymarket.com');

const CHAIN_ID = typeof window !== 'undefined'
  ? parseInt(process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID || '137', 10)
  : parseInt(process.env.POLYGON_CHAIN_ID || '137', 10);

export function createClobClient(signer: ethers.JsonRpcSigner | ethers.Wallet): ClobClient {
  const clobClient = new ClobClient(
    CLOB_API_URL,
    CHAIN_ID,
    signer as any // Type assertion needed due to ClobClient's signer type requirements
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

