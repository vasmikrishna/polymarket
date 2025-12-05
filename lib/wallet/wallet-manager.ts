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

const POLYGON_CHAIN_ID = 137;

/**
 * Universal chain ID getter that works with all provider shapes
 */
async function _getChainId(provider: any): Promise<string | null> {
    // 1. If provider.request exists
    if (provider?.request) {
        try {
            const chainId = await provider.request({ method: "eth_chainId" });
            if (chainId) return chainId;
        } catch { }
    }

    // 2. If provider.send exists (ethers v5)
    if (provider?.send) {
        try {
            const chainId = await provider.send("eth_chainId", []);
            if (chainId) return chainId;
        } catch { }
    }

    // 3. If provider.provider.request exists (WalletConnect, Coinbase)
    if (provider?.provider?.request) {
        try {
            const chainId = await provider.provider.request({ method: "eth_chainId" });
            if (chainId) return chainId;
        } catch { }
    }

    // 4. Fallback: net_version
    try {
        const v =
            (provider?.request && await provider.request({ method: "net_version" })) ||
            (provider?.send && await provider.send("net_version", [])) ||
            (provider?.provider?.request && await provider.provider.request({ method: "net_version" }));

        if (v) return "0x" + parseInt(v, 10).toString(16);
    } catch { }

    return null;
}

function isEip1193Provider(obj: any): obj is { request: Function } {
    return !!obj && typeof obj.request === "function";
}

function isEthersProvider(obj: any): obj is { getNetwork?: Function, send?: Function, provider?: any } {
    return !!obj && (typeof obj.getNetwork === "function" || typeof obj.send === "function");
}

async function _callRequest(provider: any, payload: { method: string; params?: any[] }) {
    if (!provider) throw new Error("No provider available");

    if (isEip1193Provider(provider)) {
        return provider.request(payload);
    }

    if (provider.provider && isEip1193Provider(provider.provider)) {
        return provider.provider.request(payload);
    }

    if (typeof provider.send === "function") {
        return provider.send(payload.method, payload.params ?? []);
    }

    if (typeof provider.sendAsync === "function") {
        return new Promise((resolve, reject) => {
            provider.sendAsync(
                { jsonrpc: "2.0", id: Date.now(), method: payload.method, params: payload.params ?? [] },
                (err: any, res: any) => (err ? reject(err) : resolve(res?.result ?? res))
            );
        });
    }

    if (provider.provider) {
        return _callRequest(provider.provider, payload);
    }

    throw new Error("Provider does not support requests");
}

/**
 * Ensure wallet is on Polygon chain, switch or add if needed
 * Returns true if on Polygon or successfully switched, false otherwise
 */
export async function ensurePolygon(provider: any): Promise<boolean> {
    try {
        if (isEthersProvider(provider) && typeof provider.getNetwork === "function") {
            const net = await provider.getNetwork();
            if (net && typeof net.chainId === "number") {
                if (net.chainId === POLYGON_CHAIN_ID) return true;
            }
        }

        let chainIdResult: any;
        try {
            chainIdResult = await _callRequest(provider, { method: "eth_chainId" });
        } catch (err) {
            try {
                chainIdResult = await _callRequest(provider, { method: "net_version" });
            } catch (e) {
                chainIdResult = null;
            }
        }

        let currentChainHex: string | null = null;
        if (typeof chainIdResult === "string") {
            if (chainIdResult.startsWith("0x")) currentChainHex = chainIdResult;
            else currentChainHex = "0x" + parseInt(chainIdResult, 10).toString(16);
        } else if (typeof chainIdResult === "number") {
            currentChainHex = "0x" + chainIdResult.toString(16);
        }

        if (currentChainHex === POLYGON_CHAIN_ID_HEX) return true;

        try {
            await _callRequest(provider, {
                method: "wallet_switchEthereumChain",
                params: [{ chainId: POLYGON_CHAIN_ID_HEX }],
            });
            return true;
        } catch (switchErr: any) {
            try {
                await _callRequest(provider, {
                    method: "wallet_addEthereumChain",
                    params: [
                        {
                            chainId: POLYGON_CHAIN_ID_HEX,
                            chainName: "Polygon Mainnet",
                            nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
                            rpcUrls: ["https://polygon-rpc.com/"],
                            blockExplorerUrls: ["https://polygonscan.com/"],
                        },
                    ],
                });
                await _callRequest(provider, {
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: POLYGON_CHAIN_ID_HEX }],
                });
                return true;
            } catch (addErr) {
                if (process.env.NODE_ENV === "development") {
                    console.warn("ensurePolygon: chain switch/add failed", switchErr, addErr);
                }
                return false;
            }
        }
    } catch (err) {
        if (process.env.NODE_ENV === "development") {
            console.error("ensurePolygon: unexpected provider shape or error", err);
        }
        return false;
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

    // Verify chain ID matches using universal provider detection
    let chainIdHex = await _getChainId(provider);

    if (!chainIdHex) {
        throw new Error("Unable to determine network chain ID from provider");
    }

    // Normalize to hex format
    if (!chainIdHex.startsWith("0x")) {
        chainIdHex = "0x" + parseInt(chainIdHex, 10).toString(16);
    }

    const expected = "0x" + Number(typedData.domain.chainId).toString(16);

    if (chainIdHex !== expected) {
        // Wallet is on wrong network - attempt to switch
        if (provider?.request) {
            try {
                await provider.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: expected }]
                });
            } catch (switchErr: any) {
                // If chain not added, try to add it (assumed Polygon)
                if (switchErr.code === 4902) {
                    try {
                        await provider.request({
                            method: "wallet_addEthereumChain",
                            params: [{
                                chainId: expected,
                                chainName: "Polygon Mainnet",
                                nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
                                rpcUrls: ["https://polygon-rpc.com/"],
                                blockExplorerUrls: ["https://polygonscan.com/"],
                            }],
                        });
                    } catch { }
                }
            }
        }

        // Retry retrieving chainId after switching
        chainIdHex = await _getChainId(provider);

        if (!chainIdHex) {
            throw new Error("Wallet must be connected to Polygon network");
        }

        if (!chainIdHex.startsWith("0x")) {
            chainIdHex = "0x" + parseInt(chainIdHex, 10).toString(16);
        }

        if (chainIdHex !== expected) {
            throw new Error("Wallet must be connected to Polygon network");
        }
    }

    // Ensure wallet is authorized - request accounts first
    try {
        if (provider?.request) {
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please connect your wallet.');
            }
        }
    } catch (err: any) {
        if (err.code === 4001) {
            throw new Error('User rejected wallet connection');
        }
        // If it's our custom error, re-throw it
        if (err.message.includes('No accounts')) {
            throw err;
        }
        // Otherwise, continue - some providers might not support eth_requestAccounts
    }

    try {
        const signature = await _callRequest(provider, {
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
