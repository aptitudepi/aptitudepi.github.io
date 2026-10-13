#!/usr/bin/env node
// tools/new-post.mjs — scaffold posts/<slug>.md from posts/_TEMPLATE.md.
// Fills title/date (plus --desc/--tags/--image when given), keeps draft:true.
// Fails loud (exit 1): missing title, bad slug, overwrite, missing template.
// Stdlib only; runs under node or bun.
//
// Usage:
//   node tools/new-post.mjs "My Title" --tags a,b --image ./hero.png
//   node tools/new-post.mjs "My Title" --desc "..." --slug custom --date 2026-10-13

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = join(import.meta.dirname, '..');
const POSTS_DIR = join(SITE, 'posts');
const DRAFTS_DIR = join(POSTS_DIR, '_drafts');
const TEMPLATE = join(POSTS_DIR, '_TEMPLATE.md');

const fail = (msg) => { process.stderr.write(`new-post: ${msg}\n`); process.exit(1); };
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Minimal --flag value / --flag=value parsing (no deps).
const args = process.argv.slice(2);
const opts = {};
const positionals = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!arg.startsWith('--')) { positionals.push(arg); continue; }
  const eq = arg.indexOf('=');
  const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
  const value = eq === -1 ? args[++i] : arg.slice(eq + 1);
  if (value === undefined || value.startsWith('--')) fail(`--${key}: value required`);
  opts[key] = value;
}

const title = positionals[0];
if (!title?.trim()) fail('usage: new-post.mjs "My Title" [--tags a,b] [--image ./hero.png] [--desc "..."] [--slug x] [--date YYYY-MM-DD]');
// --slug used verbatim (fail loud on uppercase); title-derived slug is normalized.
const slug = opts.slug ?? slugify(title);
if (!/^[a-z0-9-]+$/.test(slug)) fail(`bad slug ${JSON.stringify(slug)}: use lowercase letters, digits, hyphens`);
for (const dir of [POSTS_DIR, DRAFTS_DIR]) {
  if (existsSync(join(dir, `${slug}.md`))) fail(`posts/${slug}.md exists — refusing to overwrite`);
}

const dateStr = opts.date ?? new Date().toISOString().slice(0, 10);
if (Number.isNaN(new Date(dateStr).getTime())) fail(`bad --date ${JSON.stringify(dateStr)}: parseable date required`);
const desc = opts.desc ?? opts.description;
if (desc !== undefined && !desc.trim()) fail('--desc: non-empty string required');
let tags;
if (opts.tags !== undefined) {
  tags = opts.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  if (!tags.length) fail('--tags: comma-separated list required (e.g. a,b)');
}
if (opts.image !== undefined && !opts.image.trim()) fail('--image: non-empty path required');

if (!existsSync(TEMPLATE)) fail('posts/_TEMPLATE.md missing');
const template = readFileSync(TEMPLATE, 'utf8');
const block = template.match(/^---\n([\s\S]*?)\n---\n/);
if (!block) fail('template frontmatter block not found');
let front = block[1];
const set = (key, value) => {
  if (!new RegExp(`^${key}:.*$`, 'm').test(front)) fail(`template missing ${key}: line`);
  front = front.replace(new RegExp(`^${key}:.*$`, 'm'), `${key}: ${value}`);
};
set('title', JSON.stringify(title.trim()));
set('date', JSON.stringify(dateStr));
if (desc !== undefined) set('description', JSON.stringify(desc.trim()));
if (tags) set('tags', `[${tags.map((tag) => JSON.stringify(tag)).join(', ')}]`);
if (opts.image !== undefined) set('image', JSON.stringify(opts.image.trim()));
set('draft', 'true'); // template guard 2 — never scaffold a live post

writeFileSync(join(POSTS_DIR, `${slug}.md`), template.replace(block[0], `---\n${front}\n---\n`));
process.stdout.write(`wrote posts/${slug}.md (draft — delete draft: line to publish)\n`);
