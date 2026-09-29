# MCPANEL Database Service

Standalone, production-ready, API-first database and authentication service for **MCPANEL**.

## Key Architecture
```
MCPANEL WEB / CLI / DAEMONS
              │
      HTTPS / JSON API (REST v1)
              ▼
   MCPANEL DATABASE SERVICE
    ├── Argon2 / Scrypt Password Hasher
    ├── HttpOnly Cookie Sessions & API Keys
    ├── Granular RBAC Engine
    ├── File Change Tracker & Unified Diffs
    ├── Audit & Security Events Logger
    └── OpenAPI 3.x Swagger Documentation
              ▼
          PostgreSQL
```

## Quick Start
```bash
# 1. Automated Installation
bash scripts/install.sh

# 2. Local Development
npm run dev

# 3. Running Test Suite
npm test

# 4. CLI Tool
npx tsx bin/mcpanel-db.ts status
```

## Documentation
- [API Reference](docs/API.md)
- [Authentication & RBAC](docs/AUTH.md)
- [Database Schema](docs/DATABASE.md)
- [Deployment & Systemd](docs/DEPLOYMENT.md)
- [Legacy Migration Guide](docs/MIGRATION.md)
