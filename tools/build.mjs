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

const pages = [
  {
    template: 'shell.html',
    out: 'resume.html',
    title: 'Resume — Devkumar Banerjee',
    desc: 'Devkumar Banerjee — AI Systems / Site Reliability Engineer Intern @ Lockheed Martin, UT MD Anderson, DIVE Lab, AGGIES Lab. CS Honors @ Texas A&M.',
    canonical: 'https://dvxb.io/resume',
    crumbHref: '/resume',
    crumbText: 'resume',
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
    body: texToHtml(cvTex),
  },
  {
    template: 'man.html',
    out: 'man/index.html',
    title: 'resume(1) — Devkumar Banerjee',
    desc: 'Man page for Devkumar Banerjee — AI Systems / SRE Intern @ Lockheed Martin, UT MD Anderson, DIVE Lab, AGGIES Lab.',
    canonical: 'https://dvxb.io/man/',
    crumbHref: '/man/',
    crumbText: 'man',
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
    body: roffToHtml(read(join(SITE, 'dvxb.io.7'))).html,
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
    BODY: page.body,
  });
  writeFileSync(join(SITE, page.out), html);
  console.log(`wrote ${page.out} (${html.length} bytes)`);
}
