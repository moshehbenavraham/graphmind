# FalkorDB Cloudflare Tunnel Setup

**Last Updated**: 2025-11-14
**Status**: Production deployment method for GraphMind

---

## Overview

GraphMind uses **Cloudflare Tunnel** to securely expose a local FalkorDB instance to production Cloudflare Workers. This hybrid architecture provides:

✅ **Production Workers** running on Cloudflare's global edge network
✅ **Local FalkorDB** with sub-millisecond performance
✅ **Secure tunnel** without exposing ports publicly
✅ **Zero configuration changes** from local development
✅ **Easy upgrade path** to VPS or FalkorDB Cloud later

---

## Architecture

```
Production Cloudflare Workers
    ↓ HTTPS
Cloudflare Tunnel (falkordb-tunnel.aiwithapex.workers.dev.aiwithapex.com)
    ↓ HTTP (port 3001)
Local REST API Wrapper (scripts/falkordb-rest-api.js)
    ↓ Redis Protocol (port 6380)
Local FalkorDB Docker Container
```

**Key Points**:
- Workers access FalkorDB via **HTTP/REST API** (NOT Redis protocol directly)
- REST API wrapper (`scripts/falkordb-rest-api.js`) bridges HTTP ↔ Redis protocol
- Cloudflare Tunnel securely routes traffic to local machine
- No public IP or port forwarding required

---

## Prerequisites

1. **Docker** installed and running
2. **Node.js** v18+ installed
3. **cloudflared** CLI installed
4. **Cloudflare account** with Workers access
5. **wrangler** CLI authenticated

---

## Initial Setup (One-Time)

### Step 1: Install cloudflared

```bash
# Linux (WSL)
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# macOS
brew install cloudflare/cloudflare/cloudflared

# Verify installation
cloudflared --version
```

### Step 2: Authenticate cloudflared

```bash
cloudflared tunnel login
```

This opens a browser to authenticate with your Cloudflare account. Select the domain/zone you want to use.

### Step 3: Create Tunnel

```bash
# Create tunnel named "falkordb-tunnel"
cloudflared tunnel create falkordb-tunnel

# Record the tunnel ID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
# This will be displayed in the output
```

### Step 4: Configure Tunnel

Create/edit `~/.cloudflared/config.yml`:

```yaml
tunnel: <YOUR_TUNNEL_ID>
credentials-file: /home/<YOUR_USERNAME>/.cloudflared/<YOUR_TUNNEL_ID>.json

ingress:
  - hostname: falkordb-tunnel.aiwithapex.workers.dev.aiwithapex.com
    service: http://localhost:3001
  - service: http_status:404
```

**Replace**:
- `<YOUR_TUNNEL_ID>` with the tunnel ID from Step 3
- `<YOUR_USERNAME>` with your system username
- Hostname with your desired subdomain

### Step 5: Create DNS Route

```bash
cloudflared tunnel route dns falkordb-tunnel falkordb-tunnel.aiwithapex.workers.dev.aiwithapex.com
```

**Replace** the hostname with your chosen subdomain.

### Step 6: Configure Cloudflare Secrets

```bash
# Set FalkorDB tunnel hostname
echo "falkordb-tunnel.aiwithapex.workers.dev.aiwithapex.com" | npx wrangler secret put FALKORDB_HOST

# Generate and set JWT secret
openssl rand -base64 32 | npx wrangler secret put JWT_SECRET
```

**IMPORTANT**: Use your actual tunnel hostname, not the example above.

---

## Daily Operation

### Starting Services (Required Order)

**1. Start FalkorDB Docker Container**

```bash
docker start falkordb-local
```

Or if container doesn't exist:

```bash
docker run -d \
  --name falkordb-local \
  -p 6380:6379 \
  -v $(pwd)/falkordb-data:/data \
  falkordb/falkordb:latest
```

**2. Start REST API Wrapper**

```bash
# Foreground (for monitoring)
node scripts/falkordb-rest-api.js

# Background
node scripts/falkordb-rest-api.js &
```

**3. Start Cloudflare Tunnel**

```bash
# Foreground (for monitoring)
cloudflared tunnel run falkordb-tunnel

# Background
cloudflared tunnel run falkordb-tunnel &
```

**4. Verify Services**

```bash
# Check local REST API
curl http://localhost:3001/health
# Expected: {"status":"healthy","redis":"connected",...}

# Check tunnel (replace with your tunnel hostname)
curl https://falkordb-tunnel.aiwithapex.workers.dev.aiwithapex.com/health
# Expected: Same as above (may take 30-60 seconds after tunnel start)

# Check production Workers
curl https://graphmind-api.apex-web-services-llc-0d4.workers.dev/api/health
# Expected: {"status":"ok","checks":{...}}
```

---

## Quick Start Script

Use the provided startup script:

```bash
# Start all services
bash scripts/start-tunnel-services.sh

# Stop all services
bash scripts/stop-tunnel-services.sh
```

---

## Troubleshooting

### Tunnel Not Connecting

**Symptom**: `curl` to tunnel hostname times out or fails

**Fixes**:
1. Check tunnel is running: `ps aux | grep cloudflared`
2. Check tunnel logs for errors
3. Verify DNS route: `cloudflared tunnel route dns list`
4. Restart tunnel: `killall cloudflared && cloudflared tunnel run falkordb-tunnel`

### REST API Connection Refused

**Symptom**: `[Redis] Error: connect ECONNREFUSED 127.0.0.1:6380`

**Fixes**:
1. Check FalkorDB container: `docker ps | grep falkordb`
2. Start container: `docker start falkordb-local`
3. Check port mapping: `docker port falkordb-local`

### Production Workers Can't Reach FalkorDB

