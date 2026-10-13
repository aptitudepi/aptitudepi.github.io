#!/usr/bin/env node
// tools/build-blog.mjs — Flow A blog builder (PLAN-BLOG.md App D5/L3.2).
//
//   posts/<slug>.md (+ posts/_drafts/*.md) → frozen HTML under blog/ on GH Pages.
//   Bodies stay git MD, always. No D1/KV/R2/Worker in the post path.
//
//   BUILD_DRAFTS=1 → drafts render ONLY to blog/draft/<sha12>/ with noindex,
//   excluded from index/tag/RSS/sitemap. Without it (CI prod) zero draft bytes.
//
// Usage:
//   node tools/build-blog.mjs            # prod: published posts only
//   BUILD_DRAFTS=1 node tools/build-blog.mjs   # local preview incl. drafts

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from '@11ty/gray-matter';
import { marked } from 'marked';
import { codeToHtml } from 'shiki';
import sharp from 'sharp';
import { HOST } from './site-urls.mjs';

const SITE = join(import.meta.dirname, '..');
const POSTS_DIR = join(SITE, 'posts');
const DRAFTS_DIR = join(POSTS_DIR, '_drafts');
const OUT_DIR = join(SITE, 'blog');
const SITE_URL = `https://${HOST}`;
const BUILD_DRAFTS = process.env.BUILD_DRAFTS === '1';

// Step-5/6 conventions (PLAN-BLOG.md App L3.5–6): OG default card is a
// committed asset; responsive widths follow the E3 recipe (AVIF-primary,
// never upscale); post images resolve relative to their md file, absolute
// (/...) and remote srcs pass through untouched.
const OG_DEFAULT = '/assets/blog/og-default.png';
const IMG_WIDTHS = [320, 640, 960, 1280, 1920];

// Same split-join + defaults as tools/build.mjs so existing pages are
// unaffected (this file never touches resume/cv/man). DEFAULT_NAV mirrors
// build.mjs (resume/cv/man + blog self-link, no active state — nav.css has
// no active/aria-current rule).
const DEFAULT_NAV = [
  '    <a href="/resume">resume</a>',
  '    <a href="/cv">cv</a>',
  '    <a href="/man/">man</a>',
  '    <a href="/blog/">blog</a>',
].join('\n');

function renderTemplate(name, vars) {
  let template = readFileSync(join(SITE, 'templates', name), 'utf8');
  vars = { NAV: DEFAULT_NAV, META: '', HEAD_EXTRA: '', SCRIPTS: '', ...vars };
  for (const [key, value] of Object.entries(vars)) template = template.split(`__${key}__`).join(value);
  return template;
}

// E1 field set (astro content-layer checklist, plain asserts — no zod dep).
// Throws on violation so CI fails the build instead of shipping a bad post.
export function assertFrontmatter(data, file) {
  const fail = (msg) => { throw new Error(`frontmatter ${file}: ${msg}`); };
  if (typeof data.title !== 'string' || !data.title.trim()) fail('title: non-empty string required');
  if (typeof data.description !== 'string' || !data.description.trim()) fail('description: non-empty string required');
  const date = new Date(data.date);
  if (Number.isNaN(date.getTime())) fail(`date: parseable date required, saw ${JSON.stringify(data.date)}`);
  // Replace-don't-merge: tags is exactly the frontmatter array (E1 rule a).
  const tags = data.tags === undefined ? [] : data.tags;
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) fail('tags: array of strings required');
  if (data.draft !== undefined && typeof data.draft !== 'boolean') fail('draft: boolean required');
  if (data.image !== undefined && (typeof data.image !== 'string' || !data.image.trim())) fail('image: non-empty string required');
  if (data.cast !== undefined && (typeof data.cast !== 'string' || !data.cast.trim())) fail('cast: non-empty string required');
  return { title: data.title.trim(), description: data.description.trim(), date, tags, draft: data.draft === true, image: typeof data.image === 'string' ? data.image.trim() : undefined, cast: typeof data.cast === 'string' ? data.cast.trim() : undefined };
}

