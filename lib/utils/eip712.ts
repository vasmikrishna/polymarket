/**
 * EIP-712 Typed Data utilities for Polymarket orders
 */

/**
 * Convert decimal value to wei string (18 decimals)
 */
function toWeiString(value: string): string {
    const num = parseFloat(value);
    if (isNaN(num)) {
        throw new Error(`Invalid numeric value: ${value}`);
    }
    const weiValue = Math.round(num * 1e18);
    return BigInt(weiValue).toString();
}

export interface OrderTypedData {
    domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract: string;
    };
    types: {
        EIP712Domain: Array<{ name: string; type: string }>;
        Order: Array<{ name: string; type: string }>;
    };
    primaryType: string;
    message: {
        maker: string;
        price: string;
        size: string;
        side: string;
        tokenID: string;
    };
}

/**
 * Build EIP-712 typed data for Polymarket order signing
 * MetaMask compatible (string values, includes EIP712Domain in types)
 */
export function buildOrderTypedData(params: {
    price: string;
    size: string;
    side: string;
    tokenID: string;
    maker: string;
}): OrderTypedData {
    return {
        domain: {
            name: 'Polymarket CTF Exchange',
            version: '1',
            chainId: 137,
            verifyingContract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
        },
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ],
            Order: [
                { name: 'maker', type: 'address' },
                { name: 'price', type: 'uint256' },
                { name: 'size', type: 'uint256' },
                { name: 'side', type: 'uint256' },
                { name: 'tokenID', type: 'uint256' },
            ],
        },
        primaryType: 'Order',
        message: {
            maker: params.maker,
            price: toWeiString(params.price),
            size: toWeiString(params.size),
            side: (params.side === 'BUY' ? 0 : 1).toString(),
            tokenID: params.tokenID.toString(),
        },
    };
}

/**
 * Sign typed data with MetaMask
 */
export async function signTypedDataWithMetaMask(
    typedData: OrderTypedData,
    signerAddress: string
): Promise<string> {
    const provider = (window as any).ethereum;

    if (!provider) {
        throw new Error('MetaMask is not installed');
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
