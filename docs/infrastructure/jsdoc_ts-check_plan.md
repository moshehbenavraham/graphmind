# JSDoc + TypeScript Checking Implementation Plan

**Date:** 2025-11-30
**Author:** Claude Code (Opus 4.5)
**Status:** Phase 1-6, 8 Complete, Phase 7 Deferred
**Related:** [infrastructure-audit.md](./infrastructure-audit.md)

## Executive Summary

This plan outlines an incremental approach to adding TypeScript-level type checking to the GraphMind codebase **without migrating to TypeScript**. By leveraging JSDoc annotations with `// @ts-check`, we achieve ~80% of TypeScript benefits with minimal disruption to the existing build pipeline.

### Why JSDoc Instead of Full TypeScript?

| Factor | Full TypeScript | JSDoc + ts-check |
|--------|-----------------|------------------|
| Migration effort | 40-60 hours | 8-12 hours |
| Build step changes | Required | None |
| Runtime changes | None | None |
| IDE benefits | 100% | ~80% |
| Reversibility | Difficult | Easy |
| Risk to production | Medium | Low |

---

## Phase 1: Infrastructure Setup

**Estimated Time:** 1 hour
**Priority:** P0 (Foundation)

### 1.1 Create jsconfig.json

Create `/jsconfig.json` in project root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "checkJs": true,
    "allowJs": true,
    "noEmit": true,
    "strict": false,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@lib/*": ["src/lib/*"],
      "@services/*": ["src/services/*"],
      "@utils/*": ["src/utils/*"]
    }
  },
  "include": [
    "src/**/*.js",
    "scripts/**/*.js",
    "scripts/**/*.mjs"
  ],
  "exclude": [
    "node_modules",
    "dist",
    ".wrangler",
    "coverage",
    "src/frontend"
  ]
}
```

### 1.2 Install Type Definitions

```bash
npm install -D @types/node @types/express @cloudflare/workers-types
```

### 1.3 Create Types Directory

```bash
mkdir -p types
```

Create `/types/cloudflare.d.ts`:

```typescript
/// <reference types="@cloudflare/workers-types" />

/**
 * GraphMind environment bindings
 */
interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespaces
  KV: KVNamespace;
  RATE_LIMIT: KVNamespace;

  // R2 Bucket
  AUDIO_BUCKET: R2Bucket;

  // Workers AI
  AI: Ai;

  // Durable Objects
  FALKORDB_POOL: DurableObjectNamespace;
  VOICE_SESSION: DurableObjectNamespace;
  QUERY_SESSION_MANAGER: DurableObjectNamespace;

  // Queues
  ENTITY_EXTRACTION_QUEUE: Queue;
  GRAPH_SYNC_QUEUE: Queue;

  // Environment variables
  ENVIRONMENT: string;
  JWT_SECRET: string;
  FALKORDB_HOST: string;
  FALKORDB_PORT: string;
  FALKORDB_USER: string;
  FALKORDB_PASSWORD: string;
  FALKORDB_REST_API_KEY: string;

  // Optional
  ANSWER_CACHE_TTL?: string;
  ANSWER_MAX_TOKENS?: string;
  LLM_TEMPERATURE?: string;
}
```

### 1.4 Add npm Scripts

Update `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --project jsconfig.json --noEmit",
    "typecheck:watch": "tsc --project jsconfig.json --noEmit --watch"
  }
}
```

---

## Phase 2: Core Library Types

**Estimated Time:** 3-4 hours
**Priority:** P1 (High - Most Imported)

These files are imported by multiple scripts and should be typed first.

### 2.1 FalkorDB REST Client Types

Create `/src/lib/falkordb/types.js`:

```javascript
/**
 * @typedef {Object} FalkorDBConfig
 * @property {string} host - FalkorDB host (e.g., 'localhost' or 'https://tunnel.example.com')
 * @property {string|number} port - FalkorDB port (e.g., 3001 for REST API)
 * @property {string} username - FalkorDB username
 * @property {string} password - FalkorDB password
 * @property {string} [apiKey] - REST API authentication key
 */

/**
 * @typedef {Object} QueryResult
 * @property {Array<Object>} data - Query result rows
 * @property {QueryMetadata} metadata - Column information
 * @property {QueryStatistics} statistics - Execution statistics
 */

