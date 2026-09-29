import { createApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './database/migrator.js';
import { loadRuntimeConfig } from './api/controllers/system.controller.js';
import path from 'path';
import express from 'express';
import fs from 'fs';

export async function startServer(options: { port?: number; host?: string } = {}) {
  const app = createApp();

  // Handle Frontend rendering
  if (env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr: any) {
      console.warn('⚠️ [VITE] Running without Vite middleware:', viteErr.message);
    }
  } else {
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

  let port = options.port || env.PORT || 3000;
  if (port === 8080 || !port) {
    port = 3000;
  }
  let host = options.host || env.HOST || '0.0.0.0';

  const server = app.listen(port, host, () => {
    console.log(`🚀 [SERVER] Listening on http://${host}:${port}`);
  });

  runMigrations()
    .then((res) => {
      console.log(`✅ [BOOTSTRAP] PostgreSQL migrations ready (${res.applied.length} applied)`);
      return loadRuntimeConfig();
    })
    .catch((err: any) => {
      console.warn('⚠️ [BOOTSTRAP] Migration initialization warning:', err.message);
    });

  return { app, server };
}
