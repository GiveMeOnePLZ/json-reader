import { describe, expect, it } from 'vitest';
import {
  getFrozenColumnOffset,
  getFrozenColumnClass,
  getGridTemplateColumns,
  getTablePixelWidth,
} from './tableLayout';

describe('tableLayout', () => {
  it('builds fixed pixel columns from current column sizes', () => {
    expect(getGridTemplateColumns([120, 240, 180])).toBe('120px 240px 180px');
  });

  it('sums column sizes for the scrollable table width', () => {
    expect(getTablePixelWidth([120, 240, 180])).toBe(540);
  });

  it('keeps an empty table width safe', () => {
    expect(getGridTemplateColumns([])).toBe('');
    expect(getTablePixelWidth([])).toBe(0);
  });

  it('marks every selected visible column as frozen', () => {
    const columns = ['id', 'name', 'source.url'];

    expect(getFrozenColumnClass('name', ['id', 'name'], columns)).toBe(
      'is-frozen-column',
    );
    expect(getFrozenColumnClass('id', ['id', 'name'], columns)).toBe(
      'is-frozen-column',
    );
    expect(getFrozenColumnClass('source.url', ['id', 'name'], columns)).toBe('');
  });

  it('does not freeze a hidden or cleared column selection', () => {
    const columns = ['id', 'name'];

    expect(getFrozenColumnClass('source.url', ['source.url'], columns)).toBe('');
    expect(getFrozenColumnClass('name', [], columns)).toBe('');
  });

  it('computes right offsets for multiple frozen columns in visible-column order', () => {
    const columns = ['id', 'name', 'source.url', 'status'];
    const sizes = [80, 160, 260, 120];
    const frozen = ['id', 'source.url'];

    expect(getFrozenColumnOffset('source.url', frozen, columns, sizes)).toBe(0);
    expect(getFrozenColumnOffset('id', frozen, columns, sizes)).toBe(260);
    expect(getFrozenColumnOffset('name', frozen, columns, sizes)).toBeNull();
  });
});
