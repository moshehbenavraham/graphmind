#!/usr/bin/env bash
# Check prerequisites and find feature directory

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities
source "$SCRIPT_DIR/common.sh"

# Parse arguments (optional feature directory)
FEATURE_DIR=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --feature-dir)
            FEATURE_DIR="$2"
            shift 2
            ;;
        *)
            error_exit "Unknown argument: $1. Usage: $0 [--feature-dir <path>]"
            ;;
    esac
done

# Find repo root
REPO_ROOT=$(find_repo_root)

# If feature directory not provided, try to detect it
if [[ -z "$FEATURE_DIR" ]]; then
    log_info "Feature directory not specified, attempting to detect..."

    # Check if current directory is inside specs/XXX-*/
    CURRENT_DIR="$PWD"
    if [[ "$CURRENT_DIR" == "$REPO_ROOT/specs/"* ]]; then
        # Extract feature directory (first subdirectory under specs/)
        FEATURE_DIR=$(echo "$CURRENT_DIR" | sed "s|$REPO_ROOT/specs/\([^/]*\).*|\1|")
        FEATURE_DIR="$REPO_ROOT/specs/$FEATURE_DIR"
        log_info "Detected feature directory from current path: $FEATURE_DIR"
    else
        # Look for most recently modified feature directory
        if [[ -d "$REPO_ROOT/specs" ]]; then
            LATEST_DIR=$(find "$REPO_ROOT/specs" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
            if [[ -n "$LATEST_DIR" ]]; then
                FEATURE_DIR="$LATEST_DIR"
                log_info "Using most recent feature directory: $FEATURE_DIR"
            else
                error_exit "No feature directories found in specs/. Run /spec first."
            fi
        else
            error_exit "specs/ directory not found. Run /spec first."
        fi
    fi
fi

# Validate feature directory exists
if [[ ! -d "$FEATURE_DIR" ]]; then
    error_exit "Feature directory does not exist: $FEATURE_DIR"
fi

# Extract feature name from directory
FEATURE_DIR_NAME=$(basename "$FEATURE_DIR")

# Check which files exist
SPEC_FILE="$FEATURE_DIR/spec.md"
DESIGN_FILE="$FEATURE_DIR/design.md"
TASKS_FILE="$FEATURE_DIR/tasks.md"
VALIDATION_FILE="$FEATURE_DIR/validation.md"
CONTRACTS_DIR="$FEATURE_DIR/contracts"
CHECKLISTS_DIR="$FEATURE_DIR/checklists"

SPEC_EXISTS=$(file_exists "$SPEC_FILE" && echo "true" || echo "false")
DESIGN_EXISTS=$(file_exists "$DESIGN_FILE" && echo "true" || echo "false")
TASKS_EXISTS=$(file_exists "$TASKS_FILE" && echo "true" || echo "false")
VALIDATION_EXISTS=$(file_exists "$VALIDATION_FILE" && echo "true" || echo "false")
CONTRACTS_EXISTS=$(dir_exists "$CONTRACTS_DIR" && echo "true" || echo "false")
CHECKLISTS_EXISTS=$(dir_exists "$CHECKLISTS_DIR" && echo "true" || echo "false")

# Check for required tools
WRANGLER_EXISTS=$(command -v wrangler &> /dev/null && echo "true" || echo "false")
NPM_EXISTS=$(command -v npm &> /dev/null && echo "true" || echo "false")
NODE_EXISTS=$(command -v node &> /dev/null && echo "true" || echo "false")

# Output JSON result
json_output=$(cat <<EOF
{
  "repo_root": "$REPO_ROOT",
  "feature_dir": "$FEATURE_DIR",
  "feature_name": "$FEATURE_DIR_NAME",
  "files": {
    "spec": {
      "path": "$SPEC_FILE",
      "exists": $SPEC_EXISTS
    },
    "design": {
      "path": "$DESIGN_FILE",
      "exists": $DESIGN_EXISTS
    },
    "tasks": {
      "path": "$TASKS_FILE",
      "exists": $TASKS_EXISTS
    },
    "validation": {
      "path": "$VALIDATION_FILE",
      "exists": $VALIDATION_EXISTS
    }
  },
  "directories": {
    "contracts": {
      "path": "$CONTRACTS_DIR",
      "exists": $CONTRACTS_EXISTS
    },
    "checklists": {
      "path": "$CHECKLISTS_DIR",
      "exists": $CHECKLISTS_EXISTS
    }
  },
  "tools": {
    "wrangler": $WRANGLER_EXISTS,
    "npm": $NPM_EXISTS,
    "node": $NODE_EXISTS
  }
}
EOF
)

log_info "Prerequisites check complete"
echo "$json_output"
