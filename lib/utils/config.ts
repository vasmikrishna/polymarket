/**
 * Sanitizes a base64 secret by removing whitespace and invalid characters.
 * Handles both standard base64 (+, /) and URL-safe base64 (-, _).
 * Converts URL-safe base64 to standard base64 format.
 * 
 * @param secret - The base64 secret string to sanitize
 * @returns Sanitized base64 string in standard format
 * @throws Error if the secret cannot be sanitized to valid base64
 */
export function sanitizeBase64Secret(secret: string): string {
  if (!secret || typeof secret !== 'string') {
    throw new Error('Secret must be a non-empty string');
  }

  // Store original for comparison
  const original = secret;
  const originalLength = secret.length;

  // Step 1: Trim leading/trailing whitespace (spaces, tabs, newlines, etc.)
  let sanitized = secret.trim();

  // Step 2: Remove all invalid base64 characters (but keep both standard and URL-safe variants)
  // Standard base64: A-Z, a-z, 0-9, +, /, = (padding)
  // URL-safe base64: A-Z, a-z, 0-9, -, _, = (padding)
  // Remove any character that's not in either set
  const invalidChars = sanitized.match(/[^A-Za-z0-9+/_\-=]/g);
  if (invalidChars && invalidChars.length > 0) {
    const uniqueInvalidChars = [...new Set(invalidChars)];
    console.warn(
      `[Base64 Sanitization] Found ${invalidChars.length} invalid character(s): ${uniqueInvalidChars.map(c => `'${c}' (${c.charCodeAt(0)})`).join(', ')}`
    );
  }
  sanitized = sanitized.replace(/[^A-Za-z0-9+/_\-=]/g, '');

  // Step 3: Check if it's empty after sanitization
  if (!sanitized || sanitized.length === 0) {
    throw new Error(
      'Secret is invalid: after removing whitespace and invalid characters, the secret is empty. ' +
      'Please check your POLY_BUILDER_SECRET environment variable.'
    );
  }

  // Step 4: Convert URL-safe base64 to standard base64
  // URL-safe base64 uses - and _ instead of + and /
  // We need to convert these to standard base64 for atob() compatibility
  const isUrlSafe = sanitized.includes('-') || sanitized.includes('_');
  if (isUrlSafe) {
    sanitized = sanitized.replace(/-/g, '+').replace(/_/g, '/');
    console.log('[Base64 Sanitization] Converted URL-safe base64 to standard base64 format');
  }

  // Step 5: Validate base64 format
  // Base64 strings should have length that's a multiple of 4 (after padding)
  // Padding can be 0, 1, or 2 '=' characters at the end
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  if (!base64Regex.test(sanitized)) {
    throw new Error(
      'Secret is not valid base64 format. ' +
      'Base64 strings can only contain A-Z, a-z, 0-9, +, /, and = (for padding). ' +
      'URL-safe base64 (-, _) will be converted automatically.'
    );
  }

  // Step 6: Fix padding if needed (base64 strings must be multiple of 4)
  // Remove any existing padding first to check the actual content length
  const withoutPadding = sanitized.replace(/=+$/, '');
  const paddingNeeded = (4 - (withoutPadding.length % 4)) % 4;
  const currentPadding = sanitized.length - withoutPadding.length;
  
  if (currentPadding > 2) {
    // Too much padding, fix it
    sanitized = withoutPadding + '='.repeat(paddingNeeded);
    console.log(`[Base64 Sanitization] Fixed padding: removed excess padding (was ${currentPadding}, now ${paddingNeeded})`);
  } else if (paddingNeeded > 0 && currentPadding !== paddingNeeded) {
    // Need to add or fix padding
    sanitized = withoutPadding + '='.repeat(paddingNeeded);
    console.log(`[Base64 Sanitization] Fixed padding: ${currentPadding} -> ${paddingNeeded} padding character(s)`);
  }
  // If padding is already correct, keep it as is

  // Step 7: Try to decode to verify it's valid base64 using Buffer
  try {
    // Use Buffer.from with base64 encoding to validate
    const decoded = Buffer.from(sanitized, 'base64');
    if (decoded.length === 0 && sanitized.length > 0) {
      throw new Error('Decoded buffer is empty');
    }
  } catch (error: any) {
    throw new Error(
      `Secret is not valid base64: decoding failed. ${error.message}`
    );
  }

  // Step 8: Additional validation using atob (which is what the library uses internally)
  // The @polymarket/clob-client uses atob() in base64ToArrayBuffer
  try {
    // Try to use atob if available (Node.js 16+ has it in globalThis)
    let atobAvailable = false;
    let atobResult: any = null;
    
    if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
      atobAvailable = true;
      atobResult = globalThis.atob(sanitized);
      console.log('[Base64 Sanitization] atob validation passed');
    } else if (typeof Buffer !== 'undefined') {
      // Fallback: Use Buffer for validation (atob equivalent)
      const testDecode = Buffer.from(sanitized, 'base64');
      const testEncode = testDecode.toString('base64');
      // The re-encoded version should match (accounting for padding)
      const originalNoPadding = sanitized.replace(/=+$/, '');
      const encodedNoPadding = testEncode.replace(/=+$/, '');
      if (encodedNoPadding !== originalNoPadding) {
        throw new Error(`Base64 round-trip validation failed: "${originalNoPadding.substring(0, 20)}..." != "${encodedNoPadding.substring(0, 20)}..."`);
      }
      console.log('[Base64 Sanitization] Buffer validation passed (atob not available)');
    } else {
      console.warn('[Base64 Sanitization] Neither atob nor Buffer available for final validation');
    }
  } catch (error: any) {
    console.error('[Base64 Sanitization] Validation error:', error.message);
    console.error('[Base64 Sanitization] Sanitized secret (first 50 chars):', sanitized.substring(0, 50));
    throw new Error(
      `Secret is not valid base64: validation failed. ${error.message}`
    );
  }

  // Step 8: Log warning if sanitization removed characters (for debugging)
  if (sanitized.length !== originalLength || sanitized !== original.trim()) {
    const removedChars = originalLength - sanitized.length;
    console.warn(
      `[Base64 Sanitization] Removed ${removedChars} invalid character(s) from POLY_BUILDER_SECRET. ` +
      `Original length: ${originalLength}, Sanitized length: ${sanitized.length}`
    );
  }

  return sanitized;
}

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

