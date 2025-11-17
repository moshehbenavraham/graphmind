# FalkorDB Deployment Options

**Document Type:** Technical Specification
**Status:** Current Architecture
**Owner:** Development Team
**Last Updated:** 2025-11-12

---

## Overview

GraphMind supports flexible FalkorDB deployment options optimized for different environments. The architecture allows seamless transition between development, staging, and production without code changes.

**Key Principle**: Workers communicate with FalkorDB through a consistent interface, regardless of deployment type.

---

## 1. Current Development Setup (Active)

### Architecture

```
Cloudflare Workers (localhost:8787)
         |
         | Redis Protocol (Direct TCP)
         |
         ↓
FalkorDB Docker Container (localhost:6380)
         |
         | Data persistence
         ↓
   ./falkordb-data/
```

### Configuration

**Docker Container:**
```bash
docker run -d \
  --name falkordb-local \
  -p 6380:6379 \
  -v $(pwd)/falkordb-data:/data \
  falkordb/falkordb:latest
```

**Environment Variables (.env):**
```env
FALKORDB_HOST=localhost
FALKORDB_PORT=6380
FALKORDB_USER=default
FALKORDB_PASSWORD=
```

### Implementation

- **Protocol**: Redis wire protocol (RESP)
- **Library**: `redis` npm package
- **Connection**: Durable Object connection pooling (10 connections, 5ms latency)
- **Communication**: Direct TCP socket from Workers to localhost

### Performance

| Metric | Result |
|--------|--------|
| Connection time | <1ms |
| Node creation | 0.32ms |
| Relationship creation | 0.41ms |
| Query execution (uncached) | <5ms |

### Advantages

✅ Zero latency (localhost)
✅ No network costs
✅ Full debugging access
✅ Fast iteration cycles
✅ Data persistence across restarts
✅ No API rate limits

### Limitations

❌ Not accessible to deployed Workers
❌ Single developer environment
❌ No high-availability

---

## 2. Production Simulation Setup (Available)

### Architecture

```
Deployed Cloudflare Workers
         |
         | HTTPS fetch()
         |
         ↓
Cloudflare Tunnel (free)
  https://falkordb-tunnel.aiwithapex.com
         |
         | Tunnel to localhost
         |
         ↓
REST API Wrapper (Node.js Express)
  localhost:3001
         |
         | Redis Protocol
         |
         ↓
FalkorDB Docker Container
  localhost:6380
```

### Configuration

**Cloudflare Tunnel:**
```yaml
# ~/.cloudflared/config.yml
tunnel: b158953e-c943-4619-b920-2c0bb2945f07
credentials-file: /home/aiwithapex/.cloudflared/[tunnel-id].json

ingress:
  - hostname: falkordb-tunnel.aiwithapex.com
    service: http://localhost:3001
  - service: http_status:404
```

**REST API Wrapper:**
```javascript
// scripts/falkordb-rest-api.js
// Express server that:
// 1. Accepts HTTP/JSON requests
// 2. Forwards to FalkorDB via Redis protocol
// 3. Returns JSON responses
```

**Start Services:**
```bash
# Terminal 1: FalkorDB Docker
docker start falkordb-local

# Terminal 2: REST API Wrapper
cd scripts && node falkordb-rest-api.js

# Terminal 3: Cloudflare Tunnel
cloudflared tunnel run falkordb-tunnel
```

### API Endpoints

**Health Check:**
```bash
GET /health
Response: {"status":"healthy","redis":"connected"}
```

**Execute Cypher Query:**
```bash
POST /api/graph/:graphName/query
Body: {
  "query": "CREATE (n:Test {msg: $msg}) RETURN n",
  "params": {"msg": "hello"}
}
```

### Performance

| Metric | Result |
|--------|--------|
| REST API latency | 0.2-2ms |
| Cloudflare Tunnel overhead | ~10-50ms |
| Total query time | 10-60ms |

### Advantages

✅ Simulates production networking
✅ Tests deployed Worker code
✅ HTTPS security
✅ No infrastructure costs (Cloudflare Tunnel free)
✅ Accessible from anywhere

### Use Cases

- Testing deployed Workers before production
- Remote development access
- Integration testing with real networking
- Demo/preview environments

---

## 3. Production Options (Future)

### Option A: Self-Hosted VPS + REST API

**Architecture:**
```
Cloudflare Workers
         |
         | HTTPS fetch()
         |
         ↓
VPS Server (DigitalOcean/Linode/Hetzner)
  - FalkorDB Docker
  - REST API Wrapper (PM2/systemd)
  - Nginx reverse proxy (SSL)
```

**Estimated Cost:** $10-25/month (VPS with 2-4GB RAM)

**Advantages:**
- Full control over infrastructure
- No vendor lock-in
- Cost-effective at scale
- Custom optimizations

