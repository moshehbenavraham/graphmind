# Strict Type Checking - Remaining Work

**Date:** 2025-11-30
**Status:** Deferred
**Related:** [jsdoc_ts-check_plan.md](./jsdoc_ts-check_plan.md)

## Overview

Phase 7 of the JSDoc + TypeScript implementation plan was deferred after testing revealed significantly more errors than estimated. This document outlines the remaining work.

## Current State

| Metric | Value |
|--------|-------|
| Current jsconfig.json | Non-strict (working, 0 errors) |
| Tested strict mode | 1,803 errors (in our code) |
| Original estimate | 20-50 errors |
| Revised estimate | 40-60 hours of work |

## Completed Prep Work

- [x] Installed `@types/jsonwebtoken` - eliminates node_modules errors
- [x] Fixed `src/lib/auth/crypto.js` - added type cast for `jwt.verify()` return

## Strict Options Tested

The following options were enabled during testing:

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Error Breakdown

### By Category

| Error Type | Count | Description |
|------------|-------|-------------|
| `TS7006` | ~800 | Parameter implicitly has 'any' type |
| `TS18046` | ~400 | 'error' is of type 'unknown' (catch blocks) |
| `TS2339` | ~200 | Property does not exist on type 'Object' |
| `TS7030` | ~100 | Not all code paths return a value |
| `TS2532` | ~150 | Object is possibly 'undefined' |
| `TS7053` | ~100 | Element implicitly has 'any' type (index access) |
| Other | ~52 | Various type mismatches |

### By Location

| Location | Errors | Notes |
|----------|--------|-------|
| `src/**/*.js` | ~1,600 | Main application code |
| `scripts/**/*.js` | ~150 | Build/utility scripts |
| `node_modules/jsonwebtoken` | ~53 | Missing type definitions |

## Root Causes

### 1. Implicit Any Parameters (~800 errors)
Many functions lack `@param` type annotations:
```javascript
// Current (error)
function handleRequest(request, env, ctx) { ... }

// Required fix
/**
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 */
function handleRequest(request, env, ctx) { ... }
```

### 2. Unknown Error Type in Catch Blocks (~400 errors)
TypeScript strict mode types catch errors as `unknown`:
```javascript
// Current (error)
catch (error) {
  console.error(error.message); // error is 'unknown'
}

// Required fix
catch (error) {
  const err = /** @type {Error} */ (error);
  console.error(err.message);
}
```

### 3. Object Property Access (~200 errors)
Using `Object` type instead of specific types:
```javascript
// Current (error)
/** @param {Object} env */
function handler(env) {
  env.DB.prepare(...); // Property 'DB' doesn't exist on 'Object'
}

// Required fix
/** @param {Env} env */
function handler(env) {
  env.DB.prepare(...);
}
```

### 4. Unchecked Index Access (~100 errors)
`noUncheckedIndexedAccess` adds `| undefined` to array/object index access:
```javascript
// Current (error)
const items = [1, 2, 3];
const first = items[0]; // Type is number | undefined

// Required fix
const first = items[0];
if (first !== undefined) {
  // use first safely
}
```

### 5. Missing Return Statements (~100 errors)
Functions that don't return in all branches:
```javascript
// Current (error)
function getValue(condition) {
  if (condition) {
    return 'value';
  }
  // implicit undefined return
}

// Required fix
function getValue(condition) {
  if (condition) {
    return 'value';
  }
  return undefined; // or throw
}
```

## Recommended Approach

### Phase 7a: Fix Implicit Any (Highest Impact)
1. Add `@param` annotations to all exported functions
2. Add `@param` annotations to all handler functions
3. Estimated: 20-25 hours

### Phase 7b: Fix Catch Block Errors
1. Create error handling utility function
2. Add type casts to all catch blocks
3. Estimated: 8-10 hours

### Phase 7c: Fix Object Types
1. Replace `Object` with specific types
2. Add proper type definitions for all env parameters
3. Estimated: 6-8 hours

### Phase 7d: Fix Return Statements
1. Add explicit returns where missing
2. Update JSDoc `@returns` annotations
3. Estimated: 4-6 hours

### Phase 7e: Fix Index Access (Most Invasive)
1. Add null checks for all array access
2. Consider if this option provides enough value
3. Estimated: 8-10 hours (optional)

## Incremental Strategy

Instead of enabling all strict options at once, consider enabling them incrementally:

### Step 1: Enable `noImplicitReturns` First
- Lowest error count (~100)
- Easiest to fix
- High value (catches bugs)

### Step 2: Enable `noImplicitAny`
- Highest error count (~800)
- Most work but highest value
- Consider file-by-file approach

### Step 3: Keep `noUncheckedIndexedAccess` Disabled
- Very invasive
- Questionable value for this codebase
- Can be enabled later if desired

## File-by-File Approach

For gradual adoption, consider fixing files individually using `// @ts-strict` directive (TypeScript 5.0+) or by fixing highest-impact files first:

### Priority Files (fix first)
1. `src/lib/falkordb/*.js` - Core database operations
2. `src/middleware/*.js` - Request handling
3. `src/services/*.js` - Business logic
4. `src/api/**/*.js` - API endpoints

### Lower Priority (fix later)
1. `scripts/*.js` - Development utilities
2. `src/workers/**/*.js` - Worker-specific code

## Dependencies

Before starting Phase 7, consider:

1. ~~**Install `@types/jsonwebtoken`**~~ - **DONE** (installed 2025-11-30)

2. **Create error handling utilities** - Reduces catch block boilerplate
   ```javascript
   // src/utils/error-handling.js
   /**
    * @param {unknown} error
    * @returns {Error}
    */
   export function ensureError(error) {
     if (error instanceof Error) return error;
     return new Error(String(error));
   }
   ```

## Success Criteria

Phase 7 is complete when:
- [ ] `npm run typecheck` passes with strict mode enabled
- [ ] All 1,802 errors are fixed
- [ ] No `@ts-ignore` comments added (prefer proper typing)
- [ ] No runtime behavior changes

## Timeline

| Task | Estimated Hours | Priority |
|------|-----------------|----------|
| Phase 7a (implicit any) | 20-25 | High |
| Phase 7b (catch blocks) | 8-10 | Medium |
| Phase 7c (object types) | 6-8 | Medium |
| Phase 7d (returns) | 4-6 | Low |
| Phase 7e (index access) | 8-10 | Optional |
| **Total** | **46-59 hours** | - |

---

*Document created: 2025-11-30*
*Last updated: 2025-11-30*
