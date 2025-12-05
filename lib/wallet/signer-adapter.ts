import { ethers } from 'ethers';

/**
 * Adapter to make an Ethers v6 Signer compatible with Ethers v5 expectations
 * Specifically maps _signTypedData to signTypedData
 */
export class V6ToV5SignerAdapter {
    private signer: ethers.JsonRpcSigner | ethers.Wallet;
    public provider?: ethers.Provider;
    public address?: string;

    constructor(signer: ethers.JsonRpcSigner | ethers.Wallet) {
        this.signer = signer;
        this.provider = signer.provider || undefined;
    }

    async getAddress(): Promise<string> {
        if (this.address) return this.address;
        this.address = await this.signer.getAddress();
        return this.address;
    }

    async signMessage(message: string | Uint8Array): Promise<string> {
        return this.signer.signMessage(message);
    }

    // Ethers v5 method expected by SDK
    async _signTypedData(domain: any, types: any, value: any): Promise<string> {
        return this.signer.signTypedData(domain, types, value);
    }

    // Expose original signer methods if needed
    connect(provider: ethers.Provider): any {
        return new V6ToV5SignerAdapter(this.signer.connect(provider) as any);
    }
}
