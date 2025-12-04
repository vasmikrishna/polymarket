import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderApiKeyCreds, BuilderConfig } from '@polymarket/builder-signing-sdk';
import { ethers } from 'ethers';
import { createWalletClient, custom, http, WalletClient } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Use client-safe config for client-side components
const RELAYER_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_POLY_RELAYER_URL || 'https://relayer-v2.polymarket.com')
  : (process.env.POLY_RELAYER_URL || 'https://relayer-v2.polymarket.com');

// Ensure CHAIN_ID is a valid number
const getChainId = (): number => {
  const chainIdStr = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID || '137')
    : (process.env.POLYGON_CHAIN_ID || '137');
  const chainId = parseInt(chainIdStr, 10);
  if (isNaN(chainId)) {
    console.warn('Invalid CHAIN_ID, defaulting to 137');
    return 137;
  }
  return chainId;
};

const CHAIN_ID = getChainId();

// Get RPC URL for viem client
const getRpcUrl = (): string => {
  return typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com')
    : (process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');
};

/**
 * Converts an ethers signer to a viem WalletClient
 * This is necessary because RelayClient expects a viem WalletClient internally
 */
async function convertEthersSignerToViemWalletClient(
  signer: ethers.JsonRpcSigner | ethers.Wallet
): Promise<WalletClient> {
  if (signer instanceof ethers.Wallet) {
    // For ethers.Wallet, extract private key and create viem account
    const privateKey = signer.privateKey as `0x${string}`;
    const account = privateKeyToAccount(privateKey);
    const rpcUrl = getRpcUrl();

    return createWalletClient({
      account,
      chain: polygon,
      transport: http(rpcUrl),
    });
  } else if (signer instanceof ethers.JsonRpcSigner) {
    // For ethers.JsonRpcSigner, create custom transport that delegates to ethers provider
    const provider = signer.provider;
    if (!provider) {
      throw new Error('Signer must have a provider');
    }

    // Get the address from the signer
    const address = await signer.getAddress();

    // Create a custom transport that wraps the ethers provider
    // The transport needs to have a config property for viem compatibility
    const customTransport = custom({
      async request({ method, params }) {
        const result = await provider.send(method, params || []);
        return result;
      },
    });

    // Create WalletClient with custom transport
    // Note: We need to create a minimal account object for viem
    const walletClient = createWalletClient({
      chain: polygon,
      transport: customTransport,
    });

    // Override the account property to use the signer's address
    // This is a workaround since we can't directly create an account from JsonRpcSigner
    return {
      ...walletClient,
      account: {
        address: address as `0x${string}`,
        type: 'json-rpc' as const,
      },
      // Add requestAddresses method that returns the signer's address
      requestAddresses: async () => [address as `0x${string}`],
      // Add signMessage that delegates to ethers signer
      signMessage: async ({ account, message }) => {
        if (typeof message === 'string') {
          return await signer.signMessage(message);
        } else if (message.raw) {
          // Convert Uint8Array to string for ethers
          const messageStr = ethers.getBytes(message.raw).length > 0
            ? ethers.hexlify(message.raw)
            : '';
          return await signer.signMessage(messageStr);
        }
        throw new Error('Unsupported message format');
      },
      // Add signTypedData that delegates to ethers signer
      signTypedData: async (params: any) => {
        const { domain, types, primaryType, message } = params;
        if (!domain) {
          throw new Error('Domain is required for typed data signing');
        }
        // Convert viem types to ethers format
        const ethersDomain: any = {
          name: domain.name,
          version: domain.version,
          chainId: domain.chainId,
          verifyingContract: domain.verifyingContract,
        };
        return await signer.signTypedData(ethersDomain, types as any, message as any);
      },
    } as WalletClient;
  } else {
    throw new Error('Unsupported signer type');
  }
}

export function createBuilderConfig(): BuilderConfig | undefined {
  // Only access server-side env vars (not NEXT_PUBLIC_)
  const apiKey = process.env.POLY_BUILDER_API_KEY || '019ac3e0-faee-7903-ab69-e83ddd2d5015';
  const secret = process.env.POLY_BUILDER_SECRET || 'TSJp7mmXUjsnzvgP-oqZ4TgaSN-bANqtosFnkfh8X-E=';
  const passphrase = process.env.POLY_BUILDER_PASSPHRASE || '2a5dffdb9a855ee59a3af6491399e203ebe57ccac999016095fcd4e17841e0e2';
  console.log('apiKey', apiKey);
  console.log('secret', secret);
  console.log('passphrase', passphrase);

  if (!apiKey || !secret || !passphrase) {
    console.warn('Builder credentials not configured. Gasless transactions will not work.');
    return undefined;
  }

  const builderCreds: BuilderApiKeyCreds = {
    key: apiKey,
    secret: secret,
    passphrase: passphrase,
  };

  return new BuilderConfig({
    localBuilderCreds: builderCreds
  });
}

export async function createRelayerClient(signer: ethers.JsonRpcSigner | ethers.Wallet, builderConfigParam?: any): Promise<RelayClient> {
  try {
    // Validate inputs
    if (!RELAYER_URL) {
      throw new Error('Relayer URL is not configured');
    }
    
    // Ensure CHAIN_ID is a valid number
    const chainId = Number(CHAIN_ID);
    if (isNaN(chainId) || chainId <= 0) {
      throw new Error(`Invalid Chain ID: ${CHAIN_ID}. Expected a positive number.`);
    }
    
    if (!signer) {
      throw new Error('Signer is required');
    }

    // Convert ethers signer to viem WalletClient
    const walletClient = await convertEthersSignerToViemWalletClient(signer);

    // Create builder config if not provided
    const builderConfig = builderConfigParam !== undefined 
      ? builderConfigParam 
      : createBuilderConfig();

    console.log('Creating RelayClient with:', {
      relayerUrl: RELAYER_URL,
      chainId: chainId,
      signerType: signer?.constructor?.name,
      hasBuilderConfig: builderConfig !== undefined && builderConfig !== null
    });

    // RelayClient constructor: (relayerUrl, chainId, signer, builderConfig?)
    // According to docs: new RelayClient(relayerUrl, chainId, wallet, builderConfig)
    // builderConfig is optional - only pass it if provided
    let relayerClient: RelayClient;
    
    if (builderConfig !== undefined && builderConfig !== null) {
      relayerClient = new RelayClient(
        RELAYER_URL,
        chainId,
        walletClient, // Pass viem WalletClient instead of ethers signer
        builderConfig
      );
    } else {
      relayerClient = new RelayClient(
        RELAYER_URL,
        chainId,
        walletClient // Pass viem WalletClient instead of ethers signer
      );
    }

    return relayerClient;
  } catch (error) {
    console.error('Error creating RelayClient:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Relayer URL:', RELAYER_URL);
    console.error('Chain ID:', CHAIN_ID, 'Type:', typeof CHAIN_ID);
    console.error('Signer type:', signer?.constructor?.name);
    throw new Error(`Failed to create RelayClient: ${errorMessage}`);
  }
}

export interface SafeDeploymentParams {
  owners: string[];
  threshold: number;
}

export async function deploySafeWallet(
  relayerClient: RelayClient,
  params: SafeDeploymentParams
): Promise<{ transactionHash: string; proxyAddress: string }> {
  try {
    // According to documentation: client.deploy() returns a response with .wait() method
    // The deploy() method uses the signer from the RelayClient
    const response = await relayerClient.deploy();
    
    if (!response) {
      throw new Error('Failed to get response from Safe deployment');
    }
    
    // Wait for the transaction to complete
    const result = await response.wait();
    
    if (!result) {
      throw new Error('Safe deployment failed or timed out');
    }
    
    // According to docs, result has transactionHash and proxyAddress
    const transactionHash = result.transactionHash;
    const proxyAddress = result.proxyAddress;
    
    if (!transactionHash) {
      throw new Error('Failed to get transaction hash from Safe deployment');
    }
    
    if (!proxyAddress) {
      throw new Error('Proxy address not found in deployment result');
    }
    
    return {
      transactionHash,
      proxyAddress,
    };
  } catch (error: any) {
    // Check if the error indicates the Safe is already deployed
    const errorMessage = error?.message || String(error);
    if (
      errorMessage.toLowerCase().includes('already deployed') ||
      errorMessage.toLowerCase().includes('safe already exists') ||
      errorMessage.toLowerCase().includes('safe already deployed')
    ) {
      // Try to get the existing Safe address
      try {
        const expectedAddress = await getExpectedSafeAddress(relayerClient, '');
        if (expectedAddress) {
          // Return the existing Safe address
          return {
            transactionHash: '', // No new transaction
            proxyAddress: expectedAddress,
          };
        }
      } catch (getAddressError) {
        console.error('Error getting existing Safe address:', getAddressError);
      }
      
      // If we can't get the address, rethrow the original error
      throw new Error(`Safe already deployed. Please check your transactions or contact support. Original error: ${errorMessage}`);
    }
    
    console.error('Error deploying Safe wallet:', error);
    throw error;
  }
}

export async function getSafeBalance(
  provider: ethers.Provider,
  safeAddress: string
): Promise<string> {
  try {
    const balance = await provider.getBalance(safeAddress);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error fetching Safe balance:', error);
    throw error;
  }
}

/**
 * Checks if a Safe wallet is already deployed for the given address
 * and returns the Safe address if it exists
 */
export async function getExistingSafeAddress(
  relayerClient: RelayClient,
  userAddress: string
): Promise<string | null> {
  try {
    // Try to get the expected Safe address from the RelayClient
    // The Safe address is deterministic based on the signer address
    // We'll try to access it through the private method or compute it
    
    // First, try to check if there's a deployed Safe by checking transactions
    // or by trying to get the expected Safe address
    const transactions = await relayerClient.getTransactions();
    
    // Look for a deployment transaction for this user
    for (const tx of transactions) {
      if (tx.proxyAddress && tx.transactionHash) {
        // Check if this Safe belongs to the user by verifying deployment
        const isDeployed = await relayerClient.getDeployed(tx.proxyAddress);
        if (isDeployed) {
          return tx.proxyAddress;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error checking for existing Safe:', error);
    // If we can't check, return null and let deployment proceed
    return null;
  }
}

/**
 * Gets the expected Safe address for a user
 * This is a deterministic address computed by the Safe factory
 */
export async function getExpectedSafeAddress(
  relayerClient: RelayClient,
  userAddress: string
): Promise<string | null> {
  try {
    // The RelayClient has a private getExpectedSafe method
    // We'll try to access it or compute it ourselves
    // For now, we'll use a workaround by trying to get it from the client's internal state
    const client = relayerClient as any;
    
    // Try to call the private method (not ideal, but necessary)
    if (client.getExpectedSafe) {
      return await client.getExpectedSafe();
    }
    
    // Alternative: Try to get it from the contract config
    // The Safe address is computed deterministically by the Safe factory
    // We might need to compute it using the Safe SDK or factory contract
    
    return null;
  } catch (error) {
    console.error('Error getting expected Safe address:', error);
    return null;
  }
}

