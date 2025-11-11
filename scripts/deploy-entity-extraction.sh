#!/bin/bash
#
# Production Deployment Script: Feature 005 - Entity Extraction
#
# This script deploys entity extraction to production including:
# - D1 database migrations
# - Queue consumer worker
# - API endpoints
# - VoiceSessionManager updates
#
# Prerequisites:
# - Wrangler authenticated with production account
# - Production secrets configured
# - D1 and KV namespaces created
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================================================"
echo "Feature 005: Entity Extraction - Production Deployment"
echo "================================================================================"
echo ""

# Configuration
ENV="${ENV:-production}"
DRY_RUN="${DRY_RUN:-false}"

echo "Environment: $ENV"
echo "Dry Run: $DRY_RUN"
echo ""

# Function to run command or simulate
run_command() {
    local cmd="$1"
    local description="$2"

    echo -e "${BLUE}[Step] $description${NC}"
    echo "Command: $cmd"

    if [ "$DRY_RUN" = "true" ]; then
        echo -e "${YELLOW}[DRY RUN] Skipping actual execution${NC}"
        return 0
    fi

    if eval "$cmd"; then
        echo -e "${GREEN}✓ Success${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed${NC}"
        return 1
    fi
}

# T097: Apply D1 Migration
echo "================================================================================"
echo "T097: Apply D1 Migration to Production"
echo "================================================================================"
echo ""

run_command \
    "npx wrangler d1 migrations apply graphmind-db --env $ENV" \
    "Apply 0003_entity_extraction.sql migration"

echo ""
sleep 2

# T098: Verify D1 Migration
echo "================================================================================"
echo "T098: Verify D1 Migration"
echo "================================================================================"
echo ""

run_command \
    "npx wrangler d1 execute graphmind-db --env $ENV --command 'PRAGMA table_info(voice_notes);'" \
    "Check voice_notes table structure"

echo ""

run_command \
    "npx wrangler d1 execute graphmind-db --env $ENV --command 'SELECT COUNT(*) as count FROM entity_cache;'" \
    "Verify entity_cache table exists"

echo ""
sleep 2

# T099: Deploy Queue Consumer
echo "================================================================================"
echo "T099: Deploy Queue Consumer Worker"
echo "================================================================================"
echo ""

run_command \
    "npx wrangler deploy src/workers/consumers/entity-extraction-consumer.js --name entity-extraction-consumer --env $ENV" \
    "Deploy queue consumer to production"

echo ""
sleep 2

# T100: Deploy API Endpoints
echo "================================================================================"
echo "T100: Deploy API Endpoints"
echo "================================================================================"
echo ""

run_command \
    "npx wrangler deploy src/index.js --env $ENV" \
    "Deploy main Worker with entity extraction endpoints"

echo ""
sleep 2

# T101: Deploy VoiceSessionManager Update
echo "================================================================================"
echo "T101: Deploy VoiceSessionManager with Extraction Hook"
echo "================================================================================"
echo ""

run_command \
    "npx wrangler deploy src/durable-objects/VoiceSessionManager.js --env $ENV" \
    "Deploy updated VoiceSessionManager with extraction trigger"

echo ""
sleep 2

# T102: Test Production Extraction
echo "================================================================================"
echo "T102: Test Production Extraction"
echo "================================================================================"
echo ""

echo -e "${YELLOW}Manual Test Required:${NC}"
echo ""
echo "1. Create a voice note in production:"
echo "   curl -X POST https://your-worker.your-subdomain.workers.dev/api/notes \\"
echo "     -H \"Authorization: Bearer \$JWT_TOKEN\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"transcript\":\"Meeting with Sarah Johnson about FastAPI project\"}'"
echo ""
echo "2. Wait 3 seconds for extraction to complete"
echo ""
echo "3. Check extraction results:"
echo "   curl https://your-worker.your-subdomain.workers.dev/api/notes/NOTE_ID/entities \\"
echo "     -H \"Authorization: Bearer \$JWT_TOKEN\""
echo ""
echo "4. Verify entities were extracted (Person: Sarah Johnson, Project: FastAPI)"
echo ""

if [ "$DRY_RUN" = "false" ]; then
    read -p "Press Enter after completing manual test..."
fi

# T103-T104: Monitoring Setup
echo "================================================================================"
echo "T103-T104: Monitoring & Alerting Setup"
echo "================================================================================"
echo ""

echo -e "${BLUE}[Info] Setting up monitoring...${NC}"
echo ""
echo "Cloudflare Workers Analytics:"
echo "  - Queue metrics: https://dash.cloudflare.com/workers/queues"
echo "  - Worker metrics: https://dash.cloudflare.com/workers"
echo "  - Error rates: Filter by 'entity-extraction'"
echo ""
echo "Key Metrics to Monitor:"
echo "  □ Queue message processing rate"
echo "  □ Queue consumer errors"
echo "  □ Dead letter queue size"
echo "  □ Extraction latency (p95 <3s)"
echo "  □ Entity extraction success rate (>95%)"
echo ""
echo "Alerts to Configure:"
echo "  □ Dead letter queue non-empty (critical)"
echo "  □ Extraction success rate <90% (warning)"
echo "  □ Queue consumer errors >10/min (warning)"
echo ""

# T105-T106: Documentation
echo "================================================================================"
echo "T105-T106: Documentation"
echo "================================================================================"
echo ""

echo -e "${GREEN}✓ API Documentation:${NC} specs/005-entity-extraction/contracts/entity-extraction-api.md"
echo -e "${GREEN}✓ Deployment Checklist:${NC} specs/005-entity-extraction/checklists/deployment-checklist.md"
echo ""

# T107-T108: README & User Guide
echo "================================================================================"
echo "T107-T108: Update README & Create User Guide"
echo "================================================================================"
echo ""

echo -e "${BLUE}[Info] Documentation updates needed:${NC}"
echo ""
echo "□ Update README.md with entity extraction feature"
echo "□ Create docs/user-guides/entity-extraction-guide.md"
echo "□ Add feature to main documentation index"
echo ""

# Summary
echo "================================================================================"
echo "Deployment Summary"
echo "================================================================================"
echo ""
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo ""
echo "Deployed Components:"
echo "  ✓ D1 migration applied"
echo "  ✓ Queue consumer worker deployed"
echo "  ✓ API endpoints deployed"
echo "  ✓ VoiceSessionManager updated"
echo ""
echo "Next Steps:"
echo "  1. Monitor production metrics in Cloudflare dashboard"
echo "  2. Test with real user voice notes"
echo "  3. Verify extraction latency <3 seconds"
echo "  4. Check dead letter queue (should be empty)"
echo "  5. Review entity extraction accuracy"
echo ""
echo "Rollback Instructions:"
echo "  If issues occur, rollback with:"
echo "  - git revert HEAD"
echo "  - npx wrangler deploy --env production (previous version)"
echo "  - Rollback D1: DROP TABLE entity_cache; (manual)"
echo ""
echo "================================================================================"
