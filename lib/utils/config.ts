// Server-side config (for API routes)
export const config = {
  polymarket: {
    clobApiUrl: process.env.POLY_CLOB_API_URL || 'https://clob.polymarket.com',
    relayerUrl: process.env.POLY_RELAYER_URL || 'https://relayer-v2.polymarket.com',
    gammaApiUrl: process.env.POLY_GAMMA_API_URL || 'https://gamma-api.polymarket.com',
    builderApiKey: process.env.POLY_BUILDER_API_KEY || '',
    builderSecret: process.env.POLY_BUILDER_SECRET || '',
    builderPassphrase: process.env.POLY_BUILDER_PASSPHRASE || '',
  },
  polygon: {
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    chainId: parseInt(process.env.POLYGON_CHAIN_ID || '137', 10),
  },
};

// Client-side config (only public/safe values)
export const clientConfig = {
  polymarket: {
    clobApiUrl: process.env.NEXT_PUBLIC_POLY_CLOB_API_URL || 'https://clob.polymarket.com',
    relayerUrl: process.env.NEXT_PUBLIC_POLY_RELAYER_URL || 'https://relayer-v2.polymarket.com',
    gammaApiUrl: process.env.NEXT_PUBLIC_POLY_GAMMA_API_URL || 'https://gamma-api.polymarket.com',
  },
  polygon: {
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com',
    chainId: parseInt(process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID || '137', 10),
  },
};

