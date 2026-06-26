export function getGridTemplateColumns(sizes: number[]): string {
  return sizes.map((size) => `${Math.max(0, Math.round(size))}px`).join(' ');
}

export function getTablePixelWidth(sizes: number[]): number {
  return sizes.reduce((total, size) => total + Math.max(0, Math.round(size)), 0);
}

export function getFrozenColumnClass(
  columnId: string,
  frozenColumnIds: string[],
  visibleColumnIds: string[],
): string {
  const visibleFrozenColumnIds = getVisibleFrozenColumnIds(
    frozenColumnIds,
    visibleColumnIds,
  );
  return visibleFrozenColumnIds.includes(columnId) ? 'is-frozen-column' : '';
}

export function getFrozenColumnOffset(
  columnId: string,
  frozenColumnIds: string[],
  visibleColumnIds: string[],
  visibleColumnSizes: number[],
): number | null {
  const visibleFrozenColumnIds = getVisibleFrozenColumnIds(
    frozenColumnIds,
    visibleColumnIds,
  );
  if (!visibleFrozenColumnIds.includes(columnId)) return null;

  const columnIndex = visibleColumnIds.indexOf(columnId);
  return visibleColumnIds
    .slice(columnIndex + 1)
    .reduce((offset, nextColumnId, nextOffset) => {
      if (!visibleFrozenColumnIds.includes(nextColumnId)) return offset;
      return offset + Math.max(0, Math.round(visibleColumnSizes[columnIndex + 1 + nextOffset] ?? 0));
    }, 0);
}

export function getVisibleFrozenColumnIds(
  frozenColumnIds: string[],
  visibleColumnIds: string[],
): string[] {
  const selected = new Set(frozenColumnIds);
  return visibleColumnIds.filter((columnId) => selected.has(columnId));
}
