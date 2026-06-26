export type TextLinkSegment =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; href: string };

const LINK_PATTERN = /\b(?:https?:\/\/[^\s<>"'，。；：！？（）]+|mailto:[^\s<>"'，。；：！？（）]+)/gi;
const TRAILING_PUNCTUATION_PATTERN = /[),.;:!?，。；：！？）]+$/;

export function extractTextLinks(text: string): TextLinkSegment[] {
  const segments: TextLinkSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const trailing = raw.match(TRAILING_PUNCTUATION_PATTERN)?.[0] ?? '';
    const linkText = trailing ? raw.slice(0, -trailing.length) : raw;

    if (!linkText) continue;
    if (start > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, start) });
    }
    segments.push({ type: 'link', text: linkText, href: linkText });
    cursor = start + linkText.length;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) });
  }

  return segments.length ? segments : [{ type: 'text', text }];
}