function slugOf(file) {
  const slug = file.replace(/\.md$/, '');
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`slug ${file}: use lowercase letters, digits, hyphens`);
  return slug;
}

function unescapeHtml(value) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// marked → Shiki build-time highlight (zero client JS). Single github-dark
// theme keeps terminal look with no __HEAD_EXTRA__ vars needed.
export async function markdownToHtml(markdown) {
  let html = marked.parse(markdown, { gfm: true });
  const blocks = [...html.matchAll(/<pre><code class="language-([\w+-]+)">([\s\S]*?)<\/code><\/pre>/g)];
  for (const [full, lang, esc] of blocks) {
    let replacement = full; // unknown lang: keep marked's escaped block
    try {
      replacement = await codeToHtml(unescapeHtml(esc), { lang, theme: 'github-dark' });
    } catch {
      // keep marked's escaped block
    }
    html = html.replace(full, () => replacement);
  }
  return html;
}

export function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readingMinutes(markdown) {
  return Math.max(1, Math.ceil(markdown.split(/\s+/).length / 200));
}

function metaHtml(post) {
  const iso = post.date.toISOString();
  const day = iso.slice(0, 10);
  const tags = post.tags.map((tag) => `<a href="/blog/tag/${tag}/">${escapeHtml(tag)}</a>`).join(' ');
  return `<p class="post-meta"><time datetime="${iso}">${day}</time> &middot; ${post.minutes} min read${tags ? ` &middot; ${tags}` : ''}</p>\n`;
}

function slugifyHeading(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'section';
}

// Build-time heading ids + TOC entries. marked emits bare <h2>/<h3> (no
// renderer API dependence); Shiki/marked escape code samples, so the regex
// only matches real headings. Duplicate titles get -2/-3 suffixes.
export function addHeadingIds(html) {
  const seen = new Map();
  const headings = [];
  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (match, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    let headingId = slugifyHeading(text);
    const count = seen.get(headingId) ?? 0;
    seen.set(headingId, count + 1);
    if (count > 0) headingId = `${headingId}-${count + 1}`;
    headings.push({ level: Number(level), id: headingId, text });
    return `<h${level} id="${headingId}">${inner}</h${level}>`;
  });
  return { html, headings };
}

// TOC renders only when a post has 2+ sections — a one-entry TOC is noise.
export function tocHtml(headings) {
  if (headings.length < 2) return '';
  const lis = headings.map((heading) => `  <li class="toc-h${heading.level}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`).join('\n');
  return `<nav class="toc" data-pagefind-ignore aria-label="Contents"><p>contents</p>\n<ul>\n${lis}\n</ul>\n</nav>\n`;
}

