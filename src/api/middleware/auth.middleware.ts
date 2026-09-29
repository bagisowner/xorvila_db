import { Request, Response, NextFunction } from 'express';
import { query } from '../../database/pool.js';
import { hashToken } from '../../security/tokens.js';
import crypto from 'crypto';
import { env } from '../../config/env.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  name?: string;
  avatar?: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  authType?: 'session' | 'api_key';
  sessionId?: string;
  apiKeyId?: string;
  apiKeyScopes?: string[];
}

export function setSessionCookies(res: Response, req: Request, sessionToken: string, expiresAt?: Date) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || (req.headers.origin && (req.headers.origin as string).startsWith('https://'));
  const cookieOptions: any = {
    httpOnly: true,
    secure: Boolean(isHttps),
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
  };
  if (expiresAt) {
    cookieOptions.expires = expiresAt;
  } else {
    cookieOptions.maxAge = 7 * 24 * 60 * 60 * 1000;
  }
  res.cookie('mcpanel_session', sessionToken, cookieOptions);
}

export function clearSessionCookies(res: Response, req: Request) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || (req.headers.origin && (req.headers.origin as string).startsWith('https://'));
  const options: any = {
    path: '/',
    httpOnly: true,
    secure: Boolean(isHttps),
    sameSite: isHttps ? 'none' : 'lax',
  };
  res.clearCookie('mcpanel_session', options);
}

export async function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    // 1. Check HttpOnly session cookie
    if (req.cookies && req.cookies.mcpanel_session) {
      token = req.cookies.mcpanel_session;
    }

    // 2. Check Authorization header
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please sign in or provide a valid Bearer API key.',
        },
        requestId: req.headers['x-request-id'] || 'req_' + Math.random().toString(36).substring(2, 9),
      });
    }

    // Handle API Key Authentication (format: mc_live_... or mcp_live_...)
    if (token.startsWith('mc_live_') || token.startsWith('mcp_live_')) {
      const keyHash = crypto
        .createHmac('sha256', env.API_KEY_SECRET || 'mcpanel-api-key-secret')
        .update(token)
        .digest('hex');

      const keyRes = await query(
        `SELECT ak.*, u.email, u.username, u.name, u.avatar, r.name as role_name
         FROM api_keys ak
         JOIN users u ON ak.user_id = u.id
         JOIN roles r ON u.role_id = r.id
         WHERE ak.key_hash = $1`,
        [keyHash]
      );

      if (!keyRes.rows || keyRes.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Provided API Key is invalid.',
          },
          requestId: req.headers['x-request-id'] || 'req_' + Math.random().toString(36).substring(2, 9),
        });
      }

      const keyRow = keyRes.rows[0];

      if (keyRow.revoked_at) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'REVOKED_API_KEY',
            message: 'This API Key has been revoked.',
          },
          requestId: req.headers['x-request-id'] || 'req_' + Math.random().toString(36).substring(2, 9),
        });
      }

      if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'EXPIRED_API_KEY',
            message: 'This API Key has expired.',
          },
          requestId: req.headers['x-request-id'] || 'req_' + Math.random().toString(36).substring(2, 9),
        });
      }

      // Parse scopes
      let scopes: string[] = [];
      try {
        if (typeof keyRow.scopes === 'string') {
          scopes = JSON.parse(keyRow.scopes);
        } else if (Array.isArray(keyRow.scopes)) {
          scopes = keyRow.scopes;
        }
      } catch {
        scopes = ['servers:read'];
      }

      // Update last_used_at in PostgreSQL
      await query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [keyRow.id]);

      req.authType = 'api_key';
      req.apiKeyId = keyRow.id;
      req.apiKeyScopes = scopes;
      req.user = {
        id: keyRow.user_id,
        email: keyRow.email,
        username: keyRow.username,
        name: keyRow.name || keyRow.username,
        avatar: keyRow.avatar,
        role: keyRow.role_name || 'admin',
      };

      return next();
    }

    // Handle Session Token Authentication
    const sessionTokenHash = hashToken(token);

    const sessionRes = await query(
      `SELECT s.id as session_id, s.user_id, s.expires_at, s.revoked_at,
              u.email, u.username, u.name, u.avatar,
              r.name as role_name
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > CURRENT_TIMESTAMP`,
      [sessionTokenHash]
    );

    if (!sessionRes.rows || sessionRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired or is invalid. Please log in again.',
        },
        requestId: req.headers['x-request-id'] || 'req_' + Math.random().toString(36).substring(2, 9),
      });
    }

    const sessionRow = sessionRes.rows[0];

    // Touch session activity in PostgreSQL
    await query('UPDATE sessions SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [sessionRow.session_id]);

    req.authType = 'session';
    req.sessionId = sessionRow.session_id;
    req.user = {
      id: sessionRow.user_id,
      email: sessionRow.email,
      username: sessionRow.username,
      name: sessionRow.name || sessionRow.username,
      avatar: sessionRow.avatar,
      role: sessionRow.role_name,
    };

    next();
  } catch (err: any) {
    next(err);
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
        },
      });
    }

    next();
  };
}

export function requireScope(requiredScope: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // If request authenticated by API Key, verify scopes
    if (req.authType === 'api_key') {
      const scopes = req.apiKeyScopes || [];
      if (!scopes.includes(requiredScope) && !scopes.includes('*')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_SCOPE',
            message: `Forbidden: API key lacks required scope '${requiredScope}'`,
          },
        });
      }
    }
    next();
  };
}
