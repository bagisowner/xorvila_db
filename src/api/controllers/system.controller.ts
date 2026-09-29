import { Request, Response, NextFunction } from 'express';
import { query, testConnection } from '../../database/pool.js';
import { env } from '../../config/env.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const ALLOWED_CONFIG_KEYS = [
  'API_PORT',
  'CORS_ORIGINS',
  'SESSION_DURATION_DAYS',
  'OAUTH_GOOGLE_ENABLED',
  'GOOGLE_CLIENT_ID',
  'OAUTH_DISCORD_ENABLED',
  'DISCORD_CLIENT_ID',
  'REGISTRATION_ENABLED',
] as const;

type AllowedConfigKey = (typeof ALLOWED_CONFIG_KEYS)[number];

const RESTART_REQUIRED_KEYS = new Set(['API_PORT']);

// In-memory runtime override store loaded from system_settings table
export const runtimeConfig: Record<string, any> = {};

export async function loadRuntimeConfig() {
  try {
    const res = await query('SELECT key, value FROM system_settings');
    for (const row of res.rows) {
      if (ALLOWED_CONFIG_KEYS.includes(row.key as any)) {
        try {
          runtimeConfig[row.key] = JSON.parse(row.value);
        } catch {
          runtimeConfig[row.key] = row.value;
        }
      }
    }
  } catch (err: any) {
    // If table doesn't exist yet during initial boot, ignore
  }
}

export async function getSystemStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const dbCheck = await testConnection();
    let isAuthOperational = false;
    let isRegistryOperational = false;
    let totalServers = 0;
    let totalUsers = 0;

    if (dbCheck.connected) {
      try {
        const uCount = await query('SELECT count(*) as count FROM users');
        totalUsers = parseInt(uCount.rows[0]?.count || '0', 10);
        isAuthOperational = true;
      } catch {
        isAuthOperational = false;
      }

      try {
        const sCount = await query('SELECT count(*) as count FROM servers');
        totalServers = parseInt(sCount.rows[0]?.count || '0', 10);
        isRegistryOperational = true;
      } catch {
        isRegistryOperational = false;
      }
    }

    const overallStatus = dbCheck.connected && isAuthOperational && isRegistryOperational ? 'online' : 'degraded';

    res.json({
      success: true,
      data: {
        status: overallStatus,
        database: dbCheck.connected ? 'connected' : 'disconnected',
        api: 'online',
        authentication: isAuthOperational ? 'operational' : 'degraded',
        serverRegistry: isRegistryOperational ? 'operational' : 'degraded',
        uptime: Math.floor(process.uptime()),
        version: '1.0.0',
        databaseEngine: dbCheck.engine,
        metrics: {
          usersCount: totalUsers,
          serversCount: totalServers,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getSystemConfig(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await loadRuntimeConfig();

    // Whitelist only safe values - NEVER secrets
    const safeConfig = {
      API_PORT: runtimeConfig['API_PORT'] ?? env.PORT ?? 3000,
      CORS_ORIGINS: runtimeConfig['CORS_ORIGINS'] ?? env.CORS_ORIGINS ?? '*',
      SESSION_DURATION_DAYS: runtimeConfig['SESSION_DURATION_DAYS'] ?? 7,
      OAUTH_GOOGLE_ENABLED: Boolean(runtimeConfig['OAUTH_GOOGLE_ENABLED'] ?? env.OAUTH_GOOGLE_ENABLED),
      GOOGLE_CLIENT_ID: runtimeConfig['GOOGLE_CLIENT_ID'] ?? env.GOOGLE_CLIENT_ID ?? '',
      OAUTH_DISCORD_ENABLED: Boolean(runtimeConfig['OAUTH_DISCORD_ENABLED'] ?? env.OAUTH_DISCORD_ENABLED),
      DISCORD_CLIENT_ID: runtimeConfig['DISCORD_CLIENT_ID'] ?? env.DISCORD_CLIENT_ID ?? '',
      REGISTRATION_ENABLED: Boolean(runtimeConfig['REGISTRATION_ENABLED'] ?? true),
    };

    res.json({
      success: true,
      data: {
        config: safeConfig,
        allowedKeys: ALLOWED_CONFIG_KEYS,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateSystemConfig(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Payload must be a JSON object of key-value settings' },
      });
    }

    let requiresRestart = false;
    const appliedKeys: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_CONFIG_KEYS.includes(key as any)) {
        continue; // Disallow arbitrary or sensitive settings
      }

      // Format value
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

      // Persist to PostgreSQL system_settings
      await query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [key, stringValue]
      );

      // Apply runtime override immediately
      runtimeConfig[key] = value;
      appliedKeys.push(key);

      if (RESTART_REQUIRED_KEYS.has(key)) {
        requiresRestart = true;
      }
    }

    res.json({
      success: true,
      data: {
        updated: true,
        appliedKeys,
        requiresRestart,
        message: requiresRestart
          ? 'Configuration updated. One or more modified settings require an API restart to take full effect.'
          : 'Configuration updated live and applied successfully.',
      },
    });
  } catch (err) {
    next(err);
  }
}
