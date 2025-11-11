# GraphMind Deployment Guide

This document provides comprehensive deployment procedures for GraphMind, including pre-deployment checklists, deployment steps, and post-deployment verification.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Migrations](#database-migrations)
4. [Worker Deployment](#worker-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring and Alerts](#monitoring-and-alerts)

---

## Pre-Deployment Checklist

### Code Quality

- [ ] All tests passing (`npm test`)
- [ ] Integration tests passing (`npm run test:integration`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code reviewed and approved
- [ ] No console.log statements in production code (use structured logger)
- [ ] No hardcoded secrets or API keys

### Documentation

- [ ] CHANGELOG.md updated with release notes
- [ ] API changes documented in API_DOCS.md
- [ ] Database schema changes documented
- [ ] Breaking changes clearly marked

### Testing

- [ ] End-to-end flow tested locally (T117)
- [ ] Load testing completed (T118)
- [ ] Browser compatibility verified (T121)
- [ ] Mobile testing completed (T122)
- [ ] Error scenarios tested (T109-T114)
- [ ] Performance benchmarks meet targets

### Dependencies

- [ ] All npm dependencies up to date
- [ ] Security vulnerabilities addressed (`npm audit`)
- [ ] Cloudflare Workers runtime compatible
- [ ] FalkorDB SDK version verified

### Configuration

- [ ] wrangler.toml reviewed and correct
- [ ] Environment variables configured
- [ ] Secrets set in Cloudflare dashboard
- [ ] Rate limits configured correctly

---

## Environment Configuration

### Environment Variables

Create `.env.production` with the following variables:

```bash
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token

# FalkorDB Configuration (Production Tier)
FALKORDB_HOST=your-prod-instance.falkordb.cloud
FALKORDB_PORT=6379
FALKORDB_USER=default
FALKORDB_PASSWORD=your_secure_password
FALKORDB_USE_TLS=true

# JWT Configuration
JWT_SECRET=your_very_secure_jwt_secret_min_32_chars
JWT_EXPIRES_IN=24h

# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
```

### Cloudflare Secrets

Set secrets using Wrangler CLI:

```bash
# JWT Secret
echo "your_jwt_secret" | npx wrangler secret put JWT_SECRET --env production

# FalkorDB Password
echo "your_falkordb_password" | npx wrangler secret put FALKORDB_PASSWORD --env production
```

Verify secrets are set:

```bash
npx wrangler secret list --env production
```

### wrangler.toml Configuration

Ensure production environment is configured:

```toml
name = "graphmind"
main = "src/index.js"
compatibility_date = "2024-01-01"

# Production environment
[env.production]
name = "graphmind-production"
route = "graphmind.your-domain.com/*"

# Durable Objects
[[durable_objects.bindings]]
name = "VOICE_SESSION"
class_name = "VoiceSessionManager"
script_name = "graphmind-production"

[[durable_objects.bindings]]
name = "FALKORDB_POOL"
class_name = "FalkorDBConnectionPool"
script_name = "graphmind-production"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "graphmind-production-db"
database_id = "your-production-db-id"

# KV Namespaces
[[kv_namespaces]]
binding = "KV"
id = "your-production-kv-id"

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "your-production-rate-limit-kv-id"

# Workers AI Binding
[ai]
binding = "AI"
```

---

## Database Migrations

### 1. Backup Existing Data (if applicable)

```bash
# Export D1 data (if upgrading)
npx wrangler d1 export graphmind-production-db --env production --output backup.sql
```

### 2. Review Migration Files

Check `migrations/` directory:

```
migrations/
├── 0001_initial_schema.sql
├── 0002_voice_notes_enhancements.sql
└── [any new migrations]
```

### 3. Test Migrations Locally

```bash
# Apply migrations to local D1
npx wrangler d1 migrations apply graphmind-db --local

# Verify schema
npx wrangler d1 execute graphmind-db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### 4. Apply Migrations to Production

```bash
# IMPORTANT: This cannot be undone easily!
npx wrangler d1 migrations apply graphmind-production-db --env production

# Verify migrations applied
npx wrangler d1 execute graphmind-production-db --env production --command "SELECT * FROM _cf_KV WHERE key='_migrations';"
```

### 5. Verify Database Indexes

```bash
# Check indexes exist
npx wrangler d1 execute graphmind-production-db --env production --command "
  SELECT name, sql FROM sqlite_master
  WHERE type='index' AND name NOT LIKE 'sqlite_%';
"
```

Expected indexes:
- `idx_voice_notes_user_created`
- `idx_voice_notes_user_id`
- `idx_users_email`

---

## Worker Deployment

### 1. Build and Test

```bash
# Install dependencies
npm ci --production

# Run build (if applicable)
npm run build

# Test locally
npm run dev

# Run integration tests against local
npm run test:integration
```

### 2. Deploy Workers

```bash
# Deploy to production environment
npx wrangler deploy --env production

# Expected output:
# ✨ Built successfully
# ✨ Uploaded worker
# ✨ Deployed to https://graphmind-production.your-account.workers.dev
```

### 3. Verify Deployment

```bash
# Check worker status
npx wrangler deployments list --env production

# Test health endpoint
curl https://graphmind-production.your-account.workers.dev/health

# Expected:
# {"status":"ok","timestamp":"..."}
```

### 4. Deploy Durable Objects

Durable Objects are deployed with the worker. Verify:

```bash
# Check Durable Object migrations
npx wrangler deployments list --env production

# Should show:
# - VoiceSessionManager (Durable Object)
# - FalkorDBConnectionPool (Durable Object)
```

### 5. Configure Custom Domain (if applicable)

```bash
# Add route to custom domain
npx wrangler route add "graphmind.your-domain.com/*" --env production

# Verify DNS
dig graphmind.your-domain.com
```

---

## Frontend Deployment

### 1. Build Frontend

```bash
cd src/frontend

# Install dependencies
npm ci --production

# Build production bundle
npm run build

# Output in dist/ directory
```

### 2. Deploy to Cloudflare Pages

```bash
# Deploy using Wrangler
npx wrangler pages deploy dist --project-name graphmind-frontend

# Expected output:
# ✨ Success! Deployed to https://graphmind-frontend.pages.dev
```

### 3. Configure Pages Settings

In Cloudflare Dashboard:
1. Go to Pages > graphmind-frontend
2. Set production branch: `main`
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `src/frontend`
4. Environment variables:
   - `VITE_API_URL`: `https://graphmind-production.your-account.workers.dev`
   - `NODE_ENV`: `production`

### 4. Configure Custom Domain

1. Pages > Custom domains
2. Add: `app.your-domain.com`
3. Verify DNS records
4. Enable "Always Use HTTPS"

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Worker health
curl https://graphmind.your-domain.com/health
# Expected: {"status":"ok",...}

# FalkorDB health
curl https://graphmind.your-domain.com/api/health/falkordb
# Expected: {"status":"connected",...}

# Database health
curl https://graphmind.your-domain.com/api/health/db
# Expected: {"status":"ok","database":"connected"}
```

### 2. Smoke Tests

```bash
# 1. Register new user
curl -X POST https://graphmind.your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# 2. Login
curl -X POST https://graphmind.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Save JWT from response

# 3. Start recording session
curl -X POST https://graphmind.your-domain.com/api/notes/start-recording \
  -H "Authorization: Bearer $JWT"

# 4. List notes
curl https://graphmind.your-domain.com/api/notes \
  -H "Authorization: Bearer $JWT"
```

### 3. Performance Checks

```bash
# Check response times
curl -w "Time: %{time_total}s\n" -o /dev/null -s \
  https://graphmind.your-domain.com/api/notes \
  -H "Authorization: Bearer $JWT"

# Should be < 200ms
```

### 4. Monitor Logs

```bash
# Tail worker logs
npx wrangler tail --env production

# Look for:
# - No ERROR level logs
# - Successful requests
# - Normal latency
```

### 5. Frontend Verification

1. Open https://app.your-domain.com
2. Verify page loads in < 2 seconds
3. Test user registration flow
4. Test voice recording flow
5. Test notes list and detail views
6. Verify error handling (deny microphone permission)

---

## Rollback Procedures

### Immediate Rollback (Worker)

If critical issues are detected:

```bash
# List recent deployments
npx wrangler deployments list --env production

# Rollback to previous deployment
npx wrangler rollback --env production --deployment-id <previous-deployment-id>
```

### Database Rollback

**WARNING**: Database rollbacks are complex and may cause data loss.

```bash
# Restore from backup
npx wrangler d1 import graphmind-production-db --env production --file backup.sql

# Verify data
npx wrangler d1 execute graphmind-production-db --env production --command "SELECT COUNT(*) FROM users;"
```

### Frontend Rollback

```bash
# Pages automatically keeps deployment history
# Rollback from dashboard: Pages > Deployments > [Previous] > Rollback
```

---

## Monitoring and Alerts

### Cloudflare Analytics

Monitor in Cloudflare Dashboard:
- Workers > Analytics
  - Requests per second
  - Error rate
  - CPU time
  - Duration (p50, p95, p99)

- Durable Objects > Analytics
  - Active objects
  - Requests
  - CPU time
  - Storage

### Custom Metrics

Use structured logging to track:

```javascript
// In worker code
logger.info('Request completed', {
  path: request.url,
  method: request.method,
  status: response.status,
  duration_ms: duration
});
```

Parse logs to generate metrics:
- Request rate by endpoint
- Error rate by type
- Average latency by operation
- Transcription accuracy

### Alerting

Set up alerts for:

1. **High Error Rate**
   - Threshold: > 5% errors in 5 minutes
   - Action: Page on-call engineer

2. **High Latency**
   - Threshold: p95 > 2 seconds
   - Action: Slack notification

3. **Database Connection Failures**
   - Threshold: Any connection failure
   - Action: Immediate page

4. **FalkorDB Connection Issues**
   - Threshold: Connection pool exhausted
   - Action: Slack notification

5. **Rate Limit Excessive**
   - Threshold: > 100 rate limit hits in 5 minutes
   - Action: Investigate potential abuse

### Status Page

Consider setting up a status page (e.g., status.your-domain.com):
- API status
- Database status
- FalkorDB status
- Recent incidents
- Scheduled maintenance

---

## Deployment Checklist Summary

**Pre-Deployment**
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Configuration reviewed
- [ ] Secrets configured
- [ ] Database backup created

**Deployment**
- [ ] Database migrations applied
- [ ] Workers deployed
- [ ] Durable Objects deployed
- [ ] Frontend deployed
- [ ] Custom domains configured

**Post-Deployment**
- [ ] Health checks passing
- [ ] Smoke tests successful
- [ ] Performance within targets
- [ ] Logs monitored (no errors)
- [ ] Frontend verified
- [ ] Alerts configured

**Rollback Plan**
- [ ] Previous deployment ID recorded
- [ ] Database backup location noted
- [ ] Rollback procedure tested (in staging)

---

## Deployment Schedule

**Recommended deployment windows:**
- **Weekdays**: Tuesday-Thursday, 10 AM - 2 PM PST
- **Avoid**: Fridays (limited rollback window), weekends, holidays

**Deployment frequency:**
- **Critical fixes**: As needed (any time)
- **Feature releases**: Weekly (Tuesday)
- **Major updates**: Bi-weekly (Tuesday, with extended testing)

---

## Post-Deployment Tasks

After successful deployment:

1. [ ] Update CHANGELOG.md with deployment date
2. [ ] Notify team in Slack (#deployments channel)
3. [ ] Monitor logs for 30 minutes
4. [ ] Schedule follow-up review meeting
5. [ ] Document any issues or improvements needed

---

## Troubleshooting

### Worker deployment fails

```bash
# Check for syntax errors
npm run lint

# Check for configuration errors
npx wrangler deploy --dry-run --env production

# Check account/permissions
npx wrangler whoami
```

### Database migration fails

```bash
# Check migration SQL syntax locally
npx wrangler d1 migrations apply graphmind-db --local

# Review migration file for errors
cat migrations/0002_voice_notes_enhancements.sql

# Apply migrations one at a time
npx wrangler d1 execute graphmind-production-db --env production --file migrations/0001_initial_schema.sql
```

### Durable Objects not working

```bash
# Verify bindings in wrangler.toml
cat wrangler.toml | grep -A 5 "durable_objects"

# Check Durable Object class is exported
grep "export class VoiceSessionManager" src/durable-objects/VoiceSessionManager.js

# Redeploy with --new-class flag (forces migration)
npx wrangler deploy --env production --new-class VoiceSessionManager
```

---

## Support

For deployment issues:
- Check documentation: `/docs`
- Review logs: `npx wrangler tail --env production`
- Contact: devops@your-company.com
- Escalate: on-call engineer (PagerDuty)

---

Last Updated: 2024-01-01
Maintained by: GraphMind DevOps Team
