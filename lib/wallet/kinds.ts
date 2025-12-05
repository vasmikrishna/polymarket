/**
 * Canonical wallet kind definitions
 */

export const WalletKind = {
    METAMASK: 'metamask',
    COINBASE: 'coinbase',
    PHANTOM: 'phantom',
    WALLETCONNECT: 'walletconnect',
} as const;

export type WalletKind = typeof WalletKind[keyof typeof WalletKind];

/**
 * Normalize legacy wallet names to canonical format
 */
export function normalizeWalletKind(raw?: string | null): WalletKind | null {
    if (!raw) return null;

    const normalized = raw.toLowerCase().trim();

    // Handle common variations
    if (normalized.includes('meta')) return WalletKind.METAMASK;
    if (normalized.includes('coin')) return WalletKind.COINBASE;
    if (normalized.includes('phantom')) return WalletKind.PHANTOM;
    if (normalized.includes('wallet') && normalized.includes('connect')) return WalletKind.WALLETCONNECT;

    // Direct match
    if (normalized === 'metamask') return WalletKind.METAMASK;
    if (normalized === 'coinbase') return WalletKind.COINBASE;
    if (normalized === 'phantom') return WalletKind.PHANTOM;
    if (normalized === 'walletconnect') return WalletKind.WALLETCONNECT;

    return null;
}
