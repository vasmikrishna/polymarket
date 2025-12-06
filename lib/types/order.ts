export interface OrderParams {
  tokenId: string;
  tokenID?: string; // Alias for ClobClient compatibility
  price: string;
  size: string;
  side: 'BUY' | 'SELL';
  nonce: number;        // Required
  expiration: number;   // Required (timestamp)
  feeRateBps?: number;
}

export interface SignedOrder {
  order: OrderParams;
  signature: string;
  signer: string;
}

export interface ClobOrder {
  maker: string;
  tokenID: string | any; // Can be string or BigNumber from ethers-v5
  price: string | any;   // Can be string or BigNumber from ethers-v5
  size: string | any;    // Can be string or BigNumber from ethers-v5
  side: number;          // 0=BUY, 1=SELL
  nonce: number;
  expiration: number;
  feeRateBps?: number;
  signature: string;
  signatureType?: number;
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