function absImage(image) {
  if (!image) return `${SITE_URL}${OG_DEFAULT}`;
  if (/^https?:\/\//.test(image)) return image;
  return `${SITE_URL}${image.startsWith('/') ? image : `/${image}`}`;
}

// Per-post OG tags (+ default card, + image: frontmatter override) for
// __HEAD_EXTRA__. Absolute URLs throughout; card validity is verified once
// per template by inspecting output, not per post.
function ogHead({ title, description, canonical, date, tags = [], image }) {
  const published = date ? `\n<meta property="article:published_time" content="${date.toISOString()}">` : '';
  const tagLines = tags.map((tag) => `\n<meta property="article:tag" content="${escapeHtml(tag)}">`).join('');
  return '<meta property="og:type" content="article">\n' +
    `<meta property="og:title" content="${escapeHtml(title)}">\n` +
    `<meta property="og:description" content="${escapeHtml(description)}">\n` +
    `<meta property="og:url" content="${canonical}">\n` +
    `<meta property="og:image" content="${absImage(image)}">\n` +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    `<meta name="twitter:title" content="${escapeHtml(title)}">\n` +
    `<meta name="twitter:description" content="${escapeHtml(description)}">${published}${tagLines}`;
}

// Static share footer (G4/G5): copy-link + mailto/X/Bluesky/Mastodon intents.
// Links carry the clean canonical; copy-link copies location.href as-is so a
// ?ref= stamp survives the copy, and __SCRIPTS__ strips it after (canonical
// stays clean). data-pagefind-ignore is step-7 prep (zero cost, no UI).
function shareFooter(title, canonical) {
  const subj = encodeURIComponent(title);
  const url = encodeURIComponent(canonical);
  const text = encodeURIComponent(`${title} ${canonical}`);
  return '<footer class="share-footer" data-pagefind-ignore><p>share this post: ' +
    `<button type="button" id="copy-link" data-canonical="${canonical}">copy link</button> ` +
    `<a href="mailto:?subject=${subj}&amp;body=${url}">email</a> ` +
    `<a href="https://twitter.com/intent/tweet?text=${subj}&amp;url=${url}" target="_blank" rel="noopener">x</a> ` +
    `<a href="https://bsky.app/intent/compose?text=${text}" target="_blank" rel="noopener">bluesky</a> ` +
    `<a href="https://mastodon.social/share?text=${text}" target="_blank" rel="noopener">mastodon</a></p></footer>\n`;
}

const PROGRESS_DIV = '<div class="read-progress" data-pagefind-ignore aria-hidden="true" style="position:fixed;top:0;left:0;height:2px;width:0;z-index:60;background:#7ee787"></div>\n';

// Read-UX island: canonical-clean (?ref=/utm_* stripped post-attribution via
// replaceState), ?ref=-preserving copy-link, scroll progress. Vanilla inline
// JS in __SCRIPTS__ — never under js/, so the js/ budget excludes it by
// construction (island-exclusion rule). No new deps.
function postScripts() {
  return '<script>\n(function () {\n' +
    '  try {\n' +
    '    var u = new URL(window.location.href);\n' +
    '    var drop = [];\n' +
    "    u.searchParams.forEach(function (v, k) { if (k === 'ref' || k.slice(0, 4) === 'utm_') drop.push(k); });\n" +
    "    if (drop.length) { drop.forEach(function (k) { u.searchParams.delete(k); }); window.history.replaceState(null, '', u.pathname + u.search + u.hash); }\n" +
    '  } catch (e) {}\n' +
    "  var btn = document.getElementById('copy-link');\n" +
    "  if (btn && navigator.clipboard) btn.addEventListener('click', function () {\n" +
    "    navigator.clipboard.writeText(window.location.href).then(function () { btn.textContent = 'copied'; });\n" +
    '  });\n' +
    "  var bar = document.querySelector('.read-progress');\n" +
    '  if (bar) {\n' +
    '    var onScroll = function () {\n' +
    '      var max = document.documentElement.scrollHeight - window.innerHeight;\n' +
    "      bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';\n" +
    '    };\n' +
    "    window.addEventListener('scroll', onScroll, { passive: true });\n" +
    '    onScroll();\n' +
    '  }\n' +
    '})();\n</script>';
}

// Step-6 sharp island (E3 recipe, AVIF-primary): local relative <img> refs
// resolved against the md file's dir become <picture> AVIF→WebP→JPEG across
// IMG_WIDTHS capped at native width (never upscale) with w/h attrs
// (CLS-safe), loading=lazy, and a zero-JS LQIP (32px q15 JPEG data-URI as a
// backdrop span — no ThumbHash dep). Variants land in blog/<slug>/img/
// (artifact dir, deployed, gated by the image-total budget); make-style
// mtime skip keeps rebuilds incremental. svg/gif copy through with no
// variants. Missing source throws (CI-red, never a broken image).
// data-pagefind-body wrapper is step-7 prep (zero cost, no UI).
export async function renderPostImages(html, { srcDir, outDir, outUrl }) {
  for (const [tag, pre, src, postAttrs] of html.matchAll(/<img([^>]*?)\ssrc="([^"]+)"([^>]*?)>/g)) {
    if (/^(https?:|data:|\/)/.test(src)) continue;
    const srcFile = join(srcDir, src);
    if (!existsSync(srcFile)) throw new Error(`image ${src}: not found relative to ${srcDir}`);
    mkdirSync(outDir, { recursive: true });
    const alt = (/alt="([^"]*)"/.exec(tag)?.[1]) ?? '';
    const rest = postAttrs.replace(/\salt="[^"]*"/, '');
    const leaf = src.slice(src.lastIndexOf('/') + 1);
    if (/\.(svg|gif)$/i.test(leaf)) {
      writeFileSync(join(outDir, leaf), readFileSync(srcFile));
      html = html.replace(tag, () => `<img${pre} src="${outUrl}/${leaf}"${postAttrs}>`);
      continue;
    }
    const meta = await sharp(srcFile).metadata();
    const targets = [...IMG_WIDTHS.filter((width) => width < meta.width), meta.width];
    const base = (leaf.slice(0, leaf.lastIndexOf('.')) || 'img').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    const ratio = meta.height / meta.width;
    const srcsetFor = (fmt) => targets.map((width) => `${outUrl}/${base}-${width}w.${fmt} ${width}w`).join(', ');
    for (const width of targets) {
      for (const [fmt, opts] of [['avif', { quality: 60, effort: 6 }], ['webp', { quality: 80 }], ['jpg', { quality: 85 }]]) {
        const out = join(outDir, `${base}-${width}w.${fmt}`);
        if (existsSync(out) && statSync(out).mtimeMs >= statSync(srcFile).mtimeMs) continue;
        await sharp(srcFile).resize({ width }).toFormat(fmt, opts).toFile(out);
      }
    }
    const lqip = await sharp(srcFile).resize({ width: 32 }).jpeg({ quality: 15 }).toBuffer();
    const big = targets[targets.length - 1];
    html = html.replace(tag, () => `<span class="lqip" style="background-image:url(data:image/jpeg;base64,${lqip.toString('base64')})">` +
      `<picture><source type="image/avif" srcset="${srcsetFor('avif')}"><source type="image/webp" srcset="${srcsetFor('webp')}">` +
      `<img src="${outUrl}/${base}-${big}w.jpg" srcset="${srcsetFor('jpg')}" sizes="(max-width: 960px) 100vw, 960px" ` +
      `width="${big}" height="${Math.round(big * ratio)}" alt="${alt}"${rest} loading="lazy" decoding="async"></picture></span>`);
  }
  return html;
}

