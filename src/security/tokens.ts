import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Generate cryptographically secure random tokens
 */
export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash a token before storing in database (for session tokens, reset tokens, API keys)
 */
export function hashToken(token: string): string {
  return crypto
    .createHmac('sha256', env.TOKEN_SECRET || 'mcpanel-token-secret')
    .update(token)
    .digest('hex');
}

/**
 * Generate an API Key in format: mc_live_<random_hex>
 * Returns the plain key (shown once to user) and its hashed representation for DB
 */
export function generateApiKey(): { key: string; keyPrefix: string; keyHash: string } {
  const randomPart = crypto.randomBytes(24).toString('hex');
  const key = `mc_live_${randomPart}`;
  const keyPrefix = `${key.substring(0, 11)}...`;
  const keyHash = crypto
    .createHmac('sha256', env.API_KEY_SECRET || 'mcpanel-api-key-secret')
    .update(key)
    .digest('hex');

  return { key, keyPrefix, keyHash };
}

/**
 * Verify a provided API Key against a stored hash
 */
export function verifyApiKey(key: string, storedHash: string): boolean {
  try {
    const computedHash = crypto
      .createHmac('sha256', env.API_KEY_SECRET || 'mcpanel-api-key-secret')
      .update(key)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'utf8'),
      Buffer.from(storedHash, 'utf8')
    );
  } catch {
    return false;
  }
}
