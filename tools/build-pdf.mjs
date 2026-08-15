#!/usr/bin/env bun
// build-pdf.mjs — compile assets/resume.pdf and assets/cv.pdf from Full-CV
// TeX using Tectonic (XeTeX). The source contains pdfTeX-only lines
// (\pdfgentounicode, \input{glyphtounicode}) that Tectonic rejects, so they
// are stripped before compiling.
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

// pdfTeX-only lines that must not reach Tectonic, plus XeTeX hyperref font patch.
function stripPdfTexOnly(src) {
  const filtered = src
    .split('\n')
    .filter((line) => !/^\s*\\pdfgentounicode\s*=/.test(line) && !/^\s*\\input\{\s*glyphtounicode\s*\}/.test(line))
    .join('\n');
  return `\\def\\XeTeXLink@font{}\n` + filtered;
}

mkdirSync(BUILD_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

for (const job of JOBS) {
  const texPath = join(FULL_CV, job.tex);
  const cleaned = stripPdfTexOnly(readFileSync(texPath, 'utf8'));
  const tmpTex = join(BUILD_DIR, job.tex);
  writeFileSync(tmpTex, cleaned);

  const res = spawnSync('tectonic', ['--keep-logs', '-Z', 'continue-on-errors', job.tex], {
    cwd: BUILD_DIR,
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    console.error(`tectonic failed for ${job.tex}`);
    process.exit(res.status ?? 1);
  }

  const built = join(BUILD_DIR, job.pdf);
  writeFileSync(join(OUT_DIR, job.pdf), readFileSync(built));
  console.log(`wrote assets/${job.pdf}`);
}

rmSync(BUILD_DIR, { recursive: true, force: true });
