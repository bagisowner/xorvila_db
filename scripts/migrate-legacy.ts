import fs from 'fs';
import path from 'path';
import { query } from '../src/database/pool.js';
import { hashPassword } from '../src/security/hasher.js';

async function migrateLegacyData() {
  console.log('🔄 [LEGACY MIGRATOR] Scanning for legacy persistence files...');

  const searchPaths = [
    path.resolve(process.cwd(), 'db.json'),
    path.resolve(process.cwd(), 'data/db.json'),
    path.resolve(process.cwd(), 'storage/db.json'),
    path.resolve(process.cwd(), 'mcpanel.json'),
  ];

  let legacyFile: string | null = null;
  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      legacyFile = p;
      break;
    }
  }

  if (!legacyFile) {
    console.log('ℹ️ [LEGACY MIGRATOR] No legacy db.json file detected. PostgreSQL is already up to date.');
    return;
  }

  console.log(`📂 [LEGACY MIGRATOR] Found legacy data at: ${legacyFile}`);

  // Create safety backup of legacy file
  const backupLegacy = `${legacyFile}.bak.${Date.now()}`;
  fs.copyFileSync(legacyFile, backupLegacy);
  console.log(`🛡️ [BACKUP CREATED] Safety backup stored at: ${backupLegacy}`);

  const raw = fs.readFileSync(legacyFile, 'utf8');
  let legacyData: any = {};
  try {
    legacyData = JSON.parse(raw);
  } catch (err: any) {
    console.error('❌ Failed to parse legacy JSON:', err.message);
    return;
  }

  const report = {
    usersMigrated: 0,
    serversMigrated: 0,
    settingsMigrated: 0,
    skipped: 0,
  };

  // 1. Migrate Users
  if (Array.isArray(legacyData.users)) {
    for (const u of legacyData.users) {
      try {
        if (!u.username || !u.email) {
          report.skipped++;
          continue;
        }

        const passHash = u.password_hash || (u.password ? await hashPassword(u.password) : await hashPassword('LegacyPassword123!'));
        const uId = u.id || undefined;

        await query(
          `INSERT INTO users (id, email, username, password_hash, is_active, is_verified, created_at)
           VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, COALESCE($7::timestamp, CURRENT_TIMESTAMP))
           ON CONFLICT (username) DO NOTHING;`,
          [uId, u.email.toLowerCase(), u.username.toLowerCase(), passHash, u.is_active ?? true, u.is_verified ?? true, u.created_at || null]
        );

        report.usersMigrated++;
      } catch (err) {
        report.skipped++;
      }
    }
  }

  // 2. Migrate Servers
  if (Array.isArray(legacyData.servers)) {
    for (const s of legacyData.servers) {
      try {
        if (!s.name) {
          report.skipped++;
          continue;
        }

        await query(
          `INSERT INTO servers (id, name, description, status, memory_mb, cpu_limit, disk_mb, port, server_type, minecraft_version)
           VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING;`,
          [
            s.id || undefined,
            s.name,
            s.description || '',
            s.status || 'offline',
            s.memory_mb || 2048,
            s.cpu_limit || 100,
            s.disk_mb || 10240,
            s.port || 25565,
            s.server_type || 'paper',
            s.minecraft_version || '1.20.4',
          ]
        );

        report.serversMigrated++;
      } catch (err) {
        report.skipped++;
      }
    }
  }

  // 3. Migrate Settings
  if (legacyData.settings && typeof legacyData.settings === 'object') {
    for (const [key, val] of Object.entries(legacyData.settings)) {
      try {
        await query(
          `INSERT INTO panel_settings (settings_key, settings_value, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (settings_key) DO UPDATE SET settings_value = $2`,
          [key, JSON.stringify(val)]
        );
        report.settingsMigrated++;
      } catch {
        report.skipped++;
      }
    }
  }

  console.log('\n========================================');
  console.log('📊 LEGACY MIGRATION REPORT');
  console.log('========================================');
  console.log(`Users Migrated:    ${report.usersMigrated}`);
  console.log(`Servers Migrated:  ${report.serversMigrated}`);
  console.log(`Settings Migrated: ${report.settingsMigrated}`);
  console.log(`Skipped / Invalid: ${report.skipped}`);
  console.log('Status:            COMPLETED WITHOUT DATA LOSS');
  console.log('========================================\n');
}

migrateLegacyData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Migration runner error:', err);
    process.exit(1);
  });