// Step-7 Pagefind body attrs (C4/E4): explicit title meta (posts have no h1,
// so auto-title would miss), date as inline meta + sort key, one filter span
// per tag. Hidden spans ride inside the body div — harmless body text, zero UI.
function pagefindMeta(post) {
  const day = post.date.toISOString().slice(0, 10);
  const filters = post.tags.map((tag) => `<span hidden data-pagefind-filter="tag">${escapeHtml(tag)}</span>`).join('');
  return `<span hidden data-pagefind-meta="title">${escapeHtml(post.title)}</span>` +
    `<span hidden data-pagefind-meta="date:${day}"></span>` +
    `<span hidden data-pagefind-sort="date:${day}"></span>${filters}`;
}

// E4: keep shell chrome (nav links, footer, clock) out of the index via
// post-render string replace on blog pages only — shell.html itself is
// untouched, so the existing 5 outputs stay byte-identical.
function ignoreChrome(html) {
  return html
    .replace('<nav class="doc-nav-links"', '<nav class="doc-nav-links" data-pagefind-ignore')
    .replace('<footer class="doc-footer"', '<footer class="doc-footer" data-pagefind-ignore')
    .replace('id="headerClock"', 'id="headerClock" data-pagefind-ignore');
}

// Step-8 asciinema island (App §7/C5/E5): `cast:` frontmatter → vendored
// pinned player (assets/vendor/asciinema, no CDN), lazy IntersectionObserver
// init, poster npt:0:05 (still frame, avoids CLS), 80×24 cap, transcript
// fallback (build-time "o"-event text, ANSI-stripped, capped) in <details> +
// <noscript> with copy button + aria-label (E5 a11y). Zero player bytes on
// text posts — embed + CSS + init render only when post.cast exists.
const CAST_JS = '/assets/vendor/asciinema/asciinema-player.min.js';
const CAST_CSS = '/assets/vendor/asciinema/asciinema-player.css';

