# FalkorDB Cloud Setup Guide

This guide walks you through setting up FalkorDB Cloud for GraphMind development and production.

## Prerequisites

- Cloudflare account with Workers enabled
- GraphMind project cloned locally
- Node.js v18+ installed

## Step 1: Create FalkorDB Cloud Account

1. Go to [https://app.falkordb.cloud/](https://app.falkordb.cloud/)
2. Sign up with your email or GitHub account
3. Verify your email address

## Step 2: Create Database Instance

### For Local Development (Free Tier)

1. Click **"Create New Database"** in the FalkorDB Cloud dashboard
2. Choose **Free Tier**:
   - 1 GB storage
   - 100 MB RAM
   - No credit card required
   - Perfect for local development and testing
3. Select region: **US East (recommended)** or closest to you
4. Name your database: `graphmind-dev`
5. Click **"Create Database"**

### For Production (Starter Tier - $15/month)

1. Click **"Create New Database"** in the FalkorDB Cloud dashboard
2. Choose **Starter Tier**:
   - 10 GB storage
   - 1 GB RAM
   - 99.9% uptime SLA
   - Automatic backups
3. Select region: **US East** (or closest to your users)
4. Name your database: `graphmind-prod`
5. Click **"Create Database"**
6. Add payment method

## Step 3: Get Connection Credentials

After database creation (takes ~2-3 minutes):

1. Click on your database name in the dashboard
2. Go to the **"Connection"** tab
3. Copy the following credentials:
   - **Host**: e.g., `r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud`
   - **Port**: e.g., `55878`
   - **Username**: e.g., `falkorvoiceflarecat`
   - **Password**: (click "Show" button, then copy)

## Step 4: Configure Local Environment

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Edit `.env` and add your FalkorDB credentials:

```env
# FalkorDB Cloud Configuration
FALKORDB_HOST=r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud
FALKORDB_PORT=55878
FALKORDB_USER=falkorvoiceflarecat
FALKORDB_PASSWORD=cEkTQ6sscPWv
```

3. Save the file

**Important**: Never commit `.env` to git! It's in `.gitignore` for security.

## Step 5: Test Connection Locally

1. Start the development server:

```bash
npx wrangler dev
```

2. Test the health check endpoint:

```bash
curl http://localhost:8787/api/health/falkordb
```

Expected response:

```json
{
  "status": "healthy",
  "latency_ms": 5,
  "timestamp": "2025-11-11T06:41:19.305Z",
  "pool": {
    "size": 1,
    "available": 1
  }
}
```

If you see `"status": "healthy"`, your connection is working! 🎉

## Step 6: Configure Production Secrets

For production deployment, use Wrangler secrets instead of `.env`:

```bash
# Set FalkorDB credentials as Wrangler secrets
npx wrangler secret put FALKORDB_HOST
# Paste: r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud

npx wrangler secret put FALKORDB_PORT
# Paste: 55878

npx wrangler secret put FALKORDB_USER
# Paste: falkorvoiceflarecat

npx wrangler secret put FALKORDB_PASSWORD
# Paste: cEkTQ6sscPWv
```

Secrets are encrypted at rest and never exposed in logs.

## Step 7: Deploy to Production

1. Deploy Workers with Durable Objects:

```bash
npx wrangler deploy
```

2. Test production health check:

```bash
curl https://graphmind-api.workers.dev/api/health/falkordb
```

## Troubleshooting

### Connection Timeout

**Error**: `"status": "down", "details": "Connection timeout after 5000ms"`

**Solutions**:
1. Check firewall rules (FalkorDB Cloud should allow all IPs)
2. Verify host and port are correct (no typos)
3. Check FalkorDB Cloud dashboard - database must be "Running" status
4. Try from different network (some corporate networks block non-standard ports)

### Authentication Failure

**Error**: `"status": "down", "details": "Authentication failed"`

**Solutions**:
1. Verify username and password are correct (copy-paste from dashboard)
2. Check for extra spaces or newlines in credentials
3. Regenerate password in FalkorDB Cloud dashboard if needed

### Database Unreachable

**Error**: `"status": "down", "details": "Graph database unavailable"`

**Solutions**:
1. Check FalkorDB Cloud dashboard - database status should be "Running"
2. If database is "Stopped", click "Start Database"
3. Free tier databases may auto-sleep after inactivity - wait 30s for wake-up
4. Check FalkorDB Cloud status page for outages

### Invalid Credentials in .env

**Error**: `Missing required FalkorDB credentials`

**Solutions**:
1. Ensure all four variables are set in `.env`:
   - `FALKORDB_HOST`
   - `FALKORDB_PORT`
   - `FALKORDB_USER`
   - `FALKORDB_PASSWORD`
2. Check for typos in variable names
3. Restart `wrangler dev` after editing `.env`

## Next Steps

After successful connection:

1. Test namespace provisioning:

```bash
curl -X POST http://localhost:8787/api/graph/init \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

2. Verify your user's graph was created in FalkorDB Cloud dashboard
3. Continue with Phase 2 development (Entity Extraction)

## Resource Monitoring

### Free Tier Limits

- **Storage**: 1 GB total
- **RAM**: 100 MB
- **Queries**: Unlimited
- **Bandwidth**: Unlimited
- **Uptime**: Best effort (may sleep after inactivity)

Monitor usage in FalkorDB Cloud dashboard under "Metrics" tab.

### Upgrade to Starter Tier

When to upgrade:
- You hit storage limit (>1 GB of graph data)
- You need guaranteed uptime (production)
- You need automatic backups
- You want faster query performance (more RAM)

Upgrade process:
1. Click "Upgrade" in FalkorDB Cloud dashboard
2. Choose Starter tier ($15/month)
3. Add payment method
4. Click "Confirm Upgrade"
5. No data loss - existing data is preserved
6. Update credentials if host/port changes (usually doesn't)

## Security Best Practices

1. **Never commit credentials to git**
   - Always use `.env` (local) or Wrangler secrets (production)
   - Double-check `.gitignore` includes `.env`

2. **Rotate passwords regularly**
   - Every 90 days recommended
   - After team member leaves
   - If credentials accidentally exposed

3. **Use separate databases for dev/prod**
   - Free tier for local development
   - Starter/Pro tier for production
   - Prevents accidental data corruption

4. **Monitor access logs**
   - Check FalkorDB Cloud "Activity" tab
   - Watch for unexpected connections
   - Set up alerts for failed auth attempts

## Getting Help

- **FalkorDB Docs**: https://docs.falkordb.com/
- **FalkorDB GitHub**: https://github.com/FalkorDB/FalkorDB
- **GraphMind Issues**: https://github.com/yourusername/graphmind/issues
- **FalkorDB Discord**: Join for community support

## Quick Reference

**Connection String Format**:
```
rediss://username:password@host:port
```

**Health Check Command**:
```bash
curl http://localhost:8787/api/health/falkordb
```

**Wrangler Deploy**:
```bash
npx wrangler deploy
```

**View Secrets**:
```bash
npx wrangler secret list
```

**Delete Secret**:
```bash
npx wrangler secret delete FALKORDB_PASSWORD
```

---

**Last Updated**: 2025-11-11
**GraphMind Version**: 0.1.0
**FalkorDB Version**: Compatible with all versions
