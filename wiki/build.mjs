#!/usr/bin/env node
/* Enflow Wiki üretici — TEK doğruluk kaynağı: walkthrough.md §27.
 * Kullanım: node wiki/build.mjs   →  wiki/index.html üretir.
 * Akış değişince: önce §27'yi güncelle, sonra bunu çalıştır. Bağımlılık yok.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'walkthrough.md');
const OUT = join(HERE, 'index.html');

// ── 1) §27 bloğunu ayıkla ────────────────────────────────────────────────────
const md = readFileSync(SRC, 'utf-8');
const startIdx = md.indexOf('## 27.');
if (startIdx === -1) { console.error('§27 bulunamadı (walkthrough.md).'); process.exit(1); }
let block = md.slice(startIdx);
// Kapanış: içerik sonrası ilk yatay çizgi (---) — date italiğinden önce.
const endIdx = block.indexOf('\n---');
if (endIdx !== -1) block = block.slice(0, endIdx);
const lines = block.split('\n');

// ── 2) Inline markdown → HTML ────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<b>${c}</b>`);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  return out;
}

// ── 3) Blok seviyesi parser (paragraf/tablo/liste/quote/fenced) ──────────────
function renderBody(bodyLines) {
  const html = [];
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    if (!line.trim()) { i++; continue; }

    // Fenced kod / ASCII bloğu
    if (line.startsWith('```')) {
      const buf = [];
      i++;
      while (i < bodyLines.length && !bodyLines[i].startsWith('```')) { buf.push(bodyLines[i]); i++; }
      i++; // kapanış ```
      html.push(`<pre class="code">${esc(buf.join('\n'))}</pre>`);
      continue;
    }
    // Blockquote (ardışık > ...) → note kutusu
    if (line.startsWith('>')) {
      const buf = [];
      while (i < bodyLines.length && bodyLines[i].startsWith('>')) { buf.push(bodyLines[i].replace(/^>\s?/, '')); i++; }
      const txt = buf.join(' ').trim();
      const amber = /⚙️|⚠️|Not\b/.test(txt) ? ' amber' : '';
      html.push(`<div class="note${amber}">${inline(txt)}</div>`);
      continue;
    }
    // Tablo (| ... | ve sonraki satır ayraç)
    if (line.includes('|') && i + 1 < bodyLines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(bodyLines[i + 1])) {
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2; // başlık + ayraç
      const rows = [];
      while (i < bodyLines.length && bodyLines[i].includes('|') && bodyLines[i].trim()) { rows.push(cells(bodyLines[i])); i++; }
      const th = head.map((h) => `<th>${inline(h)}</th>`).join('');
      const trs = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
      html.push(`<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`);
      continue;
    }
    // Liste (- / *)
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < bodyLines.length && /^\s*[-*]\s+/.test(bodyLines[i])) { items.push(bodyLines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      html.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`);
      continue;
    }
    // Paragraf (ardışık düz satırlar)
    const para = [];
    while (i < bodyLines.length && bodyLines[i].trim() && !bodyLines[i].startsWith('```') && !bodyLines[i].startsWith('>') && !/^\s*[-*]\s+/.test(bodyLines[i]) && !bodyLines[i].startsWith('###')) {
      para.push(bodyLines[i]); i++;
    }
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return html.join('\n');
}

// ── 4) Üst-bilgi (scale pills) + bölümlere ayır ──────────────────────────────
let scalePills = '';
const scaleLine = lines.find((l) => /Ölçek .*\*\*/.test(l));
if (scaleLine) {
  const m = scaleLine.match(/\*\*(.+?)\*\*/);
  if (m) {
    scalePills = m[1].replace(/\.$/, '').split('·').map((p) => {
      const t = p.trim();
      const nm = t.match(/^([\d+]+)\s+(.*)$/);
      return nm ? `<span class="pill"><b>${nm[1]}</b> ${esc(nm[2])}</span>` : `<span class="pill">${esc(t)}</span>`;
    }).join('');
  }
}