function castTranscript(castText) {
  const out = [];
  for (const line of castText.split('\n')) {
    if (!line.startsWith('[')) continue;
    try {
      const evt = JSON.parse(line);
      if (evt[1] === 'o' && typeof evt[2] === 'string') out.push(evt[2]);
    } catch { /* malformed event line: skip, player still plays the file */ }
  }
  // Strip ANSI escapes (libterm/cell-term fallback pattern, build-time).
  return out.join('').replace(/\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[()][0-9A-B]/g, '').replace(/\r/g, '').slice(0, 8000);
}

async function castEmbed(post, srcDir, slugDir, urlBase) {
  const srcFile = post.cast.startsWith('/') ? join(SITE, post.cast.slice(1)) : join(srcDir, post.cast);
  if (!existsSync(srcFile)) throw new Error(`cast ${post.cast}: not found relative to ${srcDir}`);
  const leaf = post.cast.slice(post.cast.lastIndexOf('/') + 1);
  writeFileSync(join(slugDir, leaf), readFileSync(srcFile));
  // Site-relative src (NOT SITE_URL-absolute like images): the player fetches
  // same-origin, so local previews play local files; RSS never sees this
  // (embed is article-only, post.html stays content-only).
  const url = `${urlBase}/${leaf}`;
  const transcript = escapeHtml(castTranscript(readFileSync(srcFile, 'utf8')) || '(empty recording)');
  return `<div class="cast-player" data-cast-src="${url}" data-pagefind-ignore aria-label="Terminal recording for ${escapeHtml(post.title)}"><p class="cast-loading">loading terminal recording…</p><noscript><pre>${transcript}</pre></noscript></div>\n` +
    `<details class="cast-transcript"><summary>transcript</summary><button type="button" data-copy-transcript>copy transcript</button><pre>${transcript}</pre></details>\n`;
}

// Lazy player init: IntersectionObserver injects the vendored bundle once,
// then create() with poster + idle cap. preload:false default kept (poster
// forces preload only for the in-view embed — E5 refinement).
function castScripts() {
  return '<script>\n(function () {\n' +
    "  var el = document.querySelector('.cast-player');\n" +
    '  if (!el) return;\n' +
    '  function init() {\n' +
    "    if (el.dataset.done) return; el.dataset.done = '1';\n" +
    "    var s = document.createElement('script');\n" +
    `    s.src = '${CAST_JS}';\n` +
    '    s.onload = function () {\n' +
    "      window.AsciinemaPlayer.create(el.dataset.castSrc, el, { poster: 'npt:0:05', idleTimeLimit: 2, cols: 80, rows: 24, theme: 'monokai' });\n" +
    '    };\n' +
    '    document.head.appendChild(s);\n' +
    '  }\n' +
    "  if ('IntersectionObserver' in window) { new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { init(); o.disconnect(); } }); }).observe(el); }\n" +
    '  else init();\n' +
    "  var btn = document.querySelector('[data-copy-transcript]');\n" +
    "  if (btn && navigator.clipboard) btn.addEventListener('click', function () {\n" +
    "    var pre = btn.parentNode.querySelector('pre');\n" +
    "    if (pre) navigator.clipboard.writeText(pre.textContent).then(function () { btn.textContent = 'copied'; });\n" +
    '  });\n' +
    '})();\n</script>';
}

