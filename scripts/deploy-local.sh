#!/bin/bash

set -e

# GraphMind Local Development Deployment Script
# Clean rebuild with local services only

# ANSI colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# =============================================================================
# Functions
# =============================================================================

show_help() {
    echo "GraphMind Local Development Deployment Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --stop        Stop all running services and exit"
    echo "  --stop-all    Stop all services including Docker container"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0              # Start all services (clean rebuild)"
    echo "  $0 --stop       # Stop all services (keep Docker running)"
    echo "  $0 --stop-all   # Stop everything including FalkorDB Docker"
    echo ""
}

stop_services() {
    local stop_docker="${1:-false}"

    echo "============================================"
    echo -e "${YELLOW}Stopping GraphMind Services...${NC}"
    echo "============================================"
    echo ""

    echo -e "${BLUE}[1/4] Stopping application processes...${NC}"
    pkill -9 -f "cloudflared tunnel run" >/dev/null 2>&1 && echo "  - Stopped: cloudflared tunnel" || true
    pkill -9 -f "falkordb-rest-api.js" >/dev/null 2>&1 && echo "  - Stopped: FalkorDB REST API" || true
    pkill -9 -f "wrangler dev" >/dev/null 2>&1 && echo "  - Stopped: Wrangler dev server" || true
    pkill -9 -f "wrangler tail" >/dev/null 2>&1 && echo "  - Stopped: Wrangler tail" || true
    pkill -9 -f "workerd" >/dev/null 2>&1 && echo "  - Stopped: workerd" || true
    pkill -9 -f "vite" >/dev/null 2>&1 && echo "  - Stopped: Vite dev server" || true
    echo -e "${GREEN}Done${NC}"
    echo ""

    echo -e "${BLUE}[2/4] Releasing ports (8787, 5176, 3013)...${NC}"
    lsof -ti :8787 2>/dev/null | xargs kill -9 2>/dev/null && echo "  - Released: port 8787" || true
    lsof -ti :5176 2>/dev/null | xargs kill -9 2>/dev/null && echo "  - Released: port 5176" || true
    lsof -ti :3013 2>/dev/null | xargs kill -9 2>/dev/null && echo "  - Released: port 3013" || true
    echo -e "${GREEN}Done${NC}"
    echo ""

    echo -e "${BLUE}[3/4] Verifying all processes stopped...${NC}"
    sleep 1
    REMAINING=$(ps aux | grep -E "wrangler dev|workerd|vite|falkordb-rest-api" | grep -v grep | wc -l)
    if [ "$REMAINING" -gt 0 ]; then
        echo -e "${YELLOW}  Warning: $REMAINING processes still running, force killing...${NC}"
        pkill -9 -f "wrangler" >/dev/null 2>&1 || true
        pkill -9 -f "workerd" >/dev/null 2>&1 || true
        pkill -9 -f "vite" >/dev/null 2>&1 || true
        pkill -9 -f "falkordb-rest-api" >/dev/null 2>&1 || true
        sleep 1
    fi
    echo -e "${GREEN}Done${NC}"
    echo ""

    echo -e "${BLUE}[4/4] Docker container...${NC}"
    if [ "$stop_docker" = "true" ]; then
        if docker ps | grep -q falkordb-local; then
            docker stop falkordb-local >/dev/null 2>&1
            echo "  - Stopped: FalkorDB Docker container"
        else
            echo "  - FalkorDB Docker container was not running"
        fi
    else
        if docker ps | grep -q falkordb-local; then
            echo -e "  - ${YELLOW}FalkorDB Docker container left running${NC}"
            echo "    (use --stop-all to stop Docker too)"
        else
            echo "  - FalkorDB Docker container was not running"
        fi
    fi
    echo -e "${GREEN}Done${NC}"
    echo ""

    # Final port status
    echo "============================================"
    echo -e "${BLUE}Port Status:${NC}"
    echo "============================================"
    for port in 3013 5176 8787; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "  Port $port: ${RED}IN USE${NC}"
            lsof -Pi :$port -sTCP:LISTEN 2>/dev/null | tail -1 | awk '{print "            PID: "$2" ("$1")"}'
        else
            echo -e "  Port $port: ${GREEN}FREE${NC}"
        fi
    done
    echo ""

    echo "============================================"
    echo -e "${GREEN}All services stopped!${NC}"
    echo "============================================"
}

# =============================================================================
# Argument Parsing
# =============================================================================