/**
 * @typedef {Object} QueryMetadata
 * @property {string[]} columns - Column names
 * @property {any[]} [rawColumns] - Raw column headers for debugging
 */

/**
 * @typedef {Object} QueryStatistics
 * @property {number} [nodes_created] - Number of nodes created
 * @property {number} [relationships_created] - Number of relationships created
 * @property {number} [properties_set] - Number of properties set
 * @property {number} [labels_added] - Number of labels added
 * @property {string} [query_internal_execution_time] - Execution time
 */

/**
 * @typedef {Object} RestClient
 * @property {function(string, string, Object=): Promise<any[]>} query - Execute Cypher query
 * @property {function(string, ...any): Promise<any>} send - Send Redis command
 * @property {function(): Promise<void>} close - Close connection
 */

/**
 * @typedef {Object} IndexDefinition
 * @property {string} type - Node type (e.g., 'Person', 'Project')
 * @property {string} property - Property name (e.g., 'user_id', 'name')
 * @property {string} purpose - Index purpose description
 */

/**
 * @typedef {Object} IndexResult
 * @property {boolean} success - Whether index creation succeeded
 * @property {string} nodeType - Node type
 * @property {string} property - Property name
 * @property {string} [error] - Error message if failed
 * @property {boolean} [alreadyExists] - True if index already existed
 */

/**
 * @typedef {Object} VectorSearchOptions
 * @property {number} [limit=10] - Maximum results
 * @property {number} [threshold=0.7] - Similarity threshold (0-1)
 */

/**
 * @typedef {Object} VectorSearchResult
 * @property {number} nodeId - Graph node ID
 * @property {Object} node - Node data
 * @property {number} score - Similarity score
 */

/**
 * @typedef {Object} ConnectionValidationResult
 * @property {boolean} valid - Whether connection is valid
 * @property {number|null} latency - Latency in milliseconds
 * @property {string|null} error - Error message if invalid
 */

export {};
```

### 2.2 Add ts-check to rest-client.js

Update `/src/lib/falkordb/rest-client.js` (add at top):

```javascript
// @ts-check
/// <reference path="./types.js" />

/**
 * @typedef {import('./types.js').FalkorDBConfig} FalkorDBConfig
 * @typedef {import('./types.js').RestClient} RestClient
 * @typedef {import('./types.js').QueryResult} QueryResult
 */

/**
 * Create a FalkorDB REST API client
 *
 * @param {FalkorDBConfig} config - Connection configuration
 * @returns {RestClient} REST API client with query methods
 */
export function createRestClient(config) {
  // ... existing implementation
}
```

### 2.3 Add ts-check to response-parser.js

Update `/src/lib/falkordb/response-parser.js` (add at top):

```javascript
// @ts-check

/**
 * @typedef {Object} ParsedFalkorDBResult
 * @property {Array<Object>} data - Parsed result rows
 * @property {Object} metadata - Column metadata
 * @property {string[]} [metadata.columns] - Column names
 * @property {any[]} [metadata.rawColumns] - Raw columns
 * @property {Object} statistics - Query statistics
 */

// ... existing code with type annotations
```

### 2.4 Add ts-check to errors.js

Update `/src/lib/falkordb/errors.js`:

```javascript
// @ts-check

/**
 * @typedef {Object} NormalizedError
 * @property {string} message - User-friendly error message
 * @property {string} code - Error code (e.g., 'CONN_REFUSED', 'AUTH_FAILED')
 * @property {string} [originalMessage] - Original error message
 * @property {number} [httpStatus] - Suggested HTTP status code
 */

/**
 * Normalize FalkorDB/Redis errors into consistent format
 *
 * @param {Error} error - Original error
 * @param {Object} [context] - Additional context
 * @param {string} [context.host] - FalkorDB host
 * @param {string|number} [context.port] - FalkorDB port
 * @param {string} [context.graphName] - Graph name
 * @param {string} [context.query] - Cypher query
 * @returns {NormalizedError & Error} Normalized error
 */