// Full article body: TOC + content (+ cast embed; RSS keeps post.html =
// content only, no TOC/share/cast chrome).
async function buildPostBody(post, srcDir, slugDir, imgUrl, urlBase) {
  const headed = addHeadingIds(await markdownToHtml(post.body));
  const content = await renderPostImages(headed.html, { srcDir, outDir: join(slugDir, 'img'), outUrl: imgUrl });
  post.html = content;
  const cast = post.cast ? await castEmbed(post, srcDir, slugDir, urlBase) : '';
  return `${tocHtml(headed.headings)}<div data-pagefind-body>\n${pagefindMeta(post)}\n${content}</div>\n${cast}`;
}

// C1 getFilteredByTag 5-liner over frontmatter tags.
export function getFilteredByTag(posts, tag) {
  return posts.filter((post) => post.tags.includes(tag));
}

function loadDir(dir) {
  if (!existsSync(dir)) return [];
  // Underscore-prefixed .md (e.g. posts/_TEMPLATE.md) are authoring aids,
  // never posts — skipped before parsing so the template stays 0 bytes in
  // prod AND under BUILD_DRAFTS=1 (its draft:true is the second guard).
  return readdirSync(dir).filter((file) => file.endsWith('.md') && !file.startsWith('_') && !file.startsWith('.')).sort().map((file) => {
    const raw = readFileSync(join(dir, file));
    const parsed = matter(raw.toString());
    const frontmatter = assertFrontmatter(parsed.data, file);
    const slug = slugOf(file);
    return { ...frontmatter, slug, body: parsed.content, minutes: readingMinutes(parsed.content), draftHash: createHash('sha256').update(raw).digest('hex').slice(0, 12) };
  });
}

const now = new Date();
const isScheduledDraft = (post) => post.draft || post.date > now;
const all = [...loadDir(POSTS_DIR), ...loadDir(DRAFTS_DIR)];
// Sort by parsed-date UTC explicitly (E1 rule b — no deploy-order/TZ bugs).
const published = all.filter((post) => !isScheduledDraft(post)).sort((first, second) => second.date - first.date);
const drafts = all.filter(isScheduledDraft);

// E6: clean blog/ every build (artifact deploy makes full-clean free;
// avoids Hugo-style stale future/draft files lingering).
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const NOINDEX = '<meta name="robots" content="noindex, nofollow">';

for (const post of published) {
  const canonical = `${SITE_URL}/blog/${post.slug}/`;
  const dir = join(OUT_DIR, post.slug);
  mkdirSync(dir, { recursive: true });
  const article = await buildPostBody(post, POSTS_DIR, dir, `${SITE_URL}/blog/${post.slug}/img`, `/blog/${post.slug}`);
  writeFileSync(join(dir, 'index.html'), ignoreChrome(renderTemplate('shell.html', {
    TITLE: `${post.title} — dvxb.io`,
    DESC: post.description,
    CANONICAL: canonical,
    CRUMB_HREF: '/blog/',
    CRUMB_TEXT: 'blog',
    DOWNLOAD: '',
    BODY: `${PROGRESS_DIV}${article}${shareFooter(post.title, canonical)}`,
    META: metaHtml(post),
    HEAD_EXTRA: `${post.cast ? `<link rel="stylesheet" href="${CAST_CSS}">\n` : ''}${ogHead({ ...post, canonical })}`,
    SCRIPTS: `${postScripts()}${post.cast ? castScripts() : ''}`,
  })));
  process.stdout.write(`wrote blog/${post.slug}/index.html\n`);
}

