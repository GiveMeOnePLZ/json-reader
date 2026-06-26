import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnSizingState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Check,
  ChevronDown,
  Columns3,
  Download,
  ExternalLink,
  FileJson,
  FolderOpen,
  ListFilter,
  Save,
  Search,
  SlidersHorizontal,
  WrapText,
  X,
} from 'lucide-react';
import {
  type ColumnPath,
  type FlattenedRow,
  type JsonRow,
  type JsonValue,
  coerceEditedValue,
  flattenRows,
  formatCellValue,
  getDocumentFormat,
  getValueAtPath,
  parseJsonRows,
  parseJsonlRows,
  serializeJsonlRows,
  setValueAtPath,
} from './lib/jsonTools';
import { extractTextLinks } from './lib/linkTools';
import {
  getFrozenColumnOffset,
  getFrozenColumnClass,
  getGridTemplateColumns,
  getTablePixelWidth,
} from './lib/tableLayout';

type RowDensity = 'compact' | 'standard' | 'comfortable';
type ColumnDensity = 'compact' | 'standard' | 'wide';

interface DensityState {
  row: RowDensity;
  column: ColumnDensity;
  wrapCells: boolean;
  reduceTransparency: boolean;
  highContrast: boolean;
}

interface FileState {
  name: string;
  handle: FileSystemFileHandle | null;
  rows: JsonRow[];
  dirty: boolean;
  error: string | null;
}

interface EditingCell {
  rowIndex: number;
  path: ColumnPath;
  value: string;
}

const DEMO_ROWS: JsonRow[] = [
  {
    id: 1001,
    name: 'Alpha review',
    status: 'ready',
    score: 92,
    owner: { name: 'Lin', team: 'Research' },
    tags: ['json', 'table'],
  },
  {
    id: 1002,
    name: 'Nested sample',
    status: 'draft',
    score: 73,
    owner: { name: 'Maya', team: 'Data' },
    tags: ['edit', 'local'],
  },
  {
    id: 1003,
    name: 'Export check',
    status: 'saved',
    score: 88,
    owner: { name: 'Chen', team: 'Ops' },
    tags: ['filter', 'sort'],
  },
];

const DATA_FILE_TYPES = [
  {
    description: 'JSON / JSONL 文件',
    accept: {
      'application/json': ['.json'],
      'application/x-ndjson': ['.jsonl'],
    },
  },
];

const rowHeightByDensity: Record<RowDensity, number> = {
  compact: 34,
  standard: 44,
  comfortable: 56,
};

const wrappedRowHeightByDensity: Record<RowDensity, number> = {
  compact: 76,
  standard: 104,
  comfortable: 136,
};

const minColumnWidthByDensity: Record<ColumnDensity, number> = {
  compact: 140,
  standard: 180,
  wide: 240,
};

