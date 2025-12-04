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
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    // First, try to request permissions explicitly
    // This will show MetaMask's popup even if already authorized
    try {
      await window.ethereum.request({
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
    const accounts = await window.ethereum.request({
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
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  
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

export async function switchAccount(provider: ethers.BrowserProvider, accountIndex: number): Promise<WalletState> {
  const accounts = await provider.listAccounts();
  if (accountIndex >= accounts.length) {
    throw new Error('Account index out of range');
  }

  const signer = await provider.getSigner(accounts[accountIndex].address);
  const address = await signer.getAddress();

  return {
    provider: 'metamask',
    address,
    signer: signer as ethers.JsonRpcSigner,
    providerInstance: provider,
    accounts: accounts.map((acc) => acc.address),
    isConnected: true,
  };
}

/**
 * Disconnects the wallet and revokes MetaMask permissions
 * This ensures that reconnecting will show the MetaMask popup again
 */
export async function disconnectWallet(): Promise<WalletState> {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      // Try to revoke permissions to force re-authorization on next connect
      // This will make MetaMask show the popup again when reconnecting
      await window.ethereum.request({
        method: 'wallet_revokePermissions',
        params: [
          {
            eth_accounts: {},
          },
        ],
      });
    } catch (error) {
      // If revoking fails (e.g., permissions already revoked), that's okay
      // We'll still clear the local state
      console.log('Note: Could not revoke permissions (may already be revoked)');
    }
  }

  return {
    provider: null,
    address: null,
    signer: null,
    providerInstance: null,
    accounts: [],
    isConnected: false,
  };
}

