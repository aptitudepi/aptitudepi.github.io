#!/usr/bin/env bun
// sitemap.mjs — write sitemap.xml from the shared SITE_URLS list.
// Run in CI after the page/PDF build so lastmod reflects this deploy.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_URLS, blogEntries } from './site-urls.mjs';

const out = process.env.SITEMAP_OUT || join(import.meta.dirname, '..', 'sitemap.xml');
const deployStamp = (process.env.SITEMAP_LASTMOD || new Date().toISOString()).slice(0, 10);

// Per-entry lastmod wins (blog posts carry their frontmatter date via the
// manifest); static pages keep the deploy stamp. Stamping deploy-date on
// every URL lied for posts — fixed here (E4).
const entries = [...SITE_URLS, ...blogEntries()];

const body = entries.map(
  (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod ?? deployStamp}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

writeFileSync(out, xml);
process.stdout.write(`wrote ${out} (${entries.length} URLs, deploy-lastmod=${deployStamp})\n`);
