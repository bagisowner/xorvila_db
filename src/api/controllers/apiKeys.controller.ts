import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../../database/pool.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { generateApiKey } from '../../security/tokens.js';

export const ALLOWED_SCOPES = [
  'users:read',
  'users:write',
  'servers:read',
  'servers:write',
  'settings:read',
  'settings:write',
  'system:read',
  'api-keys:read',
  'api-keys:write',
];

export async function listApiKeys(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let sql = `
      SELECT ak.id, ak.user_id, ak.name, ak.key_prefix, ak.scopes, ak.expires_at,
             ak.created_at, ak.last_used_at, ak.revoked_at,
             u.username, u.email
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
    `;
    const params: any[] = [];

    // Non-admins only see their own keys
    if (req.user?.role !== 'admin') {
      sql += ' WHERE ak.user_id = $1';
      params.push(req.user?.id);
    }

    sql += ' ORDER BY ak.created_at DESC';

    const keysRes = await query(sql, params);

    const formattedKeys = keysRes.rows.map((row: any) => {
      let parsedScopes: string[] = [];
      try {
        parsedScopes = typeof row.scopes === 'string' ? JSON.parse(row.scopes) : (row.scopes || []);
      } catch {
        parsedScopes = ['servers:read'];
      }
      return {
        ...row,
        scopes: parsedScopes,
      };
    });

    res.json({
      success: true,
      data: { api_keys: formattedKeys },
    });
  } catch (err) {
    next(err);
  }
}

export async function getApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    let sql = `
      SELECT ak.id, ak.user_id, ak.name, ak.key_prefix, ak.scopes, ak.expires_at,
             ak.created_at, ak.last_used_at, ak.revoked_at,
             u.username, u.email
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.id = $1
    `;
    const params: any[] = [id];

    if (req.user?.role !== 'admin') {
      sql += ' AND ak.user_id = $2';
      params.push(req.user?.id);
    }

    const keyRes = await query(sql, params);

    if (keyRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'API key not found' },
      });
    }

    const row = keyRes.rows[0];
    let parsedScopes: string[] = [];
    try {
      parsedScopes = typeof row.scopes === 'string' ? JSON.parse(row.scopes) : (row.scopes || []);
    } catch {
      parsedScopes = ['servers:read'];
    }

    res.json({
      success: true,
      data: {
        api_key: {
          ...row,
          scopes: parsedScopes,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createApiKeyHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { name, scopes, expiresInDays } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'API key name is required' },
      });
    }

    // Validate and sanitize scopes
    let finalScopes: string[] = ['servers:read'];
    if (Array.isArray(scopes) && scopes.length > 0) {
      finalScopes = scopes.filter((s: string) => ALLOWED_SCOPES.includes(s));
      if (finalScopes.length === 0) {
        finalScopes = ['servers:read'];
      }
    }

    const { key, keyPrefix, keyHash } = generateApiKey();
    const keyId = crypto.randomUUID();
    const expiresAt = expiresInDays && Number(expiresInDays) > 0 
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000) 
      : null;

    await query(
      `INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [keyId, userId, name.trim(), keyPrefix, keyHash, JSON.stringify(finalScopes), expiresAt]
    );

    res.status(201).json({
      success: true,
      data: {
        api_key: {
          id: keyId,
          user_id: userId,
          name: name.trim(),
          key_prefix: keyPrefix,
          scopes: finalScopes,
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          created_at: new Date().toISOString(),
          last_used_at: null,
          token: key, // Shown ONLY once upon creation!
        },
        notice: 'Store this token securely. It will not be shown again.',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function revokeApiKeyHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = req.user!;

    let sql = 'UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1';
    const params: any[] = [id];

    if (user.role !== 'admin') {
      sql += ' AND user_id = $2';
      params.push(user.id);
    }

    const result = await query(sql, params);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'API key not found or not owned by you' },
      });
    }

    res.json({
      success: true,
      data: { message: 'API key revoked successfully' },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteApiKeyHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = req.user!;

    let sql = 'DELETE FROM api_keys WHERE id = $1';
    const params: any[] = [id];

    if (user.role !== 'admin') {
      sql += ' AND user_id = $2';
      params.push(user.id);
    }

    const result = await query(sql, params);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'API key not found or not owned by you' },
      });
    }

    res.json({
      success: true,
      data: { message: 'API key deleted successfully' },
    });
  } catch (err) {
    next(err);
  }
}
