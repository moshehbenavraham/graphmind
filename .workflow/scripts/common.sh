#!/usr/bin/env bash
# Common utilities for GraphMind workflow scripts

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# JSON output helper
json_output() {
    local json="$1"
    echo "$json"
}

# Error exit with JSON
error_exit() {
    local message="$1"
    log_error "$message"
    json_output "{\"error\": \"$message\"}"
    exit 1
}

# Find repo root (where .git directory exists)
find_repo_root() {
    local dir="$PWD"
    while [[ "$dir" != "/" ]]; do
        if [[ -d "$dir/.git" ]]; then
            echo "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    error_exit "Not in a git repository"
}

# Validate required commands exist
check_commands() {
    local commands=("$@")
    for cmd in "${commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error_exit "Required command not found: $cmd"
        fi
    done
}

# Sanitize short name (remove invalid characters, lowercase)
sanitize_short_name() {
    local name="$1"
    # Convert to lowercase, replace spaces with hyphens, remove invalid chars
    echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g'
}

# Get next feature number by finding highest existing number
get_next_feature_number() {
    local repo_root="$1"
    local specs_dir="$repo_root/specs"

    # Create specs directory if it doesn't exist
    mkdir -p "$specs_dir"

    # Find highest feature number
    local max_num=0
    if [[ -d "$specs_dir" ]]; then
        for dir in "$specs_dir"/*; do
            if [[ -d "$dir" ]]; then
                local basename=$(basename "$dir")
                # Extract number from directory name (format: XXX-feature-name)
                if [[ "$basename" =~ ^([0-9]+)- ]]; then
                    local num="${BASH_REMATCH[1]}"
                    # Remove leading zeros for comparison
                    num=$((10#$num))
                    if [[ $num -gt $max_num ]]; then
                        max_num=$num
                    fi
                fi
            fi
        done
    fi

    # Increment and format with leading zeros
    local next_num=$((max_num + 1))
    printf "%03d" "$next_num"
}

# Check if file exists
file_exists() {
    [[ -f "$1" ]]
}

# Check if directory exists
dir_exists() {
    [[ -d "$1" ]]
}

# Read file content
read_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        cat "$file"
    else
        error_exit "File not found: $file"
    fi
}

# Create directory if it doesn't exist
ensure_dir() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        mkdir -p "$dir"
        log_info "Created directory: $dir"
    fi
}

# Escape JSON string
escape_json() {
    local str="$1"
    # Escape backslashes, quotes, and newlines
    echo "$str" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n' | sed 's/\\n$//'
}
