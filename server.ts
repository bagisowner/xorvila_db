import { createApp } from './src/app.js';
import { env } from './src/config/env.js';
import { runMigrations } from './src/database/migrator.js';
import { loadRuntimeConfig } from './src/api/controllers/system.controller.js';
import path from 'path';
import express from 'express';
import fs from 'fs';

async function bootstrap() {
  const app = createApp();

  // Handle Frontend rendering
  if (env.NODE_ENV !== 'production') {
    // In development mode, mount Vite middleware with HMR disabled to avoid port collisions
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production mode, serve built dist files
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res, next) => {
        if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/docs') || req.originalUrl.startsWith('/health')) {
          return next();
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // Parse port from command line arguments or environment
  let port = 3000;
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsedArg = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsedArg) && parsedArg !== 8080) {
      port = parsedArg;
    }
  } else if (process.env.PORT && process.env.PORT !== '8080') {
    const parsedEnv = parseInt(process.env.PORT, 10);
    if (!isNaN(parsedEnv)) {
      port = parsedEnv;
    }
  } else if (env.PORT && env.PORT !== 8080) {
    port = env.PORT;
  }
  // In AI Studio / Cloud Run, 8080 is reserved for Nginx; app MUST bind to 3000
  if (port === 8080 || !port) {
    port = 3000;
  }

  let host = '0.0.0.0';
  const hostArgIndex = process.argv.indexOf('--host');
  if (hostArgIndex !== -1 && process.argv[hostArgIndex + 1]) {
    host = process.argv[hostArgIndex + 1];
  } else if (env.HOST) {
    host = env.HOST;
  }

  const server = app.listen(port, host, () => {
    console.log(`
============================================================
🚀 MCPANEL DATABASE API SERVICE ACTIVE
============================================================
📡 API Base:     http://${host}:${port}/api/v1
🩺 Health Check: http://${host}:${port}/health
📖 OpenAPI Docs: http://${host}:${port}/docs
🗄️ Database:     PostgreSQL (${env.DATABASE_NAME})
⚙️ Mode:         ${env.NODE_ENV}
============================================================
    `);
  });

  // Run database migrations on startup asynchronously without delaying port readiness
  runMigrations()
    .then((res) => {
      console.log(`✅ [BOOTSTRAP] PostgreSQL migrations ready (${res.applied.length} applied)`);
      return loadRuntimeConfig();
    })
    .catch((err: any) => {
      console.warn('⚠️ [BOOTSTRAP] Migration initialization warning:', err.message);
    });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 [SHUTDOWN] Received ${signal}. Closing server gracefully...`);
    server.close(() => {
      console.log('✅ [SHUTDOWN] Server terminated.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
