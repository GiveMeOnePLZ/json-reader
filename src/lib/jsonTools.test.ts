import { describe, expect, it } from 'vitest';
import {
  coerceEditedValue,
  flattenRows,
  getDocumentFormat,
  parseJsonRows,
  parseJsonlRows,
  serializeJsonlRows,
  setValueAtPath,
} from './jsonTools';

describe('parseJsonRows', () => {
  it('accepts arrays of objects', () => {
    expect(parseJsonRows('[{"name":"Alice"},{"name":"Bob"}]')).toEqual([
      { name: 'Alice' },
      { name: 'Bob' },
    ]);
  });

  it('rejects non-array JSON', () => {
    expect(() => parseJsonRows('{"name":"Alice"}')).toThrow(
      'JSON 顶层必须是对象数组',
    );
  });

  it('rejects arrays with primitive rows', () => {
    expect(() => parseJsonRows('[{"name":"Alice"}, 2]')).toThrow(
      '第 2 行不是对象',
    );
  });
});

describe('parseJsonlRows', () => {
  it('parses one object from each non-empty JSONL line', () => {
    expect(parseJsonlRows('{"name":"Alice"}\n\n {"name":"Bob"}\n')).toEqual([
      { name: 'Alice' },
      { name: 'Bob' },
    ]);
  });

  it('reports the original JSONL line number for malformed input', () => {
    expect(() => parseJsonlRows('{"name":"Alice"}\nnot-json')).toThrow(
      'JSONL 第 2 行解析失败',
    );
  });

  it('rejects non-object JSONL rows with their line number', () => {
    expect(() => parseJsonlRows('{"name":"Alice"}\n2')).toThrow(
      'JSONL 第 2 行不是对象',
    );
  });
});

describe('serializeJsonlRows', () => {
  it('serializes rows as newline-delimited JSON with a final newline', () => {
    expect(serializeJsonlRows([{ name: 'Alice' }, { name: 'Bob' }])).toBe(
      '{"name":"Alice"}\n{"name":"Bob"}\n',
    );
  });
});

describe('getDocumentFormat', () => {
  it('uses the JSONL format for a case-insensitive .jsonl extension', () => {
    expect(getDocumentFormat('records.jsonl')).toBe('jsonl');
    expect(getDocumentFormat('records.JSONL')).toBe('jsonl');
  });

  it('uses JSON for .json files', () => {
    expect(getDocumentFormat('records.json')).toBe('json');
  });
});

describe('flattenRows', () => {
  it('expands nested objects and arrays into stable dot-path columns', () => {
    const result = flattenRows([
      {
        id: 1,
        user: { name: 'Alice' },
        items: [{ price: 9.5 }],
      },
      {
        id: 2,
        user: { name: 'Bob' },
        extra: true,
      },
    ]);

    expect(result.columns).toEqual([
      'id',
      'user.name',
      'items[0].price',
      'extra',
    ]);
    expect(result.rows[0]).toMatchObject({
      __rowIndex: 0,
      id: 1,
      'user.name': 'Alice',
      'items[0].price': 9.5,
    });
    expect(result.rows[1]).toMatchObject({
      __rowIndex: 1,
      id: 2,
      'user.name': 'Bob',
      extra: true,
    });
  });
});

describe('setValueAtPath', () => {
  it('updates nested object and array paths without replacing sibling data', () => {
    const row = {
      user: { name: 'Alice', role: 'admin' },
      items: [{ price: 9.5, sku: 'A1' }],
    };

    const updated = setValueAtPath(row, 'items[0].price', 12);

    expect(updated).toEqual({
      user: { name: 'Alice', role: 'admin' },
      items: [{ price: 12, sku: 'A1' }],
    });
    expect(row.items[0].price).toBe(9.5);
  });
});

describe('coerceEditedValue', () => {
  it('keeps strings as strings', () => {
    expect(coerceEditedValue('12', '34')).toBe('34');
  });

  it('coerces numbers, booleans, and null when original type is known', () => {
    expect(coerceEditedValue(12, '34.5')).toBe(34.5);
    expect(coerceEditedValue(false, 'true')).toBe(true);
    expect(coerceEditedValue(null, 'null')).toBeNull();
  });

  it('falls back to text when typed conversion is invalid', () => {
    expect(coerceEditedValue(12, 'abc')).toBe('abc');
    expect(coerceEditedValue(false, 'maybe')).toBe('maybe');
  });
});
