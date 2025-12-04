import { config } from '@/lib/utils/config';

export interface BuilderSignerConfig {
  apiKey: string;
  secret: string;
  passphrase: string;
}

export class BuilderSigner {
  private config: BuilderSignerConfig;

  constructor() {
    this.config = {
      apiKey: config.polymarket.builderApiKey,
      secret: config.polymarket.builderSecret,
      passphrase: config.polymarket.builderPassphrase,
    };
  }

  async signOrder(order: any): Promise<string> {
    // This will be implemented in the API route
    // The actual signing logic should be server-side only
    throw new Error('Signing should be done server-side via API route');
  }

  getConfig(): BuilderSignerConfig {
    return this.config;
  }
}

