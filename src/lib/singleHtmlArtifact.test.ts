import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const artifactPath = resolve(process.cwd(), 'json-viewer.html');
const publishArtifactPath = resolve(process.cwd(), 'publish-json-reader', 'index.html');

describe('single HTML artifact', () => {
  it('ships as a standalone offline HTML file', () => {
    const html = readFileSync(artifactPath, 'utf8');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('JSON');
    expect(html).not.toMatch(/<script\s+[^>]*src=/i);
    expect(html).not.toMatch(/<link\s+[^>]*href=["']https?:\/\//i);
    expect(html).not.toMatch(/https?:\/\/(?:cdn|fonts|unpkg|jsdelivr|google)/i);
    expect(html).toContain('class="menu-shell"');
    expect(html).toContain('id="fileTabs"');
    expect(html).toContain('id="btnFreezeHeader"');
    expect(html).toContain('id="btnFreezeColumn"');
    expect(html).toContain('id="freezeColumnDropdown"');
    expect(html).toContain('id="freezeColumnList"');
    expect(html).toContain('data-close-doc');
    expect(html).toContain('function closeDocument');
    expect(html).toContain('function linkifyText');
    expect(html).toContain('multiple>');
    expect(html).toContain('.jsonl');
    expect(html).toContain('function parseJsonlRows');
    expect(html).toContain('JSONL 第 ');
  });
});

describe('published single HTML artifact', () => {
  it('accepts JSONL files and retains their format on save', () => {
    const html = readFileSync(publishArtifactPath, 'utf8');

    expect(html).toContain('.jsonl');
    expect(html).toContain('function parseJsonlRows');
    expect(html).toContain('JSONL 第 ');
  });
});
