import { describe, expect, it } from 'vitest';
import { extractTextLinks } from './linkTools';

describe('extractTextLinks', () => {
  it('extracts http, https, and mailto links while preserving surrounding text', () => {
    expect(
      extractTextLinks('来源：https://example.com/a?x=1，联系 mailto:team@example.com'),
    ).toEqual([
      { type: 'text', text: '来源：' },
      { type: 'link', text: 'https://example.com/a?x=1', href: 'https://example.com/a?x=1' },
      { type: 'text', text: '，联系 ' },
      { type: 'link', text: 'mailto:team@example.com', href: 'mailto:team@example.com' },
    ]);
  });

  it('trims trailing punctuation from detected links', () => {
    expect(extractTextLinks('见 https://example.com/report).')).toEqual([
      { type: 'text', text: '见 ' },
      { type: 'link', text: 'https://example.com/report', href: 'https://example.com/report' },
      { type: 'text', text: ').' },
    ]);
  });

  it('returns one text segment when no link is present', () => {
    expect(extractTextLinks('没有链接')).toEqual([{ type: 'text', text: '没有链接' }]);
  });
});
