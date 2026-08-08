#!/usr/bin/env bun
// sitemap.mjs — write sitemap.xml from the shared SITE_URLS list.
// Run in CI after the page/PDF build so lastmod reflects this deploy.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_URLS } from './site-urls.mjs';

const out = process.env.SITEMAP_OUT || join(import.meta.dirname, '..', 'sitemap.xml');
const lastmod = (process.env.SITEMAP_LASTMOD || new Date().toISOString()).slice(0, 10);

const body = SITE_URLS.map(
  (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
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
console.log(`wrote ${out} (${SITE_URLS.length} URLs, lastmod=${lastmod})`);
