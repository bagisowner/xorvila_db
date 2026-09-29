import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../../database/pool.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function listServers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    let sql: string;
    let params: any[] = [];

    if (isAdmin) {
      sql = `
        SELECT s.id, s.owner_user_id, s.name, s.server_identifier,
               s.ram, s.disk, s.cpu, s.minecraft_version, s.jdk_version, s.ip,
               s.created_at, s.updated_at,
               u.username as owner_username, u.email as owner_email
        FROM servers s
        JOIN users u ON s.owner_user_id = u.id
        ORDER BY s.created_at DESC
      `;
    } else {
      sql = `
        SELECT s.id, s.owner_user_id, s.name, s.server_identifier,
               s.ram, s.disk, s.cpu, s.minecraft_version, s.jdk_version, s.ip,
               s.created_at, s.updated_at
        FROM servers s
        WHERE s.owner_user_id = $1
        ORDER BY s.created_at DESC
      `;
      params.push(user.id);
    }

    const result = await query(sql, params);

    res.json({
      success: true,
      data: {
        servers: result.rows,
        total: result.rows.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getServer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    const sql = `
      SELECT s.id, s.owner_user_id, s.name, s.server_identifier,
             s.ram, s.disk, s.cpu, s.minecraft_version, s.jdk_version, s.ip,
             s.created_at, s.updated_at,
             u.username as owner_username, u.email as owner_email
      FROM servers s
      JOIN users u ON s.owner_user_id = u.id
      WHERE s.id = $1
    `;

    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'SERVER_NOT_FOUND', message: 'Server not found' },
      });
    }

    const server = result.rows[0];

    if (!isAdmin && server.owner_user_id !== user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view this server' },
      });
    }

    res.json({
      success: true,
      data: { server },
    });
  } catch (err) {
    next(err);
  }
}

export async function createServer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const {
      name,
      server_identifier,
      ram,
      disk,
      cpu,
      minecraft_version,
      jdk_version,
      ip,
    } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Server name is required' },
      });
    }

    const identifier = server_identifier || `srv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const id = crypto.randomUUID();

    const insertSql = `
      INSERT INTO servers (
        id, owner_user_id, name, server_identifier,
        ram, disk, cpu, minecraft_version, jdk_version, ip
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await query(insertSql, [
      id,
      user.id,
      name.trim(),
      identifier.trim().toLowerCase(),
      typeof ram === 'number' ? ram : 4096,
      typeof disk === 'number' ? disk : 10240,
      typeof cpu === 'number' ? cpu : 100,
      minecraft_version || '1.21',
      jdk_version || '21',
      ip || '127.0.0.1',
    ]);

    res.status(201).json({
      success: true,
      data: { server: result.rows[0] },
    });
  } catch (err: any) {
    if (err.message && err.message.includes('unique constraint')) {
      return res.status(409).json({
        success: false,
        error: { code: 'IDENTIFIER_CONFLICT', message: 'A server with this identifier already exists' },
      });
    }
    next(err);
  }
}

export async function updateServer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    // Verify ownership or admin
    const checkRes = await query('SELECT id, owner_user_id FROM servers WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'SERVER_NOT_FOUND', message: 'Server not found' },
      });
    }

    const existingServer = checkRes.rows[0];
    if (!isAdmin && existingServer.owner_user_id !== user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to modify this server' },
      });
    }

    const {
      name,
      ram,
      disk,
      cpu,
      minecraft_version,
      jdk_version,
      ip,
    } = req.body;

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(String(name).trim());
    }
    if (ram !== undefined) {
      setClauses.push(`ram = $${paramIndex++}`);
      params.push(Number(ram));
    }
    if (disk !== undefined) {
      setClauses.push(`disk = $${paramIndex++}`);
      params.push(Number(disk));
    }
    if (cpu !== undefined) {
      setClauses.push(`cpu = $${paramIndex++}`);
      params.push(Number(cpu));
    }
    if (minecraft_version !== undefined) {
      setClauses.push(`minecraft_version = $${paramIndex++}`);
      params.push(String(minecraft_version).trim());
    }
    if (jdk_version !== undefined) {
      setClauses.push(`jdk_version = $${paramIndex++}`);
      params.push(String(jdk_version).trim());
    }
    if (ip !== undefined) {
      setClauses.push(`ip = $${paramIndex++}`);
      params.push(String(ip).trim());
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_UPDATES', message: 'No valid fields provided for update' },
      });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const updateSql = `
      UPDATE servers
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateSql, params);

    res.json({
      success: true,
      data: { server: result.rows[0] },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteServer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    const checkRes = await query('SELECT id, owner_user_id FROM servers WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'SERVER_NOT_FOUND', message: 'Server not found' },
      });
    }

    const existingServer = checkRes.rows[0];
    if (!isAdmin && existingServer.owner_user_id !== user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to delete this server' },
      });
    }

    await query('DELETE FROM servers WHERE id = $1', [id]);

    res.json({
      success: true,
      data: { message: 'Server deleted from registry' },
    });
  } catch (err) {
    next(err);
  }
}
