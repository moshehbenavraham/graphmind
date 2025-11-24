# Rollback Procedures - Security Hardening Release

**Feature**: Security Hardening (Spec 012 + 013)
**Version**: 1.0.0
**Last Updated**: 2025-11-24

---

## Overview

This document provides step-by-step rollback procedures if issues are discovered after deploying the security hardening features.

**Recovery Time Objective (RTO)**: <15 minutes
**Recovery Point Objective (RPO)**: Last known good state before deployment

---

## Rollback Decision Criteria

### When to Rollback (Immediate)

Execute rollback IMMEDIATELY if ANY of the following occur:

1. **Security Breach Detected**
   - Injection attack successful (data exposed)
   - Unauthorized cross-site access
   - User data leakage across accounts

2. **Service Degradation (Critical)**
   - Error rate >5% in first 30 minutes
   - Authentication system fails completely
   - Workers crashing or unavailable
   - Database corruption detected

3. **Performance Degradation (Severe)**
   - Query performance >2x slower than baseline
   - Voice queries taking >10s (target: <5s)
   - Database queries timing out

### When to Fix Forward (Non-Critical)

Consider fixing forward instead of rollback if:

1. **Minor Edge Cases**
   - Specific query patterns slower than expected
   - Non-critical auth edge cases failing
   - Minor UI issues

2. **Isolated Issues**
   - Single user/account affected
   - Specific feature broken (not core functionality)
   - Performance issue with workaround

3. **Low Impact**
   - Error rate <2%
   - No data loss or security risk
   - Functionality remains mostly working

---

## Rollback Procedure

### Phase 1: Preparation (2 minutes)

1. **Assess Situation**
   - [ ] Identify failing component (Workers, Database, REST API)
   - [ ] Document symptoms and error messages
   - [ ] Confirm rollback is necessary (review criteria above)

2. **Notify Team**
   - [ ] Alert team in Slack/communication channel
   - [ ] State: "Initiating rollback of security deployment"
   - [ ] Assign monitor person to track progress

3. **Access Deployment Info**
   - [ ] Get previous deployment ID from backup notes
   - [ ] Verify database backup file exists
   - [ ] Confirm API key for REST API access

### Phase 2: Workers Rollback (3 minutes)

1. **Identify Previous Deployment**
   ```bash
   npx wrangler deployments list --env production
   ```
   - Find deployment BEFORE your security release
   - Note deployment ID

2. **Execute Workers Rollback**
   ```bash
   npx wrangler rollback --env production --deployment-id <PREVIOUS_ID>
   ```
   - Wait for confirmation
   - Expected: <30 seconds

3. **Verify Workers Rollback**
   ```bash
   curl https://your-workers-url.workers.dev/api/health
   ```
   - Expected: 200 OK
   - Verify no authentication errors for this endpoint

### Phase 3: Database Rollback (5 minutes)

**Only if database issues detected**

1. **Stop Application Traffic**
   - [ ] Set Workers to maintenance mode (if available)
   - OR: Accept brief downtime (<5 minutes)

2. **Restore Database from Backup**
   ```bash
   # List backups to find correct file
   ls -lt graphmind-backup-*.sql

   # Restore from backup
   npx wrangler d1 import graphmind-db --env production --file graphmind-backup-YYYYMMDD.sql
   ```
   - Wait for import to complete
   - Expected: 1-3 minutes depending on data size

3. **Verify Database Integrity**
   ```bash
   npx wrangler d1 execute graphmind-db --env production --command="SELECT COUNT(*) FROM users;"
   npx wrangler d1 execute graphmind-db --env production --command="SELECT COUNT(*) FROM entity_cache;"
   ```
   - Verify row counts match expected values

4. **Resume Application Traffic**
   - [ ] Disable maintenance mode
   - OR: Workers automatically resume serving requests

### Phase 4: REST API Rollback (3 minutes)

**Only if REST API needs rollback**

1. **Deploy Previous REST API Version**
   - [ ] Checkout previous Git commit
   ```bash
   cd scripts
   git log --oneline falkordb-rest-api.js
   git checkout <PREVIOUS_COMMIT> -- falkordb-rest-api.js
   ```

2. **Remove Security Controls (Temporary)**
   - [ ] Comment out API key check (if needed for immediate recovery)
   - [ ] Set CORS to allow all origins (TEMPORARILY)
   - Note: Re-enable security ASAP after investigation

3. **Restart REST API**
   ```bash
   pkill -f "node scripts/falkordb-rest-api.js"
   node scripts/falkordb-rest-api.js &
   ```

4. **Verify REST API**
   ```bash
   curl http://localhost:3001/health
   ```
   - Expected: 200 OK

### Phase 5: Verification (2 minutes)

1. **Test Core Functionality**
   - [ ] Health endpoints return 200
   - [ ] Voice note creation works
   - [ ] Voice query works
   - [ ] User authentication works

