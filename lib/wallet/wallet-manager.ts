/**
 * Wallet Manager - Robust wallet provider detection, persistence, and chain switching
 */

import { WalletKind, normalizeWalletKind } from './kinds';

const POLYGON_CHAIN_ID_HEX = '0x89'; // 137 in decimal
const POLYGON_CHAIN_ID_DECIMAL = 137;

export { WalletKind };

export interface WalletProvider {
    kind: WalletKind;
    provider: any;
}

export interface PolygonChainParams {
    chainId: string;
    chainName: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    rpcUrls: string[];
    blockExplorerUrls: string[];
}

const POLYGON_CONFIG: PolygonChainParams = {
    chainId: POLYGON_CHAIN_ID_HEX,
    chainName: 'Polygon Mainnet',
    nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18,
    },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
};

/**
 * Detect all available wallet providers
 */
export function detectProviders(): WalletProvider[] {
    const providers: WalletProvider[] = [];

    if (typeof window === 'undefined') return providers;

    const ethereum = (window as any).ethereum;
    const phantom = (window as any).phantom;

    // MetaMask detection
    if (ethereum) {
        if (Array.isArray(ethereum.providers)) {
            const metaMask = ethereum.providers.find((p: any) => p?.isMetaMask);
            if (metaMask) {
                providers.push({ kind: WalletKind.METAMASK, provider: metaMask });
            }

            const coinbase = ethereum.providers.find((p: any) => p?.isCoinbaseWallet || p?.isCoinbase);
            if (coinbase) {
                providers.push({ kind: WalletKind.COINBASE, provider: coinbase });
            }
        } else {
            if (ethereum.isMetaMask) {
                providers.push({ kind: WalletKind.METAMASK, provider: ethereum });
            } else if (ethereum.isCoinbaseWallet || ethereum.isCoinbase) {
                providers.push({ kind: WalletKind.COINBASE, provider: ethereum });
            }
        }
    }

    // Phantom detection
    if (phantom?.solana) {
        providers.push({ kind: WalletKind.PHANTOM, provider: phantom.solana });
    }

    return providers;
}

/**
 * Get provider for specific wallet kind
 * Returns null if provider not found (no throwing)
 */
export function getProviderForWallet(kind: WalletKind): any | null {
    if (typeof window === 'undefined') {
        console.warn('[getProviderForWallet] Window not available');
        return null;
    }

    const ethereum = (window as any).ethereum;
    const phantom = (window as any).phantom;

    switch (kind) {
        case WalletKind.METAMASK: {
            if (!ethereum) {
                console.warn('[getProviderForWallet] No ethereum provider found for MetaMask');
                return null;
            }

            // Handle multiple providers
            if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
                const metaMask = ethereum.providers.find((p: any) => p?.isMetaMask);
                if (metaMask) {
                    console.log('[getProviderForWallet] Found MetaMask in providers array');
                    return metaMask;
                }

                // Fallback to first provider with request method
                const first = ethereum.providers.find((p: any) => typeof p?.request === 'function');
                if (first) {
                    console.warn('[getProviderForWallet] Using first available provider as fallback');
                    return first;
                }

                return null;
            }

            // Single provider
            if (ethereum && typeof ethereum.request === 'function') {
                console.log('[getProviderForWallet] Using single ethereum provider');
                return ethereum;
            }

            console.warn('[getProviderForWallet] Ethereum provider does not support request()');
            return null;
        }

        case WalletKind.COINBASE: {
            if (!ethereum) {
                console.warn('[getProviderForWallet] No ethereum provider found for Coinbase');
                return null;
            }

            if (Array.isArray(ethereum.providers)) {
                const coinbase = ethereum.providers.find((p: any) => p?.isCoinbaseWallet || p?.isCoinbase);
                if (coinbase) {
                    console.log('[getProviderForWallet] Found Coinbase in providers array');
                    return coinbase;
                }
            }

            if (ethereum && (ethereum.isCoinbaseWallet || ethereum.isCoinbase)) {
                console.log('[getProviderForWallet] Using single Coinbase provider');
                return ethereum;
            }

            console.warn('[getProviderForWallet] No Coinbase provider found');
            return null;
        }

        case WalletKind.PHANTOM: {
            if (phantom?.solana) {
                console.log('[getProviderForWallet] Found Phantom provider');
                return phantom.solana;
            }

            console.warn('[getProviderForWallet] No Phantom provider found');
            return null;
        }

        case WalletKind.WALLETCONNECT: {
            // WalletConnect typically uses SDK, not injected provider
            console.warn('[getProviderForWallet] WalletConnect requires SDK integration');
            return null;
        }

        default:
            console.warn(`[getProviderForWallet] Unknown wallet kind: ${kind}`);
            return null;
    }
}