export function normalizeError(error, context = {}) {
  // ... existing implementation
}
```

---

## Phase 3: Scripts Migration

**Estimated Time:** 3-4 hours
**Priority:** P2 (Medium)

Migrate scripts in order of complexity (simplest first).

### 3.1 generate-admin-jwt.mjs

**Effort:** 30 minutes

```javascript
// @ts-check
/// <reference types="node" />

import jwt from 'jsonwebtoken';
import 'dotenv/config';

/**
 * @typedef {Object} JWTClaims
 * @property {string} sub - Subject (user ID)
 * @property {string} email - User email
 * @property {string} namespace - User namespace
 * @property {string} role - User role
 * @property {boolean} is_admin - Admin flag
 * @property {number} iat - Issued at timestamp
 * @property {number} exp - Expiration timestamp
 */

/** @type {string|undefined} */
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET not set in .env');
  process.exit(1);
}

// ... rest of implementation
```

### 3.2 vector-index.js

**Effort:** 45 minutes

```javascript
#!/usr/bin/env node
// @ts-check
/// <reference path="../src/lib/falkordb/types.js" />

import 'dotenv/config';
import { createRestClient } from '../src/lib/falkordb/rest-client.js';

/**
 * @typedef {import('../src/lib/falkordb/types.js').FalkorDBConfig} FalkorDBConfig
 * @typedef {import('../src/lib/falkordb/types.js').IndexResult} IndexResult
 */

/** @type {number} */
const VECTOR_DIMENSION = 768;

/** @type {string} */
const SIMILARITY_FUNCTION = 'cosine';

/**
 * @typedef {Object} VectorIndexDef
 * @property {string} type - Node type
 * @property {string} property - Property name
 */

/** @type {VectorIndexDef[]} */
const VECTOR_INDEXES = [
    { type: 'Person', property: 'embedding' },
    { type: 'Project', property: 'embedding' },
    { type: 'Note', property: 'embedding' },
    { type: 'Topic', property: 'embedding' },
];

// ... rest of implementation
```

### 3.3 create-falkordb-indexes.js

**Effort:** 1 hour

```javascript
#!/usr/bin/env node
// @ts-check
/// <reference path="../src/lib/falkordb/types.js" />

import { createRestClient } from '../src/lib/falkordb/rest-client.js';

/**
 * @typedef {import('../src/lib/falkordb/types.js').IndexDefinition} IndexDefinition
 * @typedef {import('../src/lib/falkordb/types.js').IndexResult} IndexResult
 * @typedef {import('../src/lib/falkordb/types.js').RestClient} RestClient
 */

/**
 * @typedef {Object} IndexCategories
 * @property {IndexDefinition[]} userIsolation
 * @property {IndexDefinition[]} nameSearch
 * @property {IndexDefinition[]} entityTraceability
 */

/** @type {IndexCategories} */
const INDEXES = {
  userIsolation: [
    { type: 'Person', property: 'user_id', purpose: 'User isolation' },
    // ... rest
  ],
  // ... rest
};

/**
 * Create a single index
 *
 * @param {RestClient} client - FalkorDB REST client
 * @param {string} graphName - Graph name
 * @param {string} nodeType - Node type
 * @param {string} property - Property name
 * @param {string} purpose - Index purpose
 * @returns {Promise<IndexResult>}
 */
async function createIndex(client, graphName, nodeType, property, purpose) {
  // ... existing implementation
}
```

### 3.4 seed_data.js

**Effort:** 45 minutes

```javascript
// @ts-check
/// <reference types="node" />

import { createClient } from 'redis';

/**
 * @typedef {import('redis').RedisClientType} RedisClient
 */

/** @type {RedisClient} */
const client = createClient({
    url: 'redis://localhost:6383'
});

/**
 * Seed test data into FalkorDB
 * @returns {Promise<void>}
 */
async function seed() {
    await client.connect();
    // ... rest
}
```

### 3.5 debug_production_failure.js

**Effort:** 1 hour

```javascript
// @ts-check

import { generateCypherQuery } from '../src/services/cypher-generator.js';
import { extractEntityReferences } from '../src/lib/graph/cypher-templates.js';
import { createClient } from 'redis';

/**
 * @typedef {Object} MockEnv
 * @property {Object} DB - Mock D1 database
 * @property {Object} AI - Mock Workers AI
 */

