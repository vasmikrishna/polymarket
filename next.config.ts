import type { NextConfig } from "next";
import path from "path";

// Use relative path for Turbopack (doesn't support Windows absolute paths)
// For Webpack, we'll use the absolute path resolved at runtime
const ethersV5RelativePath = 'node_modules/ethers-v5';

// Get the absolute path for Webpack (which supports it)
let ethersV5AbsolutePath: string;
try {
  ethersV5AbsolutePath = require.resolve('ethers-v5');
} catch {
  ethersV5AbsolutePath = path.join(process.cwd(), 'node_modules', 'ethers-v5');
}

const nextConfig: NextConfig = {
  // Turbopack configuration (used by default in Next.js 16)
  turbopack: {
    resolveAlias: {
      // Use relative path for Turbopack (Windows absolute paths not supported)
      'ethers-v5': ethersV5RelativePath,
    },
  },
  // Webpack configuration (fallback when --webpack flag is used)
  webpack: (config, { isServer }) => {
    // Resolve ethers-v5 alias using absolute path (Webpack supports it)
    config.resolve.alias = {
      ...config.resolve.alias,
      'ethers-v5': ethersV5AbsolutePath,
    };
    return config;
  },
};

export default nextConfig;