/**
 * Save wallet selection to localStorage
 */
export function rememberWallet(kind: WalletKind): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('rememberedWallet', kind);
    console.log(`[rememberWallet] Saved: ${kind}`);
}

/**
 * Get remembered wallet from localStorage with normalization
 */
export function getRememberedWallet(): WalletKind | null {
    if (typeof window === 'undefined') return null;

    const raw = localStorage.getItem('rememberedWallet');
    const normalized = normalizeWalletKind(raw);

    // Update localStorage if we normalized a legacy value
    if (normalized && raw !== normalized) {
        console.log(`[getRememberedWallet] Normalizing ${raw} to ${normalized}`);
        localStorage.setItem('rememberedWallet', normalized);
    }

    return normalized;
}

/**
 * Clear remembered wallet from localStorage
 */
export function clearRememberedWallet(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('rememberedWallet');
    console.log('[clearRememberedWallet] Cleared');
}

/**
 * Ensure wallet is on Polygon chain, switch or add if needed
 */
export async function ensurePolygon(provider: any): Promise<void> {
    const currentChainId = await provider.request({ method: 'eth_chainId' });

    if (currentChainId === POLYGON_CHAIN_ID_HEX) {
        return; // Already on Polygon
    }

    try {
        // Try to switch to Polygon
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: POLYGON_CHAIN_ID_HEX }],
        });
    } catch (switchError: any) {
        // Chain not added to wallet
        if (switchError.code === 4902) {
            try {
                // Add Polygon to wallet
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [POLYGON_CONFIG],
                });

                // Try switch again after adding
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: POLYGON_CHAIN_ID_HEX }],
                });
            } catch (addError: any) {
                if (addError.code === 4001) {
                    throw new Error('User rejected adding Polygon network');
                }
                throw new Error(`Failed to add Polygon network: ${addError.message}`);
            }
        } else if (switchError.code === 4001) {
            // User rejected the switch
            throw new Error('User rejected network switch');
        } else {
            throw new Error(`Failed to switch to Polygon: ${switchError.message}`);
        }
    }
}

/**
 * Get current chain ID from provider
 */
export async function getCurrentChainId(provider: any): Promise<string> {
    return provider.request({ method: 'eth_chainId' });
}

/**
 * Sign typed data with validated provider and payload
 */
export async function signTypedDataWithWallet(
    provider: any,
    signerAddress: string,
    typedData: any
): Promise<string> {
    // Validate typed data structure
    if (!typedData || typeof typedData !== 'object') {
        throw new Error('Invalid typed data: must be an object');
    }

    if (!typedData.domain || !typedData.types || !typedData.message || !typedData.primaryType) {
        throw new Error('Typed data missing required fields (domain, types, message, or primaryType)');
    }

    // Verify chain ID matches
    const currentChainId = await provider.request({ method: 'eth_chainId' });
    const expectedChainIdHex = '0x' + Number(typedData.domain.chainId).toString(16);

    if (currentChainId !== expectedChainIdHex) {
        throw new Error('Provider is not connected to the requested chain');
    }

    try {
        const signature = await provider.request({
            method: 'eth_signTypedData_v4',
            params: [signerAddress, JSON.stringify(typedData)],
        });

        return signature;
    } catch (error: any) {
        if (error.code === 4001) {
            throw new Error('User rejected the signature request');
        }

        if (error.message) {
            throw new Error(`Failed to sign: ${error.message}`);
        }

        throw new Error('Failed to sign: Unknown error');
    }
}

/**
 * Check if provider is on Polygon chain
 */
export async function isOnPolygon(provider: any): Promise<boolean> {
    try {
        const chainId = await getCurrentChainId(provider);
        return chainId === POLYGON_CHAIN_ID_HEX;
    } catch {
        return false;
    }
}
