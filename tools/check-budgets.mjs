#!/usr/bin/env node
// tools/check-budgets.mjs — local perf-budget gate (Phase 5, no CI wiring).
//
// Gzips js/, css/ and index.html from the working tree and compares against
// the ceilings documented in docs/perf-budgets.md. Exits 0 when every budget
// holds, 1 with a table of offenders otherwise. No dependencies (node:zlib).
//
// Usage:
//   npm run check:budgets

import { readdirSync, readFileSync } from 'node:fs';
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
];

function gzipSizeBytes(rawBuffer) {
  return gzipSync(rawBuffer).length;
}

function measureEntry(budgetEntry) {
  const absolutePath = join(SITE_ROOT, budgetEntry.relativePath);
  if (budgetEntry.kind === 'file') {
    const rawBytes = readFileSync(absolutePath);
    return { rawBytes: rawBytes.length, gzipBytes: gzipSizeBytes(rawBytes) };
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
  process.stdout.write(`${statusText} ${budgetEntry.label}: gzip ${measured.gzipBytes} / budget ${budgetEntry.maxGzipBytes} (raw ${measured.rawBytes})\n`);
}

if (breachCount > 0) {
  process.stderr.write(`check-budgets: ${breachCount} budget(s) breached — see docs/perf-budgets.md\n`);
  process.exit(1);
}
process.stdout.write('check-budgets: all budgets hold\n');
