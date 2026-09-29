import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || 'req_' + Math.random().toString(36).substring(2, 9);
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'PERMISSION_DENIED' : statusCode === 401 ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR');
  const message = err.message || 'An unexpected server error occurred';

  if (statusCode >= 500) {
    console.error(`💥 [ERROR] [${requestId}] ${req.method} ${req.originalUrl}:`, err);
  }

  const response: Record<string, any> = {
    success: false,
    error: {
      code: errorCode,
      message,
    },
    requestId,
  };

  if (env.NODE_ENV === 'development' && err.stack && statusCode >= 500) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
