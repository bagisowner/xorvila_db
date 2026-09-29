import { Response, NextFunction } from 'express';
import { query } from '../../database/pool.js';
import { hashPassword, verifyPassword } from '../../security/hasher.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export async function listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    let sql = `
      SELECT u.id, u.email, u.username, u.name, u.avatar, u.created_at, u.updated_at,
             r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
    `;
    let params: any[] = [];

    if (!isAdmin) {
      sql += ' WHERE u.id = $1';
      params.push(user.id);
    } else {
      sql += ' ORDER BY u.created_at ASC';
    }

    const result = await query(sql, params);

    res.json({
      success: true,
      data: {
        users: result.rows,
        total: result.rowCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    if (!isAdmin && user.id !== id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot view other users' },
      });
    }

    const result = await query(
      `SELECT u.id, u.email, u.username, u.name, u.avatar, u.created_at, u.updated_at,
              r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({
      success: true,
      data: { user: result.rows[0] },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    if (!isAdmin && user.id !== id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot modify other users' },
      });
    }

    const { name, avatar, role } = req.body;
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(String(name).trim());
    }

    if (avatar !== undefined) {
      setClauses.push(`avatar = $${paramIndex++}`);
      params.push(String(avatar));
    }

    if (role !== undefined && isAdmin) {
      const roleRes = await query('SELECT id FROM roles WHERE name = $1', [role]);
      if (roleRes.rows.length > 0) {
        setClauses.push(`role_id = $${paramIndex++}`);
        params.push(roleRes.rows[0].id);
      }
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
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, username, name, avatar, updated_at
    `;

    const result = await query(updateSql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({
      success: true,
      data: { user: result.rows[0] },
    });
  } catch (err) {
    next(err);
  }
}

export async function changeUserPassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'New password must be at least 8 characters long' },
      });
    }

    if (!isAdmin && user.id !== id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot change another user\'s password' },
      });
    }

    const targetUserRes = await query('SELECT id, password_hash FROM users WHERE id = $1', [id]);
    if (targetUserRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const targetUser = targetUserRes.rows[0];

    // Non-admin changing own password must verify current password
    if (!isAdmin || user.id === id) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          error: { code: 'CURRENT_PASSWORD_REQUIRED', message: 'Current password is required' },
        });
      }

      const isCurrentValid = await verifyPassword(currentPassword, targetUser.password_hash);
      if (!isCurrentValid) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' },
        });
      }
    }

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, id]);

    res.json({
      success: true,
      data: { message: 'Password updated successfully' },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = req.user!;

    if (user.id === id) {
      return res.status(400).json({
        success: false,
        error: { code: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own account' },
      });
    }

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({
      success: true,
      data: { message: 'User deleted' },
    });
  } catch (err) {
    next(err);
  }
}
