#!/usr/bin/env bash
# Setup feature directory with auto-numbering (NO branch creation)

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities
source "$SCRIPT_DIR/common.sh"

# Parse arguments
SHORT_NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --short-name)
            SHORT_NAME="$2"
            shift 2
            ;;
        *)
            error_exit "Unknown argument: $1. Usage: $0 --short-name <name>"
            ;;
    esac
done

# Validate required arguments
if [[ -z "$SHORT_NAME" ]]; then
    error_exit "Missing required argument: --short-name"
fi

# Find repo root
REPO_ROOT=$(find_repo_root)
log_info "Repository root: $REPO_ROOT"

# Sanitize short name
SHORT_NAME=$(sanitize_short_name "$SHORT_NAME")
log_info "Sanitized short name: $SHORT_NAME"

# Get next feature number
FEATURE_NUMBER=$(get_next_feature_number "$REPO_ROOT")
log_info "Feature number: $FEATURE_NUMBER"

# Create feature directory name
FEATURE_DIR_NAME="${FEATURE_NUMBER}-${SHORT_NAME}"
FEATURE_DIR="$REPO_ROOT/specs/$FEATURE_DIR_NAME"

# Check if feature directory already exists
if dir_exists "$FEATURE_DIR"; then
    error_exit "Feature directory already exists: $FEATURE_DIR"
fi

# Create feature directory
ensure_dir "$FEATURE_DIR"
log_info "Created feature directory: $FEATURE_DIR"

# Create subdirectories
ensure_dir "$FEATURE_DIR/contracts"
ensure_dir "$FEATURE_DIR/checklists"

# Output JSON result
json_output=$(cat <<EOF
{
  "feature_number": "$FEATURE_NUMBER",
  "short_name": "$SHORT_NAME",
  "feature_dir_name": "$FEATURE_DIR_NAME",
  "feature_dir": "$FEATURE_DIR",
  "spec_file": "$FEATURE_DIR/spec.md",
  "design_file": "$FEATURE_DIR/design.md",
  "tasks_file": "$FEATURE_DIR/tasks.md",
  "validation_file": "$FEATURE_DIR/validation.md",
  "contracts_dir": "$FEATURE_DIR/contracts",
  "checklists_dir": "$FEATURE_DIR/checklists"
}
EOF
)

log_info "Feature setup complete!"
echo "$json_output"
