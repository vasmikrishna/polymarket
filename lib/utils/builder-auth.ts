import { createHmac } from 'crypto';

/**
 * Creates a signature for Polymarket Builder API authentication
 * This is used for order attribution and revenue sharing
 */
export function createBuilderSignature(
    method: string,
    path: string,
    body: string,
    timestamp: string,
    secret: string
): string {
    // Builder signature format: timestamp + method + path + body
    const message = timestamp + method + path + body;

    // Decode base64 secret
    const decodedSecret = Buffer.from(secret, 'base64');

    // Create HMAC-SHA256 signature
    const hmac = createHmac('sha256', decodedSecret);
    hmac.update(message);

    // Return base64-encoded signature
    return hmac.digest('base64');
}