/** @type {MockEnv} */
const mockEnv = {
    DB: {
        prepare: (/** @type {string} */ query) => ({
            bind: (/** @type {string} */ userId) => ({
                /** @returns {Promise<{results: Array<{canonical_name: string, entity_type: string, entity_id: string}>}>} */
                all: async () => ({
                    results: [
                        { canonical_name: 'GraphMind', entity_type: 'Project', entity_id: 'proj_1' },
                    ]
                })
            })
        })
    },
    // ... rest
};
```

### 3.6 falkordb-rest-api.js

**Effort:** 2 hours (most complex)

```javascript
// @ts-check
/// <reference types="node" />
/// <reference types="express" />

/**
 * FalkorDB REST API Wrapper
 *
 * Lightweight Express server that exposes FalkorDB via HTTP/JSON REST API
 * Forwards requests to FalkorDB using Redis protocol
 */

require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('express').NextFunction} NextFunction
 * @typedef {import('redis').RedisClientType} RedisClient
 */

/** @type {import('express').Application} */
const app = express();
app.use(express.json());

/** @type {string|undefined} */
const API_KEY = process.env.FALKORDB_REST_API_KEY;

if (!API_KEY) {
  console.error('FATAL: FALKORDB_REST_API_KEY not set');
  process.exit(1);
}

// ... rest of implementation with types
```

---

## Phase 4: Durable Objects & Services

**Estimated Time:** 4-6 hours
**Priority:** P3 (Lower - internal code)

### 4.1 Priority Files

| File | Lines | Import Count | Priority |
|------|-------|--------------|----------|
| `FalkorDBConnectionPool.js` | 944 | 4 imports | P3-High |
| `QuerySessionManager.js` | 800+ | 6 imports | P3-High |
| `VoiceSessionManager.js` | 600+ | 5 imports | P3-Medium |
| `cypher-generator.js` | 400+ | 3 imports | P3-Medium |

### 4.2 Cloudflare Durable Object Types

Add to `/types/durable-objects.d.ts`:

```typescript
/**
 * FalkorDB Connection Pool state
 */
interface ConnectionPoolState {
  pool: PooledConnection[];
  maxConnections: number;
  namespaceCache: Map<string, string>;
  connectionConfig: FalkorDBConfig | null;
  warmupState: 'cold' | 'warming' | 'warm';
  lastWarmupTime: number | null;
  warmupInProgress: boolean;
  minPoolSize: number;
}

interface PooledConnection {
  client: RestClient;
  inUse: boolean;
  stale: boolean;
  created: number;
  lastUsed: number;
  lastPing: number;
}
```

---

## Phase 5: Verification & CI Integration

**Estimated Time:** 1-2 hours
**Priority:** P1 (Required for value)

### 5.1 Add Type Checking to CI

Update `.github/workflows/ci.yml`:

```yaml
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
```

### 5.2 Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run typecheck
```

### 5.3 VSCode Settings

Create `.vscode/settings.json`:

```json
{
  "javascript.validate.enable": true,
  "js/ts.implicitProjectConfig.checkJs": true,
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  }
}
```

---

## Phase 6: Remove @ts-nocheck Directives

**Estimated Time:** 2-3 hours
**Priority:** P2 (Quality Improvement)

Three files currently use `@ts-nocheck` due to complex library type interop issues. This phase removes those directives by properly typing these files.

### 6.1 Target Files

| File | Reason for @ts-nocheck | Complexity |
|------|------------------------|------------|
| `src/router.js` | itty-router type interop | Medium |
| `src/index.js` | Main entry with multiple bindings | Medium |
| `src/services/embedding.js` | Workers AI type definitions | High |

### 6.2 router.js Type Fixes

```javascript
// @ts-check
/// <reference types="@cloudflare/workers-types" />

/**
 * @typedef {import('itty-router').IRequest} IRequest
 * @typedef {import('itty-router').Router} Router
 */

// Add proper request type extensions for auth middleware
/**
 * @typedef {IRequest & {user?: AuthUser}} AuthenticatedRequest
 */
```

### 6.3 index.js Type Fixes

```javascript
// @ts-check
/// <reference path="../types/cloudflare.d.ts" />

/**
 * Main Worker entry point
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
export default {
  async fetch(request, env, ctx) {
    // ...
  }
}
```

