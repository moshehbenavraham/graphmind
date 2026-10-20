/**
 * Unit Tests for FalkorDB Response Parser
 *
 * Tests the parsing logic extracted from scripts/falkordb-rest-api.js
 * to ensure correct handling of various FalkorDB response formats.
 */

import { describe, it, expect } from 'vitest';
import {
  isKeyValuePair,
  pairsToObject,
  isNodeStructure,
  isEdgeStructure,
  extractValue,
  extractColumnName,
  parseFalkorDBResult
} from '../../src/lib/falkordb/response-parser.js';

describe('isKeyValuePair', () => {
  it('should return true for valid [key, value] pairs', () => {
    expect(isKeyValuePair(['name', 'Alice'])).toBe(true);
    expect(isKeyValuePair(['id', 123])).toBe(true);
    expect(isKeyValuePair(['active', true])).toBe(true);
    expect(isKeyValuePair(['data', null])).toBe(true);
    expect(isKeyValuePair(['nested', ['array']])).toBe(true);
  });

  it('should return false for non-pairs', () => {
    expect(isKeyValuePair(null)).toBe(false);
    expect(isKeyValuePair(undefined)).toBe(false);
    expect(isKeyValuePair('string')).toBe(false);
    expect(isKeyValuePair(123)).toBe(false);
    expect(isKeyValuePair([])).toBe(false);
    expect(isKeyValuePair(['single'])).toBe(false);
    expect(isKeyValuePair(['a', 'b', 'c'])).toBe(false);
    expect(isKeyValuePair([123, 'value'])).toBe(false); // First element must be string
  });
});

describe('pairsToObject', () => {
  it('should convert key-value pairs to object', () => {
    const pairs = [
      ['name', 'Alice'],
      ['age', 30],
      ['active', true]
    ];
    const result = pairsToObject(pairs);
    expect(result).toEqual({ name: 'Alice', age: 30, active: true });
  });

  it('should handle empty array', () => {
    expect(pairsToObject([])).toEqual({});
  });

  it('should skip invalid pairs', () => {
    const pairs = [
      ['valid', 'yes'],
      'invalid_string',
      [123, 'bad_key'],
      ['also_valid', 42]
    ];
    const result = pairsToObject(pairs);
    expect(result).toEqual({ valid: 'yes', also_valid: 42 });
  });

  it('should handle nested structures', () => {
    const pairs = [
      ['nested', [['inner', 'value']]]
    ];
    const result = pairsToObject(pairs);
    expect(result.nested).toEqual({ inner: 'value' });
  });
});

describe('isNodeStructure', () => {
  it('should return true for node-like structures', () => {
    const nodeStructure = [
      ['id', 1],
      ['labels', ['Person']],
      ['properties', [['name', 'Alice']]]
    ];
    expect(isNodeStructure(nodeStructure)).toBe(true);
  });

  it('should return false for non-node structures', () => {
    expect(isNodeStructure(null)).toBe(false);
    expect(isNodeStructure([])).toBe(false);
    expect(isNodeStructure([['name', 'value']])).toBe(false); // Only 1 element
    expect(isNodeStructure([['type', 'WORKS_ON']])).toBe(false); // Not starting with id
    expect(isNodeStructure([[123, 'value'], ['other', 'data']])).toBe(false); // Non-string key
  });
});

describe('isEdgeStructure', () => {
  it('should return true for edge-like structures', () => {
    const edgeStructure = [
      ['id', 1],
      ['type', 'WORKS_ON'],
      ['src_node', 1],
      ['dest_node', 3],
      ['properties', []]
    ];
    expect(isEdgeStructure(edgeStructure)).toBe(true);
  });

  it('should return false for non-edge structures', () => {
    expect(isEdgeStructure(null)).toBe(false);
    expect(isEdgeStructure([])).toBe(false);
    expect(isEdgeStructure([['id', 1]])).toBe(false); // Too few elements
    expect(isEdgeStructure([['id', 1], ['labels', ['Person']]])).toBe(false); // Missing type/src_node
  });
});

