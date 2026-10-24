#!/usr/bin/env node
// tools/check-budgets.mjs — local perf-budget gate (Phase 5, no CI wiring).
//
// Gzips js/, css/ and index.html from the working tree and compares against
// the ceilings documented in docs/perf-budgets.md. Exits 0 when every budget
// holds, 1 with a table of offenders otherwise. No dependencies (node:zlib).
//
// Usage:
//   npm run check:budgets

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(TOOL_DIRECTORY, '..');

const BUDGET_TABLE = [
  // PR4 kept mainline js/ ≤ 220k / commands.js ≤ 64k and raised css/ 23k→23.5k:
  // the lazy-load `sparkline` module + panel styles are the delta (chart library rides the CDN).
  // PR15 (`spark`, terminal-native chart renderers) raised js/ 220,000→224,000:
  // the delta is the lazy js/spark.js module + the `spark` registry entry; no CSS, no CDN.
  // feat/uptime-live raises js/ 224,000→226,000: the delta is the shared
  // live-uptime ticker in commands.js (deploy-epoch clock + single-flight 1s
  // in-place rewrite for neofetch/uptime) plus the shell executeCommand stop
  // hook; no new modules, no CSS.
  // uptime-live follow-up (refit-safe ticker) raises js/ 226,000→226,500
  // and commands.js 64,000→64,600: the rows-below offset is a per-tick thunk
  // over live term.cols so a webfont refit can't strand a stale row.
  // feat/radar-goals raises js/ 226,500→228,000: the delta is the fixed-goal
  // radar normalization (RADAR_GOALS + last-365-day numerators) in
  // js/github-stats.js — no new modules, no CSS.
  // feat/activity-wide raises css/ 23,500→23,600: the delta is the wider
  // activity pane (1180px breakout + 2.2fr share, 10px cells, clip/auto
  // overflow) — no new sheets, no JS.
  // feat/blog-dx `ring` easter egg raises commands.js 64,600→65,000: the
  // delta is the unlisted registry entry + runRingCommand (ASCII art + 3
  // lines, no help row, no allowlist change — 36/34 goldens hold).
  // feat/blog-dx `ring` art upgrade raises js/ 228,000→229,000 and
  // commands.js 65,000→65,500: the 4-line glyph becomes a 23-line
  // converter-rendered ring-face seal (official art, mono SITE_WHITE).
  { label: 'js/ total', kind: 'directory', relativePath: 'js', extension: '.js', maxGzipBytes: 233000 },
  // feat/blog-dx `ring` art re-render raises commands.js 65,500→65,600:
  // the 50-wide seal rendered its 700x370 source pixel-faithful (no
  // cell-aspect correction), stretching the oval ~1.8x tall on 1:2
  // cells; the new 64x25 art is the same official Association crop
  // center-cut (neighbor rings + caption glow out) sampled at the
  // cell-corrected height, default charset (zero JS-escaping risk).
  // feat/blog-dx `ring` braille upgrade raises js/ 229,500→230,000 and
  // commands.js 65,600→66,200: the 23-line mono ASCII seal becomes a
  // 14-line braille seal (36 cols max, 72x56 dots, equalize + threshold
  // from the same face-tight official crop, mono SITE_WHITE, facts +
  // publishing-soon link order unchanged, still unlisted — 53/36 hold).
  // feat/blog-dx `ring` crest re-render raises js/ 230,000→230,600 and
  // commands.js 66,200→66,800 (measured gzip 66,376): the 13-line seal
  // becomes the 20-line bg-removed crest (52 cols max, -W 64 braille,
  // threshold 170, margin-trimmed, mono SITE_WHITE, facts +
  // publishing-soon link order unchanged, still unlisted — 53/36 hold).
  // feat/blog-dx `ring` art 65-wide raises js/ 230,600→231,200 and
  // commands.js 66,800→67,500 (measured gzip 66,981): the 20-line
  // 52-col crest becomes the 25-line 65-col crest (raw -W 81 braille
  // at threshold 170, margin-trimmed, mono SITE_WHITE, facts +
  // publishing-soon link order unchanged, still unlisted — 53/36 hold).
  // feat/blog-dx `ring` responsive dual art needs no bump (measured gzip
  // 67,401 under the 67,500 ceiling; js/ total 230,530 under 231,200):
  // both arts ship — 25-line 65-col crest at term.cols >= 75, 20-line
  // 52-col compact crest below/fallback — picked at runtime.
  // feat/blog-dx `ring` responsive dual art raises js/ 231,200→233,000
  // and commands.js 67,500→69,000 (measured gzip 68,426 / 232,105): both
  // arts ship (bytes ~ sum — the compact 20-liner duplicates the crest,
  // no shared encoding; the lazy tradeoff for zero runtime cost), picked
  // at runtime from term.cols, facts + link order unchanged, unlisted.
  { label: 'js/commands.js', kind: 'file', relativePath: 'js/commands.js', extension: null, maxGzipBytes: 69000 },
  // feat/blog-dx gallery carousel raises css/ 23,600→24,100 (measured gzip
  // 23,963): the delta is the .gallery/.gallery-nav block in doc.css (flex +
  // scroll-snap + thin themed scrollbar + reduced-motion opt-out) — the
  // carousel is CSS-only, no new sheets, no JS.
  { label: 'css/ total', kind: 'directory', relativePath: 'css', extension: '.css', maxGzipBytes: 24100 },
  { label: 'index.html', kind: 'file', relativePath: 'index.html', extension: null, maxGzipBytes: 10000 },
  // Blog extension (append-only, 2026-10-11): per-post HTML gzip ceiling +
  // blog image-total ceiling. Island-exclusion rule: blog islands (asciinema
  // player, Pagefind search UI) ship via shell.html __SCRIPTS__ as CDN/vendor
  // payloads inside generated blog HTML — never under js!/ — so the js/ total
  // above is unaffected by construction; the checker does not scan blog/ for
  // JS. No new deps (node:fs/zlib only); missing blog dirs measure 0 and pass.
  // Step 5–6 (2026-10-12): read-UX island JS is inline in __SCRIPTS__ (same
  // exclusion); image-total also scans generated blog/ output (responsive
  // <picture> variants under blog/<slug>/img/ + OG cards) — HTML/RSS/JSON
  // files there are untouched (image extensions only).
  // Gallery fallback (2026-10-14, App Q3 evidence): image-total 500,000→
  // 2,000,000 — 500k fits zero real photos (one 3024px hero ≈ 5.5 MB raw,
  // images barely gzip); 2 MB fits 1–2 photos + OG card while still gating
  // a 24-photo repeat of App P (gallery stays under the 1-hero rule).
  { label: 'blog/ per-post HTML (max gzip per file)', kind: 'max-per-file', relativePath: 'blog', extension: '.html', maxGzipBytes: 15000 },
  { label: 'blog images total', kind: 'image-total', relativePath: 'assets/blog,images/blog,blog', extension: null, maxGzipBytes: 2000000 },
];

