import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const issues = (err as any).issues || (err as any).errors || [];
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload',
            details: issues.map((e: any) => ({
              path: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
              message: e.message,
            })),
          },
          requestId: req.headers['x-request-id'] || 'req_' + Math.random().toString(36).substring(2, 9),
        });
      }
      next(err);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const issues = (err as any).issues || (err as any).errors || [];
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: issues.map((e: any) => ({
              path: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
              message: e.message,
            })),
          },
          requestId: req.headers['x-request-id'] || 'req_' + Math.random().toString(36).substring(2, 9),
        });
      }
      next(err);
    }
  };
}
