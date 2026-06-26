# JSONL Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support opening, editing, and saving `.jsonl` files while retaining existing `.json` behavior.

**Architecture:** Add JSONL parsing and serialization helpers beside the existing JSON row parser. The app determines the document format from its filename and uses that format for file-picker filters, parsing, and persistence.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, File System Access API.

---

### Task 1: Add JSONL helper tests and implementation

**Files:**
- Modify: `src/lib/jsonTools.test.ts`
- Modify: `src/lib/jsonTools.ts`

- [ ] **Step 1: Write failing tests**

```ts
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

it('serializes rows as newline-delimited JSON with a final newline', () => {
  expect(serializeJsonlRows([{ name: 'Alice' }, { name: 'Bob' }])).toBe(
    '{"name":"Alice"}\n{"name":"Bob"}\n',
  );
});
```

- [ ] **Step 2: Verify the new tests fail**

Run: `npm test -- src/lib/jsonTools.test.ts`

Expected: FAIL because `parseJsonlRows` and `serializeJsonlRows` are not exported.

- [ ] **Step 3: Implement the minimal helpers**

```ts
export function parseJsonlRows(text: string): JsonRow[] {
  return text.split(/\r?\n/).reduce<JsonRow[]>((rows, line, index) => {
    if (!line.trim()) return rows;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      throw new Error(`JSONL 第 ${index + 1} 行解析失败：${message}`);
    }
    if (!isPlainObject(parsed)) throw new Error(`JSONL 第 ${index + 1} 行不是对象`);
    rows.push(parsed);
    return rows;
  }, []);
}

export function serializeJsonlRows(rows: JsonRow[]): string {
  return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
}
```

- [ ] **Step 4: Verify the helper tests pass**

Run: `npm test -- src/lib/jsonTools.test.ts`

Expected: PASS.

### Task 2: Route file open and save by format

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add a failing format-routing test before extracting the pure helper**

Create a testable helper in `src/lib/jsonTools.ts` with this expected contract:

```ts
expect(getDocumentFormat('records.jsonl')).toBe('jsonl');
expect(getDocumentFormat('records.JSONL')).toBe('jsonl');
expect(getDocumentFormat('records.json')).toBe('json');
```

- [ ] **Step 2: Verify the test fails**

Run: `npm test -- src/lib/jsonTools.test.ts`

Expected: FAIL because `getDocumentFormat` is not exported.

- [ ] **Step 3: Implement routing and app integration**

```ts
export type DocumentFormat = 'json' | 'jsonl';

export function getDocumentFormat(name: string): DocumentFormat {
  return name.toLowerCase().endsWith('.jsonl') ? 'jsonl' : 'json';
}
```

In `App.tsx`, add `.jsonl` to the picker type, parse an opened file with `parseJsonlRows` when its format is `jsonl`, and call `serializeJsonlRows` from `saveToHandle` when the handle name is `.jsonl`. Ensure save-as suggests `.jsonl` for an existing JSONL document.

- [ ] **Step 4: Verify tests and production build pass**

Run: `npm test && npm run build`

Expected: all tests PASS and Vite production build succeeds.
