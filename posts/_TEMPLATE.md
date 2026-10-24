---
# posts/_TEMPLATE.md — copy to posts/<slug>.md to start a post. NEVER BUILT:
#   guard 1: build-blog.mjs loadDir() skips `_*.md` (prod AND BUILD_DRAFTS=1);
#   guard 2: draft:true below (prod gate treats it as draft if guard 1 regresses).
title: "Post title — non-empty, ~70 chars"
description: "1-2 sentence summary. Required. Becomes META description, OG description, RSS description."
date: "2026-10-12" # required, parseable date; future date = scheduled draft (hidden until then; daily cron rebuild publishes)
tags: ["systems"] # required array of strings (replace-don't-merge); feeds tag pages + Pagefind filter
image: "hero.png" # OPTIONAL: OG/social image — relative to this md, /abs site path, or https URL. Delete line for default card (assets/blog/og-default.png, 1200x630).
cast: "demo.cast" # OPTIONAL: asciinema recording next to this md (or /abs site path). Delete line for text posts (zero player bytes).
draft: true # guard 2 — delete (or set false) to publish; true or future date: => prod emits ZERO bytes
---

<!--
FRONTMATTER (assertFrontmatter — violation fails CI, never ships a bad post):
  title/description non-empty; date parseable; tags array of strings;
  draft boolean only; image/cast non-empty string when present.
  NOTE: the key is `description`, not `desc`.

SLUG: filename posts/<slug>.md must match ^[a-z0-9-]+$ (lowercase, digits,
  hyphens) → URL /blog/<slug>/. Drafts live in posts/_drafts/ and, under
  BUILD_DRAFTS=1 only, render to unlisted /blog/draft/<sha12>/ (content-hash
  URL, noindex, excluded from index/tag/RSS/sitemap/Pagefind). Prod: zero
  draft bytes.

HEADINGS/TOC: ## and ### get build-time ids (slugified; dupes get -2/-3).
  <nav class=toc> renders only at 2+ headings — a single h2 = no TOC noise.

IMAGES: ![alt](./file.png) — relative refs resolve against THIS md's dir and
  become <picture> AVIF→WebP→JPEG × widths [320,640,960,1280,1920] capped at
  native width (never upscale), w/h attrs, loading=lazy, zero-JS LQIP backdrop;
  variants land in blog/<slug>/img/. Absolute (/...) and remote (https:) srcs
  pass through; svg/gif copy through. Missing source = CI-red throw.

CAST: `cast:` file resolved against this md's dir (/-absolute = site root),
  copied to blog/<slug>/, lazy IntersectionObserver vendored player
  (poster npt:0:05, 80x24 cap, monokai) + <details> transcript (build-time
  o-event text, ANSI-stripped, 8k cap, copy button) + <noscript><pre> fallback.
  Missing .cast = CI-red. No `cast:` line = zero player bytes. .cast sources
  live next to their md (no separate assets/casts/ dir).

SHARE/OG: every post gets a share footer (copy-link preserving ?ref=, mailto:,
  X/Bluesky/Mastodon intents) + scroll progress + ?ref=/utm_* strip via
  replaceState (canonical stays clean); OG head (og:type/title/description/url/
  image + twitter:card + article:published_time/tags, absolute URLs).

RSS/SITEMAP: published posts ONLY — rss.xml item = title/link/guid/pubDate
  (RFC-822)/description/content:encoded (full HTML); blog/posts.json manifest
  feeds per-post <lastmod> (frontmatter date, never deploy date) + IndexNow.
  Drafts/future posts appear in NONE of index/tag/RSS/sitemap/manifest/feed.
  Preview: BUILD_DRAFTS=1 node tools/build-blog.mjs + python3 -m http.server.

Delete this comment block when starting (or keep — HTML comments don't render).
-->

## First section

Intro line referencing the hero image below and the `cast:` recording above.

![Hero alt text](./hero.png)

### A subsection

Second `h2` keeps the TOC honest; delete what you don't need and write the post.
