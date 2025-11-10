#!/usr/bin/env bash
# Analyze GraphMind project state to determine next spec
#
# NOTE: This script checks for FILE EXISTENCE, not functionality.
# A file existing doesn't mean it works correctly.
# Use /validate to verify actual working code.

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities
source "$SCRIPT_DIR/common.sh"

# Find repo root
REPO_ROOT=$(find_repo_root)
log_info "Analyzing project at: $REPO_ROOT"

# Initialize analysis results
PHASE="Planning"
PHASE_NUMBER=0
COMPLETED_COMPONENTS=()
IN_PROGRESS_COMPONENTS=()
MISSING_COMPONENTS=()
RECOMMENDED_NEXT=""
ESTIMATED_TOKENS=15000

# Check what exists in the project

# Phase 1 checks
HAS_WRANGLER_TOML=false
HAS_WORKERS_DIR=false
HAS_MIGRATIONS_DIR=false
HAS_AUTH_SYSTEM=false
HAS_D1_SETUP=false
HAS_FALKORDB_CONNECTION=false

# Phase 2 checks
HAS_VOICE_CAPTURE=false
HAS_ENTITY_EXTRACTION=false
HAS_FALKORDB_SCHEMA=false
HAS_VOICE_NOTE_STORAGE=false

# Phase 3 checks
HAS_QUERY_ENDPOINTS=false
HAS_GRAPHRAG_INTEGRATION=false
HAS_ANSWER_GENERATION=false
HAS_VOICE_RESPONSE=false

# Phase 4 checks
HAS_ERROR_HANDLING=false
HAS_PERFORMANCE_OPTIMIZATION=false
HAS_UI_POLISH=false
HAS_MONITORING=false

# Check filesystem
cd "$REPO_ROOT"

# Check Phase 1 components
if [[ -f "wrangler.toml" ]]; then
    HAS_WRANGLER_TOML=true
    COMPLETED_COMPONENTS+=("wrangler.toml")
fi

if [[ -d "src/workers" ]]; then
    HAS_WORKERS_DIR=true
    COMPLETED_COMPONENTS+=("Workers directory structure")
fi

if [[ -d "migrations" ]]; then
    HAS_MIGRATIONS_DIR=true
    COMPLETED_COMPONENTS+=("D1 migrations directory")
fi

if [[ -f "src/workers/middleware/auth.js" ]] || [[ -f "src/middleware/auth.js" ]]; then
    HAS_AUTH_SYSTEM=true
    COMPLETED_COMPONENTS+=("Authentication middleware")
fi

# Check for D1 setup (migration files)
if [[ -d "migrations" ]] && [[ -n "$(ls -A migrations/*.sql 2>/dev/null)" ]]; then
    HAS_D1_SETUP=true
    COMPLETED_COMPONENTS+=("D1 database setup")
fi

# Check for FalkorDB connection
if [[ -f "src/lib/graph/connection.js" ]] || [[ -f "src/graph/connection.js" ]]; then
    HAS_FALKORDB_CONNECTION=true
    COMPLETED_COMPONENTS+=("FalkorDB connection")
fi

# Check Phase 2 components
if [[ -f "src/workers/api/notes.js" ]] || [[ -f "src/api/notes.js" ]]; then
    HAS_VOICE_CAPTURE=true
    COMPLETED_COMPONENTS+=("Voice capture endpoints")
fi

if [[ -f "src/lib/entities/extractor.js" ]] || [[ -f "src/entities/extractor.js" ]]; then
    HAS_ENTITY_EXTRACTION=true
    COMPLETED_COMPONENTS+=("Entity extraction")
fi

if [[ -f "src/lib/graph/schema.js" ]] || [[ -f "src/graph/schema.js" ]]; then
    HAS_FALKORDB_SCHEMA=true
    COMPLETED_COMPONENTS+=("FalkorDB schema")
fi

# Check Phase 3 components
if [[ -f "src/workers/api/query.js" ]] || [[ -f "src/api/query.js" ]]; then
    HAS_QUERY_ENDPOINTS=true
    COMPLETED_COMPONENTS+=("Query endpoints")
fi

if [[ -f "src/lib/graph/graphrag.js" ]] || [[ -f "src/graph/graphrag.js" ]]; then
    HAS_GRAPHRAG_INTEGRATION=true
    COMPLETED_COMPONENTS+=("GraphRAG integration")
