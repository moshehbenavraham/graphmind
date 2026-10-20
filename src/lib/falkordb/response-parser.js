// @ts-check
/// <reference path="./types.js" />

/**
 * FalkorDB Response Parser
 *
 * Parses FalkorDB Redis protocol responses into structured JavaScript objects.
 * Extracted from scripts/falkordb-rest-api.js for unit testing and code reuse.
 *
 * Non-compact format uses [key, value] pairs for nodes/edges/maps:
 * - Node: [["id", 1], ["labels", ["Person"]], ["properties", [[...pairs...]]]]
 * - Edge: [["id", 1], ["type", "WORKS_ON"], ["src_node", 1], ["dest_node", 3], ["properties", [...]]]
 * - Map: [[key, value], [key, value], ...]
 *
 * @module lib/falkordb/response-parser
 */

/**
 * @typedef {import('./types.js').ParsedFalkorDBResult} ParsedFalkorDBResult
 * @typedef {import('./types.js').QueryMetadata} QueryMetadata
 * @typedef {import('./types.js').QueryStatistics} QueryStatistics
 */

/**
 * Check if an array looks like a [key, value] pair
 *
 * @param {any} arr - Value to check
 * @returns {boolean} True if arr is a [string, any] pair
 */
export function isKeyValuePair(arr) {
  return Array.isArray(arr) && arr.length === 2 && typeof arr[0] === 'string';
}

/**
 * Convert an array of [key, value] pairs to an object
 *
 * @param {Array<[string, any]>} pairs - Array of key-value pairs
 * @returns {Object} Object with keys and values
 */
export function pairsToObject(pairs) {
  const obj = {};
  for (const pair of pairs) {
    if (isKeyValuePair(pair)) {
      const [key, value] = pair;
      obj[key] = extractValue(value);
    }
  }
  return obj;
}

/**
 * Check if the value looks like a FalkorDB node structure
 * Nodes have: id, labels, properties
 *
 * @param {any} arr - Value to check
 * @returns {boolean} True if arr looks like a node structure
 */
export function isNodeStructure(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return false;
  // Check if first element is ["id", number]
  const first = arr[0];
  return isKeyValuePair(first) && first[0] === 'id';
}

/**
 * Check if the value looks like a FalkorDB edge structure
 * Edges have: id, type, src_node, dest_node, properties
 *
 * @param {any} arr - Value to check
 * @returns {boolean} True if arr looks like an edge structure
 */
export function isEdgeStructure(arr) {
  if (!Array.isArray(arr) || arr.length < 4) return false;
  const keys = arr.filter(isKeyValuePair).map(p => p[0]);
  return keys.includes('type') && keys.includes('src_node');
}

/**
 * Extract a value from FalkorDB's non-compact format
 * Recursively converts nested structures to JavaScript objects
 *
 * @param {any} val - Value to extract
 * @returns {any} Extracted JavaScript value
 */
export function extractValue(val) {
  if (val === null || val === undefined) return null;

  // If it's a primitive, return as-is
  if (!Array.isArray(val)) return val;

  // Empty array
  if (val.length === 0) return [];

  // Check if this is a node structure (has id, labels, properties)
  if (isNodeStructure(val)) {
    return pairsToObject(val);
  }

  // Check if this is an edge structure (has type, src_node, dest_node)
  if (isEdgeStructure(val)) {
    return pairsToObject(val);
  }

  // Check if this looks like an array of key-value pairs (map/properties)
  if (val.every(isKeyValuePair)) {
    return pairsToObject(val);
  }

  // Otherwise, recursively process array elements
  return val.map(extractValue);
}

/**
 * Extract column name from FalkorDB header format
 * In non-compact mode, headers are just strings: ["source", "r", "target"]
 *
 * @param {any} col - Column header value
 * @param {number} index - Column index (for fallback naming)
 * @returns {string} Column name
 */
export function extractColumnName(col, index) {
  if (typeof col === 'string') {
    return col;
  }
  if (Array.isArray(col) && col.length >= 2) {
    return col[1]; // Fallback for compact format
  }
  return `col_${index}`;
}

/**
 * Parse FalkorDB result from Redis protocol format
 *
 * @param {any} result - Raw FalkorDB result from Redis
 * @returns {ParsedFalkorDBResult} Parsed result with data, metadata, and statistics
 */
export function parseFalkorDBResult(result) {
  if (!result || !Array.isArray(result)) {
    return { data: [], metadata: {}, statistics: {} };
  }

  /** @type {{ data: any[], metadata: { columns?: string[], rawColumns?: any[] }, statistics: Record<string, any> }} */
  const parsed = {
    data: [],
    metadata: {},
    statistics: {},
  };

  // Extract column headers - store both raw and extracted names
  if (result.length > 0 && Array.isArray(result[0])) {
    const rawColumns = result[0];
    // Extract clean column names for use as object keys
    parsed.metadata.columns = rawColumns.map((col, idx) => extractColumnName(col, idx));
    parsed.metadata.rawColumns = rawColumns; // Keep raw for debugging
  }

  // Extract result rows
  if (result.length > 1 && Array.isArray(result[1])) {
    const columns = parsed.metadata.columns || [];
    parsed.data = result[1].map(row => {
      if (!Array.isArray(row)) return row;

      const rowObj = {};
      row.forEach((value, index) => {
        const columnName = columns[index] || `col_${index}`;
        // Extract the actual value from [type, value] format
        rowObj[columnName] = extractValue(value);
      });
      return rowObj;
    });
  }

  // Extract statistics
  if (result.length > 0) {
    const statsArray = result[result.length - 1];
    if (Array.isArray(statsArray)) {
      statsArray.forEach(stat => {
        if (typeof stat === 'string') {
          const match = stat.match(/^(.+?):\s*(.+)$/);
          if (match) {
            const [, key, value] = match;
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
            const numericValue = parseFloat(value);
            // Only convert to number if the entire value is numeric (no units like 'milliseconds')
            const isFullyNumeric = /^[\d.]+$/.test(value.trim());
            parsed.statistics[normalizedKey] = isFullyNumeric && !isNaN(numericValue) ? numericValue : value;
          }
        }
      });
    }
  }

  return parsed;
}
