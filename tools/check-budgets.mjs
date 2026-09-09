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
const SITE_ROOT = join(TOOL_DIRECTORY, `..`);

const BUDGET_TABLE = [
  { label: `js/ total`, kind: `directory`, relativePath: `js`, extension: `.js`, maxGzipBytes: 215000 },
  { label: `js/commands.js`, kind: `file`, relativePath: `js/commands.js`, extension: null, maxGzipBytes: 60000 },
  { label: `css/ total`, kind: `directory`, relativePath: `css`, extension: `.css`, maxGzipBytes: 23000 },
  { label: `index.html`, kind: `file`, relativePath: `index.html`, extension: null, maxGzipBytes: 10000 },
];

function gzipSizeBytes(rawBuffer) {
  return gzipSync(rawBuffer).length;
}

function measureEntry(budgetEntry) {
  const absolutePath = join(SITE_ROOT, budgetEntry.relativePath);
  if (budgetEntry.kind === `file`) {
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
  const statusText = holding ? `OK  ` : `OVER`;
  process.stdout.write(`${statusText} ${budgetEntry.label}: gzip ${measured.gzipBytes} / budget ${budgetEntry.maxGzipBytes} (raw ${measured.rawBytes})\n`);
}

if (breachCount > 0) {
  process.stderr.write(`check-budgets: ${breachCount} budget(s) breached — see docs/perf-budgets.md\n`);
  process.exit(1);
}
process.stdout.write(`check-budgets: all budgets hold\n`);
