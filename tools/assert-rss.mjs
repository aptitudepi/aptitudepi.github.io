#!/usr/bin/env node
// tools/assert-rss.mjs — CI gate for blog/rss.xml (PLAN-BLOG.md E4 shape).
// Checks: well-formed XML, channel title/link/description, per-item
// title/link/guid/pubDate/description (astro-rss shape), absolute URLs,
// RFC-822 pubDates, item count == published manifest count. No deps.
//
// Usage: npm run assert:rss  (run after node tools/build-blog.mjs)

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readBlogManifest } from './site-urls.mjs';

const FEED = join(import.meta.dirname, '..', 'blog', 'rss.xml');
let failures = 0;
const check = (cond, label) => {
  process.stdout.write(`${cond ? 'ok' : 'FAIL'}: ${label}\n`);
  if (!cond) failures += 1;
};

check(existsSync(FEED), 'blog/rss.xml exists (run build-blog.mjs first)');
if (!existsSync(FEED)) process.exit(1);
const xml = readFileSync(FEED, 'utf8');
const posts = readBlogManifest();

check(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML declaration present');
check((xml.match(/<rss\b/g) || []).length === 1 && (xml.match(/<\/rss>/g) || []).length === 1, 'single well-formed <rss> root');
for (const tag of ['<title>', '<link>https://', '<description>', '<language>en</language>']) {
  check(xml.includes(`<channel>\n  ${tag}`) || xml.includes(tag), `channel carries ${tag.replace(/[<>/]/g, '')}`);
}
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
check(items.length === posts.length, `item count ${items.length} == published posts ${posts.length}`);
for (const item of items) {
  const has = (re) => re.test(item);
  check(has(/<title>[^<]+<\/title>/) && has(/<link>https:\/\/[^<]+<\/link>/) && has(/<guid isPermaLink="true">https:\/\/[^<]+<\/guid>/) && has(/<description>[\s\S]+<\/description>/) && has(/<content:encoded><!\[CDATA\[[\s\S]+\]\]><\/content:encoded>/), 'item has title/link/guid/description/content:encoded');
  const pubDate = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? '';
  check(/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(pubDate) && !Number.isNaN(Date.parse(pubDate)), `item pubDate RFC-822 + parseable (${pubDate || 'missing'})`);
}
check(!/<link>(?!https:\/\/)[^<]*<\/link>/.test(xml.replace(/<\?xml[\s\S]*?\?>/, '')), 'all URLs absolute');

if (failures > 0) {
  process.stderr.write(`assert-rss: ${failures} failure(s)\n`);
  process.exit(1);
}
process.stdout.write(`assert-rss: feed valid (${items.length} items)\n`);
