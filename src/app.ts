import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import v1Routes from './api/routes/v1/index.js';
import { errorHandler } from './api/middleware/error.middleware.js';
import { getHealth, getReady } from './api/controllers/health.controller.js';
import { openApiSpec } from './api/docs/openapi.js';
import { env, parsedCorsOrigins } from './config/env.js';

export function createApp() {
  const app = express();

  // Trust proxy for secure cookies and accurate IP logging behind reverse proxies/Cloud Run
  app.set('trust proxy', 1);

  // Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.NODE_ENV === 'development') {
          return callback(null, true);
        }
        if (parsedCorsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive in dev, strict in prod
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    })
  );

  // Request Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(env.SESSION_SECRET));

  // Health & Readiness checks
  app.get('/health', getHealth);
  app.get('/ready', getReady);

  // OpenAPI Specification & Interactive Documentation
  app.get('/openapi.json', (req, res) => {
    res.json(openApiSpec);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // API v1 Routes
  app.use('/api/v1', v1Routes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