2. **Check Error Logs**
   ```bash
   npx wrangler tail --env production
   ```
   - Monitor for 2-3 minutes
   - Verify error rate decreasing

3. **Confirm Service Restored**
   - [ ] Error rate <1%
   - [ ] Response times back to normal
   - [ ] Users can access system

---

## Post-Rollback Actions

### Immediate (Within 1 Hour)

1. **Document Failure**
   - [ ] Create incident report
   - [ ] Document exact failure mode
   - [ ] Capture error logs and metrics
   - [ ] Timeline of events

2. **Notify Users (If Applicable)**
   - [ ] If service was down >5 minutes
   - [ ] Brief explanation
   - [ ] Apologize for inconvenience
   - [ ] Provide estimated time for fix

3. **Team Debrief**
   - [ ] Review what went wrong
   - [ ] Identify root cause
   - [ ] Assign owner for investigation

### Within 24 Hours

1. **Root Cause Analysis**
   - [ ] Investigate why deployment failed
   - [ ] Identify what was missed in testing
   - [ ] Document lessons learned

2. **Fix and Test**
   - [ ] Create fix for identified issue
   - [ ] Add test coverage for failure scenario
   - [ ] Validate fix in local/staging environment

3. **Plan Re-Deployment**
   - [ ] Update deployment checklist
   - [ ] Add additional validation steps
   - [ ] Schedule re-deployment

### Before Next Deployment

1. **Enhanced Testing**
   - [ ] Add tests for failure scenario
   - [ ] Run full test suite
   - [ ] Execute more thorough staging validation

2. **Update Documentation**
   - [ ] Update deployment checklist
   - [ ] Add troubleshooting steps
   - [ ] Document new validation steps

3. **Review with Team**
   - [ ] Present fix and test plan
   - [ ] Get sign-off from team
   - [ ] Schedule deployment

---

## Rollback Validation Checklist

After rollback, verify ALL of the following before considering rollback complete:

- [ ] Workers responding to health checks
- [ ] Error rate <1%
- [ ] Response times back to baseline
- [ ] Users can authenticate
- [ ] Voice notes can be created
- [ ] Voice queries work correctly
- [ ] Database queries executing successfully
- [ ] No data loss detected
- [ ] FalkorDB connection working
- [ ] No new error patterns in logs

---

## Common Issues and Resolutions

### Issue: Workers Won't Rollback

**Symptom**: `wrangler rollback` command fails
**Resolution**:
1. Check account permissions
2. Verify deployment ID is correct
3. Try deploying previous version directly:
   ```bash
   git checkout <PREVIOUS_COMMIT>
   npx wrangler deploy --env production
   ```

### Issue: Database Restore Fails

**Symptom**: `d1 import` command errors
**Resolution**:
1. Verify backup file integrity
2. Check database isn't locked
3. Try dropping and recreating database:
   ```bash
   npx wrangler d1 delete graphmind-db --env production
   npx wrangler d1 create graphmind-db --env production
   npx wrangler d1 import graphmind-db --env production --file <backup>
   ```

### Issue: Authentication Still Failing After Rollback

**Symptom**: Users can't authenticate even after rollback
**Resolution**:
1. Check Wrangler secrets:
   ```bash
   npx wrangler secret list --env production
   ```
2. Remove security secret if interfering:
   ```bash
   npx wrangler secret delete FALKORDB_REST_API_KEY --env production
   ```
3. Restart REST API without authentication

### Issue: Performance Still Degraded

**Symptom**: Queries still slow after rollback
**Resolution**:
1. Check database size (may need vacuuming)
2. Verify FalkorDB is responsive
3. Check for database locks
4. Restart FalkorDB if needed

---

## Emergency Contacts

- **On-Call Engineer**: [Your contact info]
- **Cloudflare Support**: https://dash.cloudflare.com/?to=/:account/support
- **Database Admin**: [Contact info]
- **Team Lead**: [Contact info]

---

## Rollback Testing

**IMPORTANT**: Test rollback procedures in staging BEFORE production deployment

1. **Staging Rollback Test**
   - [ ] Deploy security features to staging
   - [ ] Execute rollback procedure
   - [ ] Verify all steps work
   - [ ] Time the rollback (should be <15 minutes)

2. **Document Deviations**
   - Note any steps that don't work as documented
   - Update this document before production deployment

---

## Notes

- Keep this document updated after each deployment
- Review rollback criteria before each deployment
- Practice rollback in staging regularly
- Have all commands ready to copy-paste during rollback
- Stay calm and methodical during rollback execution

---

## References

- Deployment Checklist: docs/deployment/SECURITY_DEPLOYMENT_CHECKLIST.md
- Security Testing: docs/deployment/SECURITY_TESTING.md
- Cloudflare Rollback Docs: https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/
- D1 Backup/Restore: https://developers.cloudflare.com/d1/observability/backups/
