import { describe, expect, it } from 'vitest';
import { constantTimeEqual } from '../../src/worker/lib/crypto';
import { sanitizeSvg, sniffMime } from '../../src/worker/lib/files';
import { fillMergeFields, findMergeFields, plainText, sanitizeHtml } from '../../src/worker/lib/sanitize';

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<svg onload=alert(1)>',
  '<iframe src="https://evil"></iframe>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
  '<a href="data:text/html,<script>alert(1)</script>">x</a>',
];

describe('rich text sanitizer (SEC-5)', () => {
  it.each(PAYLOADS)('neutralizes %s', (p) => {
    const out = sanitizeHtml(p);
    expect(out).not.toMatch(/<script|onerror|onload|javascript:|<iframe|<svg|data:text\/html/i);
  });
  it('keeps allowed formatting', () => {
    const out = sanitizeHtml(
      '<h2>Scope</h2><p><strong>Bold</strong> <a href="https://x.com">link</a></p><ul><li>a</li></ul>',
    );
    expect(out).toContain('<h2>Scope</h2>');
    expect(out).toContain('<strong>Bold</strong>');
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain('<li>a</li>');
  });
  it('strips tags from plain text fields', () => {
    expect(plainText('<b>Acme</b> Co')).toBe('Acme Co');
  });
});

describe('merge fields (QB-9)', () => {
  it('finds and fills merge fields, escaping values', () => {
    const html = '<p>Hi {customer.name}, valid until {quote.valid_until}</p>';
    expect(findMergeFields(html)).toEqual(['customer.name', 'quote.valid_until']);
    expect(fillMergeFields(html, { 'customer.name': '<Acme>', 'quote.valid_until': '2026-11-30' })).toBe(
      '<p>Hi &lt;Acme&gt;, valid until 2026-11-30</p>',
    );
  });
});

describe('upload checks (SEC-6)', () => {
  it('detects type from contents, not the name', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffMime(png, 'evil.pdf')).toBe('image/png');
    const pdf = new TextEncoder().encode('%PDF-1.7 ...');
    expect(sniffMime(pdf, 'x.png')).toBe('application/pdf');
  });
  it('strips scripts and handlers from SVG', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><a xlink:href="javascript:alert(3)"><rect/></a><foreignObject><div>x</div></foreignObject></svg>';
    const clean = sanitizeSvg(svg);
    expect(clean).not.toMatch(/script|onload|javascript:|foreignObject/i);
    expect(clean).toContain('<rect/>');
  });
});

describe('constant-time compare (SEC-8)', () => {
  it('compares equal and unequal strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});
