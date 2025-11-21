# Current Work Handoff: Multi-Statement Query Error

**Date:** 2025-11-19
**Status:** Critical Bug - "Cypher generation failed: Multi-statement queries are not allowed"
**Last Action:** Attempted aggressive sanitization in `src/services/cypher-generator.js` (split by `;` and take first part).
**Result:** Failed. The error persists in production logs.

## The Issue
Despite implementing logic to split the generated Cypher string by semicolon and take only the first part, the system is still throwing a "Multi-statement queries are not allowed" error.

## Investigation Findings
1.  **Error Source:** The error comes from `src/lib/graph/cypher-validator.js`.
2.  **Previous Fix:** We added this to `src/services/cypher-generator.js`:
    ```javascript
    if (generatedCypher.includes(';')) {
      generatedCypher = generatedCypher.split(';')[0].trim();
    }
    ```
3.  **Why it might be failing:**
    *   **Deployment Latency:** It's possible the Worker didn't update immediately, though the logs showed a successful deployment.
    *   **Validator Logic:** The validator might be detecting something else as a "statement separator" or the sanitization isn't catching all cases (e.g., newlines that look like separators to the validator).
    *   **Code Path:** Is there another path where Cypher is generated that *doesn't* go through `generateCypherWithLLM`'s sanitization? (e.g., templates?)
    *   **Validator Check:** The validator splits by `;` and checks if `statements.length > 1`. If the string *ends* with a semicolon, `split` might produce an empty second element. We need to filter out empty strings in the validator.

## Next Steps for Restart
1.  **Check Validator Logic:**
    *   Open `src/lib/graph/cypher-validator.js`.
    *   Look at how `statements` are calculated.
    *   *Hypothesis:* `const statements = query.split(';');` might return `['MATCH...', '']` if the query ends with a semicolon. If the check is `statements.length > 1`, it fails even for a single valid query that ends in a semicolon.
    *   *Fix:* Ensure the validator filters out empty/whitespace-only strings after splitting.

2.  **Verify Code Path:**
    *   Ensure `validateAndSanitize` is called *after* our sanitization in `cypher-generator.js`.

3.  **Debugging:**
    *   Add logging in `cypher-validator.js` to print exactly what it thinks the "statements" are when it fails.

## Files of Interest
*   `src/lib/graph/cypher-validator.js` (The enforcer)
*   `src/services/cypher-generator.js` (The generator)
*   `src/durable-objects/QuerySessionManager.js` (The caller)

## Immediate Action Plan
1.  Modify `src/lib/graph/cypher-validator.js` to be robust against trailing semicolons.
    ```javascript
    const statements = query.split(';').filter(s => s.trim().length > 0);
    if (statements.length > 1) { ... }
    ```
2.  Deploy and verify.
