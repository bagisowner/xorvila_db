# MCPANEL Database Service - Deployment & Operations Guide

## Automated 1-Click Linux Deployment
Run the automated idempotent installer:
```bash
bash scripts/install.sh
```

## Systemd Service Management
The installer provisions the `mcpanel-database.service` unit:
```bash
# Enable service on boot
systemctl enable mcpanel-database

# Start or restart service
systemctl restart mcpanel-database

# Inspect service status
systemctl status mcpanel-database

# Inspect live logs
journalctl -u mcpanel-database -f
```

## Manual Production Deployment Steps
1. Provision PostgreSQL 14+:
```sql
CREATE USER mcpanel WITH PASSWORD 'your_secure_password';
CREATE DATABASE mcpanel_db OWNER mcpanel;
GRANT ALL PRIVILEGES ON DATABASE mcpanel_db TO mcpanel;
```

2. Configure `.env`:
```bash
cp .env.example .env
# Edit DATABASE_URL and secrets
```

3. Run migrations and build:
```bash
npm install
npm run db:migrate
npm run build
npm run start
```

## Health Check & Monitoring
- Liveness Check: `GET /health`
- Readiness Check: `GET /ready`
- OpenAPI Specification: `GET /openapi.json`
- Swagger UI: `GET /docs`
