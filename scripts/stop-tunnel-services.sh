#!/bin/bash
# Stop FalkorDB Tunnel Services
# This script stops: Cloudflare Tunnel → REST API → FalkorDB Docker

echo "🛑 Stopping GraphMind FalkorDB Tunnel Services..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop Cloudflare Tunnel
echo -e "${YELLOW}[1/3]${NC} Stopping Cloudflare Tunnel..."
if pgrep -f "cloudflared.*tunnel.*run" > /dev/null; then
    pkill -f "cloudflared.*tunnel.*run"
    echo -e "${GREEN}✅ Cloudflare Tunnel stopped${NC}"
else
    echo -e "${YELLOW}⚠️  Cloudflare Tunnel not running${NC}"
fi

# Step 2: Stop REST API
echo -e "${YELLOW}[2/3]${NC} Stopping FalkorDB REST API..."
if pgrep -f "node.*falkordb-rest-api.js" > /dev/null; then
    pkill -f "node.*falkordb-rest-api.js"
    echo -e "${GREEN}✅ REST API stopped${NC}"
else
    echo -e "${YELLOW}⚠️  REST API not running${NC}"
fi

# Step 3: Stop FalkorDB Docker container
echo -e "${YELLOW}[3/3]${NC} Stopping FalkorDB Docker container..."
if docker ps | grep -q falkordb-local; then
    docker stop falkordb-local
    echo -e "${GREEN}✅ FalkorDB container stopped${NC}"
else
    echo -e "${YELLOW}⚠️  FalkorDB container not running${NC}"
fi

echo ""
echo -e "${GREEN}✅ All services stopped${NC}"
echo ""
echo "📊 Service Status:"
echo "  - FalkorDB Docker:   $(docker ps | grep -q falkordb-local && echo "❌ Still running" || echo "✅ Stopped")"
echo "  - REST API:          $(pgrep -f "node.*falkordb-rest-api.js" > /dev/null && echo "❌ Still running" || echo "✅ Stopped")"
echo "  - Cloudflare Tunnel: $(pgrep -f "cloudflared.*tunnel.*run" > /dev/null && echo "❌ Still running" || echo "✅ Stopped")"
echo ""
echo "🚀 To start all services again, run: bash scripts/start-tunnel-services.sh"
