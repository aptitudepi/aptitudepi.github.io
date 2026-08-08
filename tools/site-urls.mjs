// site-urls.mjs — canonical public URLs for sitemap.xml and IndexNow.
// Keep paths aligned with tools/build.mjs canonicals plus the home page.

export const HOST = 'dvxb.io';

/** @typedef {{ loc: string, changefreq: string, priority: string }} SiteUrl */

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