export function App() {
  const [fileState, setFileState] = useState<FileState>({
    name: '示例数据',
    handle: null,
    rows: DEMO_ROWS,
    dirty: false,
    error: null,
  });
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    {},
  );
  const [frozenColumnIds, setFrozenColumnIds] = useState<ColumnPath[]>([]);
  const [density, setDensity] = useState<DensityState>({
    row: 'standard',
    column: 'standard',
    wrapCells: false,
    reduceTransparency: false,
    highContrast: false,
  });
  const [activePanel, setActivePanel] = useState<
    'filters' | 'columns' | 'density' | null
  >(null);
  const tableParentRef = useRef<HTMLDivElement>(null);

  const flattened = useMemo(() => flattenRows(fileState.rows), [fileState.rows]);

  useEffect(() => {
    setVisibleColumns((current) => {
      const next = { ...current };
      flattened.columns.forEach((column) => {
        if (next[column] === undefined) next[column] = true;
      });
      Object.keys(next).forEach((column) => {
        if (!flattened.columns.includes(column)) delete next[column];
      });
      return next;
    });
  }, [flattened.columns]);

  useEffect(() => {
    setFrozenColumnIds((current) =>
      current.filter(
        (columnId) =>
          flattened.columns.includes(columnId) && visibleColumns[columnId] !== false,
      ),
    );
  }, [flattened.columns, visibleColumns]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!fileState.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [fileState.dirty]);

  const updateRows = useCallback((rows: JsonRow[], dirty = true) => {
    setFileState((current) => ({ ...current, rows, dirty, error: null }));
  }, []);

  const openFile = useCallback(async () => {
    try {
      if (!window.showOpenFilePicker) {
        throw new Error('当前浏览器不支持覆盖保存，请使用 Chrome 或 Edge。');
      }

      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: false,
        types: DATA_FILE_TYPES,
      });
      const file = await handle.getFile();
      const text = await file.text();
      const rows = getDocumentFormat(handle.name) === 'jsonl'
        ? parseJsonlRows(text)
        : parseJsonRows(text);

      setFileState({
        name: handle.name,
        handle,
        rows,
        dirty: false,
        error: null,
      });
      setGlobalFilter('');
      setColumnFilters([]);
      setSorting([]);
      setColumnSizing({});
      setEditingCell(null);
    } catch (error) {
      if (isAbortError(error)) return;
      setFileState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : '打开文件失败',
      }));
    }
  }, []);

  const saveToHandle = useCallback(
    async (handle: FileSystemFileHandle, rows: JsonRow[]) => {
      const writable = await handle.createWritable();
      await writable.write(
        getDocumentFormat(handle.name) === 'jsonl'
          ? serializeJsonlRows(rows)
          : JSON.stringify(rows, null, 2),
      );
      await writable.close();
    },
    [],
  );

  const saveAsFile = useCallback(async () => {
    try {
      if (!window.showSaveFilePicker) {
        downloadRows(fileState.name, fileState.rows);
        setFileState((current) => ({ ...current, dirty: false, error: null }));
        return;
      }

      const handle = await window.showSaveFilePicker({
        suggestedName: normalizeDataName(fileState.name),
        types: DATA_FILE_TYPES,
      });
      await saveToHandle(handle, fileState.rows);
      setFileState((current) => ({
        ...current,
        name: handle.name,
        handle,
        dirty: false,
        error: null,
      }));
    } catch (error) {
      if (isAbortError(error)) return;
      setFileState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : '另存为失败',
      }));
    }
  }, [fileState.name, fileState.rows, saveToHandle]);

  const saveFile = useCallback(async () => {
    try {
      if (!fileState.handle) {
        await saveAsFile();
        return;
      }

      await saveToHandle(fileState.handle, fileState.rows);
      setFileState((current) => ({ ...current, dirty: false, error: null }));
    } catch (error) {
      if (isAbortError(error)) return;
      setFileState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : '保存失败',
      }));
    }
  }, [fileState.handle, fileState.rows, saveAsFile, saveToHandle]);

  const handleCellCommit = useCallback(() => {
    if (!editingCell) return;

    const originalValue = getValueAtPath(
      fileState.rows[editingCell.rowIndex],
      editingCell.path,
    );
    const nextValue = coerceEditedValue(originalValue, editingCell.value);
    const nextRows = fileState.rows.map((row, index) =>
      index === editingCell.rowIndex
        ? setValueAtPath(row, editingCell.path, nextValue)
        : row,
    );

    updateRows(nextRows);
    setEditingCell(null);
  }, [editingCell, fileState.rows, updateRows]);

  const handleCellKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleCellCommit();
    }
    if (event.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const columns = useMemo<Array<ColumnDef<FlattenedRow>>>(() => {
    return flattened.columns.map((columnPath) => ({
      id: columnPath,
      accessorFn: (row) => row[columnPath],
      header: columnPath,
      size: minColumnWidthByDensity[density.column],
      minSize: 72,
      maxSize: 1200,
      enableResizing: true,
      filterFn: 'includesString',
      sortingFn: mixedValueSort,
      cell: ({ row, getValue }) => {
        const rowIndex = row.original.__rowIndex;
        const isEditing =
          editingCell?.rowIndex === rowIndex && editingCell.path === columnPath;
        const value = getValue<JsonValue | undefined>();

        if (isEditing) {
          return (
            <input
              className="cell-editor"
              value={editingCell.value}
              autoFocus
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setEditingCell((current) =>
                  current ? { ...current, value: nextValue } : current,
                );
              }}
              onBlur={handleCellCommit}
              onKeyDown={handleCellKeyDown}
            />
          );
        }

        return (
          <div
            className="cell-value"
            role="button"
            tabIndex={0}
            onDoubleClick={() =>
              setEditingCell({
                rowIndex,
                path: columnPath,
                value: formatCellValue(value),
              })
            }
            title={formatCellValue(value)}
          >
            <LinkedCellText text={formatCellValue(value)} />
          </div>
        );
      },
    }));
  }, [
    density.column,
    editingCell,
    flattened.columns,
    handleCellCommit,
    handleCellKeyDown,
  ]);

  const table = useReactTable({
    data: flattened.rows,
    columns,
    state: {
      globalFilter,
      columnFilters,
      columnSizing,
      sorting,
      columnVisibility: visibleColumns,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibleColumns,
    columnResizeMode: 'onChange',
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableRows = table.getRowModel().rows;
  const activeRowHeight = density.wrapCells
    ? wrappedRowHeightByDensity[density.row]
    : rowHeightByDensity[density.row];
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableParentRef.current,
    estimateSize: () => activeRowHeight,
    overscan: 12,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    rowVirtualizer.measure();
  }, [activeRowHeight, rowVirtualizer]);

  const appClassName = [
    'app-shell',
    density.wrapCells ? 'wrap-cells' : '',
    density.reduceTransparency ? 'reduce-transparency' : '',
    density.highContrast ? 'high-contrast' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const visibleColumnSizes = table
    .getVisibleLeafColumns()
    .map((column) => column.getSize());
  const visibleColumnIds = table.getVisibleLeafColumns().map((column) => column.id);
  const gridTemplateColumns = getGridTemplateColumns(visibleColumnSizes);
  const tableMinWidth = getTablePixelWidth(visibleColumnSizes);

  return (
    <main className={appClassName}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="workspace">
        <header className="topbar glass">
          <div className="file-meta">
            <div className="file-icon" aria-hidden="true">
              <FileJson size={22} />
            </div>
            <div>
              <h1>{fileState.name}</h1>
              <p>
                {fileState.rows.length.toLocaleString()} 行 ·{' '}
                {flattened.columns.length.toLocaleString()} 列
                {fileState.dirty ? ' · 有未保存修改' : ''}
              </p>
            </div>
          </div>

          <div className="toolbar">
            <IconButton label="打开 JSON" onClick={openFile}>
              <FolderOpen size={18} />
            </IconButton>
            <IconButton label="保存" onClick={saveFile} disabled={!fileState.dirty}>
              <Save size={18} />
            </IconButton>
            <IconButton label="另存为" onClick={saveAsFile}>
              <Download size={18} />
            </IconButton>
            <div className="search-field">
              <Search size={17} />
              <input
                value={globalFilter}
                placeholder="搜索全部列"
                onChange={(event) => setGlobalFilter(event.currentTarget.value)}
              />
              {globalFilter ? (
                <button
                  type="button"
                  aria-label="清除搜索"
                  onClick={() => setGlobalFilter('')}
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>
            <PanelButton
              active={activePanel === 'filters'}
              label="筛选"
              onClick={() => togglePanel('filters', setActivePanel)}
            >
              <ListFilter size={18} />
            </PanelButton>
            <PanelButton
              active={activePanel === 'columns'}
              label="列"
              onClick={() => togglePanel('columns', setActivePanel)}
            >
              <Columns3 size={18} />
            </PanelButton>
            <PanelButton
              active={activePanel === 'density'}
              label="显示"
              onClick={() => togglePanel('density', setActivePanel)}
            >
              <SlidersHorizontal size={18} />
            </PanelButton>
          </div>
        </header>

        {fileState.error ? (
          <div className="error-banner" role="alert">
            {fileState.error}
            <button
              type="button"
              aria-label="关闭错误提示"
              onClick={() =>
                setFileState((current) => ({ ...current, error: null }))
              }
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        <div className="panel-stack">
          {activePanel === 'filters' ? (
            <FiltersPanel
              columns={flattened.columns}
              columnFilters={columnFilters}
              onChangeFilter={(id, value) =>
                setColumnFilters((current) => upsertFilter(current, id, value))
              }
              onClear={() => {
                setColumnFilters([]);
                setGlobalFilter('');
              }}
            />
          ) : null}
          {activePanel === 'columns' ? (
            <ColumnsPanel
              columns={table.getAllLeafColumns()}
              frozenColumnIds={frozenColumnIds}
              visibleColumnIds={visibleColumnIds}
              onToggleFrozenColumn={(columnId) =>
                setFrozenColumnIds((current) =>
                  current.includes(columnId)
                    ? current.filter((item) => item !== columnId)
                    : [...current, columnId],
                )
              }
              onShowAll={() =>
                setVisibleColumns(
                  Object.fromEntries(flattened.columns.map((column) => [column, true])),
                )
              }
            />
          ) : null}
          {activePanel === 'density' ? (
            <DensityPanel density={density} onChange={setDensity} />
          ) : null}
        </div>

        <section className="table-surface" aria-label="JSON 表格">
          <div className="table-scroll" ref={tableParentRef}>
            <div className="table-grid" style={{ minWidth: `${tableMinWidth}px` }}>
              <div className="table-header" style={{ gridTemplateColumns }}>
                {table.getHeaderGroups()[0]?.headers.map((header) => (
                  <div
                    className={`table-th${
                      header.column.getIsResizing() ? ' is-resizing' : ''
                    } ${getFrozenColumnClass(
                      header.column.id,
                      frozenColumnIds,
                      visibleColumnIds,
                    )}`}
                    key={header.id}
                    style={
                      getFrozenColumnStyle(
                        header.column.id,
                        frozenColumnIds,
                        visibleColumnIds,
                        visibleColumnSizes,
                      )
                    }
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </span>
                      <SortIndicator direction={header.column.getIsSorted()} />
                    </button>
                    <button
                      className="column-resizer"
                      type="button"
                      aria-label={`调整 ${header.column.id} 列宽`}
                      title="拖拽调整列宽，双击恢复"
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        header.column.resetSize();
                      }}
                    />
                  </div>
                ))}
              </div>

              <div
                className="table-body-spacer"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
                {virtualRows.map((virtualRow) => {
                  const row = tableRows[virtualRow.index];
                  return (
                    <div
                      className="table-row"
                      key={row.id}
                      style={
                        {
                          '--row-y': `${virtualRow.start}px`,
                          '--row-height': `${activeRowHeight}px`,
                          gridTemplateColumns,
                        } as CSSProperties
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <div
                          className={`table-td ${getFrozenColumnClass(
                            cell.column.id,
                            frozenColumnIds,
                            visibleColumnIds,
                          )}`}
                          key={cell.id}
                          style={getFrozenColumnStyle(
                            cell.column.id,
                            frozenColumnIds,
                            visibleColumnIds,
                            visibleColumnSizes,
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <footer className="statusbar glass">
          <span>
            显示 {tableRows.length.toLocaleString()} /{' '}
            {fileState.rows.length.toLocaleString()} 行 ·{' '}
            {density.wrapCells ? '已换行' : '单行'}
          </span>
          <span>双击单元格编辑，Enter 保存，Esc 取消</span>
          <span>{supportsFileSystemAccess() ? '可覆盖保存' : '仅支持下载另存'}</span>
        </footer>
      </section>
    </main>
  );
}

function IconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PanelButton({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`panel-button${active ? ' is-active' : ''}`}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
      <ChevronDown size={14} />
    </button>
  );
}

function FiltersPanel({
  columns,
  columnFilters,
  onChangeFilter,
  onClear,
}: {
  columns: ColumnPath[];
  columnFilters: ColumnFiltersState;
  onChangeFilter: (id: string, value: string) => void;
  onClear: () => void;
}) {
  return (
    <aside className="floating-panel glass">
      <div className="panel-heading">
        <h2>列筛选</h2>
        <button type="button" onClick={onClear}>
          清除
        </button>
      </div>
      <div className="filter-grid">
        {columns.map((column) => (
          <label key={column}>
            <span>{column}</span>
            <input
              value={String(
                columnFilters.find((filter) => filter.id === column)?.value ?? '',
              )}
              onChange={(event) => onChangeFilter(column, event.currentTarget.value)}
              placeholder="包含..."
            />
          </label>
        ))}
      </div>
    </aside>
  );
}

function ColumnsPanel({
  columns,
  frozenColumnIds,
  visibleColumnIds,
  onToggleFrozenColumn,
  onShowAll,
}: {
  columns: ReturnType<ReturnType<typeof useReactTable<FlattenedRow>>['getAllLeafColumns']>;
  frozenColumnIds: ColumnPath[];
  visibleColumnIds: ColumnPath[];
  onToggleFrozenColumn: (columnId: ColumnPath) => void;
  onShowAll: () => void;
}) {
  return (
    <aside className="floating-panel glass compact-panel">
      <div className="panel-heading">
        <h2>显示列</h2>
        <button type="button" onClick={onShowAll}>
          全选
        </button>
      </div>
      <details className="freeze-dropdown">
        <summary>{formatFrozenColumnSummary(frozenColumnIds)}</summary>
        <div className="freeze-menu">
          {visibleColumnIds.map((columnId) => (
            <label key={columnId}>
              <input
                type="checkbox"
                checked={frozenColumnIds.includes(columnId)}
                onChange={() => onToggleFrozenColumn(columnId)}
              />
              <span>{columnId}</span>
            </label>
          ))}
        </div>
      </details>
      <div className="check-list">
        {columns.map((column) => (
          <label key={column.id}>
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
            />
            <span>{column.id}</span>
          </label>
        ))}
      </div>
    </aside>
  );
}

function formatFrozenColumnSummary(frozenColumnIds: ColumnPath[]) {
  if (!frozenColumnIds.length) return '冻结列';
  if (frozenColumnIds.length === 1) return `冻结：${frozenColumnIds[0]}`;
  return `冻结 ${frozenColumnIds.length} 列`;
}

function getFrozenColumnStyle(
  columnId: string,
  frozenColumnIds: string[],
  visibleColumnIds: string[],
  visibleColumnSizes: number[],
): CSSProperties | undefined {
  const offset = getFrozenColumnOffset(
    columnId,
    frozenColumnIds,
    visibleColumnIds,
    visibleColumnSizes,
  );
  return offset === null ? undefined : { right: `${offset}px` };
}

function LinkedCellText({ text }: { text: string }) {
  return (
    <>
      {extractTextLinks(text).map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`${index}-text`}>{segment.text}</span>;
        }

        return (
          <a
            className="cell-link"
            href={segment.href}
            key={`${index}-link`}
            target="_blank"
            rel="noreferrer"
            title="打开链接"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {segment.text}
            <ExternalLink size={12} />
          </a>
        );
      })}
    </>
  );
}

function DensityPanel({
  density,
  onChange,
}: {
  density: DensityState;
  onChange: (next: DensityState) => void;
}) {
  return (
    <aside className="floating-panel glass compact-panel">
      <div className="panel-heading">
        <h2>显示设置</h2>
      </div>
      <label className="switch-row">
        <input
          type="checkbox"
          checked={density.wrapCells}
          onChange={(event) =>
            onChange({ ...density, wrapCells: event.currentTarget.checked })
          }
        />
        <WrapText size={16} />
        <span>单元格内容换行</span>
      </label>
      <Segmented
        label="行距"
        value={density.row}
        options={[
          ['compact', '紧凑'],
          ['standard', '标准'],
          ['comfortable', '宽松'],
        ]}
        onChange={(row) => onChange({ ...density, row: row as RowDensity })}
      />
      <Segmented
        label="列距"
        value={density.column}
        options={[
          ['compact', '紧凑'],
          ['standard', '标准'],
          ['wide', '宽松'],
        ]}
        onChange={(column) =>
          onChange({ ...density, column: column as ColumnDensity })
        }
      />
      <label className="switch-row">
        <input
          type="checkbox"
          checked={density.reduceTransparency}
          onChange={(event) =>
            onChange({ ...density, reduceTransparency: event.currentTarget.checked })
          }
        />
        <span>减少透明度</span>
      </label>
      <label className="switch-row">
        <input
          type="checkbox"
          checked={density.highContrast}
          onChange={(event) =>
            onChange({ ...density, highContrast: event.currentTarget.checked })
          }
        />
        <span>高对比</span>
      </label>
    </aside>
  );
}

function Segmented({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <div className="segmented-group">
      <span>{label}</span>
      <div className="segmented">
        {options.map(([optionValue, optionLabel]) => (
          <button
            className={value === optionValue ? 'selected' : ''}
            type="button"
            key={optionValue}
            onClick={() => onChange(optionValue)}
          >
            {value === optionValue ? <Check size={14} /> : null}
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function SortIndicator({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (!direction) return <span className="sort-indicator">↕</span>;
  return <span className="sort-indicator">{direction === 'asc' ? '↑' : '↓'}</span>;
}

function togglePanel(
  panel: 'filters' | 'columns' | 'density',
  setActivePanel: React.Dispatch<
    React.SetStateAction<'filters' | 'columns' | 'density' | null>
  >,
) {
  setActivePanel((current) => (current === panel ? null : panel));
}

function upsertFilter(
  filters: ColumnFiltersState,
  id: string,
  value: string,
): ColumnFiltersState {
  const next = filters.filter((filter) => filter.id !== id);
  return value ? [...next, { id, value }] : next;
}

function mixedValueSort(
  rowA: { getValue: (columnId: string) => unknown },
  rowB: { getValue: (columnId: string) => unknown },
  columnId: string,
) {
  const a = rowA.getValue(columnId);
  const b = rowB.getValue(columnId);
  const numericA = typeof a === 'number' ? a : Number(a);
  const numericB = typeof b === 'number' ? b : Number(b);

  if (Number.isFinite(numericA) && Number.isFinite(numericB)) {
    return numericA - numericB;
  }

  return String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

function normalizeDataName(name: string) {
  return /\.jsonl?$/i.test(name) ? name : `${name}.json`;
}

function downloadRows(name: string, rows: JsonRow[]) {
  const format = getDocumentFormat(name);
  const blob = new Blob([
    format === 'jsonl' ? serializeJsonlRows(rows) : JSON.stringify(rows, null, 2),
  ], {
    type: format === 'jsonl' ? 'application/x-ndjson' : 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = normalizeDataName(name);
  anchor.click();
  URL.revokeObjectURL(url);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function supportsFileSystemAccess() {
  return Boolean(window.showOpenFilePicker && window.showSaveFilePicker);
}