### 6.4 embedding.js Type Fixes

```javascript
// @ts-check

/**
 * @typedef {Object} EmbeddingResult
 * @property {number[]} embedding - 768-dimensional vector
 * @property {number} tokens - Token count
 */

/**
 * Generate embedding using Workers AI
 * @param {Ai} ai - Workers AI binding
 * @param {string} text - Text to embed
 * @returns {Promise<EmbeddingResult>}
 */
```

---

## Phase 7: Stricter Type Checking

**Estimated Time:** 1-2 hours
**Priority:** P2 (Quality Improvement)

Enable stricter TypeScript compiler options to catch more potential bugs.

### 7.1 Update jsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "checkJs": true,
    "allowJs": true,
    "noEmit": true,
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@lib/*": ["src/lib/*"],
      "@services/*": ["src/services/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

### 7.2 New Options Explained

| Option | Purpose |
|--------|---------|
| `strict: true` | Enable all strict type-checking options |
| `noImplicitAny` | Error on expressions with implied `any` type |
| `noImplicitThis` | Error on `this` with implied `any` type |
| `noImplicitReturns` | Error when not all code paths return a value |
| `noFallthroughCasesInSwitch` | Error for fallthrough cases in switch |
| `noUncheckedIndexedAccess` | Add `undefined` to index signatures |

### 7.3 Expected Work

After enabling stricter options, fix errors in order of priority:
1. Add explicit return types where missing
2. Add explicit `any` types where truly dynamic
3. Add null checks for array/object index access
4. Fix switch statement fallthrough cases

---

## Phase 8: Documentation & Pre-commit Hook

**Estimated Time:** 1 hour
**Priority:** P3 (Developer Experience)

Ensure all developers can benefit from type checking with proper documentation and automated checks.

### 8.1 README Documentation

Add to `README.md`:

```markdown
## Type Checking

This project uses JSDoc + TypeScript for type checking without a build step.

### Running Type Check

```bash
# One-time check
npm run typecheck

# Watch mode (continuous)
npm run typecheck:watch
```

### Adding Types to New Files

Add `// @ts-check` at the top of any JavaScript file to enable type checking:

```javascript
// @ts-check

/**
 * @param {string} name - User name
 * @param {number} age - User age
 * @returns {string} Greeting message
 */
function greet(name, age) {
  return `Hello ${name}, you are ${age} years old`;
}
```

### IDE Support

VSCode will automatically show type errors. For other editors:
- WebStorm: Enable TypeScript service for JavaScript
- Vim/Neovim: Use coc-tsserver or nvim-lspconfig

### Type Definition Files

- `types/cloudflare.d.ts` - Cloudflare Workers bindings
- `types/common.d.ts` - Shared project types
- `src/lib/falkordb/types.js` - FalkorDB type definitions
- `src/durable-objects/types.js` - Durable Object types
```

### 8.2 Pre-commit Hook Setup

```bash
# Install husky
npm install -D husky

# Initialize husky
npx husky init

# Add pre-commit hook
echo '#!/bin/sh
npm run typecheck' > .husky/pre-commit
chmod +x .husky/pre-commit
```

### 8.3 Update package.json

```json
{
  "scripts": {
    "prepare": "husky",
    "typecheck": "tsc --project jsconfig.json --noEmit",
    "typecheck:watch": "tsc --project jsconfig.json --noEmit --watch"
  }
}
```

---

## Implementation Checklist

### Phase 1: Infrastructure (Week 1) - COMPLETED
- [x] Create `jsconfig.json`
- [x] Install `@types/node`, `@types/express`, `@cloudflare/workers-types` (pre-existing)
- [x] Install `typescript` as devDependency
- [x] Create `/types/cloudflare.d.ts` with Env interface
- [x] Add `typecheck` npm script
- [x] Verify `npm run typecheck` runs (expect errors initially)

### Phase 2: Core Library (Week 1-2) - COMPLETED
- [x] Create `/src/lib/falkordb/types.js` with shared typedefs
- [x] Add `// @ts-check` to `rest-client.js`
- [x] Add `// @ts-check` to `response-parser.js`
- [x] Add `// @ts-check` to `errors.js`
- [x] Add `// @ts-check` to `client.js`
- [x] Add `// @ts-check` to `namespace.js`
- [x] Add `// @ts-check` to `operations.js` (bonus)
- [x] Fix all type errors in Phase 2 files
- [x] Verify `npm run typecheck` passes for Phase 2