// Step-7 search UI (C4): blog-index-only lazy island. The Pagefind bundle
// (/pagefind/, post-build step) loads on first focus/input — never on post
// pages, never render-blocking. Result links built via DOM (no innerHTML of
// index content). Ignored by the js/ budget by construction (inline island).
function searchScripts() {
  return '<script>\n(function () {\n' +
    "  var input = document.getElementById('blog-search');\n" +
    '  if (!input) return;\n' +
    "  var list = document.getElementById('blog-search-results');\n" +
    '  var loaded = null;\n' +
    '  var load = function () {\n' +
    "    if (!loaded) loaded = import('/pagefind/pagefind.js').catch(function () { return null; });\n" +
    '    return loaded;\n' +
    '  };\n' +
    "  input.addEventListener('focus', load, { once: true });\n" +
    '  var t;\n' +
    "  input.addEventListener('input', function () {\n" +
    '    clearTimeout(t);\n' +
    '    var q = input.value.trim();\n' +
    "    if (!q) { list.innerHTML = ''; return; }\n" +
    '    t = setTimeout(function () {\n' +
    '      load().then(function (pf) {\n' +
    '        if (!pf) return;\n' +
    '        pf.search(q).then(function (r) {\n' +
    '          return Promise.all((r.results || []).slice(0, 8).map(function (x) { return x.data(); }));\n' +
    '        }).then(function (found) {\n' +
    "          list.innerHTML = '';\n" +
    '          found.forEach(function (d) {\n' +
    "            var a = document.createElement('a');\n" +
    '            a.href = d.url; a.textContent = (d.meta && d.meta.title) || d.url;\n' +
    "            var li = document.createElement('li'); li.appendChild(a); list.appendChild(li);\n" +
    '          });\n' +
    '        });\n' +
    '      });\n' +
    '    }, 200);\n' +
    '  });\n' +
    '})();\n</script>';
}

// Index page (published only — drafts never listed).
const items = published.map((post) => `  <li><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a> — ${post.date.toISOString().slice(0, 10)}</li>`).join('\n');
const INDEX_OG = ogHead({ title: 'Blog — dvxb.io', description: 'Posts on systems, reliability, and tooling.', canonical: `${SITE_URL}/blog/` });
writeFileSync(join(OUT_DIR, 'index.html'), ignoreChrome(renderTemplate('shell.html', {
  TITLE: 'Blog — dvxb.io',
  DESC: 'Posts on systems, reliability, and tooling.',
  CANONICAL: `${SITE_URL}/blog/`,
  CRUMB_HREF: '/blog/',
  CRUMB_TEXT: 'blog',
  DOWNLOAD: '',
  BODY: published.length ? `<p class="blog-search"><input id="blog-search" type="search" placeholder="search posts" aria-label="Search posts" autocomplete="off"><ul id="blog-search-results" aria-live="polite"></ul></p>\n<ul class="post-index">\n${items}\n</ul>\n` : '<p>No posts yet.</p>\n',
  HEAD_EXTRA: INDEX_OG,
  SCRIPTS: published.length ? searchScripts() : '',
})));

// Tag pages (published only).
const tags = [...new Set(published.flatMap((post) => post.tags))].sort();
for (const tag of tags) {
  const tagged = getFilteredByTag(published, tag);
  const lis = tagged.map((post) => `  <li><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></li>`).join('\n');
  const dir = join(OUT_DIR, 'tag', tag);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), ignoreChrome(renderTemplate('shell.html', {
    TITLE: `#${tag} — dvxb.io blog`,
    DESC: `Posts tagged ${tag}.`,
    CANONICAL: `${SITE_URL}/blog/tag/${tag}/`,
    CRUMB_HREF: '/blog/',
    CRUMB_TEXT: 'blog',
    DOWNLOAD: '',
    BODY: `<ul class="post-index">\n${lis}\n</ul>\n`,
    HEAD_EXTRA: ogHead({ title: `#${tag} — dvxb.io blog`, description: `Posts tagged ${tag}.`, canonical: `${SITE_URL}/blog/tag/${tag}/` }),
  })));
}

