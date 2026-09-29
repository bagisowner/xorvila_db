import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../../database/pool.js';
import { hashPassword, verifyPassword } from '../../security/hasher.js';
import { hashToken, generateRandomToken } from '../../security/tokens.js';
import { setSessionCookies, clearSessionCookies, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { env } from '../../config/env.js';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, username, password, name } = req.body;

    const normalizedEmail = (email || '').toLowerCase().trim();
    const normalizedUsername = (username || '').toLowerCase().trim();

    // Check if user already exists
    const existing = await query(
      'SELECT id, email, username FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $2',
      [normalizedEmail, normalizedUsername]
    );

    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      const field = match.email.toLowerCase() === normalizedEmail ? 'email' : 'username';
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_ALREADY_EXISTS',
          message: `A user with this ${field} already exists.`,
        },
      });
    }

    // Fetch user role
    const usersCountRes = await query('SELECT count(*) as count FROM users');
    const isFirstUser = parseInt(usersCountRes.rows[0].count, 10) === 0;
    
    const roleName = isFirstUser ? 'admin' : 'user';
    const roleRes = await query("SELECT id FROM roles WHERE name = $1", [roleName]);
    let roleId = roleRes.rows[0]?.id;
    
    if (!roleId) {
      roleId = isFirstUser ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002';
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await query(
      `INSERT INTO users (id, email, username, password_hash, role_id, name)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, normalizedEmail, normalizedUsername, passwordHash, roleId, name || normalizedUsername]
    );

    // Create session
    const sessionToken = generateRandomToken(32);
    const sessionTokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), userId, sessionTokenHash, expiresAt, ip, userAgent]
    );

    setSessionCookies(res, req, sessionToken, expiresAt);

    res.status(201).json({
      success: true,
      data: {
        expires_at: expiresAt.toISOString(),
        user: {
          id: userId,
          email: normalizedEmail,
          username: normalizedUsername,
          name: name || normalizedUsername,
          role: 'user',
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { usernameOrEmail, password } = req.body;
    const identifier = (usernameOrEmail || '').toLowerCase().trim();

    const userRes = await query(
      `SELECT u.id, u.email, u.username, u.password_hash, u.name, u.avatar, u.created_at,
              r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.email) = $1 OR LOWER(u.username) = $1`,
      [identifier]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username/email or password.',
        },
      });
    }

    const user = userRes.rows[0];

    let isValidPassword = await verifyPassword(password, user.password_hash);

    // Handle trimmed password fallback
    if (!isValidPassword && typeof password === 'string' && password.trim() !== password) {
      isValidPassword = await verifyPassword(password.trim(), user.password_hash);
    }

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username/email or password.',
        },
      });
    }

    // Create session in PostgreSQL
    const sessionToken = generateRandomToken(32);
    const sessionTokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), user.id, sessionTokenHash, expiresAt, ip, userAgent]
    );

    setSessionCookies(res, req, sessionToken, expiresAt);

    return res.json({
      success: true,
      data: {
        expires_at: expiresAt.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name || user.username,
          avatar: user.avatar,
          role: user.role_name || 'user',
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.mcpanel_session;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7).trim();
    }

    if (token) {
      const tokenHash = hashToken(token);
      await query(
        'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
        [tokenHash]
      );
    }

    clearSessionCookies(res, req);

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (err) {
    next(err);
  }
}

export async function listSessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    const sessionsRes = await query(
      `SELECT id, created_at, expires_at, last_used_at, revoked_at,
              ip, user_agent
       FROM sessions
       WHERE user_id = $1 AND (revoked_at IS NULL OR revoked_at > CURRENT_TIMESTAMP - INTERVAL '1 day')
       ORDER BY last_used_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        sessions: sessionsRes.rows.map(s => ({
          ...s,
          isCurrent: s.id === req.sessionId
        }))
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function revokeSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    const result = await query(
      'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Session not found or already revoked' } });
    }

    res.json({
      success: true,
      data: { message: 'Session revoked successfully' }
    });
  } catch (err) {
    next(err);
  }
}

export async function revokeAllSessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const keepCurrent = req.query.keepCurrent === 'true';

    let sql = 'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL';
    const params: any[] = [userId];

    if (keepCurrent && req.sessionId) {
      sql += ' AND id != $2';
      params.push(req.sessionId);
    }

    await query(sql, params);

    res.json({
      success: true,
      data: { message: keepCurrent ? 'All other sessions revoked' : 'All sessions revoked' }
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }

    res.json({
      success: true,
      data: {
        user: req.user,
        authType: req.authType,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();

    const userRes = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    let resetToken: string | undefined;

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      resetToken = generateRandomToken(32);
      const tokenHash = hashToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await query(
        `INSERT INTO password_resets (id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [crypto.randomUUID(), user.id, tokenHash, expiresAt]
      );
    }

    // Always respond with the same message to avoid account enumeration
    res.json({
      success: true,
      data: {
        message: 'If the provided email is registered, password reset instructions have been issued.',
        ...(process.env.NODE_ENV !== 'production' && resetToken ? { resetToken } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;

    if (!token || !password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Token and a password of at least 8 characters are required.',
        },
      });
    }

    const tokenHash = hashToken(token);
    const resetRes = await query(
      `SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at
       FROM password_resets pr
       WHERE pr.token_hash = $1
         AND pr.used_at IS NULL
         AND pr.expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );

    if (resetRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Password reset token is invalid or has expired.',
        },
      });
    }

    const resetRow = resetRes.rows[0];
    const newHash = await hashPassword(password);

    // Update password
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      newHash,
      resetRow.user_id,
    ]);

    // Mark token as used
    await query('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [resetRow.id]);

    // Invalidate existing sessions for security
    await query('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1', [resetRow.user_id]);

    res.json({
      success: true,
      data: { message: 'Password has been reset successfully. Please log in with your new password.' },
    });
  } catch (err) {
    next(err);
  }
}

export function getOAuthStatus(req: Request, res: Response) {
  res.json({
    success: true,
    data: {
      google: {
        enabled: Boolean(env.OAUTH_GOOGLE_ENABLED && env.GOOGLE_CLIENT_ID),
        clientId: env.GOOGLE_CLIENT_ID || undefined,
      },
      discord: {
        enabled: Boolean(env.OAUTH_DISCORD_ENABLED && env.DISCORD_CLIENT_ID),
        clientId: env.DISCORD_CLIENT_ID || undefined,
      },
    },
  });
}