### Phase 3: Scripts (Week 2) - COMPLETED
- [x] Add `// @ts-check` to `generate-admin-jwt.mjs`
- [x] Add `// @ts-check` to `vector-index.js`
- [x] Add `// @ts-check` to `create-falkordb-indexes.js`
- [x] Add `// @ts-check` to `seed_data.js`
- [x] Add `// @ts-check` to `debug_production_failure.js`
- [x] Add `// @ts-check` to `falkordb-rest-api.js`
- [x] Fix all type errors in scripts
- [x] Verify `npm run typecheck` passes for all scripts

### Phase 4: Services (Week 3+) - COMPLETED
- [x] Add `// @ts-check` to `QuerySessionManager.js`
- [x] Add `// @ts-check` to `VoiceSessionManager.js`
- [x] Create `/src/durable-objects/types.js` with shared DO types
- [x] Update `TranscriptionConfig` with all required properties
- [x] Fix all Durable Object type errors (0 remaining)
- [x] Fix JSDoc @returns patterns in auth libraries (crypto.js, rate-limit.js, validation.js)
- [x] Update `NormalizedErrorProps` with operationCount for connection pool
- [x] Add `// @ts-nocheck` to complex files with library type interop issues (router.js, index.js, embedding.js)
- [x] Target 70%+ coverage - **ACHIEVED: 70% (76/109 files passing, 77 errors in 33 files)**