fi

# Determine current phase and what's next

# Phase 1 assessment
PHASE_1_COMPLETE=false
if $HAS_WRANGLER_TOML && $HAS_WORKERS_DIR && $HAS_MIGRATIONS_DIR; then
    PHASE_1_COMPLETE=true
fi

# Phase 2 assessment
PHASE_2_COMPLETE=false
if $PHASE_1_COMPLETE && $HAS_VOICE_CAPTURE && $HAS_ENTITY_EXTRACTION && $HAS_FALKORDB_SCHEMA; then
    PHASE_2_COMPLETE=true
fi

# Phase 3 assessment
PHASE_3_COMPLETE=false
if $PHASE_2_COMPLETE && $HAS_QUERY_ENDPOINTS && $HAS_GRAPHRAG_INTEGRATION; then
    PHASE_3_COMPLETE=true
fi

# Determine current phase and recommendations
if ! $PHASE_1_COMPLETE; then
    PHASE="Phase 1: Foundation"
    PHASE_NUMBER=1

    if ! $HAS_WRANGLER_TOML; then
        RECOMMENDED_NEXT="Wrangler Configuration & Project Setup"
        MISSING_COMPONENTS+=("wrangler.toml")
        MISSING_COMPONENTS+=("Basic project structure")
        ESTIMATED_TOKENS=8000
    elif ! $HAS_D1_SETUP; then
        RECOMMENDED_NEXT="D1 Database Setup & Schema"
        MISSING_COMPONENTS+=("D1 migrations")
        MISSING_COMPONENTS+=("Database schema")
        ESTIMATED_TOKENS=12000
    elif ! $HAS_AUTH_SYSTEM; then
        RECOMMENDED_NEXT="Authentication System (JWT)"
        MISSING_COMPONENTS+=("Auth middleware")
        MISSING_COMPONENTS+=("User management")
        ESTIMATED_TOKENS=18000
    elif ! $HAS_FALKORDB_CONNECTION; then
        RECOMMENDED_NEXT="FalkorDB Connection & Setup"
        MISSING_COMPONENTS+=("FalkorDB client")
        MISSING_COMPONENTS+=("Connection utilities")
        ESTIMATED_TOKENS=10000
    else
        RECOMMENDED_NEXT="Complete Phase 1 Remaining Tasks"
        ESTIMATED_TOKENS=15000
    fi

elif ! $PHASE_2_COMPLETE; then
    PHASE="Phase 2: Knowledge Graph & Entity Extraction"
    PHASE_NUMBER=2

    if ! $HAS_VOICE_CAPTURE; then
        RECOMMENDED_NEXT="Voice Note Capture System"
        MISSING_COMPONENTS+=("Voice capture endpoints")
        MISSING_COMPONENTS+=("WebRTC integration")
        MISSING_COMPONENTS+=("STT integration")
        ESTIMATED_TOKENS=25000
    elif ! $HAS_ENTITY_EXTRACTION; then
        RECOMMENDED_NEXT="Entity Extraction Pipeline"
        MISSING_COMPONENTS+=("Entity extraction logic")
        MISSING_COMPONENTS+=("Llama 3.1 integration")
        ESTIMATED_TOKENS=20000
    elif ! $HAS_FALKORDB_SCHEMA; then
        RECOMMENDED_NEXT="FalkorDB Knowledge Graph Schema"
        MISSING_COMPONENTS+=("Graph schema definition")
        MISSING_COMPONENTS+=("Cypher queries")
        ESTIMATED_TOKENS=18000
    else
        RECOMMENDED_NEXT="Complete Phase 2 Remaining Tasks"
        ESTIMATED_TOKENS=15000
    fi

elif ! $PHASE_3_COMPLETE; then
    PHASE="Phase 3: Voice Query & GraphRAG"
    PHASE_NUMBER=3

    if ! $HAS_QUERY_ENDPOINTS; then
        RECOMMENDED_NEXT="Voice Query Endpoints"
        MISSING_COMPONENTS+=("Query API")
        MISSING_COMPONENTS+=("WebSocket query handling")
        ESTIMATED_TOKENS=20000
    elif ! $HAS_GRAPHRAG_INTEGRATION; then
        RECOMMENDED_NEXT="GraphRAG Integration"
        MISSING_COMPONENTS+=("GraphRAG SDK setup")
        MISSING_COMPONENTS+=("Query generation")
        ESTIMATED_TOKENS=22000
    else
        RECOMMENDED_NEXT="Complete Phase 3 Remaining Tasks"
        ESTIMATED_TOKENS=15000
    fi

