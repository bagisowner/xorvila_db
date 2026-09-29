import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';

interface RateLimitStoreEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitStoreEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function createRateLimiter(options: {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
  message?: string;
}) {
  const windowMs = options.windowMs || env.RATE_LIMIT_API_WINDOW_MS;
  const max = options.max || env.RATE_LIMIT_API_MAX;
  const prefix = options.keyPrefix || 'global';
  const customMessage = options.message || 'Too many requests. Please slow down and try again later.';

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!env.RATE_LIMIT_ENABLED) {
      return next();
    }

    const clientIp = (req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown_ip').toString();
    const storeKey = `${prefix}:${clientIp}`;
    const now = Date.now();

    let entry = rateLimitStore.get(storeKey);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(storeKey, entry);
    } else {
      entry.count += 1;
    }

    const remaining = Math.max(0, max - entry.count);
    const resetInSeconds = Math.ceil((entry.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetInSeconds);

    if (entry.count > max) {
      res.setHeader('Retry-After', resetInSeconds);

      if (entry.count === max + 1) {
        console.warn(`⚠️ [RATE_LIMIT] ${prefix} limit exceeded for ${clientIp}`);
      }

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: customMessage,
          retryAfterSeconds: resetInSeconds,
        },
        requestId: req.headers['x-request-id'] || 'req_' + Math.random().toString(36).substring(2, 9),
      });
    }

    next();
  };
}

// Pre-configured limiters
export const authRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

export const apiRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_API_WINDOW_MS,
  max: env.RATE_LIMIT_API_MAX,
  keyPrefix: 'api',
});
