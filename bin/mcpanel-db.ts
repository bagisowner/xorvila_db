#!/usr/bin/env tsx
import { testConnection, query } from '../src/database/pool.js';
import { runMigrations, getMigrationStatus } from '../src/database/migrator.js';
import { hashPassword } from '../src/security/hasher.js';
import { generateApiKey } from '../src/security/tokens.js';
import crypto from 'crypto';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'status': {
      console.log('🔍 [MCPANEL-DB] Checking database health & status...');
      const conn = await testConnection();
      console.log(`Database Connection: ${conn.connected ? '✅ ONLINE' : '⚠️ STANDBY / OFFLINE'}`);
      console.log(`Engine:              ${conn.engine}`);
      const mig = await getMigrationStatus();
      console.log(`Applied Migrations:  ${mig.applied.length}`);
      console.log(`Pending Migrations:  ${mig.pending.length}`);
      if (mig.pending.length > 0) {
        console.log(`Pending:             ${mig.pending.join(', ')}`);
      }
      process.exit(0);
    }

    case 'migrate': {
      console.log('🚀 [MCPANEL-DB] Executing pending database migrations...');
      const res = await runMigrations();
      if (res.success) {
        console.log(`✅ Success! Applied ${res.applied.length} migrations.`);
        process.exit(0);
      } else {
        console.error('❌ Migration failure:', res.errors);
        process.exit(1);
      }
    }

    case 'users:list': {
      const res = await query(
        `SELECT u.id, u.username, u.email, u.is_active, u.created_at, r.name as role
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         ORDER BY u.created_at DESC`
      );
      console.log('\n--- MCPANEL USERS ---');
      console.table(res.rows);
      process.exit(0);
    }

    case 'users:create': {
      const username = args[1];
      const email = args[2];
      const password = args[3];
      const roleName = args[4] || 'user';

      if (!username || !email || !password) {
        console.error('Usage: mcpanel-db users:create <username> <email> <password> [role]');
        process.exit(1);
      }

      const hash = await hashPassword(password);
      const userId = crypto.randomUUID();

      await query(
        `INSERT INTO users (id, username, email, password_hash, is_active, is_verified)
         VALUES ($1, $2, $3, $4, TRUE, TRUE)`,
        [userId, username.toLowerCase(), email.toLowerCase(), hash]
      );

      await query('INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)', [userId, username]);

      const roleRes = await query('SELECT id FROM roles WHERE name = $1', [roleName]);
      if (roleRes.rows.length > 0) {
        await query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleRes.rows[0].id]);
      }

      console.log(`✅ User ${username} created successfully (ID: ${userId}, Role: ${roleName})`);
      process.exit(0);
    }

    case 'roles:list': {
      const res = await query('SELECT id, name, description, is_system FROM roles ORDER BY name ASC');
      console.log('\n--- SYSTEM ROLES ---');
      console.table(res.rows);
      process.exit(0);
    }

    case 'api-keys:create': {
      const username = args[1] || 'admin';
      const keyName = args[2] || 'CLI Generated Key';
      const scopesArg = args[3] || 'users:read,servers:read,servers:write,players:read,audit:read';

      const userRes = await query('SELECT id FROM users WHERE username = $1', [username]);
      if (userRes.rows.length === 0) {
        console.error(`User '${username}' not found.`);
        process.exit(1);
      }

      const userId = userRes.rows[0].id;
      const scopes = scopesArg.split(',').map((s) => s.trim());
      const { key, keyPrefix, keyHash } = generateApiKey();
      const keyId = crypto.randomUUID();

      await query(
        `INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, scopes, is_revoked)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
        [keyId, userId, keyName, keyPrefix, keyHash, JSON.stringify(scopes)]
      );

      console.log('\n========================================');
      console.log('🔑 API KEY GENERATED');
      console.log('========================================');
      console.log(`Key ID:     ${keyId}`);
      console.log(`Name:       ${keyName}`);
      console.log(`Prefix:     ${keyPrefix}`);
      console.log(`Scopes:     ${scopes.join(', ')}`);
      console.log(`API Token:  ${key}`);
      console.log('⚠️  Store this secret token now. It will not be shown again.');
      console.log('========================================\n');
      process.exit(0);
    }

    default:
      console.log(`
MCPANEL Database CLI (mcpanel-db)

Usage:
  mcpanel-db <command> [arguments]

Commands:
  status                               Check database connection and migrations
  migrate                              Run pending migrations
  users:list                           List all registered user accounts
  users:create <user> <mail> <pw> [r]  Create a new user account
  roles:list                           List system roles
  api-keys:create [user] [name] [sc]   Generate a new API key
      `);
      process.exit(0);
  }
}

main().catch((err) => {
  console.error('💥 CLI Error:', err);
  process.exit(1);
});