function gzipSizeBytes(rawBuffer) {
  return gzipSync(rawBuffer).length;
}

const IMAGE_EXTENSIONS = new Set(['.avif', '.webp', '.jpg', '.jpeg', '.png', '.gif', '.svg']);

// Recursively collect files under dir matching extension (or any of extSet,
// or all files when both are null). Missing dirs yield [].
function collectFiles(dir, extension, extSet = null) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const out = [];
  for (const childName of readdirSync(dir).sort()) {
    const full = join(dir, childName);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectFiles(full, extension, extSet));
    } else if (extSet ? [...extSet].some((ext) => childName.endsWith(ext)) : (!extension || childName.endsWith(extension))) {
      out.push(full);
    }
  }
  return out;
}

function measureEntry(budgetEntry) {
  const absolutePath = join(SITE_ROOT, budgetEntry.relativePath);
  if (budgetEntry.kind === 'file') {
    const rawBytes = readFileSync(absolutePath);
    return { rawBytes: rawBytes.length, gzipBytes: gzipSizeBytes(rawBytes) };
  }
  if (budgetEntry.kind === 'max-per-file') {
    // Max gzip over every matching file under the dir (recursive). Missing
    // dir (no posts yet) or zero matches measures 0 and passes.
    const matches = collectFiles(absolutePath, budgetEntry.extension);
    let worst = { rawBytes: 0, gzipBytes: 0, file: '(no posts yet)' };
    for (const file of matches) {
      const rawBytes = readFileSync(file);
      const gzipBytes = gzipSizeBytes(rawBytes);
      if (gzipBytes > worst.gzipBytes) worst = { rawBytes: rawBytes.length, gzipBytes, file };
    }
    return worst;
  }
  if (budgetEntry.kind === 'image-total') {
    // Sum gzip over blog image dirs (comma-separated relativePaths). Missing
    // dirs count 0 — put post images under assets/blog/ or images/blog/.
    let rawTotal = 0;
    let gzipTotal = 0;
    for (const rel of budgetEntry.relativePath.split(',')) {
      const dir = join(SITE_ROOT, rel);
      for (const file of collectFiles(dir, null, IMAGE_EXTENSIONS)) {
        const childBytes = readFileSync(file);
        rawTotal += childBytes.length;
        gzipTotal += gzipSizeBytes(childBytes);
      }
    }
    return { rawBytes: rawTotal, gzipBytes: gzipTotal };
  }
  let rawTotal = 0;
  let gzipTotal = 0;
  const childNames = readdirSync(absolutePath).filter((childName) => childName.endsWith(budgetEntry.extension)).sort();
  for (const childName of childNames) {
    const childBytes = readFileSync(join(absolutePath, childName));
    rawTotal += childBytes.length;
    gzipTotal += gzipSizeBytes(childBytes);
  }
  return { rawBytes: rawTotal, gzipBytes: gzipTotal };
}

let breachCount = 0;
for (const budgetEntry of BUDGET_TABLE) {
  const measured = measureEntry(budgetEntry);
  const holding = measured.gzipBytes <= budgetEntry.maxGzipBytes;
  if (!holding) breachCount += 1;
  const statusText = holding ? 'OK  ' : 'OVER';
  const detail = measured.file ? ` [worst: ${measured.file}]` : '';
  process.stdout.write(`${statusText} ${budgetEntry.label}: gzip ${measured.gzipBytes} / budget ${budgetEntry.maxGzipBytes} (raw ${measured.rawBytes})${detail}\n`);
}

if (breachCount > 0) {
  process.stderr.write(`check-budgets: ${breachCount} budget(s) breached — see docs/perf-budgets.md\n`);
  process.exit(1);
}
process.stdout.write('check-budgets: all budgets hold\n');