// posts.json manifest (published only): feeds sitemap per-post lastmod +
// IndexNow URL list via tools/site-urls.mjs. Drafts never listed.
writeFileSync(join(OUT_DIR, 'posts.json'), `${JSON.stringify(published.map((post) => ({ slug: post.slug, date: post.date.toISOString(), tags: post.tags })), null, 2)}\n`);

// Hand-rolled rss.xml (~20 lines, zero dep — astro-rss item shape as model:
// title/description/link/pubDate; E4 hardening: absolute URLs, XML-escaped
// fields, guid permalink, content:encoded full text, RFC-822 dates).
const rfc822 = (date) => date.toUTCString();
const cdata = (html) => html.replace(/]]>/g, ']]&gt;');
const feedItems = published.map((post) => `  <item>
    <title>${escapeHtml(post.title)}</title>
    <link>${SITE_URL}/blog/${post.slug}/</link>
    <guid isPermaLink="true">${SITE_URL}/blog/${post.slug}/</guid>
    <pubDate>${rfc822(post.date)}</pubDate>
    <description>${escapeHtml(post.description)}</description>
    <content:encoded><![CDATA[${cdata(post.html)}]]></content:encoded>
  </item>`).join('\n');
writeFileSync(join(OUT_DIR, 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>dvxb.io — blog</title>
  <link>${SITE_URL}/blog/</link>
  <description>Posts on systems, reliability, and tooling.</description>
  <language>en</language>
  <lastBuildDate>${rfc822(now)}</lastBuildDate>
${feedItems ? `${feedItems}\n` : ''}</channel>
</rss>
`);
process.stdout.write(`wrote blog/rss.xml (${published.length} items) + blog/posts.json\n`);

// Drafts: BUILD_DRAFTS=1 only, hash URL + noindex, excluded from
// index/tag/RSS/sitemap/Pagefind (G5.2 unlisted-preview semantics).
if (BUILD_DRAFTS) {
  for (const post of drafts) {
    const canonical = `${SITE_URL}/blog/draft/${post.draftHash}/`;
    const dir = join(OUT_DIR, 'draft', post.draftHash);
    mkdirSync(dir, { recursive: true });
    const article = await buildPostBody(post, DRAFTS_DIR, dir, `${SITE_URL}/blog/draft/${post.draftHash}/img`, `/blog/draft/${post.draftHash}`);
    writeFileSync(join(dir, 'index.html'), ignoreChrome(renderTemplate('shell.html', {
      TITLE: `[draft] ${post.title} — dvxb.io`,
      DESC: post.description,
      CANONICAL: canonical,
      CRUMB_HREF: '/blog/',
      CRUMB_TEXT: 'blog',
      DOWNLOAD: '',
      BODY: `<p class="draft-banner">draft preview — not published</p>\n${PROGRESS_DIV}${article}${shareFooter(post.title, canonical)}`,
      META: metaHtml(post),
      HEAD_EXTRA: `${NOINDEX}\n${post.cast ? `<link rel="stylesheet" href="${CAST_CSS}">\n` : ''}${ogHead({ ...post, canonical })}`,
      SCRIPTS: `${postScripts()}${post.cast ? castScripts() : ''}`,
      // Drafts are unlisted previews: exclude the whole article from Pagefind
      // (G5.2) on top of the noindex/RSS/sitemap exclusions. ignoreChrome runs
      // first so nav/footer/clock stay ignored without touching the article.
    })).replace('<article class="doc-panel">', '<article class="doc-panel" data-pagefind-ignore="all">'));
    process.stdout.write(`wrote blog/draft/${post.draftHash}/index.html (draft, noindex)\n`);
  }
}

process.stdout.write(`build-blog: ${published.length} published, ${drafts.length} drafts (${BUILD_DRAFTS ? 'previewed' : 'skipped'})\n`);
