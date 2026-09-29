const REDACTED_FIELDS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'secret',
  'token',
  'token_hash',
  'tokenHash',
  'api_key_hash',
  'apiKeyHash',
  'refresh_token',
  'refreshToken',
  'session_secret',
  'smtp_password',
  'client_secret',
  'google_client_secret',
  'discord_client_secret',
  'authorization',
  'cookie',
]);

/**
 * Recursively redacts sensitive fields from objects before logging or outputting.
 */
export function sanitizeObject<T>(data: T): T {
  if (data === null || data === undefined) return data;

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeObject(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (REDACTED_FIELDS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
      result[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      result[key] = sanitizeObject(val);
    } else {
      result[key] = val;
    }
  }

  return result as T;
}

/**
 * Strips confidential credentials from user database records before returning to clients
 */
export function sanitizeUser(user: Record<string, any>) {
  if (!user) return null;
  const { password_hash, passwordHash, ...clean } = user;
  return clean;
}
