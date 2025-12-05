import { ethers } from 'ethers';

export type WalletProvider = 'metamask' | 'phantom' | 'walletconnect' | 'coinbase';

export interface WalletState {
  provider: WalletProvider | null;
  address: string | null;
  signer: ethers.JsonRpcSigner | ethers.Wallet | null;
  providerInstance: ethers.BrowserProvider | null;
  accounts: string[];
  isConnected: boolean;
}

/**
 * Fetches all available MetaMask accounts
 * Uses wallet_requestPermissions to force MetaMask to show the popup
 * This ensures the user always sees the account selection UI
 */
export async function getAvailableAccounts(): Promise<string[]> {
  const ethereum = getMetaMaskProvider();
  if (!ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    // First, try to request permissions explicitly
    // This will show MetaMask's popup even if already authorized
    try {
      await ethereum.request({
        method: 'wallet_requestPermissions',
        params: [
          {
            eth_accounts: {},
          },
        ],
      });
    } catch (permError: any) {
      // If permissions are already granted, wallet_requestPermissions might not show popup
      // In that case, we'll fall back to eth_requestAccounts
      if (permError.code !== 4001) {
        // Only log if it's not a user rejection
        console.log('Permissions already granted, using eth_requestAccounts');
      }
    }

    // Request account access - this will show MetaMask's account selection UI
    // and return all accounts that the user selects/authorizes
    const accounts = await ethereum.request({
      method: 'eth_requestAccounts',
    }) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from MetaMask');
    }

    return accounts;
  } catch (error: any) {
    // Handle user rejection
    if (error.code === 4001) {
      throw new Error('User rejected account access. Please approve the connection in MetaMask.');
    }

    // Handle other errors
    const errorMessage = error?.message || 'Failed to fetch accounts';
    throw new Error(`Failed to fetch accounts: ${errorMessage}. Please ensure MetaMask is unlocked.`);
  }
}

export async function connectMetaMask(selectedAddress?: string): Promise<WalletState> {
  const ethereum = getMetaMaskProvider();
  if (!ethereum) {
    throw new Error('MetaMask is not installed');
  }

  // Ensure we are on Polygon
  await switchNetwork(ethereum);

  const provider = new ethers.BrowserProvider(ethereum);

  // Request account access
  await provider.send('eth_requestAccounts', []);

  // Get all accounts
  const accounts = await provider.listAccounts();
  const accountAddresses = accounts.map((acc) => acc.address);

  // If a specific address is provided, use it; otherwise use the first account
  let targetAddress = selectedAddress;
  if (!targetAddress && accountAddresses.length > 0) {
    targetAddress = accountAddresses[0];
  }

  if (!targetAddress) {
    throw new Error('No accounts available');
  }

  // Find the account index
  const accountIndex = accountAddresses.findIndex(
    (addr) => addr.toLowerCase() === targetAddress?.toLowerCase()
  );

  if (accountIndex === -1) {
    throw new Error(`Account ${targetAddress} not found in available accounts`);
  }

  // Get signer for the selected account
  const signer = await provider.getSigner(targetAddress);
  const address = await signer.getAddress();

  return {
    provider: 'metamask',
    address,
    signer: signer as ethers.JsonRpcSigner,
    providerInstance: provider,
    accounts: accountAddresses,
    isConnected: true,
  };
}

/**
 * Helper to find the specific MetaMask provider
 * Handles cases where multiple wallets inject into window.ethereum
 */
export function getMetaMaskProvider(): any {
  if (typeof window === 'undefined') return null;

  // Check for EIP-6963 style providers
  if (window.ethereum?.providers) {
    const provider = window.ethereum.providers.find((p: any) => p.isMetaMask);
    if (provider) return provider;
  }

  // Fallback to standard injection
  if (window.ethereum?.isMetaMask) {
    return window.ethereum;
  }

  return null;
}

/**
 * Helper to find the Phantom provider
 */
export function getPhantomProvider(): any {
  if (typeof window === 'undefined') return null;

  // Check for EIP-6963 style providers
  if (window.ethereum?.providers) {
    const provider = window.ethereum.providers.find((p: any) => p.isPhantom);
    if (provider) return provider;
  }

  // Phantom specifically injects into window.phantom?.ethereum
  if ((window as any).phantom?.ethereum) {
    return (window as any).phantom.ethereum;
  }

  return null;
}

export const POLYGON_CHAIN_ID = '0x89'; // 137
export const POLYGON_RPC_URL = 'https://polygon-rpc.com';

export async function switchNetwork(provider: any): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_CHAIN_ID }],
    });
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask.
    if (switchError.code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: POLYGON_CHAIN_ID,
              chainName: 'Polygon Mainnet',
              rpcUrls: [POLYGON_RPC_URL],
              nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18,
              },
              blockExplorerUrls: ['https://polygonscan.com/'],
            },
          ],
        });
      } catch (addError) {
        throw new Error('Failed to add Polygon network');
      }
    } else {
      throw switchError;
    }
  }
}

export async function checkConnection(): Promise<WalletState | null> {
  // Check MetaMask first
  const metamask = getMetaMaskProvider();
  if (metamask && metamask.selectedAddress) {
    const provider = new ethers.BrowserProvider(metamask);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const accounts = await provider.listAccounts();

    return {
      provider: 'metamask',
      address,
      signer: signer as ethers.JsonRpcSigner,
      providerInstance: provider,
      accounts: accounts.map(a => a.address),
      isConnected: true
    };
  }

  // Check Phantom
  const phantom = getPhantomProvider();
  if (phantom && phantom.selectedAddress) {
    const provider = new ethers.BrowserProvider(phantom);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const accounts = await provider.listAccounts();

    return {
      provider: 'phantom',
      address,
      signer: signer as ethers.JsonRpcSigner,
      providerInstance: provider,
      accounts: accounts.map(a => a.address),
      isConnected: true
    };
  }

  return null;
}

export async function connectWallet(walletType: 'metamask' | 'phantom'): Promise<WalletState> {
  let ethereum;

  if (walletType === 'metamask') {
    ethereum = getMetaMaskProvider();
    if (!ethereum) throw new Error('MetaMask is not installed');
  } else if (walletType === 'phantom') {
    ethereum = getPhantomProvider();
    if (!ethereum) throw new Error('Phantom is not installed');
  }

  // Ensure we are on Polygon
  await switchNetwork(ethereum);

  const provider = new ethers.BrowserProvider(ethereum);

  // Request account access
  await provider.send('eth_requestAccounts', []);

  // Get all accounts
  const accounts = await provider.listAccounts();
  const accountAddresses = accounts.map((acc) => acc.address);

  if (accountAddresses.length === 0) {
    throw new Error('No accounts available');
  }

  // Get signer for the first account
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return {
    provider: walletType,
    address,
    signer: signer as ethers.JsonRpcSigner,
    providerInstance: provider,
    accounts: accountAddresses,
    isConnected: true,
  };
}

export async function disconnectWallet(): Promise<WalletState> {
  const metamask = getMetaMaskProvider();
  if (metamask) {
    try {
      await metamask.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      });
    } catch (e) {
      console.log('Could not revoke MetaMask permissions');
    }
  }

  // Phantom doesn't support wallet_revokePermissions the same way usually, 
  // but we can try or just rely on local cleanup.

  return {
    provider: null,
    address: null,
    signer: null,
    providerInstance: null,
    accounts: [],
    isConnected: false,
  };
}