**Considerations:**
- Manual server management
- Backup/monitoring setup required
- SSL certificate management (Let's Encrypt)

### Option B: FalkorDB Cloud (Managed)

**Architecture:**
```
Cloudflare Workers
         |
         | Redis Protocol over TLS
         |
         ↓
FalkorDB Cloud Instance
  (Managed service)
```

**Pricing Tiers:**
- **Starter**: $15/month (recommended for production launch)
- **Pro**: $50/month (higher throughput)
- **Enterprise**: Custom pricing

**Advantages:**
- Managed backups
- 99.95% SLA
- Automatic scaling
- Monitoring dashboard

**Limitations:**
- Higher cost at scale
- FREE tier has 8.4s connection times (not recommended)

### Option C: Hybrid Approach

**Development**: Self-hosted Docker
**Staging**: Cloudflare Tunnel simulation
**Production**: FalkorDB Cloud or VPS (TBD based on traffic)

---

## 4. Migration Strategy

### Development → Production Simulation

**No code changes required.** Only environment variables:

```env
# Change from:
FALKORDB_HOST=localhost
FALKORDB_PORT=6380

# To:
FALKORDB_HOST=falkordb-tunnel.aiwithapex.com
FALKORDB_PORT=443  # HTTPS
```

### Production Simulation → Production VPS

**Steps:**
1. Provision VPS server
2. Deploy FalkorDB Docker
3. Deploy REST API wrapper
4. Configure Nginx with SSL
5. Update environment variables to VPS hostname

**Code Changes:** None (same REST API interface)

### Production Simulation → FalkorDB Cloud

**Steps:**
1. Create FalkorDB Cloud instance
2. Get connection credentials
3. Update environment variables
4. Update connection code to use TLS

**Code Changes:** Minor (enable TLS in Redis client)

---

## 5. Current Implementation Details

### Connection Pool (Durable Object)

**File**: `src/durable-objects/FalkorDBConnectionPool.js`

**Features:**
- Connection pooling (10 connections, configurable)
- Keep-alive mechanism (30s PING)
- Automatic reconnection
- User namespace isolation
- Health monitoring

**Configuration:**
```javascript
{
  host: env.FALKORDB_HOST,
  port: parseInt(env.FALKORDB_PORT),
  username: env.FALKORDB_USER,
  password: env.FALKORDB_PASSWORD,
  maxConnections: 10,
  minConnections: 5,
  keepAliveInterval: 30000
}
```

### REST API Wrapper

**File**: `scripts/falkordb-rest-api.js`

**Features:**
- Express.js HTTP server
- Redis protocol forwarding
- JSON request/response
- CORS support
- Parameter interpolation
- Result parsing

**Ports:**
- Development: 3001
- Production: 80/443 (behind Nginx)

### Cloudflare Tunnel

**Tunnel ID:** `b158953e-c943-4619-b920-2c0bb2945f07`
**Hostname:** `falkordb-tunnel.aiwithapex.com`
**Status:** Active (configured, tested)

---

## 6. Recommendations

### Current Phase (Development)

**Use**: Self-hosted Docker (Option 1)

**Rationale:**
- Fastest iteration cycles
- Zero latency
- No infrastructure costs
- Full debugging capabilities

### Pre-Launch Testing

**Use**: Production Simulation (Option 2)

**Rationale:**
- Test real networking scenarios
- Verify deployed Worker behavior
- Validate HTTPS communication
- No infrastructure setup needed

### Production Launch (TBD)

**Recommended**: Option A (Self-Hosted VPS + REST API)

**Rationale:**
- Cost-effective ($10-25/mo vs $15-50/mo for Cloud)
- Full control and flexibility
- Production-grade performance
- Easy to scale horizontally

**Alternative**: Option B (FalkorDB Cloud Starter) if management overhead is a concern

---

## 7. Technical Notes

### Why Redis Protocol for Development?

- **Performance**: Sub-millisecond latency
- **Simplicity**: Direct TCP, no HTTP overhead
- **Compatibility**: Standard FalkorDB protocol
- **Debugging**: Easy to inspect with redis-cli

### Why REST API for Production?

- **Cloudflare Workers Limitation**: No direct TCP sockets
- **HTTPS Support**: Required for deployed Workers
- **Flexibility**: Easy to add auth, rate limiting, monitoring
- **Standard**: Any HTTP client can connect

### Protocol Comparison

| Feature | Redis Protocol (Dev) | REST API (Prod) |
|---------|---------------------|-----------------|
| Latency | <1ms | 10-60ms |
| Transport | TCP | HTTPS |
| Workers Support | Local only | ✅ Yes |
| Auth | Username/password | Bearer token (planned) |
| Rate Limiting | None | Easy to add |
| Monitoring | Basic | Full HTTP logs |

---

## Appendix: File Changes for Production

When transitioning to production, these files need updates:

1. **.env** - Update FALKORDB_HOST/PORT
2. **wrangler.toml** - Add production bindings (if needed)
3. **src/lib/falkordb/client.js** - Enable TLS option
4. **scripts/falkordb-rest-api.js** - Add auth middleware (recommended)

**No changes needed:**
- Durable Object connection pool
- Query builders (Cypher generation)
- Entity extraction pipeline
- API endpoints