// ### 27.x bölümleri
const sections = [];
for (let i = 0; i < lines.length; i++) {
  const h = lines[i].match(/^###\s+(27\.\d+)\s+(.*)$/);
  if (h) {
    const body = [];
    let j = i + 1;
    while (j < lines.length && !/^###\s+27\./.test(lines[j])) { body.push(lines[j]); j++; }
    sections.push({ num: h[1], title: h[2].trim(), id: 's' + h[1].replace('.', '-'), body });
    i = j - 1;
  }
}

const toc = sections.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join('\n      ');
const body = sections.map((s) =>
  `<section id="${s.id}">\n  <h2><span class="n">${s.num.replace('27.', '')}</span>${esc(s.title)}</h2>\n  ${renderBody(s.body)}\n</section>`
).join('\n\n');

// ── 5) Şablon (stil) + yaz ───────────────────────────────────────────────────
const CSS = `
  :root{--bg:#0b1220;--panel:#111a2b;--card:#0f1828;--line:#1e2c44;--txt:#e6edf6;--muted:#9fb0c7;
    --primary:#16a34a;--primary-2:#22c55e;--accent:#38bdf8;--amber:#f59e0b;--chip:#16233a;--radius:14px;--maxw:1180px;}
  *{box-sizing:border-box} html{scroll-behavior:smooth}
  body{margin:0;background:linear-gradient(180deg,#0b1220,#0c1424);color:var(--txt);
    font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif;}
  a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
  code{background:#0c1626;border:1px solid var(--line);border-radius:6px;padding:.1em .4em;font-size:.85em;color:#cbd5e1}
  .wrap{display:grid;grid-template-columns:280px 1fr;max-width:var(--maxw);margin:0 auto}
  aside{position:sticky;top:0;height:100vh;overflow:auto;padding:26px 18px;border-right:1px solid var(--line);background:#0a111e}
  .brand{display:flex;align-items:center;gap:10px} .logo{width:38px;height:38px;border-radius:11px;
    background:linear-gradient(135deg,var(--primary),var(--primary-2));display:grid;place-items:center;font-weight:800;color:#04210f;font-size:20px}
  .brand b{font-size:18px} .brand small{display:block;color:var(--muted);font-size:11px;letter-spacing:2px;text-transform:uppercase}
  .toc{margin-top:18px;font-size:13.5px} .toc a{display:block;color:var(--muted);padding:6px 10px;border-radius:8px;border-left:2px solid transparent}
  .toc a:hover{background:#0e1828;color:var(--txt);text-decoration:none}
  .toc a.active{color:#fff;background:#0e1f17;border-left-color:var(--primary-2)}
  main{padding:42px 46px 120px;min-width:0}
  .hero{background:radial-gradient(900px 300px at 0% -10%,rgba(34,197,94,.18),transparent),var(--panel);
    border:1px solid var(--line);border-radius:var(--radius);padding:34px 32px;margin-bottom:34px}
  .hero h1{margin:.1em 0 .3em;font-size:30px;line-height:1.15}
  .hero p{color:var(--muted);max-width:74ch}
  .pill{display:inline-block;background:var(--chip);border:1px solid var(--line);color:var(--muted);
    font-size:12px;border-radius:999px;padding:4px 11px;margin:6px 6px 0 0} .pill b{color:var(--primary-2)}
  section{scroll-margin-top:18px;margin:0 0 38px}
  h2{font-size:22px;margin:0 0 10px} h2 .n{color:var(--primary-2);font-weight:700;margin-right:10px}
  p{max-width:80ch} h2 + p{color:var(--muted)}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13.5px;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  th{background:#0c1626;color:#bcd;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.4px}
  tr:last-child td{border-bottom:none}
  ul{margin:10px 0;padding-left:20px} li{margin:4px 0;color:#d6e2f0}
  pre.code{background:#0a1422;border:1px solid var(--line);border-left:3px solid var(--primary-2);border-radius:10px;
    padding:14px 16px;overflow:auto;font-size:12.5px;line-height:1.5;color:#bcd}
  .note{background:#0e1a16;border:1px solid #1d3a28;border-left:3px solid var(--primary-2);border-radius:10px;
    padding:13px 16px;margin:14px 0;color:#cfe9da;font-size:14px}
  .note.amber{background:#1c160a;border-color:#473410;border-left-color:var(--amber);color:#f5e6c8}
  footer{color:#5b6c83;font-size:12.5px;border-top:1px solid var(--line);padding-top:18px;margin-top:30px}
  @media(max-width:880px){.wrap{grid-template-columns:1fr}aside{position:static;height:auto;border-right:none;border-bottom:1px solid var(--line)}main{padding:28px 20px 80px}}
`;

// Tarih §27 kaynağından (deterministik çıktı — her üretimde dosya değişmesin).
const dateStr = (scaleLine && scaleLine.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1]) || '—';
const out = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Enflow Wiki — Uçtan Uca Kılavuz</title>
<meta name="description" content="Enflow süreç yönetim platformunu hiç bilmeyen birine baştan sona anlatan statik kılavuz." />
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <aside>
    <div class="brand"><div class="logo">⚡</div><div><b>Enflow</b><small>Wiki · Kılavuz</small></div></div>
    <nav class="toc" id="toc">
      ${toc}
    </nav>
  </aside>
  <main>
    <div class="hero">
      <h1>Enflow — uçtan uca süreç yönetimi</h1>
      <p>Bir işin müşteri ilgisinden (fırsat) başlayıp teklif → sözleşme → proje → satınalma → faturalamaya kadar tüm yolculuğunu tek platformda yöneten, çok-kiracılı kurumsal yazılım. Bu sayfa yazılımı <b>hiç bilmeyen</b> birine baştan sona anlatır.</p>
      <div>${scalePills}</div>
    </div>

    ${body}

    <footer>Enflow Wiki · kaynağı <code>walkthrough.md §27</code> (tek doğruluk kaynağı) · <code>node wiki/build.mjs</code> ile üretildi · ${dateStr}.</footer>
  </main>
</div>
<script>
  const links=[...document.querySelectorAll('.toc a')];
  const map=new Map(links.map(a=>[a.getAttribute('href').slice(1),a]));
  const obs=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){links.forEach(l=>l.classList.remove('active'));const a=map.get(e.target.id);if(a)a.classList.add('active');}}),{rootMargin:'-20% 0px -70% 0px'});
  document.querySelectorAll('section[id]').forEach(s=>obs.observe(s));
</script>
</body>
</html>`;

writeFileSync(OUT, out);
console.log(`✓ wiki/index.html üretildi — ${sections.length} bölüm, ${out.length} bayt (kaynak: walkthrough.md §27).`);
