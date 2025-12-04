import { ethers } from 'ethers';
import { createRelayerClient, deploySafeWallet, getSafeBalance } from '@/lib/polymarket/relayer-client';
import { SafeWalletInfo } from '@/lib/types/order';

export async function deployUserSafe(
  signer: ethers.JsonRpcSigner | ethers.Wallet,
  userAddress: string
): Promise<SafeWalletInfo> {
  try {
    const relayerClient = await createRelayerClient(signer, undefined);
    
    const deploymentResult = await deploySafeWallet(relayerClient, {
      owners: [userAddress],
      threshold: 1,
    });

    // deploySafeWallet returns { transactionHash, proxyAddress }
    const proxyAddress = deploymentResult.proxyAddress;

    // Get balance after deployment
    const provider = signer.provider;
    if (!provider) {
      throw new Error('Provider not available');
    }

    const balance = await getSafeBalance(provider, proxyAddress);

    return {
      address: proxyAddress,
      balance,
      deployed: true,
    };
  } catch (error) {
    console.error('Error in deployUserSafe:', error);
    throw error;
  }
}

export async function fetchSafeInfo(
  provider: ethers.Provider,
  safeAddress: string
): Promise<SafeWalletInfo> {
  try {
    const balance = await getSafeBalance(provider, safeAddress);
    
    return {
      address: safeAddress,
      balance,
      deployed: true,
    };
  } catch (error) {
    console.error('Error fetching Safe info:', error);
    throw error;
  }
}

