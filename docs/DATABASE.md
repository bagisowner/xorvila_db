# MCPANEL Database Schema & Persistence Guide

## Core Tables Overview

### 1. Identity & Authentication
- `users`: Core credentials, username, email, active flag.
- `user_profiles`: Display name, bio, timezone, language, theme.
- `sessions`: Active user sessions with IP, user agent, expiration.
- `refresh_tokens`: Rotating refresh tokens for token renewal.
- `oauth_accounts`: Provider federations (Google, Discord).
- `password_resets`: Single-use tokens with short TTL.
- `email_verifications`: Email verification tokens.
- `api_keys`: Machine-to-machine tokens with scoped permissions.

### 2. Role-Based Access Control
- `roles`: Role definitions (`admin`, `developer`, `user`, `viewer`, and custom roles).
- `permissions`: Granular permission nodes.
- `role_permissions`: Role-to-permission mapping table.
- `user_roles`: User-to-role assignment table.

### 3. Minecraft Infrastructure
- `nodes`: Physical daemon hosts and ports.
- `allocations`: IP and Port mappings.
- `servers`: Server instance specifications (CPU, RAM, Disk, Port, Type, Version).
- `server_members`: User assignments and roles per server.
- `server_settings`: Key-value JSONB server properties.
- `backups`: Backup records and archive pointers.
- `schedules` & `jobs`: Cron-based task execution.

### 4. Player Analytics & Persistence
- `players`: Minecraft UUID, username, first/last seen, playtime.
- `server_players`: Current online state per server.
- `player_sessions`: Connection durations and IP logs.
- `player_data`: Arbitrary synchronized data (JSONB).

### 5. Storage & File Change Tracking
- `folder_metadata`: Directory structures.
- `file_metadata`: File sizes, MIME types, sha256 checksums, and last modifier.
- `file_versions`: Version history and unified diff patches.

### 6. Audit & Observability
- `audit_logs`: Detailed action trail with actor, before/after values, IP, UA.
- `security_events`: High-priority security occurrences (failed logins, rate limits).
- `change_history`: State transitions and diffs across all resources.

## Running Migrations
```bash
npm run db:migrate   # Execute pending SQL migrations
npm run db:status    # Check migration status
npm run db:backup    # Create a database snapshot dump
```
