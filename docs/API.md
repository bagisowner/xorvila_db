# MCPANEL Database Service - API Reference (v1)

Base URL: `http://<HOST>:<PORT>/api/v1`
Interactive Swagger UI: `http://<HOST>:<PORT>/docs`
OpenAPI Specification: `http://<HOST>:<PORT>/openapi.json`

## Authentication Headers & Cookies
- **Browser Authentication**: Uses `mcpanel_session` HttpOnly, Secure, SameSite cookie.
- **API Clients & Daemons**: Uses `Authorization: Bearer <API_KEY>` or `Authorization: Bearer <SESSION_TOKEN>`.

---

## 1. Authentication Endpoints (`/auth`)

### `POST /auth/register`
Create a new user account.
- **Request Body**:
```json
{
  "email": "player@example.com",
  "username": "Minecrafter99",
  "password": "SecurePassword123!",
  "display_name": "Pro Crafter"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "c1f7b8c3-4567-89ab-cdef-0123456789ab",
      "email": "player@example.com",
      "username": "Minecrafter99",
      "role": "user"
    },
    "token": "a1b2c3...",
    "expires_at": "2026-10-06T12:00:00.000Z"
  }
}
```

### `POST /auth/login`
Log in with username or email and password.
- **Request Body**:
```json
{
  "usernameOrEmail": "admin",
  "password": "AdminSecurePass123!"
}
```
- **Response `200 OK`**: Sets `mcpanel_session` cookie and returns user object.

### `POST /auth/logout`
Terminates the current session and clears the cookie.

### `GET /auth/me`
Retrieves the currently authenticated user session, profile, and permissions.

### `POST /auth/password/forgot`
Requests a password reset token for the specified email.

### `POST /auth/password/reset`
Applies a new password using a valid single-use reset token.

---

## 2. Users Management (`/users`)
- `GET /users` - Paginated user list with `search`, `role`, `is_active` query filters.
- `GET /users/:id` - Retrieve user details by UUID.
- `POST /users` - Create user (Requires `users:write` permission).
- `PATCH /users/:id` - Update user properties.
- `DELETE /users/:id` - Delete user account (Requires `users:delete` permission).
- `GET /users/:id/history` - Retrieve audit change trail for the user.
- `GET /users/:id/settings` - Retrieve user preferences.
- `PATCH /users/:id/settings` - Update user preferences.

---

## 3. Roles & Permissions (`/roles`)
- `GET /roles` - List all roles with attached permissions.
- `GET /roles/permissions` - List all system permissions.
- `POST /roles` - Create custom role (Requires `users:write`).
- `PATCH /roles/:id` - Update role permissions and description.
- `DELETE /roles/:id` - Delete custom role.

---

## 4. Minecraft Servers (`/servers`)
- `GET /servers` - List servers (filtered by user access or admin).
- `GET /servers/:id` - Detailed server status, resource allocation, and settings.
- `POST /servers` - Create server (Requires `servers:write`).
- `PATCH /servers/:id` - Update server limits and configuration.
- `DELETE /servers/:id` - Delete server record from database.
- `GET /servers/:id/history` - Audit diff of server settings changes.
- `GET /servers/:id/backups` - List backups.
- `POST /servers/:id/backups` - Trigger backup metadata creation.
- `GET /servers/:id/schedules` - List scheduled automated tasks.
- `POST /servers/:id/schedules` - Create cron schedule.

---

## 5. Players Database (`/players`)
- `GET /players` - Paginated player list.
- `GET /players/:uuid` - Lookup player by Minecraft UUID.
- `GET /players/:uuid/data` - Retrieve synchronized player data JSONB.
- `PATCH /players/:uuid/data` - Update player data keys.
- `POST /players/sync` - Synchronize player session, playtime, and online state.

---

## 6. Files & Change Tracking (`/files`)
- `GET /files/metadata?server_id=<UUID>` - List audited files on server.
- `POST /files/track-change` - Record file edit diff before/after in PostgreSQL.
- `GET /files/history` - Retrieve file edit change logs.

---

## 7. API Keys (`/api-keys`)
- `GET /api-keys` - List active and revoked API keys.
- `POST /api-keys` - Generate new scoped API key (`mcp_live_...`).
- `POST /api-keys/:id/revoke` - Revoke an API key immediately.
- `DELETE /api-keys/:id` - Remove API key record.

---

## 8. Audit Logs & Security (`/audit`)
- `GET /audit` - Query system audit logs with filters.
- `GET /audit/security-events` - Query security events (failed logins, rate limits, permission denials).
- `GET /audit/change-history` - Query human-readable property diffs across all resources.

---

## 9. Global Panel Settings (`/panel/settings`)
- `GET /panel/settings` - Retrieve all global panel settings.
- `PATCH /panel/settings` - Update configuration sections.