### Phase 5: CI Integration (Week 2) - COMPLETED
- [x] Add type-check job to CI workflow (fixed script name: `typecheck`)
- [x] Type-check runs in CI (non-blocking - errors logged but don't fail build)
- [x] Add VSCode settings for team (`.vscode/settings.json`)
- [ ] Document in README (moved to Phase 8)

### Phase 6: Remove @ts-nocheck Directives - COMPLETED
- [x] Remove `@ts-nocheck` from `src/router.js`
- [x] Add itty-router type imports and RouterType return annotation
- [x] Fix all type errors in router.js (fixed middleware Env type reference)
- [x] Remove `@ts-nocheck` from `src/index.js`
- [x] Add Env type reference and Worker entry point types
- [x] Fix all type errors in index.js
- [x] Remove `@ts-nocheck` from `src/services/embedding.js`
- [x] Add EmbeddingResponse typedef and Workers AI model type
- [x] Fix all type errors in embedding.js
- [x] Verify `npm run typecheck` passes with 0 errors

### Phase 7: Stricter Type Checking - DEFERRED
**Note:** Testing revealed 1,802 errors when enabling strict mode. This phase requires significantly more work than originally estimated and has been deferred to a future sprint.

- [ ] Backup current jsconfig.json
- [ ] Enable `strict: true` in jsconfig.json
- [ ] Enable `noImplicitAny`
- [ ] Enable `noImplicitReturns`
- [ ] Enable `noFallthroughCasesInSwitch`
- [ ] Enable `noUncheckedIndexedAccess`
- [ ] Fix all new type errors (revised estimate: 1,800+ errors, ~40-60 hours)
- [ ] Verify `npm run typecheck` passes with 0 errors

### Phase 8: Documentation & Pre-commit Hook - COMPLETED
- [x] Install husky as devDependency
- [x] Initialize husky with `npx husky init`
- [x] Create `.husky/pre-commit` with typecheck script
- [x] Add `prepare` script to package.json (added by husky init)
- [x] Add "Type Checking" section to README.md
- [x] Document how to run typecheck
- [x] Document how to add types to new files
- [x] Document IDE support options
- [x] Document type definition file locations

---

## Success Metrics

| Metric | Target | Current (2025-11-30) | Status |
|--------|--------|---------------------|--------|
| Type coverage | 70%+ | **100% (109/109 files)** | EXCEEDED |
| CI passing | 100% | Type-check job active | ACHIEVED |
| Type errors | 0 | **0 errors** | **ACHIEVED** |
| Developer adoption | 100% | VSCode + Husky + README docs | **ACHIEVED** |
| @ts-nocheck files | 0 | **0 files** | **ACHIEVED** |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Third-party types missing | Use `any` initially, add types incrementally |
| Complex generic types | Start with simpler `Object` types, refine later |
| Team unfamiliarity | Provide JSDoc cheat sheet, pair programming |
| False positives | Use `@ts-ignore` sparingly with TODO comments |

---

## Appendix: JSDoc Quick Reference

### Basic Types
```javascript
/** @type {string} */
/** @type {number} */
/** @type {boolean} */
/** @type {Object} */
/** @type {any} */
/** @type {null} */
/** @type {undefined} */
```

### Arrays & Objects
```javascript
/** @type {string[]} */
/** @type {Array<string>} */
/** @type {{name: string, age: number}} */
/** @type {Object<string, number>} */  // Record<string, number>
```

### Functions
```javascript
/**
 * @param {string} name - User name
 * @param {number} [age] - Optional age
 * @returns {Promise<User>}
 */
```

### Union & Optional
```javascript
/** @type {string | null} */
/** @type {string=} */  // Optional parameter
/** @type {?string} */  // Nullable
```

### Importing Types
```javascript
/** @typedef {import('./types.js').User} User */
/** @type {import('express').Request} */
```

### Custom Types
```javascript
/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} [email] - Optional email
 */
```

---

## Implementation Session Summary (2025-11-30)

### Session 1 Progress
- **Starting errors:** 193 across 37+ files
- **Ending errors:** 77 across 33 files
- **Reduction:** 116 errors fixed (60% reduction)
- **Coverage:** 70% of backend files passing (76/109)

### Session 1 Key Changes
1. Fixed JSDoc types in middleware (index.js, rateLimit.js, auth.js)
2. Added proper type definitions for FalkorDB ResolvedEntity
3. Fixed return type annotations (Promise<Response> for async handlers)
4. Added `@ts-nocheck` to complex library integration files (router.js, index.js, embedding.js)
5. Updated CI workflow to use correct script name (`typecheck`)
6. Created `.vscode/settings.json` for team IDE support

---

### Session 2 Progress (2025-11-30)
- **Starting errors:** 77 across 33 files
- **Ending errors:** 30 across 15 files
- **Reduction:** 47 errors fixed (61% reduction this session)
- **Coverage:** 86% of backend files passing (94/109 files)

### Session 2 Key Changes
1. Fixed `src/utils/responses.js` - Added missing user properties (is_deleted, updated_at), fixed rate limit parameter type
2. Fixed `src/lib/graph/error-handler.js` - Added @ts-check, ErrorDetails typedef, GraphError constructor types
3. Fixed `src/lib/audio/transcription.js` - Updated originalError parameter type (Error|null)
4. Fixed `src/lib/audio/validation.js` - Updated expectedSequence parameter types (number|null)
5. Fixed `src/lib/audio/text-sanitizer.js` - Made options and options.maxWords optional
6. Fixed `src/lib/graph/context-formatter.js` - Added Intl.DateTimeFormatOptions type for date formatting
7. Fixed `src/lib/db/voice-notes-queries.js` - Consolidated duplicate @returns tags
8. Fixed `src/lib/falkordb/types.js` - Added operation property to NormalizedErrorProps
9. Fixed `src/lib/falkordb/errors.js` - Added operation property to context typedef
10. Fixed `src/lib/session/session-manager.js` - Added SessionMetadata type cast, SessionStatus literal
11. Fixed `src/models/entity.model.js` - Added optional errors property to validateEntities return type
12. Fixed `src/services/entity-extraction.service.js` - Made all options properties optional
13. Fixed `src/services/tts-synthesizer.js` - Added @ts-check, TTSSynthesisResult and TTSError typedefs
14. Fixed `src/services/result-formatter.js` - Added @ts-check, ErrorWithCode typedef
15. Fixed `src/services/transcription-service.js` - Updated originalError parameter type
16. Fixed `src/services/tts-stream-handler.js` - Added @ts-check, SynthesizeResult and PlaybackControlResult typedefs
17. Fixed `src/lib/graph/cypher-validator.js` - Made options properties optional
18. Fixed `src/middleware/index.js` - Replaced @type {MiddlewareFn} with explicit @param/@returns annotations
19. Created `types/common.d.ts` - Added ErrorWithCode, Logger, and AuthenticatedRequest interfaces

---

### Session 3 Progress (2025-11-30)
- **Starting errors:** 30 across 15 files
- **Ending errors:** 0 across 0 files
- **Reduction:** 30 errors fixed (100% complete)
- **Coverage:** 100% of backend files passing (109/109 files)

### Session 3 Key Changes
1. Fixed `src/api/test/test-redis-direct.js` - Removed invalid second parameter from createRedis call
2. Fixed `src/lib/graph/cypher-builder.js` - Changed `nodeType = null` to `nodeType = undefined`
3. Fixed `src/lib/graph/cypher-templates.js` - Changed `filterProperty = null` to `filterProperty = undefined`
4. Fixed `src/lib/validation/answer-validator.js` - Fixed parseInt with optional chaining on regex match
5. Fixed `src/services/graph-rag.js` - Added type cast for logger parameter
6. Fixed `src/lib/falkordb/errors.js` - Added null check for error.code in isRetryableError
7. Fixed `src/api/logs/ingest-client-logs.js` - Fixed logger.warn/info call signatures (2 args not 3)
8. Fixed `src/lib/falkordb/response-parser.js` - Added inline type annotation for parsed object
9. Fixed `src/lib/graph/cypher-queries.js` - Changed `relationshipType = null` to `undefined` in 2 functions
10. Fixed `src/services/audio-stream-handler.js` - Added type annotation for stats object with nullable timestamps
11. Fixed `src/api/graph/search-entities.js` - Moved variable declarations outside try block, converted null to undefined
12. Fixed `src/api/graph/sync-note.js` - Added Request type extension with auth properties
13. Fixed `src/lib/db/entity-cache-queries.js` - Changed `null` defaults to `undefined`, added type annotations for bindings arrays
14. Fixed `src/workers/api/query.js` - Fixed null check order for origin parameter
15. Fixed `src/lib/falkordb/client.js` - Added inline type annotation for parsed object, fixed isNaN call

---

### Session 4 Progress (2025-11-30)
- **Starting errors:** 0 (Phase 1-5 complete)
- **Ending errors:** 0 (Phase 6 & 8 complete)
- **Phase 7 test:** 1,802 errors when enabling strict mode (deferred)

### Session 4 Key Changes

**Phase 6: Remove @ts-nocheck from 3 files (COMPLETED)**
1. `src/services/embedding.js`:
   - Added `EmbeddingResponse` typedef matching Workers AI output
   - Used const literal type `'@cf/baai/bge-base-en-v1.5'` for model name
   - Added type cast for Workers AI response
2. `src/index.js`:
   - Added `RouterType` import from itty-router
   - Fixed return type annotations (`Promise<Response>`, `Promise<void>`)
   - Added proper Env and ExecutionContext type references
3. `src/router.js`:
   - Added `RouterType` typedef and return annotation
   - Fixed middleware Env type by updating `src/middleware/index.js` to use `types/cloudflare.d.ts`

**Phase 8: Documentation & Pre-commit Hook (COMPLETED)**
1. Installed husky as devDependency
2. Initialized husky with `npx husky init`
3. Created `.husky/pre-commit` with `npm run typecheck`
4. Added comprehensive "Type Checking" section to README.md

**Phase 7: Stricter Type Checking (DEFERRED)**
- Tested enabling strict mode options
- Result: 1,802 type errors (vs 20-50 estimated)
- Decision: Defer to future sprint (estimated 40-60 hours)

### Next Steps

| Phase | Scope | Est. Time | Status |
|-------|-------|-----------|--------|
| Phase 6 | Remove @ts-nocheck from 3 files | 1 hour | **COMPLETED** |
| Phase 8 | Documentation & pre-commit hook | 30 min | **COMPLETED** |
| Phase 7 | Enable stricter type checking | 40-60 hours | DEFERRED |

---

*Plan created: 2025-11-30*
*Last updated: 2025-11-30*
*Current status: Phase 1-6, 8 COMPLETE (0 type errors), Phase 7 DEFERRED*
