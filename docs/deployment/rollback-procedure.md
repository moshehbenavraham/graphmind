# Rollback Procedure

**Document Version**: 1.0
**Last Updated**: 2025-11-24
**Feature**: GraphRAG 2.0 - Vector Search Validation & Production Deployment

---

## Overview

This document provides step-by-step instructions for rolling back the GraphRAG 2.0 semantic search deployment in case of critical issues in production.

## When to Roll Back

Execute rollback immediately if:

- **Critical Errors**: Error rate >5% for 5+ minutes
- **Performance Degradation**: P95 latency >1000ms (2x target) for 10+ minutes
- **Data Integrity Issues**: User reports of cross-user data leakage
- **Service Unavailability**: Health checks failing for 5+ minutes

## Prerequisites

- Access to Cloudflare dashboard or wrangler CLI
- Admin access to production environment
- KV namespace access for cache clearing

---

## Rollback Steps

### Step 1: Identify Current Deployment

```bash
# List recent deployments
npx wrangler deployments list --env production

# Example output:
# Deployment ID            Created At           Source
# abc123def456789          2025-11-24 14:30     latest (current)
# xyz789abc123456          2025-11-24 10:00     previous
```

Note the previous deployment ID (the one before "current").

### Step 2: Execute Rollback

**Option A: Via Wrangler CLI (Recommended)**

```bash
# Rollback to previous deployment
npx wrangler rollback --env production

# Or rollback to specific deployment ID
npx wrangler rollback abc123def456789 --env production
```

**Option B: Via Cloudflare Dashboard**

1. Navigate to Workers & Pages → graphmind-worker
2. Click "Deployments" tab
3. Find the previous stable deployment
4. Click "..." menu → "Rollback to this deployment"
5. Confirm rollback

### Step 3: Verify Rollback Success

```bash
# Check current deployment
npx wrangler deployments list --env production

# Verify health checks
curl https://graphmind.your-domain.com/api/health
curl https://graphmind.your-domain.com/api/health/falkordb

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-11-24T14:35:00Z",
#   "version": "previous_version"
# }
```

### Step 4: Clear KV Cache

**CRITICAL**: Clear semantic query cache to prevent serving stale vector search results.

**Option A: Via Wrangler (Bulk Delete)**

```bash
# List all semantic query cache keys
npx wrangler kv:key list --namespace-id=<YOUR_KV_NAMESPACE_ID> --env production --prefix="semantic_query:"

# Delete all semantic query cache keys
# Note: This requires manual deletion of each key or using the dashboard
```

**Option B: Via Cloudflare Dashboard**

1. Navigate to Workers & Pages → KV
2. Select your namespace (e.g., `graphmind-cache`)
3. Filter keys by prefix: `semantic_query:`
4. Select all matching keys
5. Click "Delete" → Confirm

**Option C: Via API (Automated)**

```bash
# Create a temporary worker to bulk delete keys
# (This is the fastest method for large caches)

# Use the KV API to list and delete keys
curl -X DELETE "https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/bulk" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '["semantic_query:key1", "semantic_query:key2", ...]'
```

### Step 5: Monitor for 10 Minutes

After rollback, monitor the following for 10 minutes:

```bash
# Watch error logs (via wrangler)
npx wrangler tail --env production

# Expected: No critical errors related to vector search

# Check latency metrics (via Cloudflare dashboard)
# Navigate to: Workers & Pages → graphmind-worker → Analytics
# Verify: P95 latency < 500ms
```

**Key Metrics to Monitor**:
- Error rate: Should drop to <1%
- P95 latency: Should return to <500ms
- Health check status: Should be "healthy"
- User reports: No new complaints

### Step 6: Post-Rollback Communication

**Internal Team**:
```
Subject: GraphRAG 2.0 Production Rollback Executed

Team,

We rolled back the GraphRAG 2.0 semantic search deployment due to [REASON].

Rollback completed at: [TIME]
Previous deployment restored: [DEPLOYMENT_ID]
KV cache cleared: [YES/NO]
Monitoring status: [STABLE/INVESTIGATING]

Next steps:
- Root cause analysis in progress
- Fix will be developed and re-tested
- New deployment timeline: [TBD]

Incident report: [LINK]
```

**External Users** (if customer-facing issue):
```
We identified a performance issue with our new semantic search feature
and have temporarily reverted to the previous version. Service is now
fully restored. We apologize for any inconvenience.
```

---

## Post-Rollback Actions

### 1. Root Cause Analysis

Create an incident report documenting:

- **What happened**: Error logs, metrics, user reports
- **When it happened**: Timeline of deployment → detection → rollback
- **Why it happened**: Root cause (code bug, config issue, infrastructure)
- **How to prevent**: Changes to prevent recurrence

**Template**: `docs/deployment/incident-report-template.md`

### 2. Fix Development

- Reproduce the issue in development environment
- Develop fix with additional tests
- Re-run full validation suite (US1 + US2)
- Peer review the fix

### 3. Re-Deployment Planning

- Schedule new deployment during low-traffic period
- Notify team of new deployment time
- Prepare rollback plan (this document)
- Monitor closely during rollout

---

## Rollback Verification Checklist

After rollback, verify the following:

- [ ] Deployment ID matches previous stable version
- [ ] Health checks return 200 OK
- [ ] Error rate < 1% (10 minute average)
- [ ] P95 latency < 500ms (10 minute average)
- [ ] KV cache cleared (no stale vector search results)
- [ ] No user reports of issues
- [ ] Team notified of rollback
- [ ] Incident report created
- [ ] Root cause investigation started

---

## Emergency Contacts

- **On-Call Engineer**: [Name/Slack]
- **DevOps Lead**: [Name/Slack]
- **Engineering Manager**: [Name/Slack]
- **Cloudflare Support**: [Support ticket system]

---

## Appendix: Common Issues & Solutions

### Issue 1: Rollback Command Fails

**Error**: `Failed to rollback deployment`

**Solution**:
```bash
# Check authentication
npx wrangler whoami

# Re-authenticate if needed
export CLOUDFLARE_API_TOKEN=your_token_here

# Retry rollback
npx wrangler rollback --env production
```

### Issue 2: Health Checks Still Failing After Rollback

**Possible Causes**:
- FalkorDB connection issues (not related to deployment)
- KV cache corruption
- DNS propagation delay

**Solution**:
```bash
# Check FalkorDB connectivity
curl https://graphmind.your-domain.com/api/health/falkordb

# If FalkorDB is down, restart it
# (See FalkorDB operations guide)

# Wait 2-3 minutes for edge deployment propagation
```

### Issue 3: Users Still Seeing Errors

**Cause**: Edge cache hasn't purged yet

**Solution**:
```bash
# Purge edge cache (if using Cloudflare CDN)
# Navigate to: Cloudflare Dashboard → Caching → Purge Cache
# Select "Purge Everything"

# Or wait 3-5 minutes for TTL to expire
```

---

## Testing Rollback Procedure

**IMPORTANT**: Test this procedure in staging before production deployment.

```bash
# Deploy to staging
npx wrangler deploy --env staging

# Deploy a "broken" version (intentionally)
# (e.g., set a config variable to invalid value)
npx wrangler deploy --env staging

# Execute rollback
npx wrangler rollback --env staging

# Verify staging is working
curl https://graphmind-staging.your-domain.com/api/health
```

---

## Document Maintenance

This rollback procedure should be reviewed and updated:

- Before each major deployment
- After any rollback execution (lessons learned)
- When infrastructure changes (new dependencies, new services)
- Quarterly (routine review)

**Last Tested**: 2025-11-24 (Staging)
**Next Review Date**: 2025-12-24
