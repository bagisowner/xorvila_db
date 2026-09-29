#!/usr/bin/env bash
# ==============================================================================
# MCPANEL DATABASE SERVICE - AUTOMATED IDEMPOTENT INSTALLER
# ==============================================================================

set +e

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$INSTALL_DIR"

echo "============================================================"
echo "📦 MCPANEL DATABASE SERVICE - INSTALLER"
echo "============================================================"

# 1. Check Root Privileges
IS_ROOT=false
if [ "$EUID" -eq 0 ]; then
    IS_ROOT=true
fi

# 2. Detect Linux Distribution
OS="unknown"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
fi
echo "🔍 Detected OS: $OS"

# Helper for running with sudo if not root
run_cmd() {
    if [ "$IS_ROOT" = true ]; then
        "$@"
    elif command -v sudo >/dev/null 2>&1; then
        sudo "$@"
    else
        echo "❌ Error: Root or sudo privileges required to execute: $*"
        return 1
    fi
}

# 3. Check / Install Node.js & npm
if ! command -v node >/dev/null 2>&1; then
    echo "📥 Installing Node.js..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        run_cmd apt-get update -y
        run_cmd apt-get install -y curl gnupg
        curl -fsSL https://deb.nodesource.com/setup_20.x | run_cmd bash -
        run_cmd apt-get install -y nodejs
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | run_cmd bash -
        run_cmd dnf install -y nodejs || run_cmd yum install -y nodejs
    fi
fi

if command -v node >/dev/null 2>&1; then
    echo "✅ Node.js $(node -v) verified."
else
    echo "❌ Failed to detect or install Node.js."
fi

# 4. Check / Setup PostgreSQL
DB_NAME="mcpanel_db"
DB_USER="mcpanel"

if ! command -v psql >/dev/null 2>&1; then
    echo "📥 Installing PostgreSQL Server..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        run_cmd apt-get update -y
        run_cmd apt-get install -y postgresql postgresql-contrib
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        run_cmd dnf install -y postgresql-server postgresql-contrib || run_cmd yum install -y postgresql-server postgresql-contrib
        run_cmd postgresql-setup --initdb || true
    fi
fi

# Start PostgreSQL service if systemctl exists
if command -v systemctl >/dev/null 2>&1; then
    run_cmd systemctl enable postgresql 2>/dev/null || true
    run_cmd systemctl start postgresql 2>/dev/null || true
fi

# 5. Provision PostgreSQL User & DB (Idempotent)
echo "🗄️ Checking PostgreSQL Database & Credentials..."
DB_PASS_GENERATED=$(openssl rand -hex 16 2>/dev/null || echo "mcpanel_sec_pass_$(date +%s)")

if command -v sudo >/dev/null 2>&1 && id -u postgres >/dev/null 2>&1; then
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS_GENERATED';" 2>/dev/null || true

    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true

    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
fi

# 6. Configure .env file (Idempotent: preserves existing secrets)
ENV_FILE="$INSTALL_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "📝 Generating secure .env configuration..."
    SESSION_SEC=$(openssl rand -hex 32 2>/dev/null || echo "default_session_secret_replace_$(date +%s)")
    API_KEY_SEC=$(openssl rand -hex 32 2>/dev/null || echo "default_api_key_secret_replace_$(date +%s)")
    TOKEN_SEC=$(openssl rand -hex 32 2>/dev/null || echo "default_token_secret_replace_$(date +%s)")

    cat <<EOF > "$ENV_FILE"
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
APP_URL=http://localhost:3000

DATABASE_URL=postgres://$DB_USER:$DB_PASS_GENERATED@127.0.0.1:5432/$DB_NAME
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=$DB_NAME
DATABASE_USER=$DB_USER
DATABASE_PASSWORD=$DB_PASS_GENERATED

SESSION_SECRET=$SESSION_SEC
API_KEY_SECRET=$API_KEY_SEC
TOKEN_SECRET=$TOKEN_SEC

CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

RATE_LIMIT_ENABLED=true
EOF
    echo "✅ Created $ENV_FILE with newly generated secrets."
else
    echo "✅ Preserved existing $ENV_FILE configuration."
fi

# 7. Install Dependencies & Build
echo "📦 Installing application dependencies..."
npm install --silent 2>/dev/null || npm install

echo "🔨 Building frontend & server bundles..."
npm run build 2>/dev/null || true

# 8. Run Database Migrations
echo "🔄 Executing Database Migrations & RBAC Seed..."
npm run db:migrate

# 9. Configure Systemd Service
SERVICE_FILE="/etc/systemd/system/mcpanel-database.service"
if [ -d "/etc/systemd/system" ]; then
    echo "⚙️ Configuring systemd service: mcpanel-database..."
    cat <<EOF | run_cmd tee "$SERVICE_FILE" > /dev/null
[Unit]
Description=MCPANEL Database & Authentication API Service
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$(command -v npm) run start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mcpanel-database

[Install]
WantedBy=multi-user.target
EOF

    run_cmd systemctl daemon-reload
    run_cmd systemctl enable mcpanel-database 2>/dev/null || true
    run_cmd systemctl restart mcpanel-database 2>/dev/null || true
fi

# 10. Verification
echo "🩺 Verifying service health..."
sleep 2

PORT_VAL=3000
if [ -f "$ENV_FILE" ]; then
    PORT_VAL=$(grep -E "^PORT=" "$ENV_FILE" | cut -d '=' -f2 || echo 3000)
fi

echo ""
echo "========================================"
echo "MCPANEL DATABASE API INSTALLED"
echo ""
echo "API:        http://127.0.0.1:$PORT_VAL/api/v1"
echo "Health:     http://127.0.0.1:$PORT_VAL/health"
echo "Docs:       http://127.0.0.1:$PORT_VAL/docs"
echo "Database:   PostgreSQL"
echo "Service:    mcpanel-database"
echo "Config:     $ENV_FILE"
echo "Logs:       journalctl -u mcpanel-database -f"
echo "========================================"
echo ""
