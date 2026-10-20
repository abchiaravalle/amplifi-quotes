#!/usr/bin/env python3
"""Build SPEC.md from docs/spec/0*.md and render it on the amplifi letterhead.

Usage: python3 docs/spec/build_pdf.py [out.pdf]
Needs: pandoc, and the amplifi-pdf-templates skill renderer (render_pdf.py).
"""
import glob, os, re, subprocess, sys, html

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPEC_DIR = os.path.join(ROOT, "docs", "spec")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "amplifi-Quotes-Spec-v0.1.pdf")
RENDER = os.path.expanduser("~/.hermes/skills/productivity/amplifi-pdf-templates/scripts/render_pdf.py")

parts = sorted(glob.glob(os.path.join(SPEC_DIR, "0*.md")))
md = "\n\n".join(open(p, encoding="utf-8").read().rstrip() for p in parts) + "\n"
open(os.path.join(ROOT, "SPEC.md"), "w", encoding="utf-8").write(md)

# Title block comes from the first two lines; the rest is body.
lines = md.splitlines()
title = lines[0].lstrip("# ").strip()
subtitle = lines[2].strip() if len(lines) > 2 else ""
body_md = "\n".join(lines[3:])

body = subprocess.run(["pandoc", "-f", "gfm", "-t", "html5", "--wrap=none"],
                      input=body_md, capture_output=True, text=True, check=True).stdout

# Letterhead classes: tables, numbered h2s, compact wide tables, code blocks.
body = body.replace("<table>", '<table class="amp-table">')
def h2(m):
    inner = m.group(2)
    num = re.match(r"(\d+)\.\s+(.*)", inner)
    if num:
        return f'<h2{m.group(1)}><span class="amp-h2-num">{int(num.group(1)):02d}</span>{num.group(2)}</h2>'
    app = re.match(r"(Appendix [A-Z])\.\s+(.*)", inner)
    if app:
        return f'<h2 class="amp-pb"{m.group(1)}><span class="amp-h2-num">{app.group(1)}</span>{app.group(2)}</h2>'
    return m.group(0)
body = re.sub(r"<h2([^>]*)>(.*?)</h2>", h2, body)
# 4+ column tables get the compact class so phrase cells fit.
def compact(m):
    t = m.group(0)
    head = re.search(r"<thead>(.*?)</thead>", t, re.S)
    if head and len(re.findall(r"<th(?:\s[^>]*)?>", head.group(1))) >= 4:
        t = t.replace('<table class="amp-table">', '<table class="amp-table amp-compact">', 1)
    return t
body = re.sub(r'<table class="amp-table">.*?</table>', compact, body, flags=re.S)
def wraplast(m):
    t = m.group(0)
    ths = re.findall(r"<th(?:\s[^>]*)?>(.*?)</th>", t, re.S)
    if not ths or ths[-1].strip() not in ("Phase", "O", "A", "P", "Ap", "S", "V", "C", "Per month", "Weeks"):
        t = re.sub(r'<table class="amp-table( amp-compact)?">', lambda x: x.group(0)[:-2] + ' amp-wrap-last">', t, count=1)
    if ths and ths[0].strip() in ("ID", "Phase"):
        t = re.sub(r'<table class="amp-table([^"]*)">', lambda x: '<table class="amp-table' + x.group(1) + ' amp-idcol">', t, count=1)
    return t
body = re.sub(r'<table class="amp-table[^"]*">.*?</table>', wraplast, body, flags=re.S)
body = body.replace("<pre>", '<pre class="amp-code">')

frag = f"""
<style>
table.amp-table.amp-idcol td:first-child, table.amp-table.amp-idcol th:first-child {{ white-space:nowrap; }}
table.amp-table td:last-child, table.amp-table th:last-child {{ white-space:nowrap; }}
table.amp-table.amp-wrap-last td:last-child {{ white-space:normal; }}
</style>
<div class="amp-running-header">
  <img class="amp-rh-logo" src="{{{{LOGO_DARK}}}}" alt="amplifi.studio">
  <span class="amp-rh-doc">Product Specification · amplifi Quotes</span>
</div>
<span class="amp-confidential-source">Confidential, ACWebDev, LLC</span>

<div class="amp-masthead">
  <img class="amp-logo" src="{{{{LOGO_WHITE}}}}" alt="amplifi.studio">
  <div class="amp-mh-right">
    <span class="amp-mh-bar">Product Specification</span><br>
    <strong>amplifi Quotes</strong><br>
    October 20, 2026
  </div>
</div>

<span class="amp-doctype">Product Specification</span>
<h1 class="amp-title">{html.escape(title)}</h1>
<p class="amp-subtitle">{html.escape(subtitle)}</p>

{body}

<div class="amp-close">
  <img class="amp-close-logo" src="{{{{LOGO_WHITE}}}}" alt="amplifi.studio">
  <div>amplifi Quotes product specification, version 0.1<br>
  <span class="amp-green">amplifi.studio</span> · hello@amplifi.studio</div>
</div>
"""
frag = frag.replace("\u2014", ", ").replace("\u2013", "-")
fp = os.path.join("/tmp", "amplifi-quotes-spec-fragment.html")
open(fp, "w", encoding="utf-8").write(frag)
subprocess.run([sys.executable if os.path.exists(sys.executable) else "python3", RENDER, fp, OUT,
                "--title", "amplifi Quotes · Product Specification"], check=True)
print("PDF:", OUT)
