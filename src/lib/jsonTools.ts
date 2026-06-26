export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue | undefined };
export type JsonRow = JsonObject;
export type ColumnPath = string;
export type DocumentFormat = 'json' | 'jsonl';
export type FlattenedRow = Record<string, JsonValue | undefined> & {
  __rowIndex: number;
};

export interface FlattenResult {
  columns: ColumnPath[];
  rows: FlattenedRow[];
}

const ARRAY_INDEX_PATTERN = /([^[.\]]+)|\[(\d+)\]/g;

export function parseJsonRows(text: string): JsonRow[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`JSON 解析失败：${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('JSON 顶层必须是对象数组');
  }

  parsed.forEach((row, index) => {
    if (!isPlainObject(row)) {
      throw new Error(`第 ${index + 1} 行不是对象`);
    }
  });

  return parsed as JsonRow[];
}

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

    if (!isPlainObject(parsed)) {
      throw new Error(`JSONL 第 ${index + 1} 行不是对象`);
    }

    rows.push(parsed);
    return rows;
  }, []);
}

export function serializeJsonlRows(rows: JsonRow[]): string {
  return rows.length ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '';
}

export function getDocumentFormat(name: string): DocumentFormat {
  return name.toLowerCase().endsWith('.jsonl') ? 'jsonl' : 'json';
}

export function flattenRows(rows: JsonRow[]): FlattenResult {
  const columnSet = new Set<ColumnPath>();
  const flattenedRows = rows.map((row, rowIndex) => {
    const flattened: FlattenedRow = { __rowIndex: rowIndex };
    flattenValue(row, '', flattened, columnSet);
    return flattened;
  });

  return {
    columns: Array.from(columnSet),
    rows: flattenedRows,
  };
}

export function setValueAtPath<T extends JsonRow>(
  row: T,
  path: ColumnPath,
  value: JsonValue | undefined,
): T {
  const cloned = structuredClone(row) as T;
  const segments = parsePath(path);
  let target: JsonObject | JsonValue[] = cloned;

  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;

    if (isLast) {
      if (Array.isArray(target) && typeof segment === 'number') {
        target[segment] = value as JsonValue;
      } else if (!Array.isArray(target) && typeof segment === 'string') {
        target[segment] = value;
      }
      return;
    }

    const nextSegment = segments[index + 1];
    if (Array.isArray(target) && typeof segment === 'number') {
      if (target[segment] === undefined) {
        target[segment] = typeof nextSegment === 'number' ? [] : {};
      }
      target = target[segment] as JsonObject | JsonValue[];
      return;
    }

    if (!Array.isArray(target) && typeof segment === 'string') {
      if (target[segment] === undefined) {
        target[segment] = typeof nextSegment === 'number' ? [] : {};
      }
      target = target[segment] as JsonObject | JsonValue[];
    }
  });

  return cloned;
}

export function getValueAtPath(row: JsonRow, path: ColumnPath): JsonValue | undefined {
  return parsePath(path).reduce<JsonValue | undefined>((current, segment) => {
    if (current === undefined || current === null) {
      return undefined;
    }

    if (Array.isArray(current) && typeof segment === 'number') {
      return current[segment];
    }

    if (isPlainObject(current) && typeof segment === 'string') {
      return current[segment];
    }

    return undefined;
  }, row);
}

export function coerceEditedValue(
  originalValue: JsonValue | undefined,
  editedText: string,
): JsonValue {
  if (typeof originalValue === 'number') {
    const numericValue = Number(editedText);
    return Number.isFinite(numericValue) && editedText.trim() !== ''
      ? numericValue
      : editedText;
  }

  if (typeof originalValue === 'boolean') {
    if (editedText === 'true') return true;
    if (editedText === 'false') return false;
    return editedText;
  }

  if (originalValue === null) {
    return editedText === 'null' ? null : editedText;
  }

  return editedText;
}

export function formatCellValue(value: JsonValue | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function flattenValue(
  value: JsonValue | undefined,
  path: string,
  output: FlattenedRow,
  columns: Set<ColumnPath>,
): void {
  if (Array.isArray(value)) {
    if (value.length === 0 && path) {
      output[path] = [];
      columns.add(path);
      return;
    }

    value.forEach((item, index) => {
      flattenValue(item, `${path}[${index}]`, output, columns);
    });
    return;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0 && path) {
      output[path] = {};
      columns.add(path);
      return;
    }

    entries.forEach(([key, nestedValue]) => {
      flattenValue(nestedValue, path ? `${path}.${key}` : key, output, columns);
    });
    return;
  }

  if (path) {
    output[path] = value;
    columns.add(path);
  }
}

function parsePath(path: ColumnPath): Array<string | number> {
  return Array.from(path.matchAll(ARRAY_INDEX_PATTERN)).map((match) =>
    match[2] === undefined ? match[1] : Number(match[2]),
  );
}

function isPlainObject(value: unknown): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}
