# MCPANEL Authentication & Security Specification

## Security Principles
1. **Zero Plaintext Passwords**: Passwords are cryptographically derived using memory-hard scrypt with unique 16-byte salts and verified using timing-safe comparisons.
2. **Server-Side Session Storage**: Sessions are stored in PostgreSQL (`sessions` table) with hashed tokens (`token_hash`) using HMAC-SHA256. Plaintext session tokens are never stored in the database.
3. **HttpOnly Cookies**: Browser clients use `mcpanel_session` cookies with `HttpOnly`, `SameSite=Lax`, and `Secure` (in production) flags, mitigating XSS token theft.
4. **Scoped API Keys**: Dedicated machine clients use keys in format `mcp_live_<hex>`. Key hashes are stored in `api_keys` and evaluated against granular permission scopes.
5. **No Password/Token Leaks in Logs**: Audit logs and responses strip and redact all sensitive keys (`password`, `secret`, `token`, `authorization`).
6. **Security Event Auditing**: Failed logins, token revocation, rate limits, and permission denials are captured in `security_events`.

## OAuth Architecture
MCPANEL uses a provider-independent OAuth table (`oauth_accounts`):
```sql
CREATE TABLE oauth_accounts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_oauth_provider_user UNIQUE (provider, provider_user_id)
);
```
Supported providers (Google, Discord, GitHub, Microsoft) map to `oauth_accounts` without polluting the core `users` schema.

## Granular RBAC Permissions
| Permission | Description |
|---|---|
| `users:read` | Read user profiles, accounts and roles |
| `users:write` | Create and update user accounts |
| `users:delete` | Delete users |
| `servers:read` | View Minecraft servers and specs |
| `servers:write` | Create and configure servers |
| `servers:delete` | Delete server entries |
| `servers:start` | Send start power action |
| `servers:stop` | Send stop power action |
| `files:read` | Read file metadata |
| `files:write` | Modify files and track changes |
| `players:read` | View player playtime and data |
| `players:write` | Synchronize player data |
| `nodes:read` | Inspect node infrastructure |
| `nodes:write` | Modify daemon nodes |
| `api_keys:read` | View generated keys |
| `api_keys:write` | Create and revoke keys |
| `audit:read` | Query audit trail and diffs |
| `settings:read` | View panel configuration |
| `settings:write` | Modify panel settings |
