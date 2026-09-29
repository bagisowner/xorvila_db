import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { query, executeScript } from './pool.js';
import { hashPassword, verifyPassword } from '../security/hasher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<{ success: boolean; applied: string[]; errors?: string[] }> {
  console.log('🔄 [MIGRATOR] Running PostgreSQL schema migrations...');

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err: any) {
    console.warn('⚠️ [MIGRATOR] Error creating schema_migrations table:', err.message);
  }

  const migrationsDir = path.join(__dirname, 'migrations');
  const applied: string[] = [];
  const errors: string[] = [];

  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      try {
        const check = await query('SELECT name FROM schema_migrations WHERE name = $1', [file]);
        if (check.rows && check.rows.length > 0) {
          continue;
        }

        const filePath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf8');

        console.log(`⏳ [MIGRATOR] Applying migration: ${file}...`);
        await executeScript(sqlContent);
        await query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        applied.push(file);
        console.log(`✅ [MIGRATOR] Applied migration: ${file}`);
      } catch (migErr: any) {
        console.error(`❌ [MIGRATOR] Failed to apply ${file}:`, migErr.message);
        errors.push(`${file}: ${migErr.message}`);
      }
    }
  }

  // Ensure roles exist in PostgreSQL
  await seedDefaultRoles();

  console.log(`🎉 [MIGRATOR] PostgreSQL migrations complete. Applied: ${applied.length}`);
  return { success: errors.length === 0, applied, errors: errors.length > 0 ? errors : undefined };
}

export async function getMigrationStatus(): Promise<{ applied: string[]; pending: string[] }> {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.existsSync(migrationsDir) ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort() : [];

  let appliedRows: string[] = [];
  try {
    const res = await query('SELECT name FROM schema_migrations ORDER BY name ASC');
    appliedRows = res.rows.map((r: any) => r.name);
  } catch {
    appliedRows = [];
  }

  const pending = files.filter((f) => !appliedRows.includes(f));
  return { applied: appliedRows, pending };
}

async function seedDefaultRoles() {
  try {
    await query("INSERT INTO roles (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'admin') ON CONFLICT (name) DO NOTHING");
    await query("INSERT INTO roles (id, name) VALUES ('00000000-0000-0000-0000-000000000002', 'user') ON CONFLICT (name) DO NOTHING");
  } catch (err: any) {
    console.warn('⚠️ [MIGRATOR] Roles initialization notice:', err.message);
  }
}

// CLI runner
if (process.argv[1] && process.argv[1].endsWith('migrator.ts')) {
  const action = process.argv[2] || 'migrate';
  if (action === 'status') {
    getMigrationStatus().then((s) => {
      console.log('Migration Status:', s);
      process.exit(0);
    });
  } else {
    runMigrations().then((res) => {
      if (!res.success) process.exit(1);
      process.exit(0);
    });
  }
}