**Symptom**: Production health check shows FalkorDB unhealthy

**Fixes**:
1. Verify all 3 services running (Docker, REST API, Tunnel)
2. Test local health: `curl http://localhost:3001/health`
3. Test tunnel: `curl https://YOUR_TUNNEL_HOSTNAME/health`
4. Check Workers secret: `npx wrangler secret list` (must have `FALKORDB_HOST`)
5. Verify `FALKORDB_HOST` matches tunnel hostname exactly

### High Latency

**Symptom**: FalkorDB queries taking >1 second

**Expected Latency**:
- Local connection: <1ms
- Via REST API: ~5-10ms
- Via Tunnel: ~400-600ms (includes tunnel overhead)

**Fixes**:
1. This is normal for tunnel architecture
2. Consider migrating to VPS if latency is critical
3. Implement aggressive caching (KV namespace)

---

## Monitoring

### Check Service Status

```bash
# FalkorDB Docker
docker ps | grep falkordb-local

# REST API
ps aux | grep falkordb-rest-api

# Cloudflare Tunnel
ps aux | grep cloudflared
cloudflared tunnel info falkordb-tunnel
```

### View Logs

```bash
# FalkorDB Docker logs
docker logs falkordb-local --tail 50 -f

# REST API logs (if running in foreground)
# Just watch the console output

# Tunnel logs (if running in foreground)
# Watch the console output

# Production Workers logs
npx wrangler tail
```

### Monitor Tunnel Metrics

Cloudflare provides tunnel metrics in the dashboard:
1. Go to https://dash.cloudflare.com
2. Navigate to **Zero Trust** → **Networks** → **Tunnels**
3. Click on **falkordb-tunnel**
4. View connection status, traffic, errors

---

## Auto-Start on Boot (Optional)

### systemd Service (Linux/WSL)

**1. Create REST API service**

`/etc/systemd/system/graphmind-rest-api.service`:

```ini
[Unit]
Description=GraphMind FalkorDB REST API
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=aiwithapex
WorkingDirectory=/home/aiwithapex/projects/graphmind
ExecStartPre=/usr/bin/docker start falkordb-local
ExecStart=/usr/bin/node /home/aiwithapex/projects/graphmind/scripts/falkordb-rest-api.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**2. Create Tunnel service**

`/etc/systemd/system/graphmind-tunnel.service`:

```ini
[Unit]
Description=GraphMind Cloudflare Tunnel
After=graphmind-rest-api.service
Requires=graphmind-rest-api.service

[Service]
Type=simple
User=aiwithapex
ExecStart=/usr/local/bin/cloudflared tunnel run falkordb-tunnel
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**3. Enable services**

```bash
sudo systemctl daemon-reload
sudo systemctl enable graphmind-rest-api
sudo systemctl enable graphmind-tunnel
sudo systemctl start graphmind-rest-api
sudo systemctl start graphmind-tunnel

# Check status
sudo systemctl status graphmind-rest-api
sudo systemctl status graphmind-tunnel
```

---

## Upgrading to VPS/Cloud (Future)

When ready to migrate from local tunnel to VPS or FalkorDB Cloud:

**No code changes required!** Just:

1. Provision VPS or FalkorDB Cloud instance
2. Update `FALKORDB_HOST` secret: `echo "your-vps-ip" | npx wrangler secret put FALKORDB_HOST`
3. Stop local services (Docker, REST API, Tunnel)
4. Done!

The REST API wrapper approach (`scripts/falkordb-rest-api.js`) works with:
- ✅ Local Docker (current setup)
- ✅ Remote Docker on VPS
- ✅ FalkorDB Cloud (via their HTTP API)

---

## Security Notes

### Tunnel Security

- ✅ Traffic encrypted via HTTPS
- ✅ No public ports exposed on local machine
- ✅ Cloudflare authentication required
- ✅ Tunnel credentials stored in `~/.cloudflared/` (protect this directory)

### Production Secrets

- ✅ `FALKORDB_HOST` - Tunnel hostname (public, that's OK)
- ✅ `FALKORDB_PASSWORD` - Set to empty string for local Docker
- ✅ `JWT_SECRET` - 32+ character random string
- ⚠️ Never commit secrets to git

### FalkorDB Access

- ✅ Only accessible via Cloudflare Tunnel
- ✅ REST API wrapper adds authentication layer
- ✅ Workers validate JWT before FalkorDB queries
- ⚠️ Local Docker has no password by default (fine for local-only)

---

## FAQ

**Q: Do I need to keep my computer running 24/7?**
A: Yes, for production Workers to access FalkorDB. Consider migrating to VPS for always-on deployment.

**Q: Can I use this for development?**
A: Yes! Just connect to `http://localhost:3001` instead of the tunnel hostname.

**Q: What happens if the tunnel disconnects?**
A: Cloudflare auto-reconnects. If it fails, systemd will restart the service (if configured).

**Q: How much does this cost?**
A: $0/month. Cloudflare Tunnel is free. Local FalkorDB is free. Workers free tier is generous.

**Q: Can I use this for production long-term?**
A: It works, but VPS is recommended for 24/7 uptime and better reliability.

**Q: Why not use FalkorDB Cloud directly?**
A: You can! Just update `FALKORDB_HOST` secret. The architecture supports both.

---

## Related Documentation

- [docs/DEPLOYMENT.md](./DEPLOYMENT.md) - Full production deployment guide
- [docs/FALKORDB_SETUP.md](./FALKORDB_SETUP.md) - FalkorDB installation and setup
- [docs/SETUP.md](./SETUP.md) - Local development setup
- [CLAUDE.md](../CLAUDE.md) - Project architecture overview
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

---

## Changelog

**2025-11-14**: Initial documentation created for production tunnel deployment
