#!/usr/bin/env bun
// build-pdf.mjs — compile assets/resume.pdf and assets/cv.pdf from Full-CV
// TeX using Tectonic (XeTeX). The source contains pdfTeX-only lines
// (\pdfgentounicode, \input{glyphtounicode}) that Tectonic rejects, so they
// are stripped before compiling.
//
// IMPORTANT: this build must FAIL LOUD. Tectonic downloads fonts/packages
// from its remote bundle on demand; a flaky fetch previously combined with
// `-Z continue-on-errors` to silently drop resume sections while still
// exiting 0. We therefore run WITHOUT continue-on-errors and retry the whole
// compile on transient network failures.
//
//   FULL_CV_DIR=/path/to/Full-CV bun tools/build-pdf.mjs

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(__dirname, '..');
const FULL_CV = resolve(process.env.FULL_CV_DIR || join(SITE, '..', 'Full-CV'));
const BUILD_DIR = join(SITE, '.build');
const OUT_DIR = join(SITE, 'assets');

const JOBS = [
  { tex: 'resume.tex', pdf: 'resume.pdf' },
  { tex: 'cv.tex', pdf: 'cv.pdf' },
];

// pdfTeX-only lines that must not reach Tectonic (XeTeX), plus XeTeX
// hyperref font patch.  The \pdf* filter is intentionally broad: any
// line beginning with \pdf followed by a letter is a pdfTeX primitive
// (\pdfgentounicode, \pdfobjcompresslevel, etc.) that XeTeX rejects.
function stripPdfTexOnly(src) {
  const filtered = src
    .split('\n')
    .filter((line) => !/^\s*\\pdf[a-zA-Z]/.test(line) && !/^\s*\\input\{\s*glyphtounicode\s*\}/.test(line))
    .join('\n');
  return '\\def\\XeTeXLink@font{}\n' + filtered;
}

// Read a `{...}` group with nesting. openIdx must point at `{`.
// Returns [innerText, indexAfterClose] or null if unbalanced.
function readBraced(src, openIdx) {
  let depth = 0;
  for (let j = openIdx; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) return [src.slice(openIdx + 1, j), j + 1];
    }
  }
  return null;
}

// Remove `\href{mailto:...}{...}` / `\url{mailto:...}` commands. Brace-aware:
// the display text is often `\underline{addr}` (nested braces), which a
// `[^}]*` regex matches only partially, leaving a stray `}` that breaks
// XeTeX with `Extra }, or forgotten \endgroup`.
function stripMailtoCmd(src, cmd, groups) {
  const re = new RegExp('\\\\' + cmd + '\\s*\\{', 'gi');
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    const g1 = readBraced(src, m.index + m[0].length - 1);
    if (!g1) continue;
    const end = groups === 2 ? readBraced(src, g1[1]) : null;
    const targetEnd = groups === 2 ? (end && end[1]) : g1[1];
    if (targetEnd == null) continue;
    if (/^\s*mailto:/i.test(g1[0])) {
      out += src.slice(last, m.index);
      last = targetEnd;
    }
  }
  return out + src.slice(last);
}

// Public PDFs must not carry phone numbers or email addresses (the .tex
// source keeps them for print). Scrubbed here so both local and CI builds
// produce clean PDFs without touching the private Full-CV source.
function stripPrivateContact(src) {
  return stripMailtoCmd(stripMailtoCmd(src, 'href', 2), 'url', 1)
    .replace(/\(\d{3}\)\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4}/g, '')
    .replace(/\b\d{3}\s*[-.]\s*\d{3}\s*[-.]\s*\d{4}\b/g, '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    // Collapse separators orphaned by the scrub (`$|$  $|$` -> `$|$`).
    .replace(/(?:\$\|\$\s*){2,}/g, '$|$ ');
}

// Compile with Tectonic. Tectonic fetches fonts/packages from its remote
// bundle on demand; transient failures are retried. NO `continue-on-errors`:
// a missing font must abort the build so a torn PDF can never be produced.
const MAX_ATTEMPTS = 3;

function runTectonic(job) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = spawnSync('tectonic', ['--keep-logs', job.tex], {
      cwd: BUILD_DIR,
      stdio: 'inherit',
    });
    if (res.status === 0) return;
    if (attempt < MAX_ATTEMPTS) {
      process.stderr.write(`tectonic failed for ${job.tex} (attempt ${attempt}/${MAX_ATTEMPTS}); retrying transient bundle fetch\n`);
    }
  }
  process.stderr.write(`tectonic failed for ${job.tex} after ${MAX_ATTEMPTS} attempts\n`);
  process.exit(1);
}

mkdirSync(BUILD_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

for (const job of JOBS) {
  const texPath = join(FULL_CV, job.tex);
  const cleaned = stripPrivateContact(stripPdfTexOnly(readFileSync(texPath, 'utf8')));
  const tmpTex = join(BUILD_DIR, job.tex);
  writeFileSync(tmpTex, cleaned);

  runTectonic(job);

  const built = join(BUILD_DIR, job.pdf);
  writeFileSync(join(OUT_DIR, job.pdf), readFileSync(built));
  process.stdout.write(`wrote assets/${job.pdf}\n`);
}

rmSync(BUILD_DIR, { recursive: true, force: true });
