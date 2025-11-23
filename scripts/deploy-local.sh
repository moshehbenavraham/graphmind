#!/bin/bash

set -e

# GraphMind Local Development Deployment Script
# Clean rebuild with local services only

# ANSI colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

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
pkill -f "cloudflared tunnel run" >/dev/null 2>&1 || true
pkill -f "falkordb-rest-api.js" >/dev/null 2>&1 || true
pkill -f "wrangler dev" >/dev/null 2>&1 || true
pkill -f "wrangler tail" >/dev/null 2>&1 || true
pkill -f "vite" >/dev/null 2>&1 || true
sleep 2
echo -e "${GREEN}✔ Services stopped${NC}"
echo ""

echo -e "${YELLOW}[2/8] Cleaning all build artifacts and caches...${NC}"
rm -rf dist/ .wrangler/ node_modules/.cache/ src/frontend/dist/ src/frontend/node_modules/.cache/ src/frontend/.vite/
npm cache clean --force >/dev/null 2>&1 || true
(cd src/frontend && npm cache clean --force >/dev/null 2>&1 || true)
echo -e "${GREEN}✔ Build artifacts cleaned${NC}"
echo ""

echo -e "${YELLOW}[3/8] Installing fresh dependencies...${NC}"
rm -rf node_modules/
npm install
cd src/frontend
rm -rf node_modules/
npm install
cd "$PROJECT_ROOT"
echo -e "${GREEN}✔ Dependencies installed${NC}"
echo ""

echo -e "${YELLOW}[4/8] Starting FalkorDB Docker container...${NC}"
if docker ps -a | grep -q falkordb-local; then
    echo "  - Removing existing container..."
    docker rm -f falkordb-local >/dev/null 2>&1 || true
fi

docker run -d \
  --name falkordb-local \
  -p 6380:6379 \
  -v "$PROJECT_ROOT/falkordb-data:/var/lib/falkordb/data" \
  falkordb/falkordb:latest

echo "  - Waiting for FalkorDB to be ready..."
sleep 5

# Configure persistence (save every 60s if 1+ change, enable AOF)
echo "  - Configuring persistence..."
docker exec falkordb-local redis-cli CONFIG SET save "60 1" >/dev/null
docker exec falkordb-local redis-cli CONFIG SET appendonly yes >/dev/null

if docker ps | grep -q falkordb-local; then
    echo -e "${GREEN}✔ FalkorDB running on port 6380 with persistence enabled${NC}"
else
    echo -e "${RED}✖ FalkorDB failed to start${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}[5/8] Starting FalkorDB REST API wrapper...${NC}"
node scripts/falkordb-rest-api.js > /tmp/falkordb-rest-api.log 2>&1 &
REST_API_PID=$!
echo "  - REST API started (PID: $REST_API_PID)"
echo "  - Waiting for REST API to be ready..."
sleep 3

if curl -s http://localhost:3001/health | grep -q "healthy"; then
    echo -e "${GREEN}✔ REST API running on port 3001${NC}"
else
    echo -e "${RED}✖ REST API failed to start${NC}"
    cat /tmp/falkordb-rest-api.log
    exit 1
fi
echo ""

echo -e "${YELLOW}[6/8] Starting frontend dev server...${NC}"
cd src/frontend
npm run dev > /tmp/vite-dev.log 2>&1 &
FRONTEND_PID=$!
cd "$PROJECT_ROOT"
echo "  - Frontend dev server started (PID: $FRONTEND_PID)"
echo "  - Waiting for Vite to be ready..."
sleep 5

if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✔ Frontend dev server running on port 5173${NC}"
else
    echo -e "${RED}✖ Frontend dev server failed to start${NC}"
    tail -20 /tmp/vite-dev.log
    exit 1
fi
echo ""

echo -e "${YELLOW}[7/8] Starting Workers dev server...${NC}"
npx wrangler dev > /tmp/wrangler-dev.log 2>&1 &
WORKER_PID=$!
echo "  - Workers dev server started (PID: $WORKER_PID)"
echo "  - Waiting for Workers to be ready..."
sleep 8

if ps -p $WORKER_PID > /dev/null; then
    echo -e "${GREEN}✔ Workers dev server running on port 8787${NC}"
else
    echo -e "${RED}✖ Workers dev server failed to start${NC}"
    tail -20 /tmp/wrangler-dev.log
    exit 1
fi
echo ""

echo -e "${YELLOW}[8/8] Running health checks...${NC}"
echo "  - Testing FalkorDB..."
if docker exec falkordb-local redis-cli PING | grep -q "PONG"; then
    echo -e "    ${GREEN}✔ FalkorDB responding${NC}"
else
    echo -e "    ${RED}✖ FalkorDB not responding${NC}"
    exit 1
fi

echo "  - Testing REST API..."
if curl -s http://localhost:3001/health | grep -q "healthy"; then
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
FRONTEND_HEALTH=$(curl -s -m 10 http://localhost:5173 2>&1 || echo "pending")
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
echo "  Frontend:  http://localhost:5173"
echo "  API:       http://localhost:8787"
echo "  REST API:  http://localhost:3001"
echo ""
echo "=> Running Services:"
echo "  FalkorDB Docker:  localhost:6380 (container: falkordb-local)"
echo "  REST API:         localhost:3001 (PID: $REST_API_PID)"
echo "  Frontend:         localhost:5173 (PID: $FRONTEND_PID)"
echo "  Workers:          localhost:8787 (PID: $WORKER_PID)"
echo ""
echo "=> Logs:"
echo "  REST API:  tail -f /tmp/falkordb-rest-api.log"
echo "  Frontend:  tail -f /tmp/vite-dev.log"
echo "  Workers:   tail -f /tmp/wrangler-dev.log"
echo "  FalkorDB:  docker logs -f falkordb-local"
echo ""
echo "=> To stop services:"
echo "  pkill -f vite"
echo "  pkill -f \"wrangler dev\""
echo "  pkill -f falkordb-rest-api"
echo "  docker stop falkordb-local"
echo ""
echo -e "${GREEN}✔ Local environment ready! Open http://localhost:5173 in your browser${NC}"
