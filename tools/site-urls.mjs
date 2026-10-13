// site-urls.mjs — canonical public URLs for sitemap.xml and IndexNow.
// Keep paths aligned with tools/build.mjs canonicals plus the home page.
// Blog URLs come from the build-blog.mjs manifest (blog/posts.json):
// per-post lastmod is the frontmatter date, never the deploy date (E4 fix).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const HOST = 'dvxb.io';

/** @typedef {{ loc: string, changefreq: string, priority: string, lastmod?: string }} SiteUrl */

/** @type {SiteUrl[]} */
export const SITE_URLS = [
  { loc: `https://${HOST}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `https://${HOST}/resume`, changefreq: 'weekly', priority: '0.9' },
  { loc: `https://${HOST}/cv`, changefreq: 'weekly', priority: '0.9' },
  { loc: `https://${HOST}/man/`, changefreq: 'monthly', priority: '0.7' },
  { loc: `https://${HOST}/man/resume`, changefreq: 'weekly', priority: '0.7' },
  { loc: `https://${HOST}/man/dvxb.io.7`, changefreq: 'monthly', priority: '0.6' },
  { loc: `https://${HOST}/assets/resume.pdf`, changefreq: 'weekly', priority: '0.5' },
  { loc: `https://${HOST}/assets/cv.pdf`, changefreq: 'weekly', priority: '0.5' },
];

export const URL_LIST = SITE_URLS.map((u) => u.loc);

// Blog manifest written by tools/build-blog.mjs (published posts only;
// missing file = no posts yet → no blog URLs). Drafts never listed.
export function readBlogManifest() {
  const manifest = join(import.meta.dirname, '..', 'blog', 'posts.json');
  if (!existsSync(manifest)) return [];
  return JSON.parse(readFileSync(manifest, 'utf8'));
}

// Blog entries with per-post lastmod from frontmatter dates (index/tag
// pages use the latest post date). Feeds sitemap + IndexNow free.
export function blogEntries() {
  const posts = readBlogManifest();
  if (posts.length === 0) return [];
  const latest = posts.map((post) => post.date.slice(0, 10)).sort().at(-1);
  const entries = [
    { loc: `https://${HOST}/blog/`, changefreq: 'weekly', priority: '0.8', lastmod: latest },
    { loc: `https://${HOST}/blog/rss.xml`, changefreq: 'weekly', priority: '0.4', lastmod: latest },
  ];
  for (const post of posts) {
    entries.push({ loc: `https://${HOST}/blog/${post.slug}/`, changefreq: 'monthly', priority: '0.7', lastmod: post.date.slice(0, 10) });
  }
  for (const tag of [...new Set(posts.flatMap((post) => post.tags))].sort()) {
    entries.push({ loc: `https://${HOST}/blog/tag/${tag}/`, changefreq: 'weekly', priority: '0.5', lastmod: latest });
  }
  return entries;
}

export function allUrls() {
  return [...URL_LIST, ...blogEntries().map((entry) => entry.loc)];
}
