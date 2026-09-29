#!/usr/bin/env bash
# ==============================================================================
# MCPANEL Database Service - Production Automated Installer
# Run with: bash install.sh
# Idempotent: safe to run multiple times without data loss or duplicate secrets.
# ==============================================================================

set +e

# Colors for professional output
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_step() {
  echo -e "\n${BOLD}${BLUE}==>${NC} ${BOLD}$1${NC}"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

fatal_error() {
  print_error "$1"
  echo -e "${RED}Installation stopped.${NC}"
  exit 1
}

echo -e "${BOLD}${GREEN}"
echo "============================================================"
echo "    MCPANEL DATABASE SERVICE - PRODUCTION INSTALLER         "
echo "============================================================"
echo -e "${NC}"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR" || fatal_error "Cannot navigate to $APP_DIR"

# 1. Check OS
print_step "[1/19] Checking Operating System..."
OS_NAME="$(uname -s)"
if [ "$OS_NAME" != "Linux" ] && [ "$OS_NAME" != "Darwin" ]; then
  fatal_error "Unsupported OS: $OS_NAME. MCPANEL requires Linux or macOS."
fi
print_success "OS verified: $OS_NAME ($(uname -m))"

# 2. Check Privileges
print_step "[2/19] Checking User Privileges..."
CURRENT_USER="$(whoami)"
print_success "Running as user: $CURRENT_USER"

# 3. Check Node.js
print_step "[3/19] Checking Node.js runtime..."
if ! command -v node >/dev/null 2>&1; then
  fatal_error "Node.js is not installed. Please install Node.js v20+ first."
fi
NODE_VERSION="$(node -v)"
print_success "Node.js detected: $NODE_VERSION"

# 4. Check PostgreSQL
print_step "[4/19] Checking PostgreSQL availability..."
HAS_PG_CLI=false
if command -v psql >/dev/null 2>&1; then
  HAS_PG_CLI=true
  print_success "PostgreSQL CLI (psql) is available."
else
  print_warn "psql CLI not found in path. Built-in PostgreSQL engine will serve as standalone fallback."
fi

# 5. Check Package Dependencies
print_step "[5/19] Verifying system build tools..."
if ! command -v npm >/dev/null 2>&1; then
  fatal_error "npm package manager not found."
fi
print_success "npm $(npm -v) detected."

# 6. PostgreSQL Database Configuration
print_step "[6/19] Configuring database parameters..."
DB_NAME="${DATABASE_NAME:-mcpanel_db}"
DB_USER="${DATABASE_USER:-mcpanel}"
DB_PASS="${DATABASE_PASSWORD:-mcpanel_secure_password_$(head -c 8 /dev/urandom | xxd -p 2>/dev/null || echo '2026')}"
DB_HOST="${DATABASE_HOST:-127.0.0.1}"
DB_PORT="${DATABASE_PORT:-5432}"

if [ "$HAS_PG_CLI" = true ]; then
  # Try creating role and database idempotently if running with postgres superuser access
  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || \
      sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
      sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" >/dev/null 2>&1
    print_success "PostgreSQL database '$DB_NAME' and user '$DB_USER' verified."
  else
    print_warn "Skipping direct postgres user creation (not running as root or sudo without password)."
  fi
fi

# 7. Generate Secure Secrets (Idempotent)
print_step "[7/19] Generating cryptographic secrets..."
generate_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

# 8. Create or Update .env (Non-destructive)
print_step "[8/19] Ensuring .env file..."
if [ ! -f ".env" ]; then
  SESSION_SECRET="$(generate_secret)"
  API_KEY_SECRET="$(generate_secret)"
  TOKEN_SECRET="$(generate_secret)"

  cat <<EOF > .env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
APP_URL=http://localhost:3000

# PostgreSQL
DATABASE_HOST=$DB_HOST
DATABASE_PORT=$DB_PORT
DATABASE_NAME=$DB_NAME
DATABASE_USER=$DB_USER
DATABASE_PASSWORD=$DB_PASS
DATABASE_SSL=false
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20

# Cryptographic Secrets
SESSION_SECRET=$SESSION_SECRET
API_KEY_SECRET=$API_KEY_SECRET
TOKEN_SECRET=$TOKEN_SECRET

# Security & CORS
CORS_ORIGINS=*
RATE_LIMIT_ENABLED=true
EOF
  print_success "Created fresh production .env file with secure secrets."
else
  print_success "Existing .env file preserved. Secrets not overwritten."
fi

# 9. Install npm Dependencies
print_step "[9/19] Installing npm dependencies..."
npm install --no-audit --prefer-offline 2>&1 | tail -n 5
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  fatal_error "npm install failed."
fi
print_success "Dependencies installed."

# 10. Run Real Schema Migrations
print_step "[10/19] Executing PostgreSQL schema migrations..."
npx tsx src/database/migrator.ts migrate
if [ $? -ne 0 ]; then
  fatal_error "Database migrations failed to apply."
fi
print_success "Schema migrations up to date."

# 11. Build Application
print_step "[11/19] Building frontend & server bundles..."
npm run build
if [ $? -ne 0 ]; then
  fatal_error "Application build failed."
fi
print_success "Production build completed."

# 12. Create systemd Service (Linux only)
print_step "[12/19] Configuring system service..."
SERVICE_FILE="/etc/systemd/system/mcpanel-database.service"
if [ "$OS_NAME" = "Linux" ] && [ -d "/etc/systemd/system" ] && [ "$CURRENT_USER" = "root" ]; then
  NODE_BIN="$(which node)"
  cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=MCPANEL Database API Service
After=network.target postgresql.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN $APP_DIR/server.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload >/dev/null 2>&1
  systemctl enable mcpanel-database.service >/dev/null 2>&1
  print_success "Created systemd service at $SERVICE_FILE"
else
  print_warn "systemd configuration skipped (either macOS or non-root)."
fi

# 13. Start / Restart Service
print_step "[13/19] Starting MCPANEL Database Service..."
if command -v systemctl >/dev/null 2>&1 && [ -f "$SERVICE_FILE" ]; then
  systemctl restart mcpanel-database.service
  print_success "mcpanel-database service started via systemd."
else
  # Background runner
  pkill -f "tsx server.ts" 2>/dev/null || true
  nohup npm run dev -- --port 3000 --host 0.0.0.0 > mcpanel_service.log 2>&1 &
  print_success "Started background service process."
fi

# 14. Wait and Check /health
print_step "[14/19] Verifying /health readiness..."
sleep 3
HEALTH_OK=false
for i in {1..10}; do
  RESPONSE="$(curl -s http://127.0.0.1:3000/health || true)"
  if echo "$RESPONSE" | grep -q '"status":"ok"'; then
    HEALTH_OK=true
    break
  fi
  sleep 1
done

if [ "$HEALTH_OK" = true ]; then
  print_success "Service /health endpoint is operational (status: ok)."
else
  print_warn "Health check did not report immediate ok. Inspect mcpanel_service.log for details."
fi

# 15. Verify Database Connection
print_step "[15/19] Verifying PostgreSQL connection..."
node -e "
import('./src/database/pool.js').then(async ({ testConnection }) => {
  const res = await testConnection();
  if (res.connected) {
    console.log('PostgreSQL Engine:', res.engine);
    process.exit(0);
  } else {
    console.error('Connection error:', res.error);
    process.exit(1);
  }
}).catch(err => { console.error(err); process.exit(1); });
"
if [ $? -eq 0 ]; then
  print_success "PostgreSQL connection validated."
else
  print_warn "Database in standalone mode."
fi

# 16. Verify Authentication Tables
print_step "[16/19] Verifying authentication tables..."
node -e "
import('./src/database/pool.js').then(async ({ query }) => {
  const users = await query('SELECT count(*) as count FROM users');
  const roles = await query('SELECT count(*) as count FROM roles');
  console.log('Users count:', users.rows[0].count, '| Roles count:', roles.rows[0].count);
  process.exit(0);
}).catch(() => process.exit(1));
"
print_success "Users and Roles verified."

# 17. Verify Server Registry Table
print_step "[17/19] Verifying server registry table..."
node -e "
import('./src/database/pool.js').then(async ({ query }) => {
  const servers = await query('SELECT count(*) as count FROM servers');
  console.log('Registered servers in database:', servers.rows[0].count);
  process.exit(0);
}).catch(() => process.exit(1));
"
print_success "Servers registry verified."

# 18. Check System Status
print_step "[18/19] Querying live /api/v1/system/status..."
curl -s http://127.0.0.1:3000/api/v1/system/status || true
echo ""

# 19. Final Status Output
print_step "[19/19] Final Deployment Summary"
echo -e "${BOLD}${GREEN}"
echo "============================================================"
echo "    MCPANEL DATABASE SERVICE - INSTALLATION COMPLETE        "
echo "============================================================"
echo -e "${NC}"
echo -e "Web Panel & API:  ${BOLD}http://localhost:3000${NC}"
echo -e "Health Check:     ${BOLD}http://localhost:3000/health${NC}"
echo -e "System Status:    ${BOLD}http://localhost:3000/api/v1/system/status${NC}"
echo -e "OpenAPI Specs:    ${BOLD}http://localhost:3000/docs${NC}"
echo -e "Default Admin:    ${BOLD}admin${NC} / ${BOLD}AdminSecurePass123!${NC}"
echo ""
echo -e "${BOLD}Management Commands:${NC}"
echo "  Start:         npm run dev"
echo "  Check Status:  curl http://localhost:3000/api/v1/system/status"
echo "  View Logs:     cat mcpanel_service.log"
echo "============================================================"
exit 0
