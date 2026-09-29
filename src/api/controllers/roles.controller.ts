import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../../database/pool.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function listRoles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await query('SELECT id, name FROM roles ORDER BY name ASC');
    res.json({
      success: true,
      data: { roles: result.rows },
    });
  } catch (err) {
    next(err);
  }
}

export async function createRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Role name is required' },
      });
    }

    const cleanName = name.trim().toLowerCase();
    const id = crypto.randomUUID();

    const result = await query(
      'INSERT INTO roles (id, name) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING RETURNING id, name',
      [id, cleanName]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'ROLE_EXISTS', message: 'A role with this name already exists' },
      });
    }

    res.status(201).json({
      success: true,
      data: { role: result.rows[0] },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const checkRes = await query('SELECT name FROM roles WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'ROLE_NOT_FOUND', message: 'Role not found' },
      });
    }

    const roleName = checkRes.rows[0].name;
    if (roleName === 'admin' || roleName === 'user') {
      return res.status(400).json({
        success: false,
        error: { code: 'SYSTEM_ROLE', message: 'Default system roles cannot be deleted' },
      });
    }

    await query('DELETE FROM roles WHERE id = $1', [id]);

    res.json({
      success: true,
      data: { message: `Role '${roleName}' deleted` },
    });
  } catch (err) {
    next(err);
  }
}