case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --stop)
        stop_services false
        exit 0
        ;;
    --stop-all)
        stop_services true
        exit 0
        ;;
    "")
        # No arguments - continue with normal startup
        ;;
    *)
        echo -e "${RED}Unknown option: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

# =============================================================================
# Main Script - Start Services
# =============================================================================

# Load .env into environment
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi

require_env() {
  local var_name="$1"
  if [ -z "${!var_name:-}" ]; then
    echo "${var_name} is not set. Add it to .env or export it before running this script." >&2
    exit 1
  fi
}

require_env "FALKORDB_HOST"
require_env "FALKORDB_PORT"

clear_line() {
  printf "\r"
}

echo "============================================"
echo "GraphMind Local Development Deployment"
echo "Clean rebuild with local services"
echo "============================================"
echo ""

echo -e "${YELLOW}[1/8] Stopping all existing services...${NC}"
pkill -9 -f "cloudflared tunnel run" >/dev/null 2>&1 || true
pkill -9 -f "falkordb-rest-api.js" >/dev/null 2>&1 || true
pkill -9 -f "wrangler dev" >/dev/null 2>&1 || true
pkill -9 -f "wrangler tail" >/dev/null 2>&1 || true
pkill -9 -f "workerd" >/dev/null 2>&1 || true
pkill -9 -f "vite" >/dev/null 2>&1 || true
sleep 3

echo "  - Killing processes on required ports (8787, 5176, 3013)..."
lsof -ti :8787 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :5176 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :3013 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

echo "  - Verifying all processes killed..."
REMAINING=$(ps aux | grep -E "wrangler dev|workerd|vite|falkordb-rest-api" | grep -v grep | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo -e "${RED}  WARNING: $REMAINING processes still running, killing again...${NC}"
    pkill -9 -f "wrangler" >/dev/null 2>&1 || true
    pkill -9 -f "workerd" >/dev/null 2>&1 || true
    pkill -9 -f "vite" >/dev/null 2>&1 || true
    pkill -9 -f "falkordb-rest-api" >/dev/null 2>&1 || true
    sleep 2
fi
echo -e "${GREEN}✔ Services stopped${NC}"
echo ""

echo -e "${YELLOW}[2/8] Cleaning all build artifacts and caches...${NC}"
# Clean build artifacts
rm -rf dist/ .wrangler/tmp/ node_modules/.cache/ src/frontend/dist/ src/frontend/node_modules/.cache/ src/frontend/.vite/

# HARD CLEAR: KV cache (answer cache, rate limit cache) - prevents stale cached answers
echo "  - Clearing KV answer cache..."
rm -rf .wrangler/state/kv/ 2>/dev/null || true

# HARD CLEAR: R2 local cache
echo "  - Clearing R2 local cache..."
rm -rf .wrangler/state/r2/ 2>/dev/null || true

# Preserve .wrangler/state/d1/ for D1 database persistence (development data)
if [ -d ".wrangler" ]; then
    find .wrangler -mindepth 1 -maxdepth 1 ! -name 'state' -exec rm -rf {} + 2>/dev/null || true
fi

# Clean npm caches
echo "  - Clearing npm caches..."
npm cache clean --force >/dev/null 2>&1 || true
(cd src/frontend && npm cache clean --force >/dev/null 2>&1 || true)

# Clean any TypeScript/esbuild caches
rm -rf .tsbuildinfo tsconfig.tsbuildinfo 2>/dev/null || true

echo -e "${GREEN}✔ Build artifacts and caches cleaned (D1 database preserved)${NC}"
echo ""

echo -e "${YELLOW}[3/8] Installing fresh dependencies and upgrading tools...${NC}"

# Upgrade npm itself first
echo "  - Checking npm version..."
NPM_CURRENT=$(npm --version)
echo "    Current npm: $NPM_CURRENT"
npm install -g npm@latest 2>/dev/null || echo "    (npm global upgrade skipped - may need sudo)"

# Install dependencies
rm -rf node_modules/
npm install

# Upgrade Wrangler to latest
echo "  - Upgrading Wrangler to latest..."
WRANGLER_OLD=$(npx wrangler --version 2>/dev/null | head -1 || echo "unknown")
npm install -D wrangler@latest
WRANGLER_NEW=$(npx wrangler --version 2>/dev/null | head -1 || echo "unknown")
echo "    Wrangler: $WRANGLER_OLD -> $WRANGLER_NEW"

# Security: Fix known vulnerabilities
echo "  - Running npm audit fix..."
npm audit fix --force 2>/dev/null || npm audit fix 2>/dev/null || echo "    No critical fixes needed"

# Check for outdated dependencies (informational)
echo "  - Checking for outdated packages..."
npm outdated 2>/dev/null | head -10 || echo "    All packages up to date"

cd src/frontend
rm -rf node_modules/
npm install

# Security: Fix frontend vulnerabilities
echo "  - Running npm audit fix for frontend..."
npm audit fix --force 2>/dev/null || npm audit fix 2>/dev/null || echo "    No critical fixes needed"

# Check frontend outdated packages
echo "  - Checking frontend outdated packages..."
npm outdated 2>/dev/null | head -10 || echo "    All packages up to date"

cd "$PROJECT_ROOT"
echo -e "${GREEN}✔ Dependencies installed, tools upgraded, and security audited${NC}"
echo ""

echo -e "${YELLOW}[4/8] Starting FalkorDB Docker container...${NC}"

# Pull latest FalkorDB image
echo "  - Pulling latest FalkorDB image..."
docker pull falkordb/falkordb:latest 2>/dev/null || echo "    (Image pull skipped - using cached)"

if docker ps -a | grep -q falkordb-local; then
    echo "  - Existing container found, restarting..."
    docker stop falkordb-local >/dev/null 2>&1 || true
    docker start falkordb-local >/dev/null 2>&1
    echo "  - Waiting for FalkorDB to be ready..."
    sleep 5
else
    echo "  - Creating new container with persistence enabled..."

    # Create redis.conf with persistence settings
    mkdir -p "$PROJECT_ROOT/falkordb-data"
    cat > "$PROJECT_ROOT/falkordb-data/redis.conf" << 'EOF'
# FalkorDB Persistence Configuration
# RDB snapshots: save every 60s if 1+ changes
save 60 1
save 300 10
save 3600 1

# AOF (Append-Only File) for durability
appendonly yes
appendfsync everysec

# Database directory
dir /var/lib/falkordb/data
EOF

    docker run -d \
      --name falkordb-local \
      -p 6383:6379 \
      -v "$PROJECT_ROOT/falkordb-data:/var/lib/falkordb/data" \
      falkordb/falkordb:latest \
      redis-server /var/lib/falkordb/data/redis.conf

    echo "  - Waiting for FalkorDB to be ready..."
    sleep 5
fi

if docker ps | grep -q falkordb-local; then
    echo -e "${GREEN}✔ FalkorDB running on port 6383 with persistence enabled${NC}"
else
    echo -e "${RED}✖ FalkorDB failed to start${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}[5/8] Starting FalkorDB REST API wrapper...${NC}"
# Final check that port 3013 is available
if lsof -Pi :3013 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}✖ Port 3013 is already in use!${NC}"
    echo "  Process using port 3013:"
    lsof -Pi :3013 -sTCP:LISTEN
    exit 1
