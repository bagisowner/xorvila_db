import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';

const { Pool } = pg;

export interface DatabaseQueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

let pgPool: pg.Pool | null = null;
let pgliteInstance: any = null;
let isConnected = false;
let databaseEngine = 'PostgreSQL';
let lastError: string | null = null;
let initPromise: Promise<void> | null = null;

const PG_DATA_DIR = path.resolve(process.cwd(), 'data/mcpanel_postgres');

async function getOrInitDatabase(): Promise<{ isPg: boolean; client: any }> {
  if (initPromise) {
    await initPromise;
  } else {
    initPromise = (async () => {
      // 1. Try external PostgreSQL if DATABASE_URL or specific credentials provided
      if (env.DATABASE_URL || process.env.DATABASE_URL) {
        try {
          const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;
          pgPool = new Pool({
            connectionString,
            ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
            max: env.DATABASE_POOL_MAX || 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 3000,
          });

          const testClient = await pgPool.connect();
          const res = await testClient.query('SELECT version()');
          testClient.release();
          isConnected = true;
          databaseEngine = res.rows[0]?.version || 'PostgreSQL (External)';
          console.log(`🔌 [DATABASE] Connected to external PostgreSQL: ${databaseEngine}`);
          return;
        } catch (pgErr: any) {
          console.warn('⚠️ [DATABASE] External PostgreSQL connection failed, switching to local PostgreSQL instance:', pgErr.message);
          lastError = pgErr.message;
          pgPool = null;
        }
      }

      // 2. Embedded Real PostgreSQL via PGlite with disk persistence
      try {
        const { PGlite } = await import('@electric-sql/pglite');
        
        if (!fs.existsSync(PG_DATA_DIR)) {
          fs.mkdirSync(PG_DATA_DIR, { recursive: true });
        }

        try {
          pgliteInstance = new PGlite(PG_DATA_DIR);
          await pgliteInstance.waitReady;
        } catch (firstErr: any) {
          console.error('❌ [DATABASE] PGlite failed to initialize:', firstErr.message);
          // Try to recover once by moving corrupted data
          const backupDir = `${PG_DATA_DIR}-corrupted-${Date.now()}`;
          try {
            console.warn(`⏳ [DATABASE] Attempting recovery: backing up ${PG_DATA_DIR} to ${backupDir}`);
            fs.renameSync(PG_DATA_DIR, backupDir);
            fs.mkdirSync(PG_DATA_DIR, { recursive: true });
            pgliteInstance = new PGlite(PG_DATA_DIR);
            await pgliteInstance.waitReady;
          } catch (recoveryErr: any) {
            console.warn('⚠️ [DATABASE] Recovery failed, falling back to in-memory:', recoveryErr.message);
            pgliteInstance = new PGlite();
            await pgliteInstance.waitReady;
          }
        }

        const res = await pgliteInstance.query('SELECT version()');
        isConnected = true;
        databaseEngine = res.rows[0]?.version || 'PostgreSQL (Embedded PGlite)';
        console.log(`🗄️ [DATABASE] Real PostgreSQL active at: ${PG_DATA_DIR}`);
      } catch (err: any) {
        isConnected = false;
        lastError = err.message;
        initPromise = null;
        console.error('❌ [DATABASE] Fatal engine initialization error:', err.message);
      }
    })();
    await initPromise;
  }

  if (pgPool) {
    return { isPg: true, client: pgPool };
  }
  if (pgliteInstance) {
    return { isPg: false, client: pgliteInstance };
  }
  throw new Error(lastError || 'PostgreSQL engine unavailable');
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<DatabaseQueryResult<T>> {
  const db = await getOrInitDatabase();

  try {
    if (db.isPg) {
      const res = await db.client.query(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? res.rows.length,
      };
    } else {
      const res = await db.client.query(sql, params);
      const rowCount = res.rows && res.rows.length > 0 ? res.rows.length : (res.affectedRows ?? 0);
      return {
        rows: (res.rows || []) as T[],
        rowCount,
      };
    }
  } catch (err: any) {
    lastError = err.message;
    throw err;
  }
}

export async function executeScript(sql: string): Promise<void> {
  const db = await getOrInitDatabase();
  try {
    if (db.isPg) {
      await db.client.query(sql);
    } else {
      await db.client.exec(sql);
    }
  } catch (err: any) {
    lastError = err.message;
    throw err;
  }
}

export async function withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const db = await getOrInitDatabase();

  if (db.isPg) {
    const client = await db.client.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    try {
      await db.client.query('BEGIN');
      const result = await callback(db.client);
      await db.client.query('COMMIT');
      return result;
    } catch (err) {
      await db.client.query('ROLLBACK');
      throw err;
    }
  }
}

export async function testConnection(): Promise<{ connected: boolean; engine: string; error?: string }> {
  try {
    const res = await query('SELECT 1 as alive, version()');
    isConnected = true;
    lastError = null;
    return {
      connected: true,
      engine: res.rows[0]?.version || databaseEngine,
    };
  } catch (err: any) {
    isConnected = false;
    lastError = err.message;
    return {
      connected: false,
      engine: databaseEngine,
      error: err.message,
    };
  }
}

export function isPostgresConnected(): boolean {
  return isConnected;
}

export function getDatabaseEngine(): string {
  return databaseEngine;
}
