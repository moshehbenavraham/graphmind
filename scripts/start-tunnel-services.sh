#!/bin/bash
# Start FalkorDB Tunnel Services for Production
# This script starts: FalkorDB Docker → REST API → Cloudflare Tunnel

set -e

echo "🚀 Starting GraphMind FalkorDB Tunnel Services..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Step 1: Start FalkorDB Docker container
echo -e "${YELLOW}[1/3]${NC} Starting FalkorDB Docker container..."
if docker ps -a | grep -q falkordb-local; then
    if docker ps | grep -q falkordb-local; then
        echo -e "${GREEN}✅ FalkorDB container already running${NC}"
    else
        docker start falkordb-local
        echo -e "${GREEN}✅ FalkorDB container started${NC}"
    fi
else
    echo -e "${YELLOW}Creating new FalkorDB container...${NC}"
    docker run -d \
        --name falkordb-local \
        -p 6380:6379 \
        -v "$(pwd)/falkordb-data:/data" \
        falkordb/falkordb:latest
    echo -e "${GREEN}✅ FalkorDB container created and started${NC}"
fi

# Wait for FalkorDB to be ready
echo -e "${YELLOW}Waiting for FalkorDB to be ready...${NC}"
sleep 2

# Step 2: Start REST API wrapper
echo -e "${YELLOW}[2/3]${NC} Starting FalkorDB REST API wrapper..."

# Check if already running
if pgrep -f "node.*falkordb-rest-api.js" > /dev/null; then
    echo -e "${GREEN}✅ REST API already running${NC}"
else
    # Start in background
    nohup node scripts/falkordb-rest-api.js > logs/falkordb-rest-api.log 2>&1 &
    REST_API_PID=$!
    echo -e "${GREEN}✅ REST API started (PID: $REST_API_PID)${NC}"

    # Wait for REST API to be ready
    echo -e "${YELLOW}Waiting for REST API to be ready...${NC}"
    sleep 3

    # Verify REST API is responding
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ REST API health check passed${NC}"
    else
        echo -e "${RED}⚠️  REST API health check failed (may need more time)${NC}"
    fi
fi

# Step 3: Start Cloudflare Tunnel
echo -e "${YELLOW}[3/3]${NC} Starting Cloudflare Tunnel..."

# Check if tunnel is already running
if pgrep -f "cloudflared.*tunnel.*run" > /dev/null; then
    echo -e "${GREEN}✅ Cloudflare Tunnel already running${NC}"
else
    # Check if tunnel exists
    if cloudflared tunnel info falkordb-tunnel > /dev/null 2>&1; then
        # Start tunnel in background
        nohup cloudflared tunnel run falkordb-tunnel > logs/cloudflare-tunnel.log 2>&1 &
        TUNNEL_PID=$!
        echo -e "${GREEN}✅ Cloudflare Tunnel started (PID: $TUNNEL_PID)${NC}"

        echo -e "${YELLOW}Waiting for tunnel connections to establish...${NC}"
        sleep 5
    else
        echo -e "${RED}❌ Cloudflare Tunnel 'falkordb-tunnel' not found${NC}"
        echo -e "${YELLOW}Run: cloudflared tunnel create falkordb-tunnel${NC}"
        echo -e "${YELLOW}See docs/FALKORDB_TUNNEL.md for setup instructions${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}✅ All services started successfully!${NC}"
echo ""
echo "📊 Service Status:"
echo "  - FalkorDB Docker:   $(docker ps | grep -q falkordb-local && echo "✅ Running" || echo "❌ Not running")"
echo "  - REST API:          $(pgrep -f "node.*falkordb-rest-api.js" > /dev/null && echo "✅ Running (PID: $(pgrep -f "node.*falkordb-rest-api.js"))" || echo "❌ Not running")"
echo "  - Cloudflare Tunnel: $(pgrep -f "cloudflared.*tunnel.*run" > /dev/null && echo "✅ Running (PID: $(pgrep -f "cloudflared.*tunnel.*run"))" || echo "❌ Not running")"
echo ""
echo "📋 Logs:"
echo "  - REST API:          tail -f logs/falkordb-rest-api.log"
echo "  - Cloudflare Tunnel: tail -f logs/cloudflare-tunnel.log"
echo "  - FalkorDB Docker:   docker logs falkordb-local -f"
echo ""
echo "🔗 Endpoints:"
echo "  - Local REST API:    http://localhost:3001/health"
echo "  - Tunnel (public):   https://falkordb-tunnel.aiwithapex.workers.dev.aiwithapex.com/health"
echo "  - Production Worker: https://graphmind-api.apex-web-services-llc-0d4.workers.dev/api/health"
echo ""
echo "🛑 To stop all services, run: bash scripts/stop-tunnel-services.sh"