fi

# Force connection to local Docker container (ignoring .env tunnel config)
FALKORDB_HOST="localhost" FALKORDB_PORT="6383" node scripts/falkordb-rest-api.js > /tmp/falkordb-rest-api.log 2>&1 &
REST_API_PID=$!
echo "  - REST API started (PID: $REST_API_PID)"
echo "  - Waiting for REST API to be ready..."
sleep 5

# Health check with authentication
if curl -s -H "Authorization: Bearer ${FALKORDB_REST_API_KEY}" http://localhost:3013/health | grep -q "healthy"; then
    echo -e "${GREEN}✔ REST API running on port 3013${NC}"
else
    echo -e "${RED}✖ REST API failed to start${NC}"
    cat /tmp/falkordb-rest-api.log
    exit 1
fi
echo ""

echo -e "${YELLOW}[6/8] Starting frontend dev server...${NC}"
# Final check that port 5176 is available
if lsof -Pi :5176 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}✖ Port 5176 is already in use!${NC}"
    echo "  Process using port 5176:"
    lsof -Pi :5176 -sTCP:LISTEN
    exit 1
fi

cd src/frontend
# Force API URL to localhost for local deployment, overriding any .env files
VITE_API_BASE_URL="http://localhost:8787" npm run dev > /tmp/vite-dev.log 2>&1 &
FRONTEND_PID=$!
cd "$PROJECT_ROOT"
echo "  - Frontend dev server started (PID: $FRONTEND_PID)"
echo "  - Waiting for Vite to be ready..."
sleep 5

