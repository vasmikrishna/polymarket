export interface OrderParams {
  tokenId: string;
  tokenID?: string; // Alias for ClobClient compatibility
  price: string;
  size: string;
  side: 'BUY' | 'SELL';
  feeRateBps?: number;
  nonce?: number;
  expiration?: number;
}

export interface SignedOrder {
  order: OrderParams;
  signature: string;
  signer: string;
}

export interface OrderResponse {
  orderId?: string;
  txHash?: string;
  success: boolean;
  error?: string;
}

export interface SafeWalletInfo {
  address: string;
  balance: string;
  deployed: boolean;
  deploymentTxHash?: string;
}

