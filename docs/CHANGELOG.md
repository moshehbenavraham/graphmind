# GraphMind Documentation Changelog

All notable changes to the GraphMind documentation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Previous Changelogs: `docs/previous_changelogs/`

---
Begin Changelog Entries Here - We do not use "unreleased" so all entries should have a version
---

## [1.11.9] - 2025-11-21

### Fixed

- **FalkorDB Data Persistence**
  - Fixed critical bug where FalkorDB data was lost on container restart
  - Root cause: Volume was mounted to `/data` but FalkorDB stores data in `/var/lib/falkordb/data`
  - Root cause: Default save thresholds (1hr minimum) meant data wasn't saved before restarts

### Changed

- **FalkorDB Docker Configuration** (`scripts/start-tunnel-services.sh`, `scripts/deploy-prod.sh`)
  - Updated volume mount path from `/data` to `/var/lib/falkordb/data`
  - Added persistence configuration after container startup:
    - RDB snapshots: Every 60 seconds if 1+ key changed (`CONFIG SET save "60 1"`)
    - AOF (Append-Only File): Enabled for durability (`CONFIG SET appendonly yes`)

- **Documentation** (`CLAUDE.md`)
  - Updated FalkorDB Docker command with correct volume mount path



---
END Changelog Entries Here - All Changelog entries should be above here
---

## Version History Summary

See Previous Changelogs for More Details: `docs/previous_changelogs/`

We keep here a brief history (5 entries + the entries in this file) in the form of | Version | Release Date | Key Features |

| Version | Release Date | Key Features |
|---------|--------------|--------------|
| 1.11.9  | 2025-11-21   | FalkorDB data persistence fix |
