import fs from 'fs';
import path from 'path';
import { query } from '../src/database/pool.js';

async function performBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `mcpanel-backup-${timestamp}.json`);
  console.log(`📦 [BACKUP] Dumping database snapshot to ${backupFile}...`);

  const tables = [
    'users',
    'user_profiles',
    'roles',
    'permissions',
    'role_permissions',
    'user_roles',
    'nodes',
    'allocations',
    'servers',
    'server_members',
    'server_settings',
    'backups',
    'schedules',
    'jobs',
    'players',
    'server_players',
    'player_data',
    'panel_settings',
    'user_preferences',
    'file_metadata',
    'file_versions',
    'audit_logs',
    'security_events',
    'change_history',
  ];

  const dump: Record<string, any[]> = {};

  for (const table of tables) {
    try {
      const res = await query(`SELECT * FROM ${table}`);
      dump[table] = res.rows;
    } catch (err: any) {
      dump[table] = [];
    }
  }

  fs.writeFileSync(backupFile, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`✅ [BACKUP] Successfully created ${backupFile} (${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB)`);
}

performBackup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [BACKUP FAILED]:', err);
    process.exit(1);
  });