if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✔ Frontend dev server running on port 5176${NC}"
else
    echo -e "${RED}✖ Frontend dev server failed to start${NC}"
    tail -20 /tmp/vite-dev.log
    exit 1
fi
echo ""

echo -e "${YELLOW}[7/8] Applying Database Migrations...${NC}"
# Run migrations BEFORE starting the worker to ensure DB is ready and unlocked
yes | npx wrangler d1 migrations apply graphmind-db --local
echo -e "${GREEN}✔ Database migrations applied${NC}"
echo ""

echo -e "${YELLOW}[8/8] Starting Workers dev server...${NC}"
# Final check that port 8787 is available
if lsof -Pi :8787 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}✖ Port 8787 is already in use!${NC}"
    echo "  Process using port 8787:"
    lsof -Pi :8787 -sTCP:LISTEN
    exit 1
fi

# Force Worker to talk to local REST API wrapper (ignoring .env tunnel config)
FALKORDB_HOST="http://127.0.0.1" FALKORDB_PORT="3013" npx wrangler dev --port 8787 > /tmp/wrangler-dev.log 2>&1 &
WORKER_PID=$!
echo "  - Workers dev server started (PID: $WORKER_PID)"
echo "  - Waiting for Workers to be ready on port 8787..."
sleep 8

if ps -p $WORKER_PID > /dev/null; then
    echo -e "${GREEN}✔ Workers dev server running on port 8787${NC}"
else
    echo -e "${RED}✖ Workers dev server failed to start${NC}"
    tail -20 /tmp/wrangler-dev.log
    exit 1
fi
echo ""

echo "============================================"
echo -e "${YELLOW}Running health checks...${NC}"
echo "  - Testing FalkorDB..."
if docker exec falkordb-local redis-cli PING | grep -q "PONG"; then
    echo -e "    ${GREEN}✔ FalkorDB responding${NC}"
else
    echo -e "    ${RED}✖ FalkorDB not responding${NC}"
    exit 1
fi

echo "  - Testing REST API..."
if curl -s -H "Authorization: Bearer ${FALKORDB_REST_API_KEY}" http://localhost:3013/health | grep -q "healthy"; then
    echo -e "    ${GREEN}✔ REST API healthy${NC}"
else
    echo -e "    ${RED}✖ REST API unhealthy${NC}"
    exit 1
fi

echo "  - Testing Workers dev server..."
WORKER_HEALTH=$(curl -s -m 10 http://localhost:8787/api/health 2>&1 || echo "pending")
if echo "$WORKER_HEALTH" | grep -q "ok"; then
    echo -e "    ${GREEN}✔ Workers dev server healthy${NC}"
else
    echo -e "    ${YELLOW}• Workers dev server still starting (this is normal)${NC}"
fi

echo "  - Testing Frontend dev server..."
FRONTEND_HEALTH=$(curl -s -m 10 http://localhost:5176 2>&1 || echo "pending")
if echo "$FRONTEND_HEALTH" | grep -q "<!DOCTYPE html>"; then
    echo -e "    ${GREEN}✔ Frontend dev server healthy${NC}"
else
    echo -e "    ${YELLOW}• Frontend dev server still starting (this is normal)${NC}"
fi

echo ""
echo "============================================"
echo -e "${GREEN}Local Development Environment Ready!${NC}"
echo "============================================"
echo ""
echo "=> Local URLs:"
echo "  Frontend:  http://localhost:5176"
echo "  API:       http://localhost:8787"
echo "  REST API:  http://localhost:3013"
echo ""
echo "=> Running Services:"
echo "  FalkorDB Docker:  localhost:6383 (container: falkordb-local)"
echo "  REST API:         localhost:3013 (PID: $REST_API_PID)"
echo "  Frontend:         localhost:5176 (PID: $FRONTEND_PID)"
echo "  Workers:          localhost:8787 (PID: $WORKER_PID)"
echo ""
echo "=> Logs:"
echo "  REST API:  tail -f /tmp/falkordb-rest-api.log"
echo "  Frontend:  tail -f /tmp/vite-dev.log"
echo "  Workers:   tail -f /tmp/wrangler-dev.log"
echo "  FalkorDB:  docker logs -f falkordb-local"
echo ""
echo "=> To stop services:"
echo "  ./scripts/deploy-local.sh --stop      # Stop all (keep Docker)"
echo "  ./scripts/deploy-local.sh --stop-all  # Stop everything"
echo ""
echo -e "${GREEN}✔ Local environment ready! Open http://localhost:5176 in your browser${NC}"
