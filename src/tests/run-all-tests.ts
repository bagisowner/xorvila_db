import { createApp } from '../app.js';
import { runMigrations } from '../database/migrator.js';
import { MCPANELDatabaseClient } from '../client/index.js';
import http from 'http';

async function runTests() {
  console.log('🧪 ============================================================');
  console.log('🧪 MCPANEL CLEAN PRODUCTION DATABASE API - TEST SUITE');
  console.log('🧪 ============================================================');

  // 1. Initialize Schema Migrations
  console.log('\n[1/12] 🔄 Initializing real PostgreSQL schema migrations...');
  const migRes = await runMigrations();
  if (!migRes.success) {
    throw new Error('Migration failed: ' + migRes.errors?.join(', '));
  }
  console.log('✅ Migrations applied successfully.');

  // 2. Start Test Server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`📡 Test server active on ${baseUrl}`);

  const client = new MCPANELDatabaseClient({ baseUrl });
  let adminToken = '';
  let testUserId = '';
  let testServerId = '';
  let createdApiKey = '';
  let apiKeyId = '';

  try {
    // 3. Health & System Status
    console.log('\n[2/12] 🩺 Testing /health & /api/v1/system/status...');
    const health = await client.health.check();
    if (!health.success || health.data?.status !== 'ok') {
      throw new Error(`Health check failed: ${JSON.stringify(health)}`);
    }
    console.log(`✅ Health check passed (status: ${health.data.status}, database: ${health.data.database})`);

    const statusRes = await client.system.status();
    if (!statusRes.success || statusRes.data?.database !== 'connected') {
      throw new Error(`System status check failed: ${JSON.stringify(statusRes)}`);
    }
    console.log(`✅ Real System Status verified (Engine: ${statusRes.data.databaseEngine})`);

    // 4. Admin Login
    console.log('\n[3/12] 🔑 Testing Admin Authentication with Argon2id...');
    const loginRes = await client.auth.login({
      usernameOrEmail: 'admin',
      password: 'AdminSecurePass123!',
    });
    if (!loginRes.success || !loginRes.data?.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(loginRes)}`);
    }
    adminToken = loginRes.data.token;
    client.setSessionToken(adminToken);
    console.log(`✅ Admin login succeeded (role: ${loginRes.data.user.role})`);

    // 5. User Registration & Session
    console.log('\n[4/12] 👤 Testing User Registration & Session persistence...');
    const testUsername = `user_${Date.now().toString().slice(-4)}`;
    const regRes = await client.auth.register({
      email: `${testUsername}@example.com`,
      username: testUsername,
      password: 'StandardPassword123!',
      name: 'Server Operator',
    });
    if (!regRes.success || !regRes.data?.user?.id) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes)}`);
    }
    testUserId = regRes.data.user.id;
    console.log(`✅ Registered user ${testUsername} (ID: ${testUserId})`);

    // Verify /auth/me
    const meRes = await client.auth.me();
    if (!meRes.success || meRes.data?.user.id !== testUserId) {
      throw new Error(`Auth me verification failed: ${JSON.stringify(meRes)}`);
    }
    console.log(`✅ GET /auth/me verified for: ${meRes.data.user.username}`);

    // Restore admin token
    client.setSessionToken(adminToken);

    // 6. Password Reset Flow
    console.log('\n[5/12] 🔐 Testing Password Reset flow (token hashing & verification)...');
    const forgotRes = await client.auth.forgotPassword(`${testUsername}@example.com`);
    if (!forgotRes.success) {
      throw new Error(`Forgot password failed: ${JSON.stringify(forgotRes)}`);
    }
    const resetToken = forgotRes.data?.resetToken;
    if (resetToken) {
      const resetRes = await client.auth.resetPassword({
        token: resetToken,
        password: 'NewStrongPassword123!',
      });
      if (!resetRes.success) {
        throw new Error(`Reset password failed: ${JSON.stringify(resetRes)}`);
      }
      console.log('✅ Password reset executed and verified.');
    } else {
      console.log('✅ Password reset instructions dispatched.');
    }

    // 7. API Keys Creation & Scopes
    console.log('\n[6/12] 🗝️ Testing API Key Generation & Scopes...');
    const apiKeyRes = await client.apiKeys.create({
      name: 'MCPANEL Node Client',
      scopes: ['servers:read', 'servers:write', 'system:read'],
      expiresInDays: 30,
    });
    if (!apiKeyRes.success || !apiKeyRes.data?.api_key?.token) {
      throw new Error(`API Key creation failed: ${JSON.stringify(apiKeyRes)}`);
    }
    createdApiKey = apiKeyRes.data.api_key.token;
    apiKeyId = apiKeyRes.data.api_key.id;
    console.log(`✅ API Key created: ${apiKeyRes.data.api_key.key_prefix} (Scopes: ${apiKeyRes.data.api_key.scopes?.join(', ')})`);
    if (!createdApiKey.startsWith('mc_live_')) {
      throw new Error(`API key format incorrect, expected mc_live_..., got ${createdApiKey}`);
    }

    // Verify API Keys listing does NOT expose plaintext token
    const keysList = await client.apiKeys.list();
    if (!keysList.success || !keysList.data?.api_keys.some((k) => k.id === apiKeyId)) {
      throw new Error('API key not found in listing');
    }
    const foundKey = keysList.data.api_keys.find((k) => k.id === apiKeyId)!;
    if ((foundKey as any).token || (foundKey as any).key_hash) {
      throw new Error('Plaintext token or secret hash must never be returned in listing');
    }
    console.log('✅ API Keys listing verified (Secure: no secrets exposed).');

    // 8. Server Registry CRUD using Bearer API Key Authentication!
    console.log('\n[7/12] ⛏️ Testing Server Registry using Bearer API Key Auth...');
    const apiKeyClient = new MCPANELDatabaseClient({ baseUrl, apiKey: createdApiKey });

    const serverCreateRes = await apiKeyClient.servers.create({
      name: 'Production SMP',
      server_identifier: `smp-${Date.now().toString(36)}`,
      ram: 8192,
      disk: 20480,
      cpu: 200,
      minecraft_version: '1.21.1',
      jdk_version: '21',
      ip: '192.168.1.100',
    });
    if (!serverCreateRes.success || !serverCreateRes.data?.server?.id) {
      throw new Error(`Server creation with API key failed: ${JSON.stringify(serverCreateRes)}`);
    }
    testServerId = serverCreateRes.data.server.id;
    console.log(`✅ Server created via Bearer API Key: ${serverCreateRes.data.server.name} (RAM: ${serverCreateRes.data.server.ram}MB)`);

    const serverList = await apiKeyClient.servers.list();
    if (!serverList.success || !serverList.data?.servers.some((s) => s.id === testServerId)) {
      throw new Error('Created server not found in registry list');
    }
    console.log(`✅ Server registry list verified via API key (${serverList.data?.servers.length} servers)`);

    // Verify last_used_at tracking on API key
    const checkKeyAfterUse = await client.apiKeys.get(apiKeyId);
    if (!checkKeyAfterUse.success || !checkKeyAfterUse.data?.api_key.last_used_at) {
      throw new Error('API key last_used_at was not updated after authenticated request');
    }
    console.log(`✅ API Key last_used_at tracked in PostgreSQL: ${checkKeyAfterUse.data.api_key.last_used_at}`);

    // Live PATCH server configuration
    const serverUpdate = await apiKeyClient.servers.update(testServerId, {
      ram: 12288,
      minecraft_version: '1.21.2',
    });
    if (!serverUpdate.success || serverUpdate.data?.server.ram !== 12288) {
      throw new Error(`Server update failed: ${JSON.stringify(serverUpdate)}`);
    }
    console.log('✅ Live server parameters updated (RAM upgraded to 12288 MB).');

    // 9. API Key Revocation
    console.log('\n[8/12] 🛑 Testing API Key Revocation...');
    const revokeRes = await client.apiKeys.revoke(apiKeyId);
    if (!revokeRes.success) {
      throw new Error(`Revoke failed: ${JSON.stringify(revokeRes)}`);
    }
    console.log('✅ API Key revoked.');

    // Now request with revoked key must fail
    const revokedCheck = await apiKeyClient.servers.list();
    if (revokedCheck.success) {
      throw new Error('Revoked API key was incorrectly allowed to authenticate');
    }
    console.log('✅ Blocked revoked API key with 401 Unauthorized.');

    // 10. OpenAPI Documentation Endpoints
    console.log('\n[9/12] 📜 Testing OpenAPI Specification endpoints (/openapi.json & /docs)...');
    const openApiRes = await client.docs.getOpenApiSpec();
    const doc = openApiRes.data || openApiRes;
    if (!doc || doc.openapi !== '3.0.3') {
      throw new Error(`Failed to retrieve valid OpenAPI 3.0.3 document: ${JSON.stringify(openApiRes)}`);
    }
    console.log(`✅ /openapi.json verified (${Object.keys(doc.paths || {}).length} endpoints documented)`);

    // 11. Live System Configuration
    console.log('\n[10/12] ⚙️ Testing Live System Configuration API (Admin only)...');
    const configRes = await client.system.getConfig();
    if (!configRes.success || !configRes.data?.config) {
      throw new Error(`Get system config failed: ${JSON.stringify(configRes)}`);
    }
    console.log('✅ System configuration read successfully.');

    const updateConfigRes = await client.system.updateConfig({
      SESSION_DURATION_DAYS: 14,
      CORS_ORIGINS: 'https://panel.example.com',
    });
    if (!updateConfigRes.success || !updateConfigRes.data?.updated) {
      throw new Error(`Update system config failed: ${JSON.stringify(updateConfigRes)}`);
    }
    console.log('✅ Live system configuration updated.');

    // 12. Clean Server Deletion & Session Logout
    console.log('\n[11/12] 🗑️ Testing Server deletion from registry...');
    const deleteRes = await client.servers.delete(testServerId);
    if (!deleteRes.success) {
      throw new Error(`Server delete failed: ${JSON.stringify(deleteRes)}`);
    }
    console.log('✅ Server removed from registry.');

    console.log('\n[12/12] 🚪 Testing Clean Session Termination & Access Control...');
    const logoutRes = await client.auth.logout();
    if (!logoutRes.success) {
      throw new Error(`Logout failed: ${JSON.stringify(logoutRes)}`);
    }
    console.log('✅ Session cleanly revoked in PostgreSQL.');

    const unauthServers = await client.servers.list();
    if (unauthServers.success) {
      throw new Error('Security check failed: unauthenticated request was allowed');
    }
    console.log('✅ Unauthenticated access blocked (401 Unauthorized).');

    console.log('\n============================================================');
    console.log('🎉 ALL CLEAN DATABASE API TESTS COMPLETED WITH 100% SUCCESS');
    console.log('============================================================\n');
  } finally {
    server.close();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Test suite failed:', err);
    process.exit(1);
  });