else
    PHASE="Phase 4+: Polish & Advanced Features"
    PHASE_NUMBER=4
    RECOMMENDED_NEXT="UI Polish & Error Handling"
    MISSING_COMPONENTS+=("Comprehensive error handling")
    MISSING_COMPONENTS+=("UI improvements")
    ESTIMATED_TOKENS=20000
fi

# Check specs directory
EXISTING_SPECS=()
if [[ -d "$REPO_ROOT/specs" ]]; then
    for spec_dir in "$REPO_ROOT/specs"/*; do
        if [[ -d "$spec_dir" ]]; then
            spec_name=$(basename "$spec_dir")
            EXISTING_SPECS+=("$spec_name")
        fi
    done
fi

# Build JSON output
completed_json="["
for i in "${!COMPLETED_COMPONENTS[@]}"; do
    if [[ $i -gt 0 ]]; then completed_json+=","; fi
    completed_json+="\"${COMPLETED_COMPONENTS[$i]}\""
done
completed_json+="]"

missing_json="["
for i in "${!MISSING_COMPONENTS[@]}"; do
    if [[ $i -gt 0 ]]; then missing_json+=","; fi
    missing_json+="\"${MISSING_COMPONENTS[$i]}\""
done
missing_json+="]"

existing_specs_json="["
for i in "${!EXISTING_SPECS[@]}"; do
    if [[ $i -gt 0 ]]; then existing_specs_json+=","; fi
    existing_specs_json+="\"${EXISTING_SPECS[$i]}\""
done
existing_specs_json+="]"

# Calculate phase percentages
phase1_pct=0
phase2_pct=0
phase3_pct=0

if $HAS_WRANGLER_TOML; then ((phase1_pct+=25)); fi
if $HAS_WORKERS_DIR; then ((phase1_pct+=25)); fi
if $HAS_D1_SETUP; then ((phase1_pct+=25)); fi
if $HAS_AUTH_SYSTEM || $HAS_FALKORDB_CONNECTION; then ((phase1_pct+=25)); fi

if $PHASE_1_COMPLETE; then
    phase1_pct=100
    if $HAS_VOICE_CAPTURE; then ((phase2_pct+=33)); fi
    if $HAS_ENTITY_EXTRACTION; then ((phase2_pct+=33)); fi
    if $HAS_FALKORDB_SCHEMA; then ((phase2_pct+=34)); fi
fi

if $PHASE_2_COMPLETE; then
    phase2_pct=100
    if $HAS_QUERY_ENDPOINTS; then ((phase3_pct+=50)); fi
    if $HAS_GRAPHRAG_INTEGRATION; then ((phase3_pct+=50)); fi
fi

# Output JSON
json_output=$(cat <<EOF
{
  "phase": "$PHASE",
  "phase_number": $PHASE_NUMBER,
  "phase_percentages": {
    "phase_1": $phase1_pct,
    "phase_2": $phase2_pct,
    "phase_3": $phase3_pct
  },
  "completed_components": $completed_json,
  "missing_components": $missing_json,
  "recommended_next": "$RECOMMENDED_NEXT",
  "estimated_tokens": $ESTIMATED_TOKENS,
  "existing_specs": $existing_specs_json,
  "checks": {
    "wrangler_toml": $HAS_WRANGLER_TOML,
    "workers_dir": $HAS_WORKERS_DIR,
    "migrations": $HAS_MIGRATIONS_DIR,
    "auth_system": $HAS_AUTH_SYSTEM,
    "d1_setup": $HAS_D1_SETUP,
    "falkordb_connection": $HAS_FALKORDB_CONNECTION,
    "voice_capture": $HAS_VOICE_CAPTURE,
    "entity_extraction": $HAS_ENTITY_EXTRACTION,
    "falkordb_schema": $HAS_FALKORDB_SCHEMA,
    "query_endpoints": $HAS_QUERY_ENDPOINTS,
    "graphrag_integration": $HAS_GRAPHRAG_INTEGRATION
  }
}
EOF
)

log_info "Project analysis complete"
echo "$json_output"
