#!/usr/bin/env bun
// build.mjs — generate the resume/cv/man HTML pages from the Full-CV TeX source.
//
//   FULL_CV_DIR=/path/to/Full-CV bun tools/build.mjs
//
// Falls back to the sibling ../Full-CV checkout when FULL_CV_DIR is unset. Any
// TeX the parser cannot render throws a TexParseError (exit 1) so the CI build
// can switch to the full-TeX (make4ht) fallback.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { texToHtml } from './tex2html.mjs';
import { roffToHtml } from './roff2html.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(__dirname, '..');
const FULL_CV = resolve(process.env.FULL_CV_DIR || join(SITE, '..', 'Full-CV'));

function read(path) {
  return readFileSync(path, 'utf8');
}

function renderTemplate(name, vars) {
  let t = read(join(SITE, 'templates', name));
  for (const [key, value] of Object.entries(vars)) {
    t = t.split(`__${key}__`).join(value);
  }
  return t;
}

const resumeTex = read(join(FULL_CV, 'resume.tex'));
const cvTex = read(join(FULL_CV, 'cv.tex'));
const siteManual = roffToHtml(read(join(SITE, 'dvxb.io.7'))).html;

const DOWNLOAD_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';

function downloadButton(label, href) {
  return `<div class="resume-download doc-download">
    <a href="${href}" target="_blank" rel="noopener noreferrer">
      ${DOWNLOAD_ICON}
      ${label}
    </a>
  </div>`;
}

const pages = [
  {
    template: 'shell.html',
    out: 'resume.html',
    title: 'Resume — Devkumar Banerjee',
    desc: 'Devkumar Banerjee — AI Systems / Site Reliability Engineer Intern @ Lockheed Martin, UT MD Anderson, DIVE Lab, AGGIES Lab. CS Honors @ Texas A&M.',
    canonical: 'https://dvxb.io/resume',
    crumbHref: '/resume',
    crumbText: 'resume',
    download: downloadButton('Download resume', '/assets/resume.pdf'),
    body: texToHtml(resumeTex),
  },
  {
    template: 'shell.html',
    out: 'cv.html',
    title: 'CV — Devkumar Banerjee',
    desc: 'Devkumar Banerjee — full CV: research, work, teaching, projects, awards, publications, certifications, skills, and languages.',
    canonical: 'https://dvxb.io/cv',
    crumbHref: '/cv',
    crumbText: 'cv',
    download: downloadButton('Download CV', '/assets/cv.pdf'),
    body: texToHtml(cvTex),
  },
  {
    template: 'man.html',
    out: 'man/index.html',
    title: 'dvxb.io(7) — Personal Website Manual',
    desc: "Man page for dvxb.io — Devkumar Banerjee's personal website.",
    canonical: 'https://dvxb.io/man/',
    crumbHref: '/man/',
    crumbText: 'man',
    download: '',
    body: siteManual,
  },
  {
    template: 'man.html',
    out: 'man/resume.html',
    title: 'resume(1) — Devkumar Banerjee',
    desc: 'Man page for Devkumar Banerjee — AI Systems / SRE Intern @ Lockheed Martin, UT MD Anderson, DIVE Lab, AGGIES Lab.',
    canonical: 'https://dvxb.io/man/resume',
    crumbHref: '/man/',
    crumbText: 'man',
    download: downloadButton('Download resume', '/assets/resume.pdf'),
    body: texToHtml(resumeTex),
  },
  {
    template: 'man.html',
    out: 'man/dvxb.io.7.html',
    title: 'dvxb.io(7) — Personal Website Manual',
    desc: "Man page for dvxb.io — Devkumar Banerjee's personal website.",
    canonical: 'https://dvxb.io/man/dvxb.io.7',
    crumbHref: '/man/',
    crumbText: 'man',
    download: '',
    body: siteManual,
  },
];

mkdirSync(join(SITE, 'man'), { recursive: true });

for (const page of pages) {
  const html = renderTemplate(page.template, {
    TITLE: page.title,
    DESC: page.desc,
    CANONICAL: page.canonical,
    CRUMB_HREF: page.crumbHref,
    CRUMB_TEXT: page.crumbText,
    DOWNLOAD: page.download,
    BODY: page.body,
  });
  writeFileSync(join(SITE, page.out), html);
  console.log(`wrote ${page.out} (${html.length} bytes)`);
}