describe('extractValue', () => {
  it('should return null for null/undefined', () => {
    expect(extractValue(null)).toBe(null);
    expect(extractValue(undefined)).toBe(null);
  });

  it('should return primitives as-is', () => {
    expect(extractValue('string')).toBe('string');
    expect(extractValue(123)).toBe(123);
    expect(extractValue(true)).toBe(true);
    expect(extractValue(0)).toBe(0);
  });

  it('should return empty array as-is', () => {
    expect(extractValue([])).toEqual([]);
  });

  it('should convert node structures to objects', () => {
    const node = [
      ['id', 1],
      ['labels', ['Person']],
      ['properties', [['name', 'Alice'], ['age', 30]]]
    ];
    const result = extractValue(node);
    expect(result).toEqual({
      id: 1,
      labels: ['Person'],
      properties: { name: 'Alice', age: 30 }
    });
  });

  it('should convert edge structures to objects', () => {
    const edge = [
      ['id', 5],
      ['type', 'WORKS_ON'],
      ['src_node', 1],
      ['dest_node', 3],
      ['properties', [['since', '2020']]]
    ];
    const result = extractValue(edge);
    expect(result).toEqual({
      id: 5,
      type: 'WORKS_ON',
      src_node: 1,
      dest_node: 3,
      properties: { since: '2020' }
    });
  });

  it('should convert key-value pair arrays to objects', () => {
    const pairs = [['key1', 'value1'], ['key2', 'value2']];
    const result = extractValue(pairs);
    expect(result).toEqual({ key1: 'value1', key2: 'value2' });
  });

  it('should recursively process mixed arrays', () => {
    const mixed = ['simple', 123, [['nested', 'object']]];
    const result = extractValue(mixed);
    expect(result).toEqual(['simple', 123, { nested: 'object' }]);
  });
});

describe('extractColumnName', () => {
  it('should return string columns as-is', () => {
    expect(extractColumnName('source', 0)).toBe('source');
    expect(extractColumnName('target', 1)).toBe('target');
  });

  it('should extract from compact format [type, name]', () => {
    expect(extractColumnName([1, 'source'], 0)).toBe('source');
  });

  it('should fallback to col_N for unknown formats', () => {
    expect(extractColumnName(123, 0)).toBe('col_0');
    expect(extractColumnName(null, 2)).toBe('col_2');
    expect(extractColumnName([1], 3)).toBe('col_3'); // Array too short
  });
});

describe('parseFalkorDBResult', () => {
  it('should return empty result for null/undefined', () => {
    expect(parseFalkorDBResult(null)).toEqual({ data: [], metadata: {}, statistics: {} });
    expect(parseFalkorDBResult(undefined)).toEqual({ data: [], metadata: {}, statistics: {} });
  });

  it('should return empty result for non-array', () => {
    expect(parseFalkorDBResult('string')).toEqual({ data: [], metadata: {}, statistics: {} });
    expect(parseFalkorDBResult(123)).toEqual({ data: [], metadata: {}, statistics: {} });
  });

  it('should parse columns from headers', () => {
    const result = [
      ['name', 'age', 'active'],
      [],
      []
    ];
    const parsed = parseFalkorDBResult(result);
    expect(parsed.metadata.columns).toEqual(['name', 'age', 'active']);
  });

  it('should parse data rows', () => {
    const result = [
      ['name', 'value'],
      [
        ['Alice', 100],
        ['Bob', 200]
      ],
      []
    ];
    const parsed = parseFalkorDBResult(result);
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0]).toEqual({ name: 'Alice', value: 100 });
    expect(parsed.data[1]).toEqual({ name: 'Bob', value: 200 });
  });

  it('should parse statistics', () => {
    const result = [
      ['n'],
      [['node_data']],
      ['Nodes created: 5', 'Properties set: 10', 'Query internal execution time: 0.5 milliseconds']
    ];
    const parsed = parseFalkorDBResult(result);
    expect(parsed.statistics.nodes_created).toBe(5);
    expect(parsed.statistics.properties_set).toBe(10);
    expect(parsed.statistics.query_internal_execution_time).toBe('0.5 milliseconds');
  });

  it('should handle complete FalkorDB response with nodes', () => {
    const result = [
      ['n'],
      [
        [
          [
            ['id', 1],
            ['labels', ['Person']],
            ['properties', [['name', 'Alice'], ['age', 30]]]
          ]
        ]
      ],
      ['Nodes created: 1']
    ];
    const parsed = parseFalkorDBResult(result);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].n.id).toBe(1);
    expect(parsed.data[0].n.labels).toEqual(['Person']);
    expect(parsed.data[0].n.properties.name).toBe('Alice');
    expect(parsed.statistics.nodes_created).toBe(1);
  });

  it('should handle relationship queries', () => {
    const result = [
      ['source', 'r', 'target'],
      [
        [
          [['id', 1], ['labels', ['Person']], ['properties', [['name', 'Alice']]]],
          [['id', 5], ['type', 'KNOWS'], ['src_node', 1], ['dest_node', 2], ['properties', []]],
          [['id', 2], ['labels', ['Person']], ['properties', [['name', 'Bob']]]]
        ]
      ],
      []
    ];
    const parsed = parseFalkorDBResult(result);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].source.properties.name).toBe('Alice');
    expect(parsed.data[0].r.type).toBe('KNOWS');
    expect(parsed.data[0].target.properties.name).toBe('Bob');
  });

  it('should handle empty result sets', () => {
    const result = [
      ['n'],
      [],
      ['Cached execution: 0']
    ];
    const parsed = parseFalkorDBResult(result);

    expect(parsed.data).toHaveLength(0);
    expect(parsed.metadata.columns).toEqual(['n']);
  });
});
