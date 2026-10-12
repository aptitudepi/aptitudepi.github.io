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
  { label: 'js/ total', kind: 'directory', relativePath: 'js', extension: '.js', maxGzipBytes: 228000 },
  { label: 'js/commands.js', kind: 'file', relativePath: 'js/commands.js', extension: null, maxGzipBytes: 64600 },
  { label: 'css/ total', kind: 'directory', relativePath: 'css', extension: '.css', maxGzipBytes: 23600 },
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
  { label: 'blog/ per-post HTML (max gzip per file)', kind: 'max-per-file', relativePath: 'blog', extension: '.html', maxGzipBytes: 15000 },
  { label: 'blog images total', kind: 'image-total', relativePath: 'assets/blog,images/blog,blog', extension: null, maxGzipBytes: 500000 },
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
