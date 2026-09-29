import { Request, Response } from 'express';
import { testConnection } from '../../database/pool.js';

export async function getHealth(req: Request, res: Response) {
  try {
    const dbStatus = await testConnection();

    if (!dbStatus.connected) {
      return res.status(200).json({
        status: 'initializing',
        database: 'disconnected',
        warning: dbStatus.error || 'Database initializing',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      status: 'ok',
      database: 'connected',
      engine: dbStatus.engine,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(200).json({
      status: 'ok',
      database: 'initializing',
      error: err.message,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }
}

export async function getReady(req: Request, res: Response) {
  const dbStatus = await testConnection();
  if (!dbStatus.connected) {
    return res.status(503).json({ ready: false, error: dbStatus.error });
  }
  res.json({ ready: true });
}
