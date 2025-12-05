/**
 * Wallet provider utilities for detecting and switching between providers
 */

import { getMetaMaskProvider, getPhantomProvider } from './providers';

export const POLYGON_CHAIN_ID = '0x89'; // 137 in hex
export const POLYGON_CHAIN_ID_DECIMAL = 137;

export interface PolygonChainConfig {
    chainId: string;
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    blockExplorerUrls: string[];
}

export const POLYGON_CONFIG: PolygonChainConfig = {
    chainId: POLYGON_CHAIN_ID,
    chainName: 'Polygon Mainnet',
    rpcUrls: ['https://polygon-rpc.com'],
    nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18,
    },
    blockExplorerUrls: ['https://polygonscan.com'],
};

/**
 * Get the current connected wallet provider
 * This prevents the wrong wallet from being used
 */
export function getCurrentProvider(walletType: 'metamask' | 'phantom' | 'walletconnect' | 'coinbase' | null): any {
    if (!walletType) {
        throw new Error('No wallet connected');
    }

    if (walletType === 'metamask') {
        const provider = getMetaMaskProvider();
        if (!provider) {
            throw new Error('MetaMask not found');
        }
        return provider;
    }

    if (walletType === 'phantom') {
        const provider = getPhantomProvider();
        if (!provider) {
            throw new Error('Phantom not found');
        }
        return provider;
    }

    // For WalletConnect and Coinbase, fall back to window.ethereum
    if (walletType === 'walletconnect' || walletType === 'coinbase') {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            return (window as any).ethereum;
        }
        throw new Error(`${walletType} provider not found`);
    }

    throw new Error(`Unsupported wallet type: ${walletType}`);
}

/**
 * Ensure the wallet is connected to Polygon chain
 * Switches or adds the chain if necessary
 */
export async function ensurePolygonChain(provider: any): Promise<void> {
    try {
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: POLYGON_CHAIN_ID }],
        });
    } catch (error: any) {
        // Chain not added to wallet
        if (error.code === 4902) {
            try {
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [POLYGON_CONFIG],
                });
            } catch (addError) {
                throw new Error('Failed to add Polygon network to wallet');
            }
        } else if (error.code === 4001) {
            // User rejected the request
            throw new Error('User rejected network switch');
        } else {
            throw new Error(`Failed to switch to Polygon: ${error.message}`);
        }
    }
}

/**
 * Get the current chain ID from the provider
 */
export async function getCurrentChainId(provider: any): Promise<string> {
    const chainId = await provider.request({ method: 'eth_chainId' });
    return chainId;
}

/**
 * Check if the provider is on Polygon chain
 */
export async function isOnPolygonChain(provider: any): Promise<boolean> {
    try {
        const chainId = await getCurrentChainId(provider);
        return chainId === POLYGON_CHAIN_ID;
    } catch (error) {
        return false;
    }
}
