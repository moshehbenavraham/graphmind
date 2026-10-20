#!/bin/bash

set -e

# GraphMind Production Deployment Script
# Clean rebuild with Cloudflare Tunnel

# ANSI colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Load .env into environment so Wrangler sees CLOUDFLARE_API_TOKEN
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

require_env "CLOUDFLARE_API_TOKEN"

clear_line() {
  printf "\r"
}

echo "============================================"
echo "GraphMind Production Deployment Script"
echo "Clean rebuild with Cloudflare Tunnel"
echo "============================================"
echo ""

echo -e "${YELLOW}[1/11] Stopping all existing services...${NC}"
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
REMAINING=$(ps aux | grep -E "wrangler dev|workerd|vite|falkordb-rest-api|cloudflared" | grep -v grep | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo -e "${RED}  WARNING: $REMAINING processes still running, killing again...${NC}"
    pkill -9 -f "wrangler" >/dev/null 2>&1 || true
    pkill -9 -f "workerd" >/dev/null 2>&1 || true
    pkill -9 -f "vite" >/dev/null 2>&1 || true
    pkill -9 -f "falkordb-rest-api" >/dev/null 2>&1 || true
    pkill -9 -f "cloudflared" >/dev/null 2>&1 || true
    sleep 2
fi
echo -e "${GREEN}✔ Services stopped${NC}"
echo ""

echo -e "${YELLOW}[2/11] Cleaning all build artifacts and caches...${NC}"
# Clean build artifacts
rm -rf dist/ node_modules/.cache/ src/frontend/dist/ src/frontend/node_modules/.cache/ src/frontend/.vite/

# HARD CLEAR: All wrangler state including KV, D1, R2 caches
echo "  - Clearing all .wrangler state (KV, D1, R2 caches)..."
rm -rf .wrangler/ 2>/dev/null || true

# Clean npm caches
echo "  - Clearing npm caches..."
npm cache clean --force >/dev/null 2>&1 || true
(cd src/frontend && npm cache clean --force >/dev/null 2>&1 || true)

# Clean any TypeScript/esbuild caches
rm -rf .tsbuildinfo tsconfig.tsbuildinfo 2>/dev/null || true

# Clean any stale lock files that might cause issues
rm -rf package-lock.json.bak 2>/dev/null || true

echo -e "${GREEN}✔ All build artifacts and caches cleared${NC}"
echo ""

echo -e "${YELLOW}[3/11] Installing fresh dependencies and upgrading tools...${NC}"

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

echo -e "${YELLOW}[4/11] Starting FalkorDB Docker container...${NC}"

# Pull latest FalkorDB image
echo "  - Pulling latest FalkorDB image..."
docker pull falkordb/falkordb:latest

if docker ps -a | grep -q falkordb-local; then
    echo "  - Removing existing container..."
    docker rm -f falkordb-local >/dev/null 2>&1 || true
fi

docker run -d \
  --name falkordb-local \
  -p 6383:6379 \
  -v "$PROJECT_ROOT/falkordb-data:/var/lib/falkordb/data" \
  falkordb/falkordb:latest

echo "  - Waiting for FalkorDB to be ready..."
sleep 5

# Configure persistence (save every 60s if 1+ change, enable AOF)
echo "  - Configuring persistence..."
docker exec falkordb-local redis-cli CONFIG SET save "60 1" >/dev/null
docker exec falkordb-local redis-cli CONFIG SET appendonly yes >/dev/null

if docker ps | grep -q falkordb-local; then
    echo -e "${GREEN}✔ FalkorDB running on port 6383 with persistence enabled${NC}"
else
    echo -e "${RED}✖ FalkorDB failed to start${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}[5/11] Starting FalkorDB REST API wrapper...${NC}"
node scripts/falkordb-rest-api.js > /tmp/falkordb-rest-api.log 2>&1 &
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

echo -e "${YELLOW}[6/11] Starting Cloudflare Tunnel...${NC}"

# Check and upgrade cloudflared
echo "  - Checking cloudflared version..."
CLOUDFLARED_CURRENT=$(cloudflared --version 2>/dev/null | head -1 || echo "not installed")
echo "    Current: $CLOUDFLARED_CURRENT"

# Try to update cloudflared (different methods based on install type)
echo "  - Attempting cloudflared upgrade..."
cloudflared update 2>/dev/null || \
  (which apt-get >/dev/null && apt-get update && apt-get install -y cloudflared 2>/dev/null) || \
  (which brew >/dev/null && brew upgrade cloudflared 2>/dev/null) || \
  echo "    (cloudflared upgrade skipped - update manually if needed)"

CLOUDFLARED_NEW=$(cloudflared --version 2>/dev/null | head -1 || echo "unknown")
echo "    Version: $CLOUDFLARED_NEW"

cloudflared tunnel run falkordb-tunnel > /tmp/cloudflared.log 2>&1 &
TUNNEL_PID=$!
echo "  - Tunnel started (PID: $TUNNEL_PID)"
echo "  - Waiting for tunnel to connect..."
sleep 10

if ps -p $TUNNEL_PID > /dev/null; then
    echo -e "${GREEN}✔ Cloudflare Tunnel running${NC}"
    cloudflared tunnel info falkordb-tunnel | head -5
else
    echo -e "${RED}✖ Cloudflare Tunnel failed to start${NC}"
    tail -20 /tmp/cloudflared.log
    exit 1
fi
echo ""

echo -e "${YELLOW}[7/11] Verifying production secrets...${NC}"
SECRETS=$(npx wrangler secret list --env production 2>&1 || true)
if echo "$SECRETS" | grep -q "FALKORDB_HOST" && echo "$SECRETS" | grep -q "FALKORDB_PORT"; then
    echo -e "${GREEN}✔ Production secrets configured${NC}"
else
    echo -e "${RED}✖ Missing production secrets${NC}"
    echo "Please run:"
    echo "  npx wrangler secret put FALKORDB_HOST --env production"
    echo "  npx wrangler secret put FALKORDB_PORT --env production"
    exit 1
fi
echo ""

echo -e "${YELLOW}[8/11] Applying Database Migrations...${NC}"
# Run migrations BEFORE starting the worker
yes | npx wrangler d1 migrations apply graphmind-db --env production
echo -e "${GREEN}✔ Database migrations applied${NC}"
echo ""

echo -e "${YELLOW}[9/11] Building and deploying frontend...${NC}"
cd src/frontend
rm -rf dist/
echo "  - Building frontend..."
npm run build
echo "  - Deploying to Cloudflare Pages..."
DEPLOY_OUTPUT=$(npx wrangler pages deploy dist --project-name=graphmind 2>&1)
echo "$DEPLOY_OUTPUT"
FRONTEND_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://[a-z0-9-]*\.graphmind-[a-z0-9]*\.pages\.dev' | head -1)
if [ -z "$FRONTEND_URL" ]; then
    echo -e "${RED}✖ Failed to extract frontend URL${NC}"
    exit 1
fi

echo -e "${GREEN}✔ Frontend deployed: $FRONTEND_URL${NC}"
cd "$PROJECT_ROOT"
echo ""

echo -e "${YELLOW}[10/11] Deploying Workers API...${NC}"
npx wrangler deploy --env production
WORKER_URL=$(npx wrangler deployments list --json 2>/dev/null | jq -r '.[0].url // "https://graphmind-api.apex-web-services-llc-0d4.workers.dev"')
echo -e "${GREEN}✔ Workers deployed: $WORKER_URL${NC}"
echo ""

echo -e "${YELLOW}[11/11] Running health checks...${NC}"
echo "  - Testing FalkorDB..."
if docker exec falkordb-local redis-cli PING | grep -q "PONG"; then
    echo -e "    ${GREEN}✔ FalkorDB responding${NC}"
else
    echo -e "    ${RED}✖ FalkorDB not responding${NC}"
    exit 1
fi

echo "  - Testing REST API..."
if curl -s -m 10 -H "Authorization: Bearer ${FALKORDB_REST_API_KEY}" http://localhost:3013/health | grep -q "healthy"; then
    echo -e "    ${GREEN}✔ REST API healthy${NC}"
else
    echo -e "    ${RED}✖ REST API unhealthy${NC}"
    exit 1
fi

echo "  - Testing Cloudflare Tunnel..."
TUNNEL_HEALTH=$(curl -s -m 10 https://falkordb-tunnel.aiwithapex.com/health 2>&1 || echo "failed")
if echo "$TUNNEL_HEALTH" | grep -q "healthy"; then
    echo -e "    ${GREEN}✔ Tunnel accessible${NC}"
else
    echo -e "    ${YELLOW}• Tunnel health check failed (may take a minute to propagate)${NC}"
fi

echo "  - Testing Workers API..."
API_HEALTH=$(curl -s -m 10 "$WORKER_URL/api/health" 2>&1)
if echo "$API_HEALTH" | grep -q "ok"; then
    echo -e "    ${GREEN}✔ Workers API healthy${NC}"
else
    echo -e "    ${YELLOW}• Workers API check failed${NC}"
    echo "    Response: $API_HEALTH"
fi

echo ""
echo "============================================"
echo -e "${GREEN}Production Deployment Complete!${NC}"
echo "============================================"
echo ""
echo "=> Deployment Summary:"
echo "  Frontend:  $FRONTEND_URL"
echo "  API:       $WORKER_URL"
echo "  Tunnel:    https://falkordb-tunnel.aiwithapex.com"
echo ""
echo "=> Running Services:"
echo "  FalkorDB Docker:  localhost:6383 (container: falkordb-local)"
echo "  REST API:         localhost:3013 (PID: $REST_API_PID)"
echo "  Cloudflare Tunnel:              (PID: $TUNNEL_PID)"
echo ""
echo "=> Logs:"
echo "  REST API:  tail -f /tmp/falkordb-rest-api.log"
echo "  Tunnel:    tail -f /tmp/cloudflared.log"
echo "  Workers:   npx wrangler tail"
echo "  FalkorDB:  docker logs -f falkordb-local"
echo ""
echo "=> To stop services:"
echo "  pkill -f cloudflared"
echo "  pkill -f falkordb-rest-api"
echo "  docker stop falkordb-local"
echo ""
echo -e "${GREEN}✔ Deployment successful!${NC}"
