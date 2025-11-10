# GraphMind Documentation Changelog

All notable changes to the GraphMind documentation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Previous Changelogs: `docs/previous_changelogs/`

---
Begin Changelog Entries Here - We do not use "unreleased" so all entries should have a version
---

## [1.3.0] - 2025-11-10

### Added

- **Setup Spec Template** - New `setup-spec-template.md` for infrastructure work
  - "Setup Goals" instead of forced "User Stories" format
  - Better fit for foundational/prerequisite work (wrangler config, database setup, etc.)
  - Sections: Configuration Requirements, Service Bindings, Data Schema

- **Workflow State Tracking** - `.workflow/state.json` for simple state management
  - Tracks NEXT_SPEC.md conversions to spec numbers
  - Records spec status (tasks_generated, implemented, validated)
  - Audit trail of workflow progression
  - Eliminates need for grep searches to check state

### Changed

- **NEXT_SPEC Template Refactored** - 75% reduction in size, focused on scoping
  - **Purpose**: Scoping and sequencing only, not full specification
  - **Old**: 430 lines with full user stories, technical details, schemas
  - **New**: 100 lines with scope boundaries and /spec feed data
  - **Sections**: Why This Next, Scope Definition, What /spec Needs to Know, After This Spec
  - **Removed**: Detailed user stories, implementation steps, complete schemas, token estimates

- **Design Template Refactored** - Architectural focus, not literal code
  - Focus on **decisions** ("Why this approach") not implementations
  - **Patterns** over code ("Query strategy" not full Cypher queries)
  - Added "Key Architectural Decisions" section
  - Removed full code blocks (wrangler.toml, SQL schemas, Worker implementations)
  - Shorter, higher-level content that won't drift from actual code

### Removed

- **Token Estimates** - Removed from all templates
  - Unvalidated estimates removed from NEXT_SPEC header
  - Token breakdown section removed
  - Estimates created false expectations without validation

### Philosophy Update

**NEXT_SPEC.md Role Clarification**:
- Analyzes project state → determines what's next
- Validates scope → ensures single context window fit
- Feeds /spec → provides expansion seeds
- **NOT** a complete spec with full details

**Workflow Separation of Concerns**:
- `/nextspec`: "What's next and is it sized right?" (scoping)
- `/spec`: "What are we building and why?" (requirements)
- `/design`: "How are we building it?" (architecture)
- `/tasks`: "Step-by-step implementation" (execution)

## [1.2.0] - 2025-11-10

### Added

- **Workflow System** - Complete context-scoped development workflow in `.workflow/`
  - 6 workflow commands: `nextspec`, `spec`, `design`, `tasks`, `validate`, `updateprd`
  - 4 automation scripts: `setup-feature.sh`, `analyze-project.sh`, `check-prereqs.sh`, `common.sh`
  - 5 document templates: nextspec, spec, design, tasks, validation
  - Auto-numbered spec directory generation (001, 002, 003...)
  - Project state analysis with phase detection
  - Prerequisites validation system

- **Workflow Documentation** - `README_SPEC.md` with complete system documentation
  - Full workflow cycle documentation
  - Known limitations and safeguards
  - Troubleshooting guide
  - Customization instructions
  - Claude Code setup instructions

### Changed

- Updated `.gitignore` to exclude:
  - `temp/` - Temporary project files
  - `specs/` - Local workflow artifacts (not committed)

### Design Philosophy

The workflow system enables iterative development in single context windows:
1. Analyze project state and recommend next component (~8-30K tokens)
2. Create user-focused specification from recommendation
3. Generate technical design (Cloudflare + FalkorDB + Voice AI)
4. Create dependency-ordered implementation checklist
5. Validate implementation completeness
6. Sync PRD documentation with actual progress

Safeguards prevent common errors:
- NEXT_SPEC.md overwrite protection
- Duplicate spec prevention
- Archive directory auto-creation
- File existence vs functionality distinction documented



---
END Changelog Entries Here - All Changelog entries should be above here
---

## Version History Summary

See Previous Changelogs for More Details: `docs/previous_changelogs/`

We keep here a brief history (5 entries + the entries in this file) in the form of | Version | Release Date | Key Features |

| Version | Release Date | Key Features |
|---------|--------------|--------------|
| 1.3.0   | 2025-11-10   | Workflow refinement - Setup spec template, state tracking, lighter NEXT_SPEC (scoping only), architectural design focus |
| 1.2.0   | 2025-11-10   | Workflow system - Context-scoped development with 6 commands, automation scripts, templates, safeguards |
| 1.1.0   | 2025-11-10   | Deployment simplification - FalkorDB Cloud only, removed self-hosted options, updated cost targets to ~$20/mo |
| 1.0.0   | 2025-11-10   | Initial documentation suite - Complete PRD extraction: 15 docs, 8,500+ lines, phase guides, API specs, schemas |
