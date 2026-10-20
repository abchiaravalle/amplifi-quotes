import { FilterXSS } from 'xss';

/**
 * Server-side rich-text sanitizer (SEC-5). Allowlist of tags/attributes used by letters, scope, terms,
 * content blocks and comments. Everything else is stripped; text is kept.
 */
const ALLOWED: Record<string, string[]> = {
  p: [],
  br: [],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  s: [],
  h2: [],
  h3: [],
  h4: [],
  ul: [],
  ol: ['start'],
  li: [],
  blockquote: [],
  a: ['href', 'title'],
  table: [],
  thead: [],
  tbody: [],
  tr: [],
  th: ['colspan', 'rowspan'],
  td: ['colspan', 'rowspan'],
  hr: [],
  code: [],
  span: [],
};

const filter = new FilterXSS({
  whiteList: ALLOWED,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'noscript'],
  allowCommentTag: false,
  onTagAttr(tag, name, value) {
    if (tag === 'a' && name === 'href') {
      const v = value.trim();
      if (/^(https?:|mailto:|tel:)/i.test(v))
        return `href="${v.replace(/"/g, '&quot;')}" rel="noopener noreferrer"`;
      return '';
    }
    return undefined;
  },
  safeAttrValue(tag, name, value) {
    if (tag === 'a' && name === 'href' && !/^(https?:|mailto:|tel:)/i.test(value.trim())) return '';
    return value;
  },
});

export function sanitizeHtml(html: string | null | undefined, maxLength = 200_000): string {
  if (!html) return '';
  return filter.process(String(html).slice(0, maxLength));
}

/** Plain text: strips every tag. For names, titles, single-line fields. */
export function plainText(s: string | null | undefined, maxLength = 2_000): string {
  if (!s) return '';
  return (
    String(s)
      .replace(/<[^>]*>/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .slice(0, maxLength)
      .trim()
  );
}

/** Merge fields like {customer.name}. Unknown fields are reported, not silently dropped (QB-9). */
export function findMergeFields(html: string): string[] {
  return [...new Set([...html.matchAll(/\{([a-z_]+(?:\.[a-z_]+)+)\}/gi)].map((m) => m[1]!))];
}

export function fillMergeFields(html: string, values: Record<string, string>): string {
  return html.replace(/\{([a-z_]+(?:\.[a-z_]+)+)\}/gi, (whole, key: string) => {
    const v = values[key];
    return v === undefined ? whole : escapeHtml(v);
  });
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
