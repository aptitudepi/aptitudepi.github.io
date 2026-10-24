# PLAN-BLOG.md — Blog Refresh Ground Truth (living, append-only)

> Append-only: add entries under logs, never rewrite history. Check this file after context compression.
> Last updated: 2026-10-11 UTC (v1 lock: comments-A, gates 1-4, phase-2 B)

## 1. Goal & Constraints

- Goal: refresh blog on static GitHub Pages, keep `shell.html` / `doc.css` look.
- Dynamic-edit / static-deploy: edit comfortably (md-friendly), deploy static HTML.
- High perf: minimal JS/CSS, fast load, no framework bloat.
- No auth needed (public static site).
- RSS wanted.
- Asciinema wanted (terminal session embeds).

## 2. Open Questions (answered 2026-10-11)

- [x] D1/R2 current use? → **Answered:** `wrangler.jsonc` has NO D1 anywhere; R2 TELEMETRY bucket declared but fallback-active (R2 not enabled, API 10042, KV `WALL_KV` is live path). `.wrangler/` only cache/state/tmp. No posts store — only `wall-guestbook` pattern to copy if needed.
- [x] md-viewer retheme scope? → **Answered:** `md-viewer.html` is fully self-contained inline style (hardcoded `#0a0a0f`, system fonts, own toolbar), zero shared CSS. `shell.html`/`man.html` load `tokens.css`+`base`+`components`+`nav`+`doc.css` + Space Grotesk/Inter/JetBrains Mono + three.js importmap + topolines + canvases (`c`, `matrix-rain`, `topo-host`) + `initMotionPolicy`/`initBackgrounds` + doc-nav terminal bar + `doc-main`/`doc-panel` scaffold. Retheme = replace inline style with 5 shared CSS links, add canvas/host nodes + doc-nav + doc-main/panel/footer, reuse `doc.css`, no JS logic change.
- [x] Minify as CI step? → **Answered with conflict:** `tools/build.mjs` (bun split-join `__KEY__`) generates resume/cv/man; `static.yml` has NO minify step; `docs/perf-budgets.md` says unminified **deliberately** (readable View-Source), budgets enforced via `check-budgets.mjs` local-only. Minify would conflict with that policy — needs explicit decision (§10).
- [x] Reusable template design? → **Answered:** `shell.html` already templated with 6 slots `__TITLE__ __DESC__ __CANONICAL__ __CRUMB_TEXT__`/`__CRUMB_HREF__ __DOWNLOAD__ __BODY__`; `man.html` differs by one class. For blog need `__NAV__` (currently hardcoded resume/cv/man) + `__META__` (date/byline/reading-time/tags).

## 3. Research Log

Fill as results come in. One row per repo examined.

### emdash (emdash-cms/emdash, NOT bearcove — 13.6k stars)

| Repo / Area | Finding | Relevance (use / skip) |
|---|---|---|
| Astro integration + `packages/cloudflare` adapter | Real static/SSR path, but needs Worker/Node | skip (GH Pages static, no Worker) |
| Kysely SQL (D1/SQLite/Turso/PG) + S3 storage (R2/S3/local) | Needs D1; repo has no D1, R2 fallback-inactive | skip (overkill for static blog) |
| `getEmDashCollection` Live Collections, `npx emdash types` | Nice DX, dynamic CMS model | skip (no admin/DB wanted) |
| Auth WebAuthn+RBAC for admin/REST-write/CLI/MCP | Required for writes | skip (no-auth constraint) |
| Public surface (posts, RSS, FTS5, SEO) prerenderable, no login | Only part that fits | use pattern: prerendered posts + RSS + FTS5-style search |

### home (bearcove/home bee44ed v6.3.1, archived 2025-10-13)

| Repo / Area | Finding | Relevance (use / skip) |
|---|---|---|
| DerivationKind Passthrough/Identity/Bitmap (JXL/PNG→AVIF/WEBP w400/@2x)/Video/VideoThumbnail/DrawioRender/SvgCleanup | Image pipeline worth stealing | use Bitmap/SvgCleanup ideas |
| Object store S3 API, librevision Pak + watcher, dumbcache | Heavy infra | skip |
| libterm ANSI→HTML/Markdown (cell-term forward) | Terminal-render pattern | use for asciinema fallback HTML |
| No `.cast` refs | Confirms no prior asciinema | — |
| Successor = dodeca (static) + arborium (highlight) | Research there instead | use |

### dodeca (b092d93 v0.17.0)

| Repo / Area | Finding | Relevance (use / skip) |
|---|---|---|
| Incremental picante queries, prod-parity dev | Build speed/correctness | use pattern (incremental `build.mjs`) |
| Cache-bust base12 alphabet | Short hashed asset names | use |
| Responsive images JXL primary + WebP fallback widths [320,640,960,1280,1920] + thumbhash | Perf checklist core | use |
| fontcull subsetting via headless chromium | Font trim | use if Google Fonts kept |
| cell-minify + svg minify | Minify precedent | use, subject to §10 policy decision |
| link_checker query-based | CI link check | use |
| cell-code-execution (pulldown-cmark + 30s timeout) | Executable code cells | optional/later |
| from-scratch pagefind-inspired search (UAX29 + Snowball, facet-postcard shards) | Zero-dep search | use if search wanted |
| gingembre Jinja-like templates with diagnostics (`libs/gingembre`, not standalone) | Template model | use pattern for `__NAV__`/`__META__` slots |
| cell-vite + livereload WASM | Dev DX | skip (bun build.mjs suffices) |

### arborium (45fae8a v2.18.2)

| Repo / Area | Finding | Relevance (use / skip) |
|---|---|---|
| ~70 langs, Rust lib Highlighter+AnsiHighlighter `Arc<GrammarStore>` rayon-parallel, 23 themes | Build-time highlight engine | use (pre-render, zero client JS) |
| Browser `@arborium/arborium` IIFE auto-highlight + ESM | Client fallback | skip (prefer pre-render) |
| WASM allocator fix | — | — |
| Dodeca uses arborium crates at build time | Proven pattern: pre-render HTML | use pattern |

### astro

| Repo / Area | Finding | Relevance (use / skip) |
|---|---|---|
| Content layer + collections + `@astrojs/rss` endpoint shape | MD→HTML + RSS model | use shape, not framework |
| Shiki alternative | Ecosystem win but heavier than arborium pre-render | skip (arborium lighter) |
| Pagefind drop-in search | Alternative to dodeca search | optional alternative |

### asciinema (7749806 v3.2.1)

| Repo / Area | Finding | Relevance (use / skip) |
|---|---|---|
| Recorder asciicast v1/v2/v3 zstd (~8%) | Small `.cast` files | use |
| Static embed: `<link css><div><script min.js> AsciinemaPlayer.create('demo.cast', el, {poster, idleTimeLimit, theme})` — host `.cast` statically or R2, no server | Fits GH Pages | use |
| Perf: KBs vs MBs mp4; costs player JS/WASM + SymbolsNerdFont woff2 | Lazy-init needed | use with IntersectionObserver + poster (avoid CLS), cap cols×rows |
| Build-time HTML fallback like cell-term | No-JS/readable fallback | use (libterm pattern) |

### Other bearcove repos

| Repo | Finding | Relevance (use / skip) |
|---|---|---|
| facet-rs/facet (moved from bearcove; typed-config + facet-postcard cache) | Config/cache pattern | optional |
| home-tree-sitter | Superseded by arborium | skip |
| home-drawio (drawio→SVG) | Diagram pipeline | optional/later |
| marq/tracey (spec-coverage docs) | Docs pattern | optional |
| picante/fontcull (live in dodeca `libs/`) | See dodeca | use via dodeca |
| beardist (release to object storage) | Deploy helper | skip (GH Pages) |
| timelord (mtime restore for hot caches) | Cache-hot builds | optional |
| figue (CLI config) | — | skip |
| dodeca-zed + authoring-lsp | MD authoring DX | optional |
| hindsight (tracing) | — | skip |
| bearcove.eu (live dodeca consumer) | Reference output | use as example |

Corrections: emdash is not bearcove; facet moved to `facet-rs/facet`; gingembre is `libs/gingembre` inside dodeca, not standalone.

## 4. Decision Matrix (filled 2026-10-11)

| Option | Fit w/ shell.html/doc.css | Edit UX | Perf | RSS | Asciinema | Effort | Verdict |
|---|---|---|---|---|---|---|---|
| EmDash | Poor (Astro theme, adapter rewrite) | Great (CMS) | OK (needs Worker) | Built-in | Manual | High (D1+R2+auth+Worker) | **Reject** — dynamic CMS, needs Worker/Node+D1, violates static+no-auth |
| home | Medium (ideas only, archived 2025-10-13) | N/A (infra, not blog) | Good patterns | No | No `.cast` refs | Medium (port pipeline) | **Reject as base** — steal DerivationKind/libterm ideas only |
| dodeca + arborium | Good (static HTML, pre-render highlight) | MD cells + gingembre + LSP | Best (JXL/WebP+thumbhash, fontcull, minify, incremental) | Build it | Via static embed | High (port Rust/libs) | **Steal patterns, don't adopt** — too much port for this repo |
| Custom (current + tweaks) | Perfect (shell.html as-is) | Good (md + `build.mjs` split-join) | Good (add checklist §6 only) | Small `rss.xml` gen | Static `.cast` + lazy player (§7) | Low | **Winner** — extend `build.mjs`, keep View-Source policy unless §10 changes |

## 5. Next Steps Checklist

- [x] Fill research tables (§3) from subagent results
- [x] Answer open questions (§2)
- [x] Fill decision matrix (§4), pick winner → Custom
- [ ] Write implementation plan (files to change, CI steps, template)
- [ ] Implement + verify (build, perf check, RSS + asciinema demo)

## 6. Performance checklist (stolen from dodeca, sized for this repo)

- [ ] Hashed assets (cache-bust base12-style short names) for css/js
- [ ] Responsive images JXL primary + WebP fallback, widths [320,640,960,1280,1920] + thumbhash/LQIP
- [ ] Font subsetting (fontcull pattern) if Space Grotesk/Inter/JetBrains Mono kept; else system-font fallback
- [ ] Minify policy decision (§10) — cell-minify/svg-minify precedent vs View-Source readability
- [ ] Link check in CI (link_checker query-based pattern)
- [ ] Code execution cells — defer (pulldown-cmark + 30s timeout pattern noted)
- [ ] Search — defer or Pagefind drop-in / dodeca UAX29+Snowball facet-postcard pattern if wanted

## 7. Asciinema embed plan

- Host `.cast` (v3 zstd) statically under `assets/casts/` (or R2 TELEMETRY if ever enabled — currently fallback-inactive, so static).
- Embed: `<link rel=stylesheet href=player.css><div id=demo></div><script src=player.min.js>` + `AsciinemaPlayer.create('demo.cast', el, {poster: 'npt:0:05', idleTimeLimit: 2, theme: 'monokai'})`.
- Lazy-init on IntersectionObserver; poster frame to avoid CLS; cap cols×rows (e.g. 80×24).
- Cost: player JS/WASM + SymbolsNerdFont woff2 — load only on posts with `.cast`.
- Build-time HTML fallback (libterm/cell-term pattern) inside `<noscript>` + readable `<pre>`.

## 8. md-viewer retheme tasks

1. Delete inline `<style>` (hardcoded `#0a0a0f` etc); link 5 shared CSS: `tokens.css`, `base`, `components`, `nav`, `doc.css`.
2. Add font links (Space Grotesk/Inter/JetBrains Mono) + three.js importmap (copy from `shell.html`).
3. Add `<canvas id=c>`, `<canvas id=matrix-rain>`, `<div id=topo-host>` + `initMotionPolicy()`/`initBackgrounds()` calls.
4. Replace toolbar with doc-nav terminal bar; wrap content in `doc-main`/`doc-panel` scaffold + shared footer.
5. Reuse `doc.css` classes for MD body; no JS logic change (render path untouched).

## 9. Reusable template tasks (`shell.html` → blog layout)

1. Add `__NAV__` slot (replace hardcoded resume/cv/man list; generate from posts index).
2. Add `__META__` slot (date/byline/reading-time/tags) rendered into doc-panel header.
3. Keep existing 6 slots untouched; `man.html` one-class diff becomes a flag, not a fork.
4. Extend `tools/build.mjs` split-join: md posts dir → shell template → `blog/<slug>/index.html` + index page + `rss.xml` (`@astrojs/rss` endpoint shape as model).

## 10. Minify CI proposal (conflicts with View-Source policy)

- Precedent: dodeca cell-minify + svg minify; `static.yml` currently NO minify; `docs/perf-budgets.md` + `check-budgets.mjs` enforce budgets local-only with unminified-intentional policy.
- Proposal if adopted: add opt-in CI step (html-minifier-terser/clean-css/terser or dodeca cell-minify port) producing `-min` artifacts or minify-only-on-release; keep `View-Source` readable on main.
- Decision needed: keep readable-source policy (skip minify, rely on hashed assets + image/font wins) vs max-perf (minify release). Recommend: **defer minify; do images/fonts/hashing first**.

---
### Append-only log

- 2026-10-11: file created (scaffold).
- 2026-10-11: research filled (§2 answered, §3 tables, §4 matrix → Custom wins, §§6–10 added). Sources: explore (wrangler/md-viewer/build/shell slots); ~/repos dodeca b092d93 v0.17.0, arborium 45fae8a v2.18.2, home bee44ed v6.3.1, asciinema 7749806 v3.2.1, emdash-cms/emdash (non-bearcove).
- 2026-10-11: R2/KV ground-truth re-verify (corrects §2 R2 line, which predates commit `190f474`): `wrangler.jsonc:15-20` declares TELEMETRY R2 binding (bucket `telemetry`, live since 2026-09-09 via dashboard per `190f474`). Worker prefers `env.TELEMETRY` for opaque blobs (`assets/v86/cors-proxy-worker.js:210-216`), `WALL_KV` fallback (`:217-221`); public posts are ALWAYS KV (`:509-523`) — R2 only carries telemetry blobs, so "R2 live" ≠ "KV retired." Client `wall` GET/POST → `0.supernovadkb.workers.dev/wall` (`js/commands.js:1796,1848`), telemetry encrypted client-side (`:1840-1843`). Live deployment NOT verifiable from repo alone (`logs/` holds only terminal-goldens; no deploy logs) — confirm via dashboard / `wrangler tail` / live POST. Stale: worker `:34-38` still says R2 BLOCKED (contradicts `190f474`). Minify idea added to IDEAS.md CI table as TABLED (View-Source policy conflict, `docs/perf-budgets.md:36-38`).

---
## Appendix B — Clone + options research (2026-10-11T19:03Z → appended ~19:25Z)

### B1. Repo clones into ~/repos (all 12 newly cloned, none pre-existed)

| dir | source | HEAD |
|---|---|---|
| facet | facet-rs/facet | `65bae5c` 2026-08-20 — release v0.50.0-rc.7 |
| home-drawio | bearcove/home-drawio | `e1d47fa` 2025-04-22 — Add logo |
| beardist | bearcove/beardist | `4f6c38a` 2025-04-28 — Strip v from the version |
| timelord | bearcove/timelord | `7aed4df` 2025-03-22 — Release 3.0.2 |
| figue | bearcove/figue | `4780161` 2026-08-20 — restore trusted crates.io releases (#116) |
| tracey | bearcove/tracey | `66008aa` 2026-10-08 — StrictDoc parser 0.2 + exclude fixes (#209) |
| marq | bearcove/marq | `286a3f8` 2026-06-22 — release v5.0.0-rc.1 (ARCHIVED) |
| bearcove.eu | bearcove/bearcove.eu | `ed4aa39` 2026-06-22 — blue accent |
| picante | bearcove/picante | `a191115` 2026-06-18 — points users to Facet monorepo |
| fontcull | bearcove/fontcull | `b5d9b45` 2026-06-18 — points readers to Dodeca (ARCHIVED) |
| hindsight | bearcove/hindsight | `5ec1ed0` 2026-02-05 — domain bearcove.net → bearcove.eu |
| dodeca-zed | bearcove/dodeca-zed | `b09ae1f` 2026-05-26 — Highlight Gingembre in Dodeca HTML |

Note: `~/repos/dodeca` (SSG) already existed and is distinct from `dodeca-zed` (Zed extension). First clone batch briefly landed in the site dir due to a `cd && … &` subshell bug; moved to `~/repos/`, site tree untouched (no site code modified).

### B2. SSG options (stars / pushed_at as of 2026-10-11 via `gh api`)

| repo | ★ | active | verdict for this blog |
|---|---|---|---|
| gohugoio/hugo | 90k | 2026-10-11 | Fastest, single binary, zero-dep. But: Go templates fight the existing `shell.html` + `tools/build.mjs` custom pipeline (§9); adopts a framework to replace ~50 lines of split-join. Skip. |
| withastro/astro | 63k | 2026-10-11 | Most momentum, content collections + built-in Shiki. Same objection as Hugo: heavier than needed; custom build already wins (§4). Steal: content-collection frontmatter validation pattern (zod schema per post). |
| 11ty/eleventy | 20k | 2026-10-09 | Closest philosophy to custom (transform templates dir, no client JS). If custom ever gets dropped, this is the migration target. Steal: layout-chain + computed-data cascade. |
| getzola/zola | 17.5k | 2026-10-08 | Single binary, built-in Sass/search/feeds — most batteries-included, Tera templates. Runner-up if custom is abandoned. Steal: built-in `config.toml` taxonomies → tags pages. |
| lumeland/lume | 2.3k | 2026-10-11 | Deno, flexible, small community. No advantage over current Node build script. Skip. |
| bearcove/dodeca ★223 | — | 2026-08-21 | Already-vendored precedent (cell-minify, svg minify). Steal, don't adopt. |

Pattern to steal: nobody — keep custom `build.mjs`; adopt Eleventy's data-cascade idea (per-dir JSON frontmatter defaults) if post metadata grows.

### B3. Markdown rendering + syntax highlighting

| repo | ★ | active | relevance |
|---|---|---|---|
| shikijs/shiki | 13.9k | 2026-10-01 | VS-Code-quality, build-time HTML (zero client JS) — matches readable-source + perf-budget policy. Dual-theme (light/dark) via CSS vars fits terminal theme. **Pick for build-time highlight.** |
| highlightjs/highlight.js | 25k | 2026-09-06 | Zero-dep client-side + auto-detect. Fallback if build-time step is unwanted; heavier runtime, less accurate. |
| bearcove/arborium ★504 | — | 2026-08-28 | tree-sitter + highlight bundle, already in workspace. Accurate + fast, but Rust/WASM integration cost vs Shiki's one npm call. Only if tree-sitter grammars needed. |

Pattern to steal: Shiki at build time in `build.mjs` (rehype/remark plugin or direct `codeToHtml`), emit dual-theme tokens, no runtime JS. Terminal theme = one custom Shiki theme JSON.

### B4. Static search

| repo | ★ | active | relevance |
|---|---|---|---|
| Pagefind/pagefind | 5.5k | 2026-10-08 | Indexes built HTML post-build, chunked fragments (low bandwidth), no build integration, MIT, works on GH Pages. **Pick.** Post-build binary step after `build.mjs`; UI component stylable as terminal palette. |
| olivernn/lunr.js | 9.2k | 2024-07 (stale) | Single upfront index, instant search, but loads everything; maintenance-quiet. Only for tiny indexes. |
| bearcove/dodeca-search | — | (in ~/repos/dodeca) | Bearcove-native; evaluate only if Pagefind theming/chunking proves awkward. |

Pattern to steal: Pagefind `data-pagefind-body` / `data-pagefind-meta` attributes on post HTML + default modal UI re-skinned.

### B5. RSS

No framework needed: `feed` npm (v6.0.0, maintained) or hand-rolled string template in `build.mjs` (~20 lines, zero dep — most ponytail). `@astrojs/rss` (v4.0.19) is Astro-only; steal its item-shape (title/description/pubDate/link) as the model, not the dep. Recommend: hand-roll `rss.xml` in `build.mjs`.

### B6. asciinema embedding

- asciinema/asciinema-player ★2.9k, active 2026-09-13: standalone JS+CSS bundle, self-hostable, plays `.cast` from same origin — no asciinema.org dependency. **Pick:** vendor bundle, load only on posts with `.cast` (matches existing §7 decision), build-time `<noscript>` HTML fallback.
- Pattern to steal: `danielraffel.me` 2026 tool — record CLI → host `.cast` in repo → embed; trim server-side. Keep player version pinned; lazy-load via IntersectionObserver.

### B7. Image optimization

| repo | ★ | active | relevance |
|---|---|---|---|
| lovell/sharp | 32.7k | 2026-10-11 | Fastest Node pipeline; emit AVIF/WebP + srcset widths at build time in `build.mjs`. **Pick for build step.** |
| GoogleChromeLabs/squoosh | 26k | 2026-10-07 | Best-in-class codecs in-browser/WASM; good for one-off manual compression, not CI. |
| 11ty image plugin | — | — | Reference pattern: build-time multi-size/multi-format + cache. Copy the shape, not the dep. |

Pattern to steal: build-time `sharp` → `{avif, webp, jpeg}` × widths → `<picture>`/srcset + `loading=lazy`; keep originals out of deploy. Pairs with font subsetting precedent (fontcull → Dodeca, §10-adjacent).

### B8. Bottom line

Adopt zero frameworks: custom `build.mjs` + **Shiki** (highlight) + **Pagefind** (search) + **hand-rolled RSS** + **vendored asciinema-player** + **sharp** (images). All batteries-included libs, no framework lock-in, each is one build step or one vendored asset. Minimal maintenance: Pagefind/sharp/Shiki update via Dependabot; everything else is static output.

---
## Appendix C — Deep per-repo steal sheet (2026-10-11T~20:00Z)

All 9 cloned into `~/repos/` (eleventy/zola/shiki/pagefind/marked/DOMPurify/sharp/asciinema-player new; astro pre-existed). Stars/pushed via `gh api` 2026-10-11. Site code untouched — only this file edited. Shell ground truth re-verified: `templates/shell.html` has 7 slots (`__TITLE__ __DESC__ __CANONICAL__ __CRUMB_TEXT__ __CRUMB_HREF__ __DOWNLOAD__ __BODY__`); `tools/build.mjs` uses same split-join. Blog needs new `__NAV__ __META__ __HEAD_EXTRA__ __SCRIPTS__` slots (§9).

### C1. 11ty/eleventy — HEAD `c0bb3f4` 2026-10-02 · v4.0.0-alpha.10 · ★19961 · pushed 2026-10-09 · MIT
- **Mechanism:** data cascade in `src/Data/TemplateData.js` (`getDataValue` + `Merge` from `@11ty/eleventy-utils`, lodash get/set): global `_data/` files ← per-dir data files ← frontmatter ← computed data (`src/Data/ComputedData.js` queue, `ComputedDataProxy.js`). Collections = `src/TemplateCollection.js` (`getFilteredByTag`/`getFilteredByTags` over frontmatter `tags`). Frontmatter via `@11ty/gray-matter` (`src/Engines/FrontMatter/`, JS-frontmatter eval removed in v2).
- **Steal:** per-dir defaults convention — `posts/posts.json` (`{layout, author, tags}`) shallow-merged under each post's frontmatter (~15 lines in `build-blog.mjs`); `tags: []` array + a `getFilteredByTag` 5-liner to generate tag pages into `__NAV__`. No dep needed — copy the pattern, not the package.
- **Cost:** pattern-only = zero dep, zero runtime JS. Adopting Eleventy itself = Node dep + Nunjucks/Liquid rewrite of shell.html (see table).

### C2. getzola/zola — HEAD `9740ae2` 2026-10-09 · v0.23.6 (`[workspace.package]`) · ★17504 · pushed 2026-10-08 · EUPL-1.2
- **Mechanism:** `PageFrontMatter` (`components/content/src/front_matter/page.rs`: title/description/date/updated/draft/slug/path/taxonomies/weight/authors) vs `SectionFrontMatter` (`section.rs`, `deny_unknown_fields`, sort_by/paginate_by); sections = dirs with `_index.md`, pages = `.md`; taxonomies declared in `config.toml` (`components/config/src/config/taxonomies.rs`, merged per-language in `languages.rs` `merge_field!`); Tera templates + built-in feeds/search/sass.
- **Steal:** `_index.md`-per-section convention (`blog/_index.md` → section title/desc/sort) + taxonomies block (`tags`, `categories`) auto-generating tag pages into `__NAV__`; copy the frontmatter field set verbatim as the `build-blog.mjs` validation checklist. Zero dep.
- **Cost:** pattern-only = zero dep, zero runtime JS. Adopting Zola = single binary (no Node), but Tera rewrite of shell.html + EUPL license note.

### C3. shikijs/shiki — HEAD `f7d0167` 2026-10-01 (release v4.5.0) · `packages/shiki` + `@shikijs/rehype` v4.5.0 · ★13863 · pushed 2026-10-01 · MIT
- **Mechanism:** `codeToHtml` (`packages/core/src/highlight/code-to-html.ts`: `codeToHast` + `hast-util-to-html` + transformer `postprocess`); multi-theme via `options.themes: {light, dark}` emitting per-token dual values as CSS vars (`packages/core/src/theme-css-variables.ts` `createCssVariablesTheme`, default prefix `--shiki-`); rehype plugin (`packages/rehype/src/core.ts`) visits `pre` blocks with optional cache.
- **Steal:** build-time `codeToHtml(code, {lang, themes: {light: 'github-light', dark: 'github-dark'}})` (or one custom terminal-theme JSON) in `build-blog.mjs`; emit the vars `<style>` into `__HEAD_EXTRA__`. Zero runtime JS, dual theme for free.
- **Cost:** build-time npm only (`shiki`, oniguruma WASM at build); pin version, Dependabot. No client weight.

### C4. pagefind/pagefind — HEAD `b6185b2` 2026-10-08 · latest release v1.5.2 (2026-04-12) · ★5511 · pushed 2026-10-08 · MIT
- **Mechanism:** Rust indexer (`pagefind/src/fossick/parser.rs` reads `data-pagefind-body` / `data-pagefind-meta` / `filter` / `sort` / `ignore` / `index-attrs`; `fossick/splitting.rs` fragments pages) → chunked WASM index shards fetched on demand; UI in `pagefind_ui/` (`default/`, `modular/`, svelte) that can be lazy-loaded and re-skinned.
- **Steal:** post-build `npx pagefind --site dist` step after `build-blog.mjs`; add `data-pagefind-body` to post wrapper + `data-pagefind-meta="title[title], date[date]"` + `data-pagefind-filter="tag"` in shell; load UI JS only on search route into `__SCRIPTS__`.
- **Cost:** build-time binary via npx; runtime ~tens KB WASM+JS chunked, only on pages that include the UI. Zero build integration needed (indexes built HTML).

### C5. asciinema/asciinema-player — HEAD `fc82c58` 2026-08-13 · v3.17.0 · ★2930 · pushed 2026-09-13 · Apache-2.0 (JS, `src/index.js` + `src/opts.js`; distinct from Rust CLI in `~/repos/asciinema`)
- **Mechanism:** `create(src, elem, opts)` (`src/index.js`: Core + `mount(view)`); opts split into `coreOpts` (audioUrl/autoPlay/cols/rows/idleTimeLimit/poster/preload/speed/startAt) vs `uiOpts` (theme/fit/controls/font) in `src/opts.js`; `poster: 'npt:0:05'` renders a still frame (avoids CLS); `idleTimeLimit: 2` caps idle playback.
- **Steal:** vendor `dist` css+js; `AsciinemaPlayer.create('x.cast', el, {poster: 'npt:0:05', idleTimeLimit: 2, cols: 80, rows: 24, theme: 'monokai'})` behind IntersectionObserver in `__SCRIPTS__` (load only on posts with `.cast`); `<noscript><pre>` transcript fallback (matches §7).
- **Cost:** player JS+CSS + SymbolsNerdFont woff2, scoped to cast-posts only. Pin version.

### C6. withastro/astro (rss + content layer only) — HEAD `9050e3819c` 2026-10-09 · `@astrojs/rss` 4.0.19 · ★63166 · pushed 2026-10-11
- **Mechanism:** `packages/astro-rss/src/index.ts` zod `rssSchema` (title/description/link/pubDate/customData; requires title||description; per-item frontmatter+link validated); canonical URL in `src/util.ts` (`createCanonicalURL` strips `index.html`, normalizes slashes); content layer `packages/astro/src/content/config.ts` (`defineCollection` + zod schema) with `loaders/glob.ts` file loader.
- **Steal:** RSS item shape `{title, description, link, pubDate}` + canonical-URL rule → hand-rolled `rss.xml` (~20 lines, zero dep, most ponytail); zod-style frontmatter assert per post (or plain asserts — skip zod dep).
- **Cost:** zero dep, zero runtime JS. Do NOT adopt the dep (`@astrojs/rss` is Astro-only).

### C7. markedjs/marked — HEAD `6a57018` 2026-10-10 · v18.1.0 · ★37229 · pushed 2026-10-10
- **Mechanism:** `Lexer.ts` → `Parser.ts`; GFM on by default (`src/defaults.ts` `gfm: true`); entry `marked.parse` (`src/marked.ts`) with `use()` extensions, `Renderer.ts` overrides, `walkTokens` hook.
- **Steal:** `marked.parse(md, {gfm: true})` + custom `renderer.heading` → slug IDs (feeds `__NAV__` anchors + Pagefind structure). Pairs with DOMPurify below.
- **Cost:** tiny zero-dep (~single file, `src/` 156K), actively maintained. Build-time only.

### C8. cure53/DOMPurify — HEAD `a3a4061` 2026-10-10 · v3.4.16 · ★17452 · pushed 2026-10-11 · Apache-2.0 (min build 30KB `dist/purify.min.js`)
- **Mechanism:** `sanitize()` in `src/purify.ts` over allowlist sets (`src/tags.ts`, `src/attrs.ts`); `USE_PROFILES: {html: true}` preset (`purify.ts:587,880`); hooks API for custom policy.
- **Steal:** `DOMPurify.sanitize(markedHtml, {USE_PROFILES: {html: true}, ADD_ATTR: ['data-pagefind-body','data-pagefind-meta','data-pagefind-filter'], FORBID_TAGS: ['iframe']})` between marked and shell injection in `build-blog.mjs`. NOTE: needs a DOM at build time (jsdom/happy-dom) — that is the only weight; allowlist must include Pagefind `data-*` attrs and asciinema containers or the pipeline will strip them.
- **Cost:** small dep + build-time DOM shim; zero runtime JS.

### C9. lovell/sharp — HEAD `3887f0f` 2026-10-11 · v0.35.5 · ★32748 · pushed 2026-10-11 · Apache-2.0 (checkout 87M — libvips native)
- **Mechanism:** `lib/output.mjs` (`toFormat`/`avif()`/`webp()`), `lib/resize.mjs`, libvips backend (`lib/libvips.mjs`); pipeline `sharp(in).resize({width}).toFormat(fmt, opts).toFile(out)`.
- **Steal:** widths `[320,640,960,1280,1920]` × `{avif, webp}` (+jpeg fallback) → `<picture>` srcset + `loading="lazy"` + width/height attrs (CLS-safe) in `build-blog.mjs`. Keep originals out of deploy.
- **Cost:** heaviest dep here (native libvips download, large install); build-time only, zero runtime JS. Pin version; cache output dir to keep builds incremental.

### C10. Comparison: Eleventy vs Zola vs Custom build.mjs vs Astro vs Dodeca

| Axis | Eleventy (★20k) | Zola (★17.5k, v0.23.6) | Custom `build.mjs` (winner, §4) | Astro (★63k) | Dodeca (b092d93) |
|---|---|---|---|---|---|
| Hosting fit (GH Pages) | Perfect (static output) | Perfect (static binary output) | Perfect (already deployed) | Perfect for static export, but ships framework JS | Perfect (static) but Rust toolchain |
| Template rewrite cost | Medium: shell.html → Nunjucks/Liquid layout chain | Medium-high: shell.html → Tera templates + `config.toml` | Zero: 4 new slots only (§9) | High: shell.html → Astro components/islands, adapter not needed but idiom rewrite | Highest: port Rust libs (gingembre/cells) |
| Perf levers | No client JS by default; needs plugins for images/search | Built-in sass/feeds/search, imageproc; no JS | Hand-picked: Shiki (0 JS) + Pagefind (chunked) + sharp + fontcull-idea + hashed assets (§6) | Content collections + Shiki built-in, but island hydration JS by default | Best-in-class (JXL/WebP+thumbhash, fontcull, cell-minify, incremental) — at port cost |
| Maintenance | npm, Dependabot, large community; must track v4 alpha | Single binary, no npm; Tera + EUPL; small core team | Minimal: 5 pinned build deps, rest static; bus factor = this repo | Heavy: Astro + adapter + integration churn; overkill for md→html+shell | Highest: track bearcove monorepo libs, Rust builds in CI |
| Verdict | Migration target IF custom ever dropped; steal data-cascade (C1) | Runner-up IF custom dropped; steal taxonomies/_index.md (C2) | **Keep** — adopt C1–C9 steals as build steps | Steal RSS shape + collection schema (C6); skip framework | Steal perf checklist (§6); skip adoption |

Bottom line unchanged from §B8, now file-path-grounded: custom `build.mjs` + marked → DOMPurify → Shiki → shell slots → rss.xml → sharp → Pagefind. Total runtime JS on a post: zero (text) or player-only (cast posts); search UI only on search page.
---

## Live Cloudflare verification — wall feature (2026-10-11 UTC, read-only)

- Workers: 1 worker, name `0` (matches `wrangler.jsonc` name; serves `0.supernovadkb.workers.dev` per `js/commands.js:1796,1848`). Modified 2026-10-01. Deployed bundle (~25KB) contains `TELEMETRY`, `WALL_KV`, `/wall`, `telemetry/` put — matches repo source.
- R2 `telemetry`: EXISTS (ENAM, Standard, created 2026-09-10). Holds 8+ `telemetry/*.asc` blobs, latest 2026-10-07, with `contentType application/pgp-encrypted`, `private, no-store`, customMetadata `postId/createdAt/fpHash` — exactly the R2-prefer write shape (`cors-proxy-worker.js:210-214`). R2 path is LIVE and receiving writes.
- KV `WALL_KV`: EXISTS, prod id `cae9…48f6ca` == `wrangler.jsonc:24`, preview `8940…46f9ea` == `:25`. `posts` key readable, 4 public posts (latest 2026-10-07) — public-posts-always-KV (`:509-523`) confirmed live.
- Observability: keys schema present, but events queries (service filter, `wall` needle, unfiltered 24h over 2026-10-04→11) all returned empty; no success-rate data available. No test data posted (read-only).
- CORRECTION to §2 (line 17): the "R2 not enabled, API 10042, KV `WALL_KV` is live path / fallback-active" note is STALE. Ground truth: R2 TELEMETRY binding live since 2026-09-10 (dashboard-bound, mirrored in `wrangler.jsonc:15-20`); worker prefers R2 for blobs with KV fallback (`:210-221`), public posts always KV (`:521-523`). Both paths verified live.

---
## Appendix E — Gap sweep, second pass (2026-10-11T~23:00Z)

Seven areas not covered in B/C. Per area: top 1–2 repos/patterns (HEAD/stars verified 2026-10-11), steal/skip, Custom-`build.mjs` verdict impact. Site code untouched — only this file edited.

### E1. Frontmatter / content validation

| Repo / pattern | HEAD / stars | Steal | Skip |
|---|---|---|---|
| withastro/astro content layer (`defineCollection` + zod, `z.coerce.date()`, fail-build-on-violation) | `9050e3819c` 2026-10-09 · ★63k | Field set verbatim as validation checklist (`title/description/pubDate/updatedDate/tags/draft`, C6) + coerce-date idea | Framework + dep (Astro-only) |
| HiDeoo/zod-matter (gray-matter + zod wrapper, `parse`/`read` throw `ZodError`) | main · ★30 · MIT | Pattern only: schema + throw = fail the CI build | The dep (★30, single maintainer; ~10 lines of asserts do it) |
| jonschlinkert/gray-matter 4.0.3 vs `@11ty/gray-matter` 2.0.2 | upstream stale, open cache bug #166 (invalid frontmatter cached, 2nd call returns wrong `{}`) | Maintained `@11ty/` fork if a parser dep is wanted | Upstream gray-matter |
| 11ty data-cascade pitfalls (docs + issues #2060/#3078) | ★20k | Two rules for custom build: (a) replace-don't-merge `tags` arrays (cascade deep-merges); (b) sort posts by parsed-date UTC explicitly (their deploy-order/TZ bugs bite the same way) | `eleventyExcludeFromCollections` machinery — see E2 |

**Verdict impact:** none — Custom stands. Validation = plain asserts in `build-blog.mjs` (~20 lines), no zod dep.

### E2. Drafts / preview / scheduled publishing without auth

| Repo / pattern | HEAD / stars | Steal | Skip |
|---|---|---|---|
| rossjrw/pr-preview-action v1.8.1 | main · ★441 · used by 1.4k projects | Whole pattern IF draft previews wanted: PR → `pr-preview/pr-N/` subpath + sticky comment + self-cleanup on close | Caveat: assumes branch-based Pages deploy; repo uses artifact deploy (`upload-pages-artifact` + `deploy-pages`) — main workflow needs `clean-exclude: pr-preview/` equivalent or previews get wiped (same gotcha as Quarto+`github-pages-deploy-action` reports) |
| Hugo semantics (`draft`/`publishDate`/`expiryDate`, future excluded by default, `-D/-F/-E` to include) + Eleventy (`eleventyExcludeFromCollections:true` + `permalink:false` via computed data, `process.env.CI` ignores) | hugo ★90k, eleventy ★20k | Exact gate for `build-blog.mjs`: `draft:true` or `publishDate>now` → skip unless `BUILD_DRAFTS=1`; `posts/_drafts/` dir never built in CI | `?draft=` token idea — no static-native pattern exists; on GH Pages it's security-by-obscurity (no server). Use unlisted-but-built URLs (`noindex`) or PR previews instead |
| `static.yml` schedule cron (`0 6 * * *`, already live for Full-CV sync) | this repo | Reuse same cron for `publishDate` gating — zero new infra; future-dated post goes live on next daily rebuild | New scheduler/action |

**Verdict impact:** strengthens Custom — no new deps, cron already exists.

### E3. Image / media pipeline on Pages (2026 reality check)

| Repo / pattern | HEAD / stars | Steal | Skip |
|---|---|---|---|
| lovell/sharp v0.35.5 | `3887f0f` 2026-10-11 · ★32.7k · 9M weekly dl | Production pick, build-time only: widths × `{avif, webp}` + jpeg fallback → `<picture>`, `loading=lazy`, w/h attrs. AVIF q60 ≈ JPEG q85, `effort: 6`; 5–6× slower AVIF encode is irrelevant at build time | — |
| GoogleChromeLabs/squoosh | ★26k | One-off manual quality exploration only | CI use (WASM, ~25× slower than sharp) |
| evanw/thumbhash ★4.2k vs LQIP-vs-JS tradeoff | main, MIT | LQIP-first: sharp → 32px q10–15 JPEG data-URI (~200–400 B) + CSS `blur()`, zero JS. ThumbHash only if placeholder fidelity proves lacking (needs JS decode) | junevm/splathash ★208 (Feb 2026, 16 B fixed, 0.067 ms decode) — watch, don't adopt (26 commits, unproven) |
| JXL vs AVIF 2026 | multi-benchmark consensus | **CORRECTION to §6:** drop "JXL primary". AVIF ~93–95% browser coverage vs JXL ~15% Safari-only (Chrome JXL behind flag since Canary 145, `jxl-rs`). Ship AVIF→WebP→JPEG. JXL's real wins (encode speed, lossless JPEG repack ~20%, progressive) don't deliver to readers | Dodeca's JXL-primary checklist line as written |

**Verdict impact:** amends §6 (AVIF-primary), Custom otherwise stands.

### E4. Search + RSS + sitemap robustness

| Repo / pattern | HEAD / stars | Steal | Skip |
|---|---|---|---|
| Pagefind/pagefind v1.5.2 (2026-04-12) | `b6185b2` 2026-10-08 · ★5.5k · MIT | Confirms C4 + pitfalls: (a) `data-pagefind-ignore` on nav/footer/clock or index pollutes; (b) scope with `--glob 'blog/**/*.html'`; (c) `<html lang="en">` already present ✓ (result-id prefix); (d) v1.5.x runs in Web Worker, ~45% smaller chunks — ~100 kB typical, search-page-only load | lunr.js (stale 2024, loads whole index) |
| RSS 2.0 spec + `feed` npm shape | spec (rssboard.org) | Hand-roll stands, plus hardening list: channel `title/link/description` required; per-item `title/link/guid(isPermaLink=false, stable non-URL or permalink)/pubDate` RFC-822 + `description` (+ `content:encoded` full text); absolute URLs only; XML-escape every field; CI assert (~15 lines, channel+item presence — blavity/smartformat-validate-action shape minus SmartNews-specific fields) | `feed` npm dep (template does it in ~20 lines) |
| Existing `tools/sitemap.mjs` + `site-urls.mjs` + IndexNow in `static.yml` | this repo | Extension pattern is clean, one fix: per-post `<lastmod>` from frontmatter date — current sitemap stamps deploy-date on ALL urls, which lies for posts once blog exists. IndexNow needs no change (extends URL list free) | New sitemap lib |

**Verdict impact:** Custom stands + one correction (per-post lastmod).

### E5. Terminal-embedded content

| Repo / pattern | HEAD / stars | Steal | Skip |
|---|---|---|---|
| asciinema/asciinema-player | ★2.9k (C1: `fc82c58`, player docs) | Confirms §7 + two refinements: (a) default `preload:false` fetches on play — keep; NPT `poster` forces preload (bandwidth cost, use sparingly); (b) split UI/worker bundle exists for responsiveness. Pin version at vendor time (npm/GitHub tags disagreed at check time — verify, don't trust memory) | asciinema.org embeds (external dep, privacy) |
| bearcove libterm/cell-term (ANSI→HTML build-time) | in ~/repos/dodeca | `<noscript><pre>` transcript fallback generated at build time — screen-reader + no-JS path in one | NAME COLLISION — rizukirr/libterm (C11 TUI lib) and ColdGrub1384/LibTerm (iOS terminal) are unrelated; do not fetch |
| terminal-ui ACCESSIBILITY.md pattern | OpenKnots | Copy-transcript button per embed + `aria-label` on player container + focusable controls; transcript fallback doubles as the AT path | Canvas-only renderers (player is DOM-based, text stays selectable) |

**Verdict impact:** Custom stands; §7 confirmed + copy-transcript requirement added.

### E6. Incremental builds + cache

| Repo / pattern | HEAD / stars | Steal | Skip |
|---|---|---|---|
| bearcove/timelord (mtime preserve via hash db) | main · ★40 · MIT/Apache | Idea only, and only for sharp output: `actions/cache` on image-output dir keyed by input hash; 5-line size/mtime manifest, no dep | The tool (Cargo-specific; bun build is seconds) |
| `build-info.json` SHA provenance + `actions/deploy-pages@v4` atomicity | this repo | (a) Provenance exists (`sha/run_number/built_at`) — optionally embed per-post content hash at build time, cheap; (b) deploy-pages swaps the whole artifact live at once = atomic, no partial deploys; `concurrency.pages/cancel-in-progress:false` already prevents overlap | Extra deploy machinery |
| Hugo gotcha (stale future/draft files linger without output clean) | hugo docs | Rule: clean `blog/` output dir every build (artifact deploy makes full-clean free) | Incremental-output complexity |

**Verdict impact:** Custom stands; add clean-output + image-cache rules.

### E7. Build blockers (verified against working tree)

1. **Missing deps** — `package.json` has only `playwright`. Blog build needs pinned: `marked` (md-viewer uses 15.0.7 CDN — pin same major for build), frontmatter parser (`@11ty/gray-matter` 2.0.2 recommended per E1, or `js-yaml` direct), `shiki`, `sharp`, pagefind binary via npx. `zod`: skip (E1 asserts suffice). DECISION NEEDED: DOMPurify-at-build needs a DOM shim (`jsdom`) — weight for trusted own-authored md; recommend skip-at-build, keep DOMPurify client-side in md-viewer only.
2. **Template slots** — not blockers, but all four missing: `__NAV__` (nav hardcoded resume/cv/man in `shell.html:54-58`), `__META__`, `__HEAD_EXTRA__` (Shiki vars, Pagefind attrs), `__SCRIPTS__` (player/search islands). Adding blog link to nav rebuilds all pages — fine, single `build.mjs` run.
3. **md-viewer draft-route hardening** (verified issues, fix pre-launch, none architectural): (a) DOMPurify 3.2.4 pinned vs 3.4.16 latest — bump; (b) error path interpolates `e.message` into `innerHTML` (`md-viewer.html:177`) — switch to `textContent`; (c) `?url=` fetches+renders arbitrary CORS URLs — open-redirect/phishing aid, add same-origin/`raw.githubusercontent` allowlist for any draft mode; (d) no `?draft=` mechanism exists yet — new route, unlisted+`noindex` per E2.
4. **Perf-budget bypass** — `check-budgets.mjs` covers `js/`+`css/`+`index.html` only. Blog adds unbudgeted weight: N post pages, Pagefind (~100 kB, search page), player (cast posts), images. Extend: per-post HTML gzip ceiling + image-total ceiling + island-exclusion rule (search/player JS excluded from `js/` total, budgeted separately). Until extended, budgets silently don't cover the blog.

---
## Appendix F — Build-readiness checklist (GO/NO-GO per item, 2026-10-11)

| # | Item | Status | Missing piece |
|---|---|---|---|
| 1 | Frontmatter validation design | **GO** | — (asserts spec in E1; ~20 lines at implementation) |
| 2 | Draft/preview/scheduled publishing | **GO (design)** | `posts/_drafts/` + `BUILD_DRAFTS`/`publishDate` gate + cron reuse unimplemented |
| 3 | Image pipeline | **GO (design, corrected)** | §6 JXL→AVIF amendment accepted; sharp step unimplemented |
| 4 | Search + RSS + sitemap | **GO (design)** | Pagefind attrs, RSS CI assert, per-post lastmod fix unimplemented |
| 5 | Asciinema embed + fallback + a11y | **GO (design)** | Vendor pin + transcript fallback + copy button unimplemented |
| 6 | Incremental build + cache + atomicity | **GO** | clean-output + image-cache rules to encode at implementation |
| 7a | Deps pinned (`marked`, `@11ty/gray-matter`, `shiki`, `sharp`, pagefind) | **NO-GO** | Nothing added to `package.json`; DOMPurify-at-build decision open |
| 7b | Template slots (`__NAV__ __META__ __HEAD_EXTRA__ __SCRIPTS__`) | **NO-GO** | Four slots + nav regen unimplemented |
| 7c | md-viewer hardening (DOMPurify bump, `textContent` error, `?url=` allowlist, `?draft=` route) | **NO-GO** | Four fixes listed in E7.3, none applied |
| 7d | Perf-budget extension (post HTML + image ceilings, island rule) | **NO-GO** | `check-budgets.mjs` + `perf-budgets.md` untouched |

**Overall verdict: NO-GO (architecture GO, implementation NO-GO).** The Custom-`build.mjs` verdict survives all seven sweeps unchanged (E3 amends one §6 line, E4 one sitemap line — patterns, not architecture). What blocks building is implementation, not decisions: 7a (deps), 7b (slots), 7c (viewer hardening), 7d (budgets). Unblocks in dependency order: 7a → 7b → 7d (gate the first blog build) → 7c (before any draft URL is shared). No site code modified in this pass.

---
## Appendix D — Content storage: git MD vs R2/KV/D1 (2026-10-11 UTC)

Question: should post bodies live as MD files in git (CI renders frozen HTML),
or in R2/KV/D1 (rendered on request or after CI)? Verdict up front: **git MD
source of truth + CI renders frozen HTML (Flow A).** R2 only for heavy media
overflow (`.cast`/images) if repo size ever hurts; KV/D1 not for blog content.

### D1. Flow A — git MD → CI → frozen HTML (recommended, extends current pipeline)

```
write:  posts/<slug>.md (+ frontmatter: title/date/tags/desc/draft)
  → preview: bun tools/build-blog.mjs && python3 -m http.server  (seconds, local)
  → publish: git push main → static.yml → build-blog.mjs
      (marked → DOMPurify → Shiki → shell slots → rss.xml/sitemap
       → sharp images → pagefind index)
    → upload-pages-artifact → deploy-pages
  → serve: GH Pages (Fastly CDN) serves static files, long-cache hashed assets
  → invalidate: next deploy replaces files (atomic); IndexNow ping via indexnow.mjs
```

Preview speed: full local rebuild is sub-second at ~10 posts/yr scale; no
network, no Worker dev. Publish latency = CI minutes (self-hosted runner,
already paid for). Failure surface = git + CI only.

### D2. Flow B — R2/KV/D1 content store → render on request or post-CI

Variants: B1 R2 holds `posts/<slug>.md` (or JSON); B2 KV holds bodies/index;
B3 D1 holds posts table with SQL queries.

```
write:  wrangler r2 object put / dashboard / custom admin UI (needs auth you
        don't have or want) → object versioned in bucket, NOT in git history
  → preview: staging Worker reads draft key, or wrangler dev (needs bindings)
  → publish: flip draft→live flag, or copy draft/→live/ prefix, or redeploy
  → serve:   (i) Worker on every request fetches R2/KV/D1 → renders MD→HTML
             → caches via Cache API; or (ii) CI/workflow re-renders static on
             object change (webhook/poll — extra moving part)
  → invalidate: Cache API purge / cache-tags; stale-while-revalidate tuning
```

Extra parts vs Flow A: Worker route + bindings + auth for writes + cache
invalidation + backup story (R2 ≠ git log) + local-dev bindings. Hosting fit:
needs Workers; GH Pages alone cannot serve Flow B(i) — splits hosting in two.

### D3. Pros/cons (single author, ~10 posts/yr, static, no auth, RSS + asciinema)

| Axis | A: git MD + frozen HTML | B: R2/KV/D1 content |
|---|---|---|
| Editing UX | md file in editor, frontmatter validated (C1/C2 pattern); full git history/diff/blame; works offline | Needs admin UI or CLI + auth (violates no-auth); no diffs unless built; dashboard editing is worse than editor |
| Preview speed | Instant local rebuild; `git diff` shows content change | Staging Worker or draft-key dance; slower loop, needs credentials |
| Build scaling | Linear in posts; trivial at 10/yr; incremental build (dodeca pattern) if ever 1000+ | Build scaling avoided only by paying per-request render latency instead |
| Hosting fit | Perfect: static.yml → Pages, already deployed; zero new infra | Poor: dynamic render needs Worker; splits Pages + Worker; Pages PR previews don't exist either way |
| Cache/CDN | Frozen files, hashed assets, immutable; invalidation = deploy (atomic) | Mutable store behind cache = invalidation bugs (stale posts, partial purges); must design TTL/SWR |
| Search/RSS/sitemap | Build-time: rss.xml (~20 lines, C6), sitemap.mjs exists, Pagefind indexes built HTML (C4) | Must generate feed/index from store at request time or with a sync job; no free lunch |
| Drafts/scheduling | `draft: true` frontmatter + future `date:` skipped by build; scheduled publish = cron hitting static.yml (already has schedule trigger) | Draft flags in object metadata; scheduling needs cron Worker + purge logic |
| Media/assets | `.cast`/images committed under `assets/`; zero extra infra; cap: repo bloat | R2's one real win: binaries don't bloat git; signed URLs/range requests for large files |
| Cost | Free (Pages + Actions self-hosted); 5 pinned build deps (B8) | R2/KV/D1 metered ops + Worker requests; small but nonzero forever |
| Lock-in | None: MD files + template render anywhere | Cloudflare APIs in serve path; migration = re-export + rebuild |
| Failure modes | CI red (visible), broken link caught by link-check | Auth outage blocks writing; cache-stale serves wrong post silently; eventual-consistency reads; backup/restore is your job |

Wall-precedent note: wall uses KV for public posts + R2 for opaque blobs
(verified live, §"Live Cloudflare verification"). That fits a guestbook
(untrusted writes at runtime — must live outside git). Blog posts are the
opposite: trusted single-author writes at author time. Do NOT copy the wall
pattern for posts.

### D4. Hybrids — what to adopt, what to skip

1. **Adopt if needed: git MD bodies + R2 for media overflow only.** Keep
   `posts/*.md` in git; if `assets/casts/*.cast` or images push the repo past
   comfort (~50–100MB or slow clones), move binaries to a public R2 bucket
   behind the site domain, reference by URL in MD. Post bodies stay in git.
   Trigger: repo size pain, not post count.
2. **Skip: R2 as build cache.** Incremental `build.mjs` + Actions cache covers
   it; R2 cache adds auth + invalidation for minutes saved ~10×/yr.
3. **Skip: KV for index.** Pagefind shards (C4) are the index, generated at
   build, served static. KV index only pays off with runtime queries you don't have.
4. **Skip: D1, full stop.** No relations, no queries, no users, no auth. D1
   enters only if the site ever needs comments/accounts/full-text SQL — none
   wanted; Pagefind covers search.
5. **When R2 content bodies WOULD make sense:** non-git editors needing a web
   CMS, multi-author with roles, >1000 posts with per-second publishing, user
   uploads at runtime, or private per-user content. None apply here.

### D5. Recommendation (decisive)

**Flow A, pure: `posts/*.md` in git → `build-blog.mjs` → frozen HTML on Pages.**
Media stays in-repo until size forces R2-overflow (D4.1). No KV, no D1, no
Worker in the post path. Reasons, mapped to constraints (§1): single author +
10/yr ⇒ git history beats any CMS; static Pages + no-auth ⇒ Flow B's admin +
Worker are pure overhead; RSS/sitemap/search/asciinema all already decided as
build-time steps (App B8/C) that assume frozen HTML; perf ⇒ immutable files +
hashed assets beat cache-invalidation tuning; failure modes ⇒ CI-red is
visible, cache-stale is silent. Revisit only if D4.1 size trigger or D4.5
conditions appear.

### D6. Correction — "does R2 need a database?" No. (2026-10-11 UTC, append-only)

Owner Q: "move images/vids/high storage files to R2? why does R2 need me to
maintain a database? isn't that D1?" — the premise is wrong; correcting without
rewriting D1–D5 above.

Ground truth: **R2 is S3-compatible object storage (files/blobs: put/get, no
tables, no queries, no migrations). D1 is SQLite (tables/rows/queries,
schema + migrations + backups).** Storing `.cast`/images/video in R2 needs NO
database — just object keys + public URL + cache headers. D1 never enters the
picture for media.

| | R2 (media overflow) | D1 (database) |
|---|---|---|
| Holds | blobs: `media/<slug>/<hash>-hero.avif` | rows: `posts(id, slug, body, ...)` |
| Access | `GET https://media.<domain>/...` / `wrangler r2 object put` | SQL `SELECT ... WHERE slug=?` |
| Maintenance | bucket + public/custom-domain + lifecycle rule + `Cache-Control`; no migrations/backups (media re-derivable from git-tracked originals or `assets/`) | schema, migrations, query code, backups, local-dev bindings |
| Blog read path? | Not needed until D4.1 size trigger (~50–100MB repo pain); even then only for blobs, bodies stay git MD | Never — no relations/users/auth/queries; Pagefind covers search |

Why no DB/KV/Worker in blog read path: blog writes are trusted, single-author,
at author time → git history is the store; Pages serves frozen HTML. Wall uses
KV (public posts) + R2 (opaque telemetry blobs) because strangers write at
runtime — untrusted input that cannot live in git. Opposite problem; do not copy.

R2-media recipe (only when D4.1 triggers; small files stay in git):
1. `wrangler r2 object put blog-media/media/<slug>/<contenthash>-<name>.avif --content-type image/avif --cache-control "public, max-age=31536000, immutable" ./out.avif` (same for webp/mp4/.cast; `.cast` immutable only if hashed).
2. `build-blog.mjs` rewrites media refs: local `assets/...` below size cap → in-repo hashed URL; above cap → `https://media.<domain>/media/<slug>/<hash>-...`. Hash = content hash (dodeca base12 pattern, §6) so URLs are immutable.
3. Public bucket behind site domain (custom domain; `r2.dev` for draft only); no signed URLs while media is public. Signed uploads/range requests only if private/large-video streaming ever wanted — not now.
4. Fallback default: keep small files in git (`assets/`); move to R2 per-file on size pain, not wholesale. No site code touched by this note.

---
## Appendix G — Newsletter/blog shareability parity (2026-10-11 UTC)

(Brief asked for "Appendix F"; F already taken by build-readiness checklist,
so this lands as G. Append-only: nothing above touched. Site code untouched —
research only. Sources: Substack/Ghost support + forums, Beehiiv help/blog,
Medium handbook/blog, Buttondown docs, websearch 2026-10-11.)

### G1. What "shareable links" actually are per platform

| Platform | Link types | Server/DB needed? |
|---|---|---|
| Substack | Public post URL (customizable slug + social preview image); **secret draft link** (unguessable token URL, view-only, bypasses paywalls, revocable via "Reset the link"); email web-version; Notes/social embeds | Yes — token store + paywall check are server-side |
| Beehiiv | Public web post URL; email web-version; **per-subscriber referral links** (`{{rp_refer_url}}` merge tag, personalized per inbox — block renders ONLY in emailed copies, NOT on web posts); referral-hub progress URL; Boosts links | Yes — referral identity/tracking needs subscriber DB |
| Ghost (self-host) | Public post URL; **draft preview URL** (unguessable, password-like, no account needed); **gift links** (share one paywalled post free); **public-preview divider** (`/preview` card: free top, members/paid/tier-only below); email web-version; Portal/magic-link URLs | Yes — Ghost server + members DB (paywall/tier checks are request-time) |
| Kit/ConvertKit | Broadcast email web-version ("view in browser"); landing/form URLs; **automation/tag-driven** sequences — list-centric, no secret-draft or gift-link primitive (sharing = forward or public broadcast archive) | Yes — subscriber/tag/automation DB |
| Medium | Public story URL; **friend link** (paywall-bypassing share URL, unlimited sharing; author's own friend-link reads still count toward earnings); metered-paywall URLs (same URL, server decides quota) | Yes — membership/paywall state is request-time |
| Buttondown | Email archive URL per send (public/private/paywalled visibility); **canonical-URL passthrough** (RSS-imported emails point SEO at the original post URL); RSS-to-email automation (send-now or create-draft per new feed item, daily/weekly/monthly); tags/segments + automations | Yes for sends/subs; the RSS→email bridge itself is Buttondown-hosted |

Needs-server/DB: token-gated drafts, paywall/metering, per-subscriber
personalized links, referral credit, subscriber DB, scheduled sends, drip
automation. Just-files: public canonical URLs, OG unfurls, RSS, archive pages.

### G2. What static CAN do without auth/server

1. **Public canonical URLs** — `blog/<slug>/` frozen HTML, `<link rel=canonical>`, stable slugs (Flow A, App D).
2. **Secret unlisted draft URLs** — build drafts to `blog/draft/<content-hash>/`
   (hash of file bytes, e.g. first 12 hex of sha256): unguessable in practice,
   shareable pre-publish. NOT access control — anyone with the URL reads it.
   Hardening: `<meta name=robots content="noindex,nofollow">`, exclude from
   `rss.xml`, sitemap output, Pagefind (`data-pagefind-ignore` / `--glob`
   scoping), index/tag pages, and RSS-driven bridges (E2's `?draft=`-token
   warning stands: no static-native token gate exists).
3. **Email-by-RSS** — hand-rolled `rss.xml` (B5/C6) → Buttondown RSS-to-email
   automation (free tier; send-immediately or create-draft-for-review per new
   item). Zero own backend; Buttondown hosts subs/sends. Canonical passthrough
   keeps SEO on our post URL.
4. **Web-version of emails** — two free copies: canonical post URL (source of
   truth) + Buttondown archive URL per send (public visibility).
5. **Referral-lite via query params** — `?ref=<handle>` links + copy-link button;
   counting needs a counter (KV/Worker, phase 2). Honor-system leaderboard or
   manual milestone fulfillment works with zero infra at this scale.
6. **OG unfurls** — per-post `og:title/description/image/url` + `twitter:card`
   (Substack-style custom social image = build-time `sharp` export, C9);
   absolute URLs; verify once per template with a card validator.

### G3. What static CANNOT do (needs backend) + minimal Cloudflare phase-2

Cannot without a server: true scheduled sends (cron rebuild in E2 covers
*publishing*, not *emailing*), subscriber DB/management, drip/tag automation,
paywalls/metering, referral credit/attribution, per-subscriber personalization.

Optional phase-2 only (NOT required; Flow A stays pure per App D):

| Want | Minimal Cloudflare add-on |
|---|---|
| Referral counting | Worker `GET /r?to=<slug>&ref=<h>` → KV `INCR ref:<slug>:<h>` → 302 to canonical (strips `ref` so canonical stays clean); build reads counts back from KV into a leaderboard page |
| Subscribe box w/o third party | Worker POST → KV/D1 insert + double-opt-in via Cloudflare email service; prefer Buttondown instead unless independence matters |
| Scheduled email sends | Buttondown RSS automation already covers it — no Worker needed |
| Paywall/metering | Skip: incompatible with static + no-auth (§1); revisit only if membership ever wanted (then a Ghost-style server, not static) |

### G4. Cool tricks to steal

- **Preview/unlisted links:** Substack secret-draft UX (share → copy → reset =
  rebuild with new hash, old URL 404s on next deploy) and Ghost draft-preview
  semantics; Medium friend link → our equivalent is the unlisted hash URL
  (no paywall to bypass, same "share privately" job).
- **OG image generation:** build-time social cards (`sharp` text-on-template or
  committed per-post image, absolute `og:image`, frontmatter `image:` override).
- **Canonical + UTM handling:** keep `?ref=`/`utm_*` off the canonical; strip
  params post-attribution (JS `history.replaceState` or Worker 302);
  Buttondown canonical passthrough already points at the clean URL.
- **User-fetch optimization:** `<link rel=prefetch>` next post on index;
  `stale-while-revalidate` on static assets via `Cache-Control`;
  RSS polling (Buttondown polls our feed — no webhooks to maintain);
  read-time + TOC + scroll-progress (build-time headings → TOC, ~10 lines JS);
  copy-link button (`navigator.clipboard`); transcript + `aria-label` on
  asciinema embeds (E5).
- **Beehiiv referral block, static edition:** static "share this post" footer
  (copy link, mailto:, X/Bluesky/Mastodon intent links) with optional `?ref=`
  stamp — same growth surface, no DB until phase 2.

### G5. Concrete proposal for this site (extends Flow A / §§7–9, E2)

Build steps (all in `tools/build-blog.mjs` + `static.yml`, no new services):

1. `posts/*.md` (+ frontmatter `title/desc/date/tags/image/draft`, asserts per E1)
   → `marked` → Shiki → shell slots (`__NAV__ __META__ __HEAD_EXTRA__ __SCRIPTS__`)
   → frozen `blog/<slug>/index.html` + index/tag pages + `rss.xml` + Pagefind step.
2. Pre-publish sharing: `draft:true` or future `date:` → built ONLY to
   `blog/draft/<sha12>/index.html` when `BUILD_DRAFTS=1` (local/PR preview);
   CI production build skips drafts. Draft pages carry `noindex`, excluded from
   sitemap/RSS/Pagefind/index pages. Rebuild-after-edit ≈ Substack "reset link".
3. Hand-rolled `rss.xml` (full `content:encoded`, absolute URLs, CI assert per E4)
   → Buttondown free account → RSS-to-email automation in create-draft mode
   (review before send) → Buttondown archive = email web-version; canonical ours.
4. OG tags per post (+ default card); `image:` frontmatter override; absolute URLs.
5. Share footer per post (copy-link + intent links, `?ref=`-preserving) +
   read-time/TOC/progress; tracking params kept off the canonical.
6. Phase 2 iff wanted: ref-counter Worker + KV (G3 table). Nothing else needs a server.

### G6. Comparison table (this site vs platforms)

| Capability | Substack | Beehiiv | Ghost (self-host) | Kit | Medium | Buttondown | This site (static) | + opt. Workers (ph.2) |
|---|---|---|---|---|---|---|---|---|
| Public canonical post URL | ✓ | ✓ | ✓ | archive | ✓ | archive+canonical | ✓ `blog/<slug>/` | — |
| Secret/unlisted pre-publish share | ✓ token link | — | ✓ preview URL | — | — | — | ✓ hash URL (obscurity, noindex) | — |
| Email web-version | ✓ | ✓ | ✓ | ✓ | — | ✓ archive URL | ✓ via Buttondown archive | — |
| RSS-to-email sends | ✓ | ✓ | ✓ | ✓ | — | ✓ native | ✓ bridged via Buttondown free | — |
| OG/social unfurls | ✓ custom image | ✓ | ✓ | — | ✓ | ✓ link cards | ✓ build-time tags+cards | — |
| Subscriber DB ownership | Substack-held | exportable | ✓ self-hosted | ✓ | ✗ | exportable | Buttondown-held (free) | Worker+KV/D1 if ever |
| Referral program w/ credit | basic | ✓ full | ✗ | ✗ | ✗ | ✗ | ✗ (share footer only) | ✓ counters via KV |
| Automation/tagging/funnels | ✗ | ✓ | ✓ (beta) | ✓ best | ✗ | ✓ | ✗ | ✗ (use Buttondown's) |
| Paywall/metering/gift links | ✓ paywall | ✓ paid tiers | ✓ + gift links | ✓ paid | ✓ friend link | ✓ premium | ✗ (out of scope §1) | ✗ |
| Custom domain | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ (paid) | ✓ (already) | — |
| Fees on paid subs | 10% | 0% (+Stripe) | 0% (self-host) | plan-based | Medium-controlled | 0% | n/a (no paid tier) | — |
| Ops cost at ~10 posts/yr | hosted | hosted | VPS upkeep | hosted | free | free tier | ~zero (Pages+Actions) | metered, ~zero |

Static matches every *sharing* primitive that matters (canonical, unlisted
preview, web-version, RSS-email, OG) and rents the two needing a DB (subs,
sends) from Buttondown free — referral credit and paywalls are the sole gaps,
both out of scope unless phase 2 is ever invoked.

---
## Appendix H — Free-tier costs + referral analytics (2026-10-11 UTC)

Research-only; site code untouched. Prices from Cloudflare docs fetched
2026-10-11 (R2 pricing updated 2026-10-01, Workers pricing 2026-10-02,
Pages limits 2026-09-05). Site stays free to access: no paywall, no fees,
no referral monetization — analytics below is count-only and optional.

### H1. Current free-tier numbers

| Service | Free allowance | Paid overage | Source |
|---|---|---|---|
| R2 Standard storage | 10 GB-mo / mo | $0.015 / GB-mo | https://developers.cloudflare.com/r2/pricing/ |
| R2 Class A ops (PUT/list) | 1M req / mo | $4.50 / M | same |
| R2 Class B ops (GET/HEAD) | 10M req / mo | $0.36 / M | same |
| R2 egress | free, unlimited (all classes) | $0 | same |
| Workers requests | 100,000 / day | $5/mo base → 10M/mo incl, +$0.30/M | https://developers.cloudflare.com/workers/platform/pricing/ |
| Workers CPU | 10 ms / invocation | 30M ms/mo incl, +$0.02/M ms | same |
| Workers egress | free | $0 | same |
| KV reads | 100,000 / day | 10M/mo incl, +$0.50/M | same (KV section) |
| KV writes/deletes/lists | 1,000 / day each | 1M/mo incl, +$5.00/M each | same |
| KV stored | 1 GB | +$0.50 / GB-mo | same |
| Pages builds | 500 / mo, 1 at a time | — | https://developers.cloudflare.com/pages/platform/limits/ |
| Pages static reqs + bandwidth | unlimited, all plans | $0 | https://www.cloudflare.com/products/pages/ |
| Pages files | 20,000 files, 25 MiB/file | — | Pages limits page |
| Web Analytics | free, all plans, cookieless | $0 | https://developers.cloudflare.com/web-analytics/ |

Notes: R2 free tier covers Standard class only (Infrequent Access:
$0.01/GB-mo + $9/M A + $0.90/M B + $0.01/GB retrieval — do not use it;
deletes are free in both classes). R2 Infrequent Access class is the main
recent pricing-surface change; Standard numbers above are current.
Watch item: Workers Logs moves to Observability pricing 2026-12-01
(Workers pricing page) — only matters if log-based analytics is ever used.
Blog hosting per App D is GitHub Pages (Flow A); Pages row is included in
case hosting ever migrates — same free outcome either way.

### H2. Usage estimate vs free tier

Today (verified live): 8 `telemetry/*.asc` R2 blobs (KB-scale PGP blobs) +
4 KV wall posts (280-char max each). Blog projection: ~10 posts/yr,
50–100 posts max, 1–5 MB media/post (images/`.cast`, App D §7/E3).

| Meter | Projected max | Free tier | Headroom |
|---|---|---|---|
| R2 storage (telemetry + R2-overflow media, D4.1) | 100×5 MB + blobs ≈ 0.5 GB | 10 GB-mo/mo | ~20× |
| R2 Class A (puts: posts + media) | ~100s / mo | 1M / mo | ~10,000× |
| R2 Class B (media GETs) | human traffic, ~1Ks / mo | 10M / mo | ~1,000×+ |
| KV writes (wall posts, human-rate) | ~10s / day worst case | 1,000 / day | ~100× |
| KV reads (`GET /wall` per visitor) | ~1Ks / day | 100,000 / day | ~100× |
| KV stored (posts + `ref:` counters, H3) | KBs | 1 GB | ~1,000,000× |
| Worker reqs (wall + ref beacons) | ~1Ks / day | 100,000 / day | ~100× |
| Blog builds (GH Pages; Pages if migrated) | ~10–30 / mo | 500 / mo | ~20× |

Verdict: everything fits free tier with ≥20× headroom on every meter;
expected bill $0/mo indefinitely. First meter to watch if traffic ever
10–100×s: KV reads / Worker daily requests (both fail-closed with an
error past the daily cap — no surprise bill on the free plan).

### H3. Referral-link analytics (optional, zero-cost, no monetization)

Goal: answer "which `?ref=` links bring readers" reusing the existing
`TELEMETRY` + `WALL_KV` pattern (`wrangler.jsonc:15-27`,
`cors-proxy-worker.js:210-221,435-559`). No new DB, no new service.

Design (requires one small Worker route + ~10 lines client JS; NOT built here):
1. Share footer stamps links `blog/<slug>/?ref=<handle>` (G4/G5 pattern).
2. On page load, client reads `?ref=`, sanitizes (`[a-z0-9-]{1,32}`,
   drops anything else), `navigator.sendBeacon('https://0.supernovadkb.workers.dev/r?to=<slug>&ref=<h>')`,
   then `history.replaceState` strips `ref` so the canonical stays clean (G4).
3. Worker `GET /r`: validates slug+handle against allowlist regex, does
   `WALL_KV INCR ref:<slug>:<h>` (read-modify-write; atomic enough at this
   scale — note KV is eventually consistent, counts are approximate), 302s
   to the clean canonical. No new binding — reuses `WALL_KV`.
4. Privacy: NO raw IP stored (reuse existing HMAC-daily-salt rate-limit
   counters, `cors-proxy-worker.js:39-41`, for abuse control only); no
   cookies, no fingerprinting, no PII — handle + slug + counter only.
   Sampling: unnecessary at this scale (1:1 fine); add `Math.random()<0.1`
   gate only if beacons ever exceed ~10k/day.
5. Readback: leaderboard page built at deploy time reads `ref:*` keys
   (or owner-only Worker read); honor-system display per G2.5.

Alternatives (no code, no backend): **Cloudflare Web Analytics — recommended
first step.** Free on all plans, cookieless, privacy-first, one JS snippet,
works on GitHub Pages without proxying (docs: Web Analytics page above);
enable + verify in dashboard before writing any `/r` code. Plausible/Umami
self-host: free software but needs a VPS (~$5/mo) + DB upkeep — violates
zero-infra/zero-cost; skip unless independence from Cloudflare matters.

Recommendation: (1) turn on Cloudflare Web Analytics now (free, zero code
risk); (2) `/r` + KV-counter design above stays phase-2-optional — build
only if per-link attribution proves useful; (3) never paywall, never sell
or share per-visitor data, never monetize referrals.

### H4. Telemetry ground truth + phase-2 ?ref= shape (2026-10-11 UTC, ses_ed387fa9cffeVDjqebHGRFh7DN)

1. **Cloudflare Web Analytics: ABSENT today.** Zero hits for
   `cloudflareinsights` / `beacon.min.js` / `zaraz` / `rum` in `index.html`,
   `templates/shell.html`, `templates/man.html`, `js/`, `tools/build.mjs`.
   Owner thought it was on — it is not. Enable = one snippet for `dvxb.io`,
   cookieless pageviews, free. Do this before any `/r` code (H3 rec stands).
2. **R2 telemetry (owner-eyes-only):** PGP blobs, triggered ONLY on wall
   `<msg>` submit, sent via `ctx.waitUntil`, key `telemetry/<postId>.asc`,
   `private, no-store`, keep-forever. Owner decrypts offline via
   `tools/wall-admin.mjs`. No visitor read path.
3. **WALL_KV contents:** public posts (max 50, keep-forever) + rate counters
   (TTL 3600) + salted delete hashes. Raw IP/UA only in HMAC digests, never
   persisted.
4. **Phase-2 `?ref=` (NOT built):** share footer `?ref=<handle>` →
   `sendBeacon` to new `GET /r` (not `/wall`) → reuse rate-limit shape with
   `ref:rl:` prefix → `INCR ref:<slug>:<h>` in same `WALL_KV`. No new
   binding, no cookies/PII. Free-tier headroom ~100× (H2). Do NOT collect
   raw IP/UA/fingerprint.

---
## Appendix J — Comment systems for static GH-Pages + Cloudflare (2026-10-11 UTC)

Research-only; site code untouched. Context: single author, low volume,
no login/paywall, terminal aesthetic, free-tier only, wall abuse primitives
already live (HMAC-daily-salt rate limits, masked monikers, 50-cap,
`wall-admin.mjs`, salted delete tokens — `assets/v86/cors-proxy-worker.js`
§5 + App H4). Sources: repo worker source; giscus/utterances READMEs +
marketplace; Staticman whois/README; Isso PyPI/isso-comments.de;
Remark42 site + CVE-2026-48788 (NVD/SentinelOne); Cloudflare KV/Turnstile
pricing docs; webmention.io/Bridgy/IndieWeb docs; websearch 2026-10-11.

### J1. Comparison matrix

| Axis | 1. Wall-pattern `comments:<slug>` | 2a. giscus | 2b. utterances | 3a. Staticman | 3b. Isso | 3c. Remark42 | 3d. Webmention | 4. CF-native (KV+Turnstile) | 5. No comments |
|---|---|---|---|---|---|---|---|---|---|
| Auth for readers | None | GitHub login + OAuth | GitHub login + OAuth | None | None (opt name/email) | None-anon or social/email | None (reply from fediverse/own blog) | None | n/a (mailto:) |
| Moderation | Post-moderation: `wall-admin.mjs` KV read/delete + salted self-delete tokens; spam regex server-side | GitHub Discussions UI (edit/delete/lock/category perms) | GitHub Issues UI | `moderated:true` queue → merge/edit in git; Akismet opt | Built-in queue + admin UI; invisible until approved | Best: remove/block users, restricted-words, read-only age, Telegram/Slack/email notify | Manual: filter at build; delete from webmention.io; Bridgy dashboard | Same as 1 + Turnstile verdict | Inbox delete key |
| JS weight | ~0 new (reuse wall fetch; ~10 lines) | ~40KB chunks in cross-origin iframe; `loading=lazy` opt | Vanilla TS, no fonts, lighter than giscus | 0 (comments baked at build) | 65KB single file (20KB gzip) | Embed JS (~tens KB) + backend UI | 0 if baked at build; ~small JS if client-fetched | Same as 1 + Turnstile widget (~small, only on submit) | 0 |
| a11y | Native DOM, full control, terminal-theme trivial | Iframe: themable (incl. custom), but focus/AT boundary + fixed Primer styling | Iframe, Primer styling, dark theme only | Native (your markup) | Native, Markdown | Native-ish widget, white/dark themes | Native (your markup) | Native + Turnstile (managed widget is keyboard-clean, non-visual option exists) | Native |
| JS off | Degradable: plain `<form action=...>` POST still works (worker reads JSON/form) | Dead: iframe never injects; zero comments visible | Dead: same | Perfect: baked HTML | Dead section (needs JS fetch) | Dead section | Perfect if baked at build | Same as 1 (form + Turnstile needs JS for challenge; fail-open vs fail-closed decision needed) | Perfect |
| Free-tier fit | $0: reuses `WALL_KV` + worker (H2 headroom ~100×) | $0 (GitHub-hosted) | $0 (GitHub-hosted) | Self-host Node (~$0 on existing runner? no — needs always-on or per-comment Actions run) | FAIL: needs always-on server (~$5/mo VPS) | FAIL: needs always-on server (80MiB min, VPS/Pi) | $0 (webmention.io + Bridgy free/grant-funded) | $0 (KV 100k reads/1k writes/day; Turnstile unlimited free) | $0 |
| Spam story | HMAC rate limits + `wallSpamVerdict` regex + masked monikers (no identity to farm) | GitHub account cost + repo moderation | Same, weaker (bot installed on fewer repos) | PR-review latency + Akismet | Manual queue (admin burden) | Restricted-words + admin block + throttles | Low volume by obscurity; Bridgy accounts have cost | Turnstile (free, unlimited) replaces/augments regex | Inbox spam filter |
| Failure modes | KV same-key 1 write/s (concurrent POST race on popular slug); eventual-consistency reads; 25MiB value cap (never at this scale); daily caps fail-closed | GitHub API outage; rate limits on search API; Discussions breaking-change (README warns); repo must stay public | STALLED: last commit Aug 2024, 146 open issues; single maintainer; prefer giscus | Public Staticman instance DEAD (domain expired 2021); self-host = token mgmt + rebuild-per-comment latency (Pages minutes) + token leak = spam pipe | SQLite single file (backups on you); CSP needs `unsafe-eval`; Python/C toolchain upkeep | CVE-2026-48788 XSS via image proxy (≤1.15.0; pin ≥1.16.0); Go/Node/PNPM build toolchain; backup upkeep | Third-party dependence (brid.gy grant-funded; webmention.io free); Twitter/X backfeed already dead; polling delay | Same as 1; Turnstile outage → decide fail-open (spam risk) vs fail-closed (lost comments) | Missed email; no public discussion |

### J2. Per-option notes (what the matrix compresses)

1. **Wall-pattern extension** — cheapest correct move. Per-slug keys
   (`comments:<slug>`, same 50-cap + unshift/trim shape as `posts`), same
   HMAC rate-limit + spam-verdict + masked-moniker code paths, same
   `wall-admin.mjs` extended with a key arg (`list --key comments:<slug>`).
   Privacy story already written (App H4.3): no raw IP/UA persisted. New work
   ≈ one Worker route + ~10 lines client JS + admin key param. Caveat: KV
   read-modify-write races on concurrent POSTs to one slug — acceptable at
   this volume; per-slug keys (not one global key) bound the blast radius.
2. **giscus (★12k, active May 2026) vs utterances (★9.7k, stalled Aug 2024)** —
   same deal (zero backend, GitHub moderation), different health. giscus does
   Discussions + reactions + lazy-iframe + custom themes; utterances is Issues
   + lighter but effectively unmaintained (146 open issues, oauth helper
   untouched since 2022). Both force GitHub login on every commenter (funnel
   killer for a no-login blog) and render nothing with JS off. If either,
   giscus only. Needs: public repo + Discussions on + giscus app install +
   Announcements-type category so only maintainers/bot create threads.
3. **Self-hosted/static** — Staticman's hosted tier is gone (self-host Node +
   GitHub token + rebuild-per-comment; each comment burns a Pages build and
   waits minutes to appear). Isso (v0.14.0 Mar 2026, ★5.3k) and Remark42
   (★5.6k, actively released) are both good software that fail the same
   constraint: they need an always-on box, i.e. the first recurring bill on
   this site. Remark42 has the best moderation UX of anything surveyed and an
   anonymous-access mode, but pin ≥1.16.0 (stored-XSS CVE below). Webmention
   is the exception in this group: no server of yours, W3C standard,
   webmention.io receives + Bridgy backfeeds Mastodon/Bluesky/GitHub replies,
   build-time fetch bakes them into frozen HTML (JS-off perfect, SEO-positive).
4. **Cloudflare-native minimal** — in practice = option 1 + Turnstile.
   KV free (100k reads/1k writes/day, fail-closed, no surprise bill) and
   Turnstile free (unlimited challenges, 20 widgets) both fit with ~100×
   headroom. D1 adds nothing here: no relations/queries/users; KV JSON arrays
   per slug are the whole store (App D5 already rejected D1 for content; same
   logic holds for comments at this scale). Only real decision: Turnstile
   fail-open vs fail-closed on verify-outage.
5. **No comments** — defensible default of many personal blogs: `mailto:` +
   reply-via-email-published-as-follow-up + guestbook-only (wall already
   exists). Zero code, zero spam surface, zero maintenance. Cost is discursive:
   no public thread per post.

### J3. Recommendation

- **Default: option 1 (+ Turnstile from option 4 when spam arrives, not before).**
  Ship `GET/POST /comments?slug=` on the existing worker reusing HMAC limits,
  spam verdict, masked monikers, 50-cap, salted delete tokens; extend
  `wall-admin.mjs` with a key argument. No login, ~10 lines client JS, native
  terminal-styled DOM, degradable without JS, $0 forever on meters with ~100×
  headroom. Add Turnstile only on evidence of spam (don't pay its JS/a11y cost
  upfront); decide fail-open at that time.
- **Fallback: option 5 now, option 3d (Webmention receive-only) as the
  no-backend upgrade.** Keep guestbook-only on day one if comment UI isn't
  worth the week; adding Webmention later (receive via webmention.io, bake at
  build, Bridgy for fediverse backfeed) gives public per-post discussion with
  zero backend, zero login, and perfect JS-off — at the price of third-party
  dependence and polling delay. Revisit giscus only if the audience turns out
  to be GitHub-logged-in anyway; never utterances (stalled) or Isso/Remark42
  (recurring host bill) under current constraints.

---
## Appendix K — v1 lock + Phase-2 comments + starter gates (2026-10-11 UTC)

Append-only: locks prior open decisions, touches nothing above. Site code untouched.

### K1. Comments decision: LOCKED

- **v1 = Option A — No comments.** Frozen HTML pure; share-footer only per G4/G5
  (copy-link + mailto:/X/Bluesky/Mastodon intent links, `?ref=`-preserving,
  canonical stays clean). No comment UI, no Worker route, no KV keys, no
  Turnstile in v1. Supersedes App J3 default (opt-1-now) for v1 scope.
- **Phase-2 = Option B — runtime fetch per-slug, post-moderated, wall-primitive reuse.**
  Design (NOT built in v1): `GET/POST /comments?slug=` on existing worker;
  keys `comments:<slug>` (50-cap unshift/trim, same shape as wall `posts`),
  `comment:deltoken` (salted self-delete, same as wall delete hashes),
  `comment:rl` slug-scoped HMAC-daily-salt rate limits (same shape as wall
  `rl:` counters, TTL 3600); `wall-admin.mjs` extension (`list/delete --key
  comments:<slug>`); `hidden` flag for post-moderation (hide without delete).
  Client ≈10 lines fetch into `__SCRIPTS__` island, native terminal-styled DOM,
  `<form action>` degrade. Reuses `WALL_KV`, no new binding/DB (App D5/H2 hold).
- **Rejected (stay rejected): Option C — third-party login-gated (giscus /
  utterances class, App J1 2a/2b).** Forces GitHub login (no-login violation),
  iframe a11y boundary, JS-off dead, utterances stalled. **Option D —
  self-hosted / rebuild-per-comment (Isso / Remark42 / Staticman class, App J1
  3a–3c).** First recurring bill (always-on box) or per-comment Pages rebuild
  latency; violates $0/zero-infra (§1/H2). Webmention receive-only (J1 3d)
  stays deferred, not v1 — third-party dependence + polling delay.

### K2. Phase-2 B prerequisites (all must hold before build)

1. `__SCRIPTS__` slot exists (Gate 2) — comment island has nowhere to live without it.
2. KV volume check — re-verify H2 headroom (`WALL_KV` reads 100k/day, writes
   1k/day) against live wall + projected comment rate; per-slug keys bound race
   blast radius (KV same-key 1 write/s, J1), but confirm before shipping.
3. Cap policy — confirm 50-cap + unshift/trim + `hidden`-flag semantics match
   wall `posts` before first route lands.
4. Turnstile ONLY on spam evidence — not in v1, not in Phase-2 initial cut
   (App J3/H4: pay its JS/a11y cost + fail-open/fail-closed decision only when
   `wallSpamVerdict` regex + HMAC limits prove insufficient).

### K3. v1 starter tasks (build gates 1–4, from App F 7a–7d / E7)

1. **Deps pin** (F7a/E7.1): `marked` (match md-viewer 15.0.7 major), `@11ty/gray-matter`
   2.0.2 (not upstream — cache bug #166, E1), `shiki`, `sharp`, pagefind binary
   via npx. Skip `zod` (E1 asserts suffice); DOMPurify-at-build decision stays
   open (recommend skip-at-build, client-side md-viewer only).
2. **Shell slots** (F7b/E7.2/C): add `__NAV__ __META__ __HEAD_EXTRA__ __SCRIPTS__`
   to `shell.html` (7 slots today + 4 new); nav regen rebuilds all pages in one
   `build.mjs` run — fine.
3. **Perf budgets** (F7d/E7.4): extend `check-budgets.mjs` + `perf-budgets.md` —
   per-post HTML gzip ceiling + image-total ceiling + island-exclusion rule
   (search/player JS excluded from `js/` total, budgeted separately). Gate the
   first blog build on this.
4. **md-viewer hardening — DEFERRED to draft-sharing phase** (F7c/E7.3, E2/G5):
   DOMPurify 3.2.4→3.4.16 bump, `textContent` error path (`md-viewer.html:177`),
   `?url=` same-origin/`raw.githubusercontent` allowlist, new `?draft=` route
   (unlisted + `noindex`, per E2). Required before any draft URL is shared, not
   before first frozen post.

Order: Gates 1→2→3 gate the first blog build; Gate 4 gates draft sharing.

---
## Build gates 2–4 implementation note (2026-10-11T~15:00Z)

No `package.json` / `node_modules` added (`git diff --stat package.json` empty;
`node_modules/` + `package-lock.json` are pre-existing untracked env artifacts,
not commits). Deps avoided: zero-npm by design — slots are `build.mjs`
split-join strings, budgets are `node:fs/zlib` only, viewer hardening is
vanilla inline JS + pinned CDN ESM/UMD (marked/DOMPurify stay CDN, no install).

1. **Slots (K3.2/F7b) done:** `templates/shell.html` 7→11 slots — new `__NAV__`
   (default = previous hardcoded resume/cv/man links), `__META__` (default '',
   post header inside `doc-panel`), `__HEAD_EXTRA__` (default '', after
   topolines script), `__SCRIPTS__` (default '', before `</body>`). Placeholders
   positioned so empty defaults render byte-identical output. `tools/build.mjs`:
   `DEFAULT_NAV` const + `renderTemplate` defaults + explicit
   `NAV/META/HEAD_EXTRA/SCRIPTS` at the call site (`page.nav/meta/headExtra/
   scripts ?? default` passthrough for future blog builds). `man.html` kept as
   fork (one-class diff); collapsing to a shell flag is a follow-up.
   Verify: `bun tools/build.mjs` → sha256 of all 5 outputs
   (`resume.html`, `cv.html`, `man/index.html`, `man/resume.html`,
   `man/dvxb.io.7.html`) identical to pre-change baseline (BYTE-IDENTICAL ×5).
2. **Budgets (K3.3/F7d) done:** `tools/check-budgets.mjs` keeps existing 4
   entries, appends `blog/ per-post HTML (max gzip per file) ≤ 15,000 B`
   (recursive worst-file over `blog/**/*.html`; missing dir = 0, passes) and
   `blog images total ≤ 500,000 B` (sum over `assets/blog/` + `images/blog/`
   AVIF/WebP/JPEG/PNG/GIF/SVG; missing dirs = 0). Island-exclusion rule: blog
   islands ride `__SCRIPTS__` (CDN/vendor in generated HTML, never `js/`), so
   the `js/` total excludes them by construction. `docs/perf-budgets.md` gains
   an append-only `## Blog budgets` section (14 insertions, 0 deletions).
   Verify: `npm run check:budgets` → 6/6 OK, exit 0.
3. **Viewer hardening (K3.4/F7c, early — ?draft= still deferred) done in
   `md-viewer.html` only:** marked 15.0.7→15.0.12 (15.x latest per jsdelivr,
   line kept), DOMPurify 3.2.4→3.4.16 (npm latest per jsdelivr); error path
   `innerHTML`+`${e.message}` → `showError()` (`textContent`); `?url=`
   allowlist `isAllowedUrl()` (same-origin http(s) or any https host; blocks
   `localhost`/127/10/8/172.16-31/192.168/169.254/link-local, `.local`/
   `.internal`/`.lan`/`.home.arpa`/`.localhost`, non-http(s) schemes);
   `<meta name="robots" content="noindex, nofollow">` added. `?draft=` route
   NOT added (still deferred per E2). `#urlInput`/`#goBtn`/`#status` IDs kept;
   `js/commands.js` untouched (`git status js/` clean) so `md` iframe compat
   (`md-viewer.html?url=<https>`, sandbox `allow-scripts`) and goldens hold.
   Verify: `node --check` on extracted inline script OK; allowlist harness
   15/15 PASS (same-origin allow, https-public allow incl.
   `raw.githubusercontent`, http/localhost/RFC1918/link-local/js:/data: block);
   `node tools/assert-registry.mjs` → all checks passed (52 entries).

---
## Playwright removal + snapshot driver → Firefox BiDi (2026-10-11 UTC)

Append-only: nothing above touched. Site code untouched (`git status js/ css/ index.html templates/` clean apart from the pre-existing gates 2–4 work).

1. **Removal:** `npm uninstall playwright` → `package.json` dependencies gone,
   `package-lock.json` emptied to `{}` packages, `node_modules/` emptied.
   `test_errors.mjs` (untracked, statically imported playwright, zero
   references repo-wide outside the codegraph index) deleted. Only remaining
   playwright reference is `tools/assert-wave7.mjs` (dynamic import in its
   browser half) — left alone per no-other-code-changes scope; its browser
   half needs a driver rework before it can run again.
2. **Driver:** `tools/snapshot-terminal.mjs` playwright + system-chromium-CDP
   paths replaced by `createFirefoxDriver`: system `firefox --headless`
   driven over its built-in WebDriver BiDi endpoint
   (`--remote-debugging-port`, `ws://127.0.0.1:<port>/session`, stdlib
   WebSocket only — **no geckodriver needed**, zero npm deps kept).
   Preload (`script.addPreloadScript`, document-start) carries the unchanged
   Date/Math.random/chunk-recorder init script; `network.addIntercept`
   (beforeRequestSent) keeps the allow-list + `{"results":[]}` search stub;
   typing via batched `input.performActions` keyDown/keyUp (+ Enter `\uE007`),
   focus via pointer click. Env: `SNAPSHOT_FIREFOX` (binary path, `=1` = auto),
   `SNAPSHOT_BIDI_PORT` (default 9333, `SNAPSHOT_DEBUG_PORT` alias);
   `SNAPSHOT_FORCE_CDP=1` kept as deprecated no-op alias (warns, same driver);
   `SNAPSHOT_CHROMIUM` warns-ignored. Missing binary fails loud with
   `sudo apt-get install firefox` / `SNAPSHOT_FIREFOX=` hint, never silent.
   Two Firefox behaviors stubbed for determinism: non-http(s) intercepts
   (data:/blob: favicons aren't continuable) are skipped; geolocation is
   denied in the preload script (headless Firefox pends getCurrentPosition
   forever — Chromium denies — goldens pin the denied path). Stubbed search
   responses carry `Access-Control-Allow-Origin: *` (else the page's
   cross-origin fetch fails CORS). `-width/-height 1280/800` keeps viewport
   parity with the old drivers (headless height settles ~714; rows unaffected).
3. **Verification:** `node --check tools/snapshot-terminal.mjs` OK;
   `npm run check:budgets` 6/6 OK; `node tools/assert-registry.mjs` 52
   entries OK; full regen green twice (`SNAPSHOT_FIREFOX=1` and
   `SNAPSHOT_FORCE_CDP=1` alias both exercised, driver=firefox-bidi,
   32 goldens incl. manifest). Repeat regen byte-identical across all 31
   `.ans` (sha256sum -c clean) — determinism holds.
4. **Golden diff (8 files) — all classified, no site changes needed:**
   (a) OSC-8 link wraps in about/export-about/projects/projects-filter —
   stale-golden catch-up from `a69f35f` (Oct 4, browser-independent);
   (b) wrap reflows in case-pcpg/md-fallback — cols 80→97 layout-era drift
   (verified: system Chromium TODAY also yields cols=97 at 1280 wide);
   (c) boot.ans GPU/Memory fingerprints — the ONLY true driver-switch delta
   (SwiftShader→Intel HD, 32GB→2GB deviceMemory fallback); (d) manifest.json —
   mechanical commit-SHA/hash churn. search-help.ans regenerates
   byte-identical (stub path intact).

---
## assert-wave7 browser half → Firefox BiDi (2026-10-11 UTC)

Append-only: nothing above touched. No site changes (`js/`, `css/`, `index.html`, `templates/` untouched by this pass; other working-tree mods are sibling-session gates work, not mine).

1. **Port:** `tools/assert-wave7.mjs` browser half drops `await import('playwright')` + `chromium.launch` for a `createFirefoxDriver` mirroring `tools/snapshot-terminal.mjs`: system `firefox --headless` over its built-in WebDriver BiDi endpoint (`--remote-debugging-port`, stdlib WebSocket only, no npm deps, no geckodriver). Same shape: temp profile, `script.addPreloadScript` (unchanged chunk-recorder INIT_SCRIPT), `network.addIntercept` (beforeRequestSent) with the wave7 allow-list (127.0.0.1/localhost/cdn.jsdelivr.net, rest `failRequest`), `browsingContext.navigate`, `input.performActions` typing (batched keyDown/keyUp, Enter `\uE007`) + pointer-click terminal focus. Env: `WAVE7_FIREFOX`/`SNAPSHOT_FIREFOX` (binary, `=1` = auto), `WAVE7_BIDI_PORT`/`SNAPSHOT_BIDI_PORT`/`SNAPSHOT_DEBUG_PORT` (default 9333); missing binary fails loud with the `apt-get install firefox` / `WAVE7_FIREFOX=` hint, never silent. Unit half byte-untouched and still hermetic (fetch stub, same 15 checks).
2. **Playwright API mapping (all 18 browser assertions preserved, labels identical):** `keyboard.type` → `typeText`; `press(Enter/Escape/Tab)` → WebDriver key codes `\uE007`/`\uE00C`/`\uE004`; `press(Control+k/r)` → Control-chord keyDown/keyUp sequences; `keyboard.insertText` → `execCommand('insertText')` on the xterm textarea (same input-event-no-key-events semantics); `locator.click`/`page.click(:has-text)` → pointer-click center / `textContent.includes` + `.click()`; `waitForSelector`/`waitForFunction` → `waitFor` boolean-expr poll; `$$eval`/`$eval`/`evaluate` → `evalJson`/`evalValue` (`script.evaluate`, `awaitPromise: true`). Viewport 1280x800 via `-width/-height`; `waitQuiet` (❯ + 500ms quiet) unchanged.
3. **Firefox deltas (2, both in-tool, no site changes):** (a) INIT_SCRIPT gains the snapshot-style geolocation-denial stub — headless Firefox pends `getCurrentPosition` (no prompt to answer) while the weather assert pins the denied path; without it `weather` would burn the 8s geo timeout + fall through to blocked-network fetches (still passes within the 20s budget, but slow and nondeterministic). (b) `$eval`-throws-on-missing becomes `|| ''`/`|| {}`-safe reads that record FAIL instead of throwing — same labels, run continues past a missing node.
4. **Verification:** `node --check` OK; full `node tools/assert-wave7.mjs` green first run — 15/15 unit + 18/18 browser (`driver=firefox-bidi`, default `WAVE7_PORT` 8903), exit 0, zero assertion changes needed for Firefox behavior (palette groups/args-focus, no-match, Esc focus, guided equivalence, mode-pill, ghost Tab, Ctrl+R, paste-strip, AbortError all hold). `npm run check:budgets` 6/6 OK; `node tools/assert-registry.mjs` 52 entries OK. Resolves the stale-state note (§"Playwright removal", item 1): no playwright references remain repo-wide.

---
## Appendix L — Ordered build plan (2026-10-11 UTC)

Read PLAN-BLOG.md fully (693+530 lines, Apps B–K + H4) + verified working tree
(`git status`, `package.json`, `shell.html` slots, `build.mjs`, `check-budgets.mjs`,
`md-viewer.html`, `site-urls.mjs`/`sitemap.mjs`, `static.yml`, registry+budgets runs).
Site code untouched — this appendix only. `package.json` EXISTS (scripts only,
zero deps); `posts/`/`blog/`/`assets/blog/` do not exist yet.

### L1. v1 scope lock (from K1/K3 + D5/G5/H3–H4)

- **Flow A pure:** `posts/*.md` in git → `tools/build-blog.mjs`
  (marked → Shiki → shell slots → rss.xml/sitemap → sharp → Pagefind)
  → frozen HTML on GH Pages. Bodies stay git MD, always.
- **Comments:** v1 = Option A — NO comments. Share-footer only per G4/G5
  (copy-link + mailto:/X/Bluesky/Mastodon intents, `?ref=`-preserving,
  canonical stays clean). Phase-2 B design stands (K2), not built.
- **Search:** Pagefind OPTIONAL — blog launches without it; post-build
  `npx pagefind --site` + `--glob 'blog/**/*.html'`, UI on search route only.
- **Media:** R2 overflow ONLY on D4.1 size trigger (~50–100 MB repo pain),
  blobs only, bodies never leave git. No D1, no KV, no Worker in read path.
- **Analytics:** `/r` beacon SKIPPED (phase-2-optional). Web Analytics snippet
  (ABSENT today per H4 — owner thought it was on) is a non-gating ops task:
  enable in dashboard before any `/r` code, never blocks first post.
- **Viewer:** hardened viewer is draft-preview-local only; `?draft=` route
  stays deferred to draft-sharing phase (Gate 4, L3 step 10).
- **Stay tabled:** minify (View-Source policy), code-execution cells, paywall,
  D1 anywhere, DOMPurify-at-build (recommendation: SKIP — own-authored trusted
  MD; DOMPurify stays client-side in viewer only; lock this in step 1).

### L2. Starter gates 1–4 status (after slots/budgets/viewer/playwright/wave7 work)

| Gate (K3) | Status | DONE | Still OPEN |
|---|---|---|---|
| 1. Deps pin (F7a/E7.1) | **OPEN** | — | Pin into existing `package.json`: `marked` 15.x (match viewer 15.0.12), `@11ty/gray-matter` 2.0.2 (not upstream — cache bug #166), `shiki` (pin at install), `sharp` (pin), pagefind version for CI. Lock skips: `zod` (asserts suffice), DOMPurify-at-build (skip). |
| 2. Shell slots (F7b/E7.2) | **DONE** | 11 slots (`__NAV__ __META__ __HEAD_EXTRA__ __SCRIPTS__` added, empty defaults render byte-identical ×5; `renderTemplate` defaults + `DEFAULT_NAV`; verified in tree) | `man.html` fork → shell-flag collapse (cosmetic follow-up, non-gating). Note: `__META____BODY__` adjacent on one line — works via split-join, cosmetic only. Nav regen on blog-link add is one `build.mjs` run — fine. |
| 3. Perf budgets (F7d/E7.4) | **DONE (untested vs real posts)** | 6/6 OK (`blog/` per-post gzip ≤15000, images total ≤500000, missing dirs pass at 0); island-exclusion by construction (`__SCRIPTS__` CDN/vendor never under `js/`); verified green in tree | Ceilings tuned on zero posts — retune ONLY on evidence at first real build, never preemptively. |
| 4. Viewer hardening (F7c/E7.3) | **DONE except `?draft=`, correctly deferred** | marked→15.0.12, DOMPurify→3.4.16, `showError()` textContent, `isAllowedUrl()` allowlist (15/15 harness), `noindex` meta; registry 52 OK; verified in tree | `?draft=` route OPEN by design — gates draft SHARING (step 10), not first post. |
| Playwright removal + snapshot→Firefox BiDi | **DONE** | Zero npm deps; regen green twice, 31 `.ans` byte-identical; only true delta = boot GPU/Memory fingerprints (classified) | — |
| wave7 → Firefox BiDi | **DONE** | 15/15 unit + 18/18 browser green; zero playwright refs repo-wide (excl. a comment noting removal) | — |
| Per-post `<lastmod>` (E4) | **OPEN** | — | `sitemap.mjs` stamps deploy-date on ALL URLs; needs frontmatter-date per post. Build step 4. |
| OG cards (G5.4) | **OPEN** | — | No `og:`/`twitter:` tags in shell today; per-post tags + default card. Build step 5. |
| RSS + CI assert (B5/C6/E4) | **OPEN** | — | `rss.xml` gen + ~15-line assert unimplemented. Build step 4. |
| Image pipeline (C9/E3) | **OPEN** | — | sharp step unimplemented; AVIF-primary (E3 corrects §6 JXL line). Build step 6. |

### L3. Ordered steps (files to touch + verification per step)

- **0. Baseline lock (no files).** `bun tools/build.mjs` → sha256 of 5 outputs
  matches pre-change; `npm run check:budgets` 6/6; `node tools/assert-registry.mjs`
  52 OK. Redo before every step below; any step that breaks byte-identical
  existing outputs stops the line.
- **1. Gate 1 — deps decision+pin. Touch:** `package.json` (+ lockfile).
  Pin marked 15.x / `@11ty/gray-matter` 2.0.2 / shiki / sharp / pagefind-CI
  version; record skip-zod + skip-DOMPurify-at-build (L1). **Verify:** clean
  `bun install` hermetic, import smoke (`marked.parse`, `codeToHtml`,
  `sharp` version, `gray-matter` parse), no extraneous deps.
- **2. Builder skeleton. Touch:** `tools/build-blog.mjs` (new), `posts/`,
  `posts/_drafts/`, one fixture draft (unpublished). Frontmatter asserts
  (E1 field set), `draft:true`/future-date gate (`BUILD_DRAFTS=1` → ONLY
  `blog/draft/<sha12>/` + `noindex`; CI prod skips), clean `blog/` output each
  build (E6), marked→Shiki→slots, index + tag pages (`getFilteredByTag`
  5-liner, C1; replace-don't-merge `tags`, UTC date sort, E1). **Verify:**
  5 existing outputs byte-identical; draft renders locally with `noindex`,
  excluded from index/RSS/sitemap; prod build emits zero draft bytes.
- **3. Gate 3 confirm (no files expected).** Run budgets against skeleton
  output; retune ceilings ONLY on evidence. **Verify:** 6/6 or all-post build
  green.
- **4. RSS + sitemap + IndexNow. Touch:** `build-blog.mjs` (rss.xml gen:
  channel+item shape C6, absolute URLs, XML-escape, `content:encoded`),
  new CI assert (~15 lines, E4), `tools/sitemap.mjs` (per-post lastmod from
  frontmatter), `tools/site-urls.mjs` (blog URLs — feeds sitemap + IndexNow
  free). **Verify:** feed XML-parses, RFC-822 dates, absolute URLs, assert
  green, sitemap lastmod per-post correct, IndexNow list includes posts.
- **5. Share footer + OG + read UX. Touch:** `build-blog.mjs` + shell slot
  payloads (`__META__`: date/byline/reading-time/tags; share footer:
  copy-link + intents, `?ref=`-preserving, canonical clean; OG:
  `og:title/description/image/url` + `twitter:card`, absolute, `image:`
  frontmatter override + default card; TOC/read-time/progress, copy-transcript
  on cast embeds per E5). **Verify:** card validator once per template;
  `noindex` absent on live posts; canonical clean with `?ref=` stripped.
- **6. Image pipeline (island). Touch:** `build-blog.mjs` sharp step +
  `assets/blog/` convention. AVIF→WebP→JPEG, widths
  [320,640,960,1280,1920], `<picture>` + `loading=lazy` + w/h attrs,
  LQIP data-URI + blur (ThumbHash only if fidelity fails), originals out of
  deploy, `actions/cache` on output keyed by input hash. **Verify:**
  image-total ceiling holds; CLS spot check.
- **7. Pagefind (OPTIONAL island). Touch:** shell post wrapper attrs
  (`data-pagefind-body`, `data-pagefind-meta`, `data-pagefind-filter`;
  `data-pagefind-ignore` on nav/footer/clock), `static.yml` post-build
  `npx pagefind --site ... --glob 'blog/**/*.html'`, UI JS into `__SCRIPTS__`
  on search route only. **Verify:** index builds, query returns post,
  ~100 kB chunked, search-page-only load. May land after launch.
- **8. Asciinema (ON FIRST CAST POST ONLY). Touch:** vendored pinned player
  dist + `__SCRIPTS__` lazy IntersectionObserver init (`poster` sparingly —
  forces preload; cap 80×24; split UI/worker bundle), `<noscript><pre>`
  transcript + `aria-label`. **Verify:** zero player JS on text posts;
  transcript readable no-JS. Deferred until a post needs `.cast`.
- **9. First real post + launch. Touch:** `posts/<slug>.md` (one post),
  Buttondown free account + RSS-to-email automation in create-draft mode
  (zero code). **Verify:** full CI green (build, budgets, registry, goldens
  unaffected, sitemap+IndexNow), live URL, feed valid, archive copy, OG unfurl.
- **10. Draft-sharing phase — Gate 4 (after launch, never before). Touch:**
  `?draft=` route (unlisted hash URL + `noindex`, excluded from RSS/sitemap/
  Pagefind/index per E2/G5) and/or PR-preview pattern (E2 caveat: artifact
  deploy needs `pr-preview/` exclusion). **Verify:** draft URL shares privately,
  rebuild-after-edit rotates hash (Substack-reset semantics), zero draft bytes
  in prod artifact.

### L4. Parallelization

- **Spine (sequential):** 0 → 1 → 2 → 4 → 5 → 9. Each gates the next.
- **Islands (any time after 2, parallel-safe):** 6 (sharp), 7 (Pagefind),
  8 (asciinema) — all plug into `__HEAD_EXTRA__`/`__SCRIPTS__` against a
  fixture post; no cross-dependence. 3 is a 5-minute check piggybacked on any step.
- **After launch:** 10 (Gate 4) whenever draft sharing is wanted; Web Analytics
  snippet (dashboard ops, H4) any time, non-gating.
- **Never in v1:** comments, `/r` beacon, D1/KV/R2-read-path, minify, man-flag
  collapse (drive-by only).

### L5. First 3 concrete tasks to start now

1. **Lock Gate 1** — pin 5 deps in `package.json` + record the two skips (L3.1);
   verify clean install + smoke imports. (~30 min, unblocks everything.)
2. **Skeleton `build-blog.mjs` + fixture draft** (L3.2); verify byte-identical
   ×5 + draft-gate semantics. (~1–2 h, unblocks 4/5/6/7/8.)
3. **RSS + per-post lastmod + site-urls on the skeleton** (L3.4); verify feed
   parses + assert green. (~1 h, unblocks launch spine.)

### L6. GO / NO-GO

- **GO** for tasks 1–3 now (first-build spine; architecture GO per App F,
  implementation path clear, zero infra/risk to existing outputs).
- **NO-GO for publish (step 9)** until budgets gate (step 3) + RSS assert
  (step 4) are green on the skeleton.
- **NO-GO for draft sharing** until Gate 4 (step 10).
- **NO-GO (out of v1 by lock)** for comments / `/r` beacon / D1 / KV-or-R2
  read path / minify.

---
## Appendix L tasks 1–3 — DONE (2026-10-11T~16:00Z)

Baseline (L3.0): `bun tools/build.mjs` → sha256 ×5 locked
(`1e0c0d28` resume, `7684d457` cv, `925987b8` man/index, `e9dd0b29`
man/resume, `3e321894` man/dvxb.io.7); budgets 6/6; registry 52 OK.
Sibling-session gates 2–4 work (slots/budgets/viewer/bi-di) taken as
baseline, untouched. No site code (`js/ css/ index.html templates/`)
modified by this pass.

**Task 1 — Gate 1 deps pin.** `package.json`: exact pins `marked
15.0.12` (matches viewer CDN), `@11ty/gray-matter 2.0.2` (not upstream —
cache bug #166; not 3.0.0 — plan-explicit), `shiki 4.5.0`, `sharp
0.35.5`, `pagefind 1.5.2` (latest release; not yet in CI — this is the
version CI will use per `--glob 'blog/**/*.html'` plan). Skips locked:
`zod` (E1 asserts suffice), DOMPurify-at-build (trusted own-authored
MD; stays client-side in viewer). `npm ls --depth=0` = exactly those 5,
zero extras. Smoke: marked→`<h1>`, gray-matter parse, shiki
`codeToHtml` 285 chars, sharp 4×4 PNG 90 B, `pagefind 1.5.2`.
Scripts added: `build:blog`, `assert:rss`. Verify: `node --check` ×4,
budgets 6/6, registry 52 OK.

**Task 2 — `tools/build-blog.mjs` skeleton + `posts/` + fixture draft.**
Split-join render + DEFAULT_NAV copied from `build.mjs` (which runs on
import — cannot share; duplication is 8 lines, no refactor). E1 asserts
(title/desc/date/tags/draft, throw = CI-red), slug `[a-z0-9-]+` check,
`draft:true`/future-date gate (`BUILD_DRAFTS=1` → only
`blog/draft/<sha12>/` + `noindex`; prod = zero draft bytes), E6
`rm -rf blog/` each build, marked→Shiki single `github-dark` theme
(zero `__HEAD_EXTRA__`, unknown-lang fallback keeps marked block),
UTC-explicit date sort, replace-don't-merge tags, `getFilteredByTag`,
index + tag pages, `__META__` date/reading-time/tags. Fixture:
`posts/_drafts/hello-fixture.md` (`draft:true`, never published).
`.gitignore`: `blog/` artifact-only (same convention as resume/cv/man).
Skipped: `posts/posts.json` per-dir defaults (C1, YAGNI at 1 fixture).
Verify: prod `blog/index.html` only, 0 draft bytes; `BUILD_DRAFTS=1`
→ `blog/draft/b050ef3310b4/` with `noindex` + Shiki `<pre>`, absent
from index; rebuild ×5 byte-identical (`sha256sum -c` clean); budgets
6/6 (blog worst 3239/15000); registry 52 OK.

**Task 3 — RSS + lastmod on skeleton.** `build-blog.mjs` writes
`blog/rss.xml` (hand-rolled, astro-rss item shape; absolute URLs,
escaped fields, `guid isPermaLink`, `content:encoded` CDATA with
`]]>` guard, `toUTCString` RFC-822 dates) + `blog/posts.json`
manifest (published only). `tools/site-urls.mjs`: `readBlogManifest()`
+ `blogEntries()` (`/blog/`, `/blog/rss.xml`, per-post, per-tag;
lastmod = frontmatter date, index/tag = latest post) + `allUrls()`.
`sitemap.mjs`: `u.lastmod ?? deployStamp` — deploy-date lie fixed
(static keep deploy stamp, posts carry frontmatter date). `indexnow.mjs`:
`urlList: allUrls()` (blog feeds IndexNow free). New
`tools/assert-rss.mjs` (no deps: XML declaration, single `<rss>` root,
channel title/link/desc/lang, item count == manifest count, per-item
title/link/guid/desc/content + RFC-822 `pubDate`, all-absolute URLs).
Verified with temp published post (deleted after): feed XML-parses, 1
item, `pubDate Mon, 05 Oct 2026`, title escaped
(`&amp; &lt;`), draft 0 bytes in feed+manifest, sitemap 13 URLs with
post `lastmod 2026-10-05` vs static `2026-10-11`; final skeleton state:
sitemap 8 URLs, assert-rss green (0 items), budgets 6/6, registry 52,
×5 byte-identical.
Deferred to step 9 (first real post): `static.yml` wiring (build-blog
+ assert-rss steps) — CI behavior unchanged with zero published posts.
Gate 4 (`?draft=` route, step 10) stays NO-GO per L6.

---
## Appendix L steps 5–6 — DONE (2026-10-12T~02:10Z)

Baseline (L3.0) re-locked first: ×5 sha prefixes `1e0c0d28 7684d457 925987b8
e9dd0b29 3e321894` match the tasks-1–3 lock; budgets 6/6; registry 52 OK.
No site code (`js/ css/ index.html templates/`, `build.mjs`) touched by this
pass — `shell.html` slots used as-is. Out of v1 untouched per lock:
comments, `/r` beacon, D1/KV/R2-read-path, minify.

**Pre-existing sibling artifacts found + handled.** `blog/tmp-verify-56/`
(share/OG/picture-shaped output), `assets/blog/fixture/sample.jpg`,
`blog/og-default.{png,svg}` (~22:45Z) with `build-blog.mjs` still the
Task-3 skeleton — a parallel step-5/6 attempt whose script edits did not
survive. Stale outputs wiped by the E6 clean-output rebuild;
`sample.jpg` deleted (superseded by `posts/fixture-hero.png`). Output-shape
conventions re-derived from the residue (`share-footer`, `toc-h2/h3`,
`blog/<slug>/img/<base>-<w>.<fmt>`); `<picture>` URLs made absolute
(`SITE_URL`-prefixed) so RSS `content:encoded` stays valid — the one
deliberate divergence.

**Step 5 — share footer + OG + read UX (`tools/build-blog.mjs` only).**
`META` slot now carries `metaHtml` (date/byline/reading-time/tags; moved out
of `BODY`); `HEAD_EXTRA` carries `ogHead` (og:type/title/description/url/
image + twitter:card/title/description + article:published_time/tags,
absolute URLs, `image:` frontmatter override else committed
`assets/blog/og-default.png` 1200×630, 30 KB); `BODY` = progress div + TOC +
`<div data-pagefind-body>` + content + `<footer class="share-footer">`
(copy-link `data-canonical` + mailto:/X/Bluesky/Mastodon intents);
`__SCRIPTS__` carries one vanilla inline island (replaceState strips
`?ref=`/`utm_*` post-attribution; copy-link copies `location.href` as-is so
`?ref=` survives the copy; scroll progress) — no new deps, js/-excluded by
construction. TOC from build-time h2/h3 ids (regex post-process, no marked
API dependence; dupes suffixed; renders only at 2+ entries). Index/tag pages
get minimal OG. RSS keeps `post.html` = content only (no TOC/share chrome).
`assertFrontmatter` accepts optional `image:`.

**Step 6 — sharp island (same file).** `renderPostImages`: relative md refs
→ `<picture>` AVIF(q60,effort 6)→WebP(q80)→JPEG(q85) across
`[320,640,960,1280,1920]` capped at native width (never upscale), w/h attrs,
`loading=lazy` + `decoding=async`, zero-JS LQIP (32px q15 JPEG data-URI
backdrop span, no ThumbHash); variants to `blog/<slug>/img/` (artifact dir,
deployed via whole-workspace artifact); svg/gif copy-through; missing source
throws (CI-red). Make-style mtime skip (Actions cache defers with static.yml
wiring, step 9). `.gitignore` `blog/` → `/blog/` (the bare pattern also
ignored `assets/blog/` + `images/blog/`, making the documented image
convention uncommittable); checker image-total now scans
`assets/blog,images/blog,blog`; doc table gains an append-only row.
Fixture: `posts/_drafts/hello-fixture.md` +3 headings + hero ref;
`posts/fixture-hero.png` 1280×720 generated gradient source (51 KB).

**Verify.** Temp published post (deleted after, zero tmp bytes remain):
26/26 markup checks (OG/escaping/canonical/override/TAG/published_time,
META, TOC, share+4 intents, progress, replaceState, clipboard-as-is,
picture×3fm, LQIP, w/h, lazy, absolute URLs, no-noindex, pagefind prep),
draft page 8/8 (incl. noindex + default card + hash-URL OG), feed parses
(RFC-822, escaped title, picture in content:encoded), assert-rss green
(1→0 items after delete), sitemap per-post `lastmod 2026-10-05` (deploy-date
lie stays fixed), IndexNow list includes post+tag, budgets 6/6 prod AND
preview (worst post 5342/15000, images 147940→81906/500000 now actually
gating variants), registry 52 OK, `bun tools/build.mjs` ×5 byte-identical,
missing-image throws, heading dedupe/escape + TOC<2-empty hold, Shiki block
intact. Card-validator-by-inspection (tags absolute, once per template).
Skipped: per-post generated social cards (use `image:` override when needed),
`static.yml` wiring incl. posts/-source exclusion from artifact (step 9),
`data-pagefind-ignore` on shell nav/footer (step 7; body-level only for now).
Gate 4 (`?draft=`, step 10) stays NO-GO per L6.

---
## Appendix L steps 7–9 — DONE (2026-10-12T14:33Z)

Baseline (L3.0) re-locked first: ×5 sha prefixes `1e0c0d28 7684d457 925987b8
e9dd0b29 3e321894` match the tasks-1–3 lock; budgets 6/6; registry 52 OK.
Sibling-session work (gates 2–4, BiDi drivers, steps 5–6) taken as baseline,
untouched. Out of v1 untouched per lock: comments, `/r` beacon, D1/KV/R2-read-path, minify.

**Step 7 — Pagefind island (`tools/build-blog.mjs` + CI, no shell.html touch).**
`pagefindMeta(post)`: explicit `data-pagefind-meta="title"` (posts have no h1,
auto-title would miss) + inline `date:` meta + `data-pagefind-sort` + one
`data-pagefind-filter="tag"` span per tag, hidden inside the existing
`data-pagefind-body` div. `ignoreChrome()`: post-render string replace adding
`data-pagefind-ignore` to shell nav/footer/clock on blog pages only — shared
template untouched, ×5 byte-identical holds. TOC/progress/share already ignored
(share was, TOC+progress gained it here). Draft articles get
`data-pagefind-ignore="all"` on top of noindex/RSS/sitemap exclusion (G5.2).
Index page (`published.length` only, so the 0-post shape is unchanged) gains a
search box + lazy island in `__SCRIPTS__` (`import('/pagefind/pagefind.js')` on
focus/input, 200 ms debounce, top-8 links built via DOM — no innerHTML of index
content). Post-build: `npm run build:pagefind` =
`pagefind --site . --glob 'blog/**/*.html'` (pinned 1.5.2, local dep, no npx
drift); bundle lands in gitignored `/pagefind/`, UI loads it on the blog index
only. Heavy-gate: `PAGEFIND=0` skips (default on). Base budgets unaffected by
construction (checker scans `js/`+`css/`+`index.html`+`blog/`-html+images only;
`/pagefind/` and `assets/vendor/` unscanned — same island-exclusion rule).

**Step 8 — Asciinema on-demand (same file + vendored bundle, no CDN).**
Vendored `assets/vendor/asciinema/asciinema-player.{min.js,css}` pinned 3.17.0
(jsdelivr, Apache-2.0; CSS carries no `url()` font refs — zero font work).
`cast:` frontmatter field (optional non-empty string; asserts with the E1 set).
`castEmbed`: `.cast` resolved against the md dir (`/`-absolute = site root),
copied to `blog/<slug>/` (NOT the `img/` variants dir), site-relative src so
local previews play local files (deliberate divergence from SITE_URL-absolute
images, which RSS needs and casts don't — embed is article-only, `post.html`
stays content-only). Player div (`aria-label`, `data-pagefind-ignore`) +
sibling `<details class=cast-transcript>` (copy button, E5) +
`<noscript><pre>` fallback; transcript = build-time `o`-event text,
ANSI-stripped (libterm/cell-term pattern), capped 8000 chars (keeps the 15k
gzip ceiling). `castScripts`: IntersectionObserver injects the vendored bundle
once, `create(src, el, {poster:'npt:0:05', idleTimeLimit:2, cols:80, rows:24,
theme:'monokai'})`; CSS link + init render ONLY when `post.cast` exists — zero
player bytes on text posts. Missing `.cast` throws (CI-red, same as images).
Fixture: `posts/_drafts/fixture.cast` (minimal valid v2, ANSI-colored prompt to
prove stripping) + `cast: fixture.cast` on `hello-fixture.md`; draft hash
rotated `b050ef…→b5b29a…` on the frontmatter edit (Substack-reset semantics).
Divergence noted: `.cast` sources live next to their md (like images), not a
separate `assets/casts/` dir — one fewer convention.

**Step 9 — Launch wiring (CI + docs, no editorial post).**
`static.yml` (order: blog steps before sitemap/IndexNow so manifest feeds both
free): Cache-bun-store → `bun install` → `bun tools/build-blog.mjs` →
`bun tools/assert-rss.mjs` → Pagefind step (PAGEFIND gate) → existing
build-info/sitemap/key/artifact/deploy/IndexNow. `rm -rf full-cv posts`
before upload: `posts/` sources (incl. `_drafts/`) must never deploy or draft
bodies ship as static files; frozen `blog/` is the serve path. Image-cache
rule: CI re-encodes clean every run (E6 `rm -rf blog/` stands — stale variants
must never deploy; seconds at ~10 posts/yr), `renderPostImages` mtime-skip
covers local rebuilds, so no `actions/cache` on outputs (documented in the
workflow comment). `docs/buttondown.md`: free-tier RSS-to-email bridge,
create-draft mode, canonical passthrough, archive = web-version, drafts-can't-
email by construction. `package.json`: `build:pagefind` script.
`.gitignore`: `/pagefind/`. `bun install` minted untracked `bun.lock`
(same status as the pre-existing untracked `package-lock.json` — env
artifact, not committed). NO real post created: `posts/_drafts/hello-fixture.md`
(+`.cast`) remains the proof artifact; first real `posts/<slug>.md` is an
explicit owner action (Buttondown approve-the-draft included).

**Verify (temp published cast+text posts, deleted after; zero tmp bytes remain).**
Cast post 33/33 (body/meta×2/sort/filter×2/chrome-ignore×3/embed/src/bundle/
poster/idle/80×24/monokai/Observer/transcript/copy/noscript/aria-label/
transcript-text/picture/avif/lazy/OG/published_time/share/copy-link/progress/
replaceState/TOC; `noindex` correctly absent). Text post: zero
asciinema/cast/TOC bytes, pagefind body present. Draft preview 8/8 carry-over
+ ignore-all + cast embed; prod 0 draft bytes in index/manifest/feed. Feed
XML-parses, assert-rss green (2→0 items after delete), sitemap per-post
`lastmod 2026-10-05/2026-10-04` vs deploy `2026-10-12` (lie stays fixed),
IndexNow list gains all 6 blog URLs (submit skips without key, pre-existing
behavior). Pagefind: 5 files walked → 2 pages indexed (index/tag correctly
body-less), 1 filter + 1 sort; REAL queries over local HTTP via node
(`options({baseUrl})` + `search()`): `terminal` → cast post only (title meta
correct), `verify` → both. Budgets 6/6 prod (worst post 5392/15000 incl. cast
embed+transcript+picture; images 81906/500000) AND skeleton (worst 3360);
registry 52 OK; `bun tools/build.mjs` ×5 byte-identical; missing-cast +
missing-image both CI-red (exit 1); PAGEFIND=0 skips cleanly; static.yml YAML
parses; full CI sequence (`bun install` → blog → rss → pagefind) green on the
empty-blog launch state. Card-validator-by-inspection (unchanged template).
Gate 4 (`?draft=`, step 10) stays NO-GO per L6.

---
## Post template `_TEMPLATE.md` — DONE (2026-10-12T~19:40Z)

Append-only: nothing above touched. Sibling-session work (steps 5–9, gates,
BiDi drivers) taken as baseline, untouched. Out of v1 untouched per lock:
comments, `/r` beacon, D1/KV/R2-read-path, minify.

**Choice: `posts/_TEMPLATE.md`** (top-of-`posts/` authoring aid, not in
`_drafts/` which holds real drafts). Either path needed the same loader fix:
`loadDir()` filtered only on `.md` suffix, so `_TEMPLATE.md` would have parsed
and thrown on the `^[a-z0-9-]+$` slug check — neither location excluded itself.

**Change (`tools/build-blog.mjs`, 1 filter + comment):** `loadDir()` now skips
`_*.md` and dotfiles before parsing. Double-guard: underscore prefix (prod AND
`BUILD_DRAFTS=1`) + `draft:true` in the template frontmatter (prod gate treats
it as draft even if the prefix filter regresses).

**Template format (`posts/_TEMPLATE.md`, committed — `git check-ignore` clean):**
valid frontmatter example (`title`/`description`/`date`/`tags` + optional
`image:`/`cast:` + `draft:true`), YAML-commented field notes; one HTML-comment
block documenting slug rules, heading/TOC (h2/h3 ids, 2+-entry rule), image
syntax (relative→`<picture>`, widths, LQIP, `img/` variants, CI-red on miss),
cast usage (resolve/copy/lazy player 80×24 monokai/transcript/`noscript`,
CI-red on miss), share footer + OG behavior (`?ref=`-preserving, canonical
clean, absolute URLs, default card), RSS/sitemap implications (published-only,
item shape, per-post lastmod, IndexNow, preview command); example body
(`## First section` + intro line + `![Hero](./hero.png)` + `### A subsection`
+ closing line). HTML comments don't render, so a lazy copy still builds clean.
Skipped: per-dir `posts.json` defaults (C1 YAGNI stands), generated social
cards (override line suffices).

**Verify:** prod `node tools/build-blog.mjs` → 0 published / 1 draft skipped,
`grep -rli template blog/` 0 hits (0 bytes); `BUILD_DRAFTS=1` → only
`blog/draft/b5b29a4f191b/` (fixture hash stable, Substack-reset semantics
intact), 0 template hits; budgets 6/6 (worst post 5876/15000 incl. draft,
images 81906/500000); `assert-rss` green (0 items); registry 52 OK;
`bun tools/build.mjs` ×5 byte-identical
(`1e0c0d28 7684d457 925987b8 e9dd0b29 3e321894` match the tasks-1–3 lock).
Gate 4 (`?draft=`, step 10) stays NO-GO per L6.

---
## Top-bar blog nav — DONE (2026-10-12T~20:30Z)

Append-only: nothing above touched. Sibling-session work taken as baseline,
untouched. No terminal strings changed (no `js/` touched).

**Change (1 line each, order resume/cv/man + blog, `/blog/` trailing-slash to
match `/man/`):** `index.html` doc-nav-links, `templates/man.html` hardcoded
links, `c/index.html` hardcoded links, `DEFAULT_NAV` in `tools/build.mjs` +
`tools/build-blog.mjs`. `templates/shell.html` needed no edit (already
`__NAV__` slot; default flows from the two scripts). No active state:
`css/nav.css` has no active/`aria-current` rule for `.doc-nav-links a`
(hover/focus only), so blog self-links plain like every other entry.

**Verify:** `bun tools/build.mjs` → ×5 regen, blog link in all
(resume/cv/man-index/man-resume/man-dvxb.io.7); `node tools/build-blog.mjs`
prod + `BUILD_DRAFTS=1` preview → blog index + draft page carry nav self-link
(crumb accounts for the 2nd `/blog/` hit); rebuild ×2 `sha256sum -c` clean
(byte-identical except the nav line); budgets 6/6 (index.html 9985/10000,
worst post 5877/15000, images 81906/500000); registry 52 entries / 36 listed,
all checks passed; assert-rss green (0 items); terminal snapshot re-run (32
goldens): 0 blog/nav lines in `logs/` diff — goldens unaffected. Tree left in
prod state (`blog/` = index/posts.json/rss.xml, 0 draft bytes).
Skipped: `__NAV__` slot conversion for `man.html` (hardcoded +1 line holds;
fork-collapse stays a §9 follow-up), md-viewer (own toolbar, no doc nav),
footers (no page links).

---
## Appendix M — Easiest authoring flow proposal (2026-10-13 UTC, design-only, nothing built)

Goal: 3-command flow — `bun new-post <slug>` → write → `bun preview` → push.
Foundation reused as-is: `posts/_TEMPLATE.md` (double-guarded `_*.md` skip +
`draft:true`), `tools/build-blog.mjs` draft gate (`draft:true`/future-date →
zero prod bytes; `BUILD_DRAFTS=1` → `blog/draft/<sha12>/` + `noindex`), 11
shell slots, RSS + `assert-rss.mjs`, Pagefind (`build:pagefind` + `PAGEFIND=0`
gate), sharp AVIF→WebP→JPEG island, vendored asciinema 3.17.0, `static.yml`
(blog→rss→pagefind→sitemap→IndexNow, `rm -rf full-cv posts` from artifact),
`docs/buttondown.md` bridge, branch `feat/blog-foundation` (PR #24).
Ranked by impact/effort (impact = mistakes prevented × frequency). Each item
lists exact commands/files; nothing here is implemented.

### M1. `bun new-post <slug>` — scaffolder (DO FIRST; ~30 lines, highest leverage)
- **Why first:** #1 authoring failure is slug-regex (`^[a-z0-9-]+$`) +
  frontmatter-key (`description` not `desc`, `tags` array, date parseable) →
  CI-red in `assertFrontmatter`. Scaffolder kills the whole class.
- **Files:** new `tools/new-post.mjs` (~30 lines, no deps: `node:fs`,
  `node:path` only) + 1 line in `package.json`:
  `"new-post": "bun tools/new-post.mjs"`.
- **Behavior:** `bun new-post my-slug` → validates slug regex (same as
  `slugOf()`), refuses on collision (`posts/<slug>.md` or `_drafts/<slug>.md`
  exists), copies `posts/_TEMPLATE.md`, stamps `date: "<today YYYY-MM-DD>"`,
  strips the `draft:true` guard comment? No — keeps `draft:true` (safe
  default; publish = delete the line), prints next steps
  (`bun preview` URL shape + publish checklist). `--drafts` flag writes to
  `posts/_drafts/<slug>.md` instead (default: `posts/<slug>.md` with
  `draft:true`, so the file is visible but unshipped).
- **Verify:** `bun new-post bad_Slug` exits 1 with the regex hint;
  `bun new-post ok-slug` → prod build 0 new bytes, `BUILD_DRAFTS=1` build
  renders `blog/draft/<sha12>/`; delete the test file after.

### M2. `bun preview` — watch+serve (DO SECOND; 1–2 lines, no new file)
- **Why:** `_TEMPLATE.md` comment documents a 2-step preview
  (`BUILD_DRAFTS=1 node tools/build-blog.mjs + python3 -m http.server`);
  one command makes it stick.
- **Files:** `package.json` only:
  `"preview": "BUILD_DRAFTS=1 bun tools/build-blog.mjs && python3 -m http.server 8089"`,
  `"preview:watch": "BUILD_DRAFTS=1 bun --watch tools/build-blog.mjs"`
  (serve in a second terminal; `bun --watch` re-runs on `posts/**` saves —
  no chokidar/nodemon dep).
- **Verify:** `bun preview` → draft URL prints from build output
  (`wrote blog/draft/<sha12>/index.html`); open `http://localhost:8089/`
  + index. No CI change (prod never sets `BUILD_DRAFTS`).

### M3. VSCode snippet + tasks (~15 min, zero runtime, zero risk)
- **Files:** new `.vscode/blog.code-snippets` (frontmatter skeleton with
  `description`/`tags: [""]`/`draft: true` placeholders + `![alt](./hero.png)`
  + `## / ###` stubs — catches `desc`-vs-`description` at type time),
  new `.vscode/tasks.json` (tasks: `blog: new-post` (input slug),
  `blog: preview` (`preview:watch`), `blog: build-prod`,
  `blog: check` (M5); problemMatcher `$node` so `assertFrontmatter` throws
  surface in VSCode). `.vscode/settings.json` exists (3 lines) — extend,
  don't replace.
- **Verify:** `Cmd+Shift+P → Run Task → blog: preview` works from a fresh
  clone with only `bun install`.

### M4. Friendlier frontmatter errors (~10-line diff, no new file)
- **File:** `tools/build-blog.mjs` `assertFrontmatter()` only.
- **Change:** keep every current check (no schema loosening), but format
  throws as `posts/<file>: field '<key>' — <what's wrong> — fix: <one-liner>`
  + print the valid keys line
  (`title/description/date/tags/image/cast/draft`) and the slug rule on
  slug failures. Add optional `bun check:post <file>` alias that parses one
  file through `matter` + `assertFrontmatter` + `slugOf` without building
  (fast pre-flight; reuses the same functions, ~10 lines in the same file
  guarded by `process.argv`).
- **Verify:** each violation class (missing title, `desc:` key, string tags,
  unparseable date, non-boolean draft, bad slug) prints file + fix hint;
  existing green/red cases unchanged.

### M5. `bun check` pre-push aggregate (compose gates, no new logic)
- **Files:** `package.json` 1 line:
  `"check": "bun tools/build-blog.mjs && BUILD_DRAFTS=1 bun tools/build-blog.mjs && bun run assert:rss && bun run check:budgets"`.
  Optional: `.git/hooks/pre-push` 3-liner calling `bun run check`
  (committed as `docs/pre-push.sample`, copied manually — NO husky/lefthook
  dep at ~10 posts/yr).
- **Why this order:** prod build (zero-draft-bytes) → preview build (draft
  renders) → feed assert → budgets (worst-post 15k gzip + images 500k).
  Mirrors `static.yml` sequence locally so push-day CI-red disappears.
- **Verify:** `bun run check` green on the fixture-only tree; temp published
  post keeps it green; missing-image/missing-cast fixtures turn it red.

### M6. Image/cast micro-helpers (docs + tiny wrapper, NO new pipeline)
- **Reality:** `renderPostImages` already resizes/converts/validates (sharp
  AVIF q60/WebP q80/JPEG q85, never-upscale, LQIP, CI-red on miss);
  `castEmbed` already copies/validates/transcribes. Don't build a resizer —
  document the two one-liners and add one read-only checker.
- **Files:** (a) 10-line section appended to `posts/_TEMPLATE.md` comment:
  `asciinema rec posts/<slug>/demo.cast` (v3 file, cap 80×24 at record time)
  + `![alt](./hero.png)` naming rule; (b) optional
  `package.json` alias `"check:media": "bun tools/build-blog.mjs"`
  (the build IS the checker — missing source already throws); (c) defer
  `bun poster <cast>` (extract `npt:0:05` still) until a second cast post
  proves the need — poster is already a player opt, not a build step.
- **Verify:** oversized hero still builds (sharp caps at native width);
  missing `./hero.png`/`.cast` still CI-red with the source dir in the message.

### M7. Buttondown bridge checklist (docs-only, already exists)
- **Files:** `docs/buttondown.md` EXISTS (feed URL, create-draft mode,
  canonical passthrough, archive = web-version, drafts-can't-email by
  construction). Change = 3-line footer appended to `posts/_TEMPLATE.md`
  comment linking it + publish checklist (publish `posts/<slug>.md` →
  CI green → approve drafted Buttondown issue → verify OG unfurl once per
  template). Optional alias `"check:feed": "bun run assert:rss"`.
- **Explicitly manual (correct):** account creation, RSS-automation setup,
  per-issue approval stay dashboard clicks — no code, no webhook, no Worker.
- **Verify:** feed for a temp published post passes `assert:rss` and shows
  the approved draft in Buttondown; draft/future posts never appear in feed.

### M8. Terminal `blog` command (LAST, only if trivial after M1–M7)
- **File:** `js/commands.js` registry only (~20 lines, same shape as `wall`
  read path): `blog` → fetch `blog/posts.json` (static, no backend, no auth)
  → list latest 8 (title + date); `blog <slug>` → `window.open('/blog/<slug>/')`.
  Reuses the existing fetch-timeout + error-text pattern; no KV/R2/Worker.
- **Why last:** zero authoring gain (discovery only), touches snapshot goldens
  (`logs/terminal-goldens/`) + `assert-registry.mjs` count (36 → 37) + help
  text. Gating: build only when M1–M5 are landed and goldens regen is already
  scheduled for another reason.
- **Verify:** `blog` offline prints the static fallback; registry count bump
  asserted; goldens regen reviewed (no unrelated diffs).

### M9. Explicitly NOT building (ponytail cuts)
- Per-dir `posts/posts.json` defaults (C1), generated OG social cards
  (`image:` override suffices), R2 media overflow (D4.1 size trigger only),
  WYSIWYG/CMS/admin UI (violates no-auth + git-history wins, App D5), `zod`
  (asserts suffice, E1), DOMPurify-at-build (trusted own-authored MD; stays
  client-side), hook frameworks (husky/lefthook — one sample file max),
  file watchers beyond `bun --watch`, `?draft=` token URLs (no static-native
  gate exists, E2), comments/`/r` beacon/D1 (locked out of v1, K1/L6).

### M10. Landing order
M1 → M2 (first productive afternoon; both unblock daily writing) → M3+M4
(same PR, polish) → M5 (before first real post) → M6-docs + M7-link (with
first real post) → M8 (only opportunistic). Total new code if all built:
~70 lines (`new-post.mjs` ~30 + asserts polish ~10 + tasks/snippets JSON ~30)
plus 4–5 `package.json` script lines. No new npm deps. No CI behavior change
until a real `posts/<slug>.md` lands.

---
## Authoring wins — new-post scaffolder + npm/VSCode shortcuts (2026-10-13 UTC)

**Added:** `tools/new-post.mjs` (stdlib only, node+bun) — `"Title"` → slugify →
`posts/<slug>.md` from `_TEMPLATE.md` with title/date filled (+ `--desc/--tags/--image/--slug/--date`
overrides), `draft: true` forced. Fail-loud exit 1: missing title, bad slug
(`^[a-z0-9-]+$`, `--slug` verbatim), overwrite (`posts/` + `posts/_drafts/`),
bad `--date`, missing template. Usage: `bun tools/new-post.mjs "My Title" --tags a,b --image ./hero.png`.
`package.json`: `new-post`, `preview` (`BUILD_DRAFTS=1` build + `python3 -m http.server 8089`),
`preview:prod` (prod build + serve). `.vscode/tasks.json` (new-post w/ title prompt,
preview, prod build) + `.vscode/blog-post.code-snippets` (`post` prefix frontmatter).
Zero new deps; no existing tool touched.

**Verify:** scaffolder create → frontmatter correct (title/date/desc/tags, draft:true);
no-args / bad-`--slug` / overwrite all exit 1; bun path confirmed. Prod build with
scaffolded draft present: 2 drafts skipped, `blog/draft/` absent, slug in none of
index/rss/posts.json. `BUILD_DRAFTS=1`: fixture draft → `blog/draft/<sha12>/`;
rebuilt prod after (tree left prod: index/posts.json/rss.xml, 0 draft bytes; temp
posts deleted). Budgets 6/6, registry 52/36, rss green (0 items). Old 5 pages
(resume/cv/man-index/man-resume/man-dvxb.io.7.html) `sha256sum -c` identical.

Skipped: `--watch` mode (no watcher infra; rerun build), snippet `cast:`/`image:`
lines (template comment covers them; scaffold keeps template defaults unless flagged).

---
## Appendix N — DeepSource triage (PR #25) + local-only editor options + Markdown vs LaTeX (2026-10-13 UTC, plan-only, no code changed)

### N1. DeepSource on PR #25 — when to ignore vs fix

Context: PR #25 (`feat/blog-dx` → main, OPEN) adds 5 files, 289 insertions:
`tools/new-post.mjs` (73 lines, stdlib-only CLI scaffolder), `.vscode/tasks.json`,
`.vscode/blog-post.code-snippets`, `package.json` (+3 scripts), PLAN-BLOG.md (docs).
Precedent: PR #24's foundation branch needed two fix commits (`384bc23`, `ae33ba3`:
regex/async/hoist findings in `build-blog.mjs` — code that RUNS IN CI on every
deploy and parses untrusted-shaped input). PR #25 code is a different animal:
a local-only authoring helper the owner runs by hand (`node tools/new-post.mjs
"Title"`), never in CI, never reachable from the browser. Owner copy/pastes MD
by hand; the branch may be discarded entirely.

Triage rule: **fix a DeepSource finding on this PR iff (a) the branch will merge
AND (b) the finding is in a class that bites a local CLI. Otherwise ignore
(resolve as false-positive/wont-fix in the DeepSource UI, no commit).**

| Finding class (likely on `new-post.mjs`) | Fix or ignore | Why |
|---|---|---|
| Path traversal / file-write outside intent (`join(POSTS_DIR, slug + '.md')` with `--slug` verbatim) | **FIX if merging** (~2 lines: reject `/`, `\`, `..` in slug; the `^[a-z0-9-]+$` regex already blocks them — confirm, don't add code) | Only finding with teeth: writes a file. But the existing regex already excludes separators, so the likely outcome is "confirm + dismiss," not a patch. |
| ReDoS (`[^a-z0-9]+`, `^[a-z0-9-]+$`, `^key:.*$` with `m` flag) | **IGNORE** | All patterns are linear (negated class / anchored, no nested quantifiers). No backtracking input exists — input is the owner's own CLI arg, not a network string. |
| `new RegExp` from variable (`key` interpolated) | **IGNORE** | Interpolated value is a hardcoded literal (`'title'`, `'date'`, …), never user input. Static allowlist in disguise. |
| Sync fs (`readFileSync`/`writeFileSync`/`existsSync`) flagged as blocking | **IGNORE** | Correct for a 73-line run-once CLI: no event loop to block, no server, exits after one write. Async would add lines for zero gain. |
| `process.exit` / `process.stdout` | **IGNORE** | Fail-loud CLI convention (matches repo's other tools); DeepSource's browser-oriented JS preset misfires on CLIs. |
| Style/complexity/cognitive-load on argument parsing | **IGNORE** | 73 lines, single author, single purpose; any "refactor" grows the diff past the value of the file. |
| Anything in `.vscode/*.json` | **IGNORE** | DeepSource JS analyzer doesn't meaningfully cover editor config; JSON snippets/tasks are inert. |
| Anything in PLAN-BLOG.md / `package.json` scripts | **IGNORE** | Docs and 1-line script aliases; no analyzer signal worth a commit. |

If the branch is discarded: do nothing at all — don't push "fix DeepSource"
commits to a dead branch, don't add `.deepsource.toml` excludes preemptively.
If it merges: first re-run DeepSource post-merge (findings on short-lived
branches often go stale), then apply the table — expected outcome is zero code
changes, only UI-dismissals. The one process improvement worth keeping either
way: DeepSource's JS preset is tuned for browser/server code; CLI tools under
`tools/` will keep generating this noise. If it recurs, the fix is config
(`exclude_patterns` for `tools/new-post.mjs`-class CLIs or a lowered severity),
not per-PR patches.

### N2. Local-only blog post editor — options + deployment-exclusion guarantee

Constraint: runs on `python3 -m http.server` / `bun preview`, NEVER deployed to
GitHub Pages/Cloudflare. No server needed because the whole job is client-side:
read MD → live HTML preview → write MD back. Browsers already provide every
primitive (File System Access API `showOpenFilePicker`/`showSaveFilePicker`
with `posts/*.md` as the suggested dir; `<input type=file>` + download fallback
where FSA is unavailable; `<input type=file accept=image/*,.cast>` for the
image/cast picker reading filenames into frontmatter; `marked` 15.x +
DOMPurify from the same pinned CDN versions `md-viewer.html` already uses for
render + sanitize; frontmatter = a small form (title/description/date/tags/
image/cast/draft) serialized back into the `---` block with the E1 asserts
mirrored as inline validation hints).

| Option | What it is | Exclusion mechanism (why it can't deploy) | Verdict |
|---|---|---|---|
| A. `md-viewer.html` `?draft=` route (extend existing) | Viewer already exists, already `noindex`, already outside sitemap/RSS (it reads `?url=`-fetched MD at runtime; nothing is baked into `rss.xml`/sitemap/Pagefind). Add a draft mode: textarea + preview pane + frontmatter form + save-via-FSA/download. | Inherits the viewer's existing exclusion: `noindex` meta + never linked from index/nav + `posts/` sources are `rm -rf`'d from the CI artifact (`static.yml`: `rm -rf full-cv posts`), so even a committed viewer can't leak drafts. | **RECOMMENDED.** Zero new pages, zero new exclusion surface to audit; the file already ships (or rather, already exists) and its hardening (Gate 4: `isAllowedUrl()`, `showError()`, DOMPurify 3.4.16) is done. Draft-sharing phase (L3.10) already plans a `?draft=` route — this is that route, kept local-first. |
| B. New `/editor/` local-only page | Separate `editor.html` (or `editor/`) with the same preview/form/save stack, plus niceties (editor + rendered post side-by-side in shell styling). | Must be excluded explicitly — pick ONE, in this order: (1) gitignored file (`/editor.html` in `.gitignore`, same convention as `/blog/` + `/pagefind/`): never pushed, so never deployed — strongest, zero CI touch; (2) separate local-only dir (e.g. `local/editor.html`, gitignored dir): same guarantee, room to grow; (3) `static.yml` artifact-path exclusion (`rm -rf editor` next to the existing `rm -rf full-cv posts`): works but is the weakest — relies on CI staying in sync, and the file still lives in git where a future workflow could bundle it. `robots noindex` alone is NOT exclusion (it only asks crawlers nicely; the bytes still deploy). Belt-and-braces: gitignore + `noindex` + never link from nav/index. | Runner-up. Justified only if the editor outgrows what fits in the viewer (multi-pane shell-styled WYSIWYG, per-post asset browser). Until then it's a second page to exclude, theme, and maintain for the same job. |
| C. VSCode tasks/snippets (already in `.vscode/`) | Already landed on PR #25: `blog: new post` / `preview` / `build-prod` tasks + `post` frontmatter snippet. Zero runtime, zero deploy surface (`.vscode/` is dev-only config; Pages serves it only if committed AND inside the artifact path — today it would upload as static files, but inert JSON nobody links). | Nothing to exclude: no HTML/JS ships a UI. (Note: `.vscode/*.json` IS currently inside the uploaded artifact path `'.'` — harmless today, but if editor-adjacent secrets ever land in settings, add `.vscode/` to the artifact `rm -rf` line.) | **KEEP as the baseline regardless.** A–B debate is about the visual preview layer; tasks/snippets stay either way. They already cover scaffold + preview + prod-build; the editor only adds live WYSIWYG. |

Recommended sequence: C (done, PR #25) → A (grow the viewer when copy/paste
fatigue is real — the `?draft=` Gate-4 work doubles as the editor shell) → B
only if A gets cramped. Whichever UI wins, the save path is identical
(FSA-write to `posts/` → `BUILD_DRAFTS=1` rebuild → `http://localhost:8089/blog/draft/<sha12>/`
for the true shell-styled proof), and the deploy guarantee rests on the two
mechanisms that already exist: `posts/` stripped from the artifact + draft HTML
carrying `noindex` and excluded from index/tag/RSS/sitemap/Pagefind.

### N3. Markdown vs LaTeX for posts — recommendation: Markdown (+ math-lite), LaTeX stays on resume/CV

| Axis | Blog Markdown (today: `marked` 15.0.12 + Shiki 4.5.0, `_TEMPLATE.md`) | LaTeX (`resume.tex` pipeline: `tex2html.mjs` + Tectonic PDFs, Full-CV private) |
|---|---|---|
| Authoring ease | Plain prose + `##`/`###` + fenced code + `![alt](./hero.png)`; owner already copy/pastes MD. Frontmatter asserts fail CI loud with fix hints (M4). | Author writes `\section`, `\resumeItem`, macro soup; every new macro must be taught to the parser or CI throws. Correct for a CV (pixel-identical typeset output) but hostile for prose drafting. |
| Build deps | 5 pinned npm packages, all build-time, zero client JS on text posts; `bun install` seconds. | Tectonic binary (~tens of MB) + remote font/package bundle (cached in CI) + private Full-CV checkout via PAT + `tex2html.mjs` custom parser. Heavy, network-dependent first run, secret-gated. |
| Failure modes | `assertFrontmatter` + missing-image/missing-cast throws: loud, local, fixable in the MD file. | `tex2html.mjs` is intentionally fail-fast — any unknown command/environment throws `TexParseError` (by design, falls back to make4ht). Porting that posture to blog prose means every `\usepackage` whim is a build break. |
| Perf | Frozen HTML + Shiki pre-render (zero runtime) + AVIF/WebP sharp pipeline + Pagefind chunked index. Budgets enforced (15k gzip/post, 500k images). | Tectonic PDF per post would add MB-scale binaries to the artifact; HTML-via-make4ht output is verbose and fights `doc.css`/shell slots. No budget story. |
| RSS/search compatibility | Native: post HTML → `content:encoded` full text (C6/E4), Pagefind indexes built HTML via `data-pagefind-*` attrs, per-post `<lastmod>` from frontmatter date. | RSS readers and Pagefind consume HTML; a TeX source would need the full TeX→HTML render just to reach parity with what MD emits directly. Math-in-RSS is broken in both unless rendered to HTML/SVG at build. |
| Math/code needs | Code: Shiki at build (settled, C3). Math: add math-lite ONLY when the first math post lands — `marked` extension or remark-math/rehype-katex at build emitting KaTeX CSS/HTML (zero or one font+CSS island, same pattern as the asciinema island: load only on math posts), NOT a TeX pipeline. Inline `$…$` in MD covers 95% of blog math; display equations render to HTML at build so RSS/search still work. | Full TeX math (`amsmath`, tikz) is the one genuine LaTeX advantage — and irrelevant until posts need proofs/diagrams TeX-only. Even then, prefer KaTeX-in-MD over a `.tex` post type: same glyphs, no second pipeline. |

**Recommendation (locks App D5/L1, no code):** blog prose stays Markdown, period.
LaTeX remains exactly where it is — `resume.tex`/`cv.tex` via Full-CV +
Tectonic for PDFs and `tex2html.mjs` for the resume/cv/man pages — and never
enters `posts/`. If math appears: KaTeX-at-build island scoped by frontmatter
flag (same island pattern as `cast:`), committed only with the first math post
(YAGNI until then — no dep, no CSS, no font today). Rationale in one line:
Markdown already satisfies every v1 constraint (§1: static, no-auth, RSS,
perf) with 5 pinned deps and loud local errors; LaTeX buys typesetting power
the blog doesn't need at the price of a secret-gated binary toolchain plus a
fail-fast parser that treats authorial novelty as a build break.

---
## Appendix O — LinkedIn themes + blog candidates (2026-10-13 UTC, append-only, no site code)

Method: Composio `linkedin` toolkit ACTIVE (`linkedin_bub-torso`, Devkumar
Banerjee, vanity `dvkb`, `https://www.linkedin.com/in/dvkb`, headline "CS
Honors @ TAMU | Brown Scholar | Prev @ LM, MDA | GSEC"). Official tools
(`LINKEDIN_GET_MY_INFO` OK; `GET_PERSON`/`GET_POST_CONTENT`/`LIST_REACTIONS`/
`GET_SHARE_STATS`) CANNOT list a member's posts — user-post listing needs
`just_one_api` (`JUST_ONE_API_LINKEDIN_GET_USER_POSTS`) or `apify`
(`APIFY_SCRAPE_LINKEDIN_PROFILE_POSTS`), both with NO active connection (new
OAuth not initiated — needs owner click). Fallback: public websearch snippets;
direct `webfetch linkedin.com/in/dvkb` → HTTP 999 (anti-scrape). Engagement
counts below are snippet-observed only, not API-exact.

### O1. Post list (own shares + key reposts/likes, newest first)

| Date | Type | Text hook | Link / activity |
|---|---|---|---|
| 2026-09-15 | own share | WHIT 2025–2026 Tutor of the Year (1 of 170+ tutors, 29 TX unis) | `activity-7505653055611215872` |
| 2026-09-15 | repost | TAMU Division of Academic Affairs WHIT Campus Champions | `activity-7505664629189292034` |
| 2026-09-09 | repost | TAMU System WHIT foster-tutoring recognition | `activity-7503441087877799937` |
| 2026-08-23 | own share | MD Anderson SIRP completion, PI Dr. Nghi Nguyen, Epic EHR cohort, genomic-risk vs metastasis-on-imaging stats | `activity-7497147124997050369` (+ father reshare `activity-7497880097274724352`) |
| 2026-08-05 | repost | SIRP leadership: 10-week research showcase | `activity-7490590053975629824` |
| 2026-07-22 | spotlight (3rd party) | cybr-sec-careers scholar spotlight (OT/ICS research, certs, Taylor Austin Broussard scholarship) | `activity-7485709589003403264` |
| 2026-05-09 | repost | NVIDIA NemoTron customization for 200 TAMU scientists | `activity-7458698932710191105` |
| 2026-04-14 | repost | Association of Former Students Telly Award vote | `activity-7449804183152787456` |
| 2026-03-11 | own share | Autodesk Design & Make Ambassador TAMU (workshops, CAD+compute workflows) | `activity-7437482594163851264` |
| 2025-10-21 | own share | HowdyHack 2025 Aggie Map (FastAPI+scraping+Perplexity LLM, React/Leaflet/Clerk, DigitalOcean; CORS/env war stories) | `activity-7386251606557646849` |
| 2025-09-07 | own share | Lockheed Martin EO Splunk Delivery internship (AWS GovCloud, Python, Ansible, GitLab CI/CD, Podman; Intern Summit) | `activity-7370541324254715904` |
| 2024-07-30 | own share | GitHub Professional Certificate learning path | `activity-7223916226299752448` |
| 2023-10-31 | own share | TAMU Datathon 3rd/600+ Hospital Plunge (CNN+PCA) | `activity-7124979589847662592` |
| likes (signal only) | liked/reacted | ASME Memorial Award (father), airport CV deployment (Akku Kumar), Hermes Agent v0.21 | various Sep 2026 |

Engagement (snippet-observed): LM post most congrats (6+ comments, highest);
HowdyHack 2 substantive comments; SIRP reshared by family + SIRP leadership
post; WHIT posts institutionally reshared (TAMU System reach). No API counts.

### O2. Recurring themes

1. Research labs: MD Anderson SIRP diagnostic imaging / translational oncology;
   AGGIES + DIVE (GNN) + security (headline/resume, thin on LinkedIn — gap to fill).
2. Internships: LM Splunk/AWS-GovCloud SRE; MD Anderson SIRP.
3. Hackathons: HowdyHack Aggie Map (Best Aggie Hack), Datathon Hospital Plunge
   (3rd), TAMUHack AI Voice MFA (resume-only, no LinkedIn post found).
4. Certs: GSEC/GFACT/RVFA/ITF+/Azure AI (headline + resume; only GitHub-cert
   post on LinkedIn — gap).
5. Service/ambassador: WHIT Tutor of Year; Autodesk Ambassador (CAD+compute).

### O3. Top 5 blog candidates (engagement × unfinished depth)

1. SIRP: Epic cohort + genomic-risk vs visible metastasis — methods/stats/
   translational lessons, PHI-free. Highest depth gap.
2. LM Splunk delivery on GovCloud (Ansible/Podman/GitLab CI) — enterprise SRE,
   what scales vs what broke.
3. Aggie Map 24h build (concurrent scraping + LLM Q&A + Leaflet heat/ping) —
   architecture + CORS/env/dependency war stories, live Demo/Devpost/GitHub links.
4. Hospital Plunge CNN/PCA Datathon — compact ML writeup; imaging-ML diptych w/ #1.
5. WHIT Tutor of Year — tutoring foster youth at scale; human counterweight to
   research/SRE posts; teaching-CS angle.

---
## Appendix P — Images vs carousel + Notion/Obsidian blocks (2026-10-13 UTC, research-only, no site code)

Context: Aggie Ring draft (`posts/_drafts/aggie-ring.md`) carries 24 photos
(1 hero + order-night group + 22 out-of-repo by draft comment); pipeline is
`tools/build-blog.mjs` `renderPostImages` (relative `![alt](./x)` → `<picture>`
AVIF→WebP→JPEG × [320,640,960,1280,1920] capped native, w/h + lazy + LQIP,
variants `blog/<slug>/img/`, CI-red on miss); budgets are per-post HTML gzip
≤15000 + images total ≤500000 (`tools/check-budgets.mjs`, `docs/perf-budgets.md`);
islands ride `__SCRIPTS__` (js/-excluded by construction); RSS keeps content-only
`post.html`; Pagefind via `data-pagefind-*` + `ignoreChrome()`; asciinema 3.17.0
vendored (`assets/vendor/asciinema/`). Shell: `templates/shell.html` (11 slots).

### P1. Rule: 1–3 inline, 4+ carousel; 24-photo post = 1 hero + offsite rest

| Axis | 1–3 inline (current, zero new code) | 4+ carousel (`gallery` island) | 24-photo Aggie verdict |
|---|---|---|---|
| Bytes | Each photo ≤18 variants; 1 fixture ≈82k/500k gzip already. 24 photos ≈5–10× image budget + srcset/LQIP pressure on 15k/post HTML | Same variants, but rule caps in-repo count; island ~40 lines gated to gallery posts only | 1 hero inline; group shot to LinkedIn; 22 stay out (draft comment already says this) |
| LCP/CLS | Hero eager + `fetchpriority=high` (one-line tweak to existing output); w/h + LQIP already CLS-safe | Slide 1 eager, slides 2+ `loading=lazy` (free from pipeline); snap-track reserves boxes | Hero LCP-safe; carousel never blocks LCP |
| A11y | Native order, zero interaction — wins ≤3 | Buttons + `aria-roledescription=carousel` + `aria-live` counter + arrows + reduced-motion off; snap works JS-off | 24 stacked images = SR swamp; carousel (or offsite) kinder |
| SEO/RSS | `og:image` = single `image:` frontmatter (hero) | Captions indexed as body; chrome `data-pagefind-ignore`; RSS/`noscript` = stacked `<picture>`+`<figcaption>` list | Feed readers get linear photos — correct there |
| Maintenance | Zero | One fence parser reusing `renderPostImages` + one island; missing file = same CI-red | Author edits one list, not 24 tags |

### P2. Minimal block set (zero-runtime frozen HTML + budgets)

IN: (1) GFM-free — tables/checklists/`---` (marked `gfm:true`, 0 lines);
(2) callouts — `> [!NOTE]/[!TIP]/[!WARNING]` → `<aside class="callout …">`
(~15-line build post-process, CSS reuses details/transcript rules, no new sheet);
(3) toggles — raw `<details><summary>` passthrough (0 lines, zero JS, md-viewer
already styles it); (4) gallery — ` ```gallery ` fence → carousel island (P3).
DEFERRED (explicit): tabs (runtime state + tablist a11y + RSS order break);
KaTeX (N3 math-lite island only with first math post, frontmatter-flag-scoped);
embeds beyond asciinema (iframe/FORBID precedent + privacy/weight); custom
dividers (`hr` suffices). Caption/transcript bloat gated by 15k/post ceiling
(reuse 8k transcript-cap precedent for gallery caption totals).

### P3. Carousel sketch (vanilla island, no vendored lib)

Reject Splide/Swiper (10–30 KB JS+CSS + theme/a11y audit for a 4-photo strip).
Vanilla `__SCRIPTS__` island (~40 lines, `postScripts()`/`castScripts()` shape,
renders only when fence present): scroll-snap track + prev/next buttons +
`aria-live` counter + arrow keys + `prefers-reduced-motion` smooth-off.
Author syntax: ` ```gallery ` fence, one `![alt](./f.jpg) caption` per line
(same resolution/CI-red as inline). Build output: `<figure class=gallery>`
→ snap `<div class=gallery-track>` of `<figure><picture/><figcaption/></figure>`
+ `data-pagefind-ignore` chrome (buttons + counter) + `<noscript>` stacked list.
Lazy: slide-1 eager/high-priority, rest `loading=lazy`; IntersectionObserver
upgrade only on evidence, not day one.

---
## Appendix R — Obsidian/Notion WYSIWYG parity (2026-10-13 UTC, research-only, no site code)

Question: can the owner write in Obsidian/Notion and have the blog render
"just like Obsidian renders it, with site theme applied"? Answer: **yes for
Obsidian-as-editor over `posts/` (subset), no for Notion-as-source.**
Grounding: `tools/build-blog.mjs` (`marked` gfm:true → Shiki → shell 11
slots), `css/tokens.css` (oklch vars, Space Grotesk body / JetBrains Mono
code), `posts/_TEMPLATE.md` (frontmatter contract), App P2 (callout/toggle/
gallery block set). Obsidian docs verified 2026-10-13 (callout syntax, fold
suffixes, case-insensitivity, `note` fallback, snippet override shape);
Notion verified via Notion help (Markdown & CSV export) + notion-to-md
source/issues (toggle/callout transformers, open bug #173).

### R1. Parity map (Obsidian → blog pipeline)

| Obsidian | Blog status |
|---|---|
| Callouts `> [!note]` + custom title, case-insensitive, unknown → `note` | **P2-planned, ~15-line post-process** (`> [!NOTE]/[!TIP]/[!WARNING]` → `<aside class="callout …">`). Build regex MUST be case-insensitive + normalize (Obsidian ids are case-insensitive; P2 sketch shows uppercase). Fold suffixes `+`/`-` → `<details open?>` inside the aside (or plain `<details>`); `+`=open, `-`=closed. Nested callouts: support one level, flatten deeper (cap like the 8k transcript precedent). |
| Toggles / callout folds | **Free today**: raw `<details><summary>` passes marked through untouched (P2 IN, 0 lines). Bullet-list folding is view-only in Obsidian (no syntax) — nothing to convert, don't author structure that depends on it. |
| Tables / checklists / `---` | **Free today**: `marked` `gfm:true` (P2 IN, 0 lines). |
| `![alt](./hero.png)` standard embeds | **Free today**: renders in Obsidian reading view AND feeds `renderPostImages` (AVIF→WebP→JPEG, CI-red on miss). This is the authoring rule — standard syntax in both tools. |
| `![[hero.png]]` / `[[page]]` / `[[page\|alias]]` wikilinks | **Lint-reject (R3)**. marked emits them as literal text. No silent converter (hides broken refs; contradicts missing-image CI-red precedent). |
| `![[note]]` / `![[note#heading]]` transclusions | **Breaks, by design.** No static equivalent without a transclusion resolver (second pipeline, out of v1). Rule: never author; inline the content. |
| Backlinks panel / graph | **No equivalent.** Static has no backlink index. Manual "related: [a](/blog/a/)" links where wanted. |
| `#tag` inline | Renders as plain text; feeds NOTHING (tag pages come from frontmatter `tags:` via `getFilteredByTag`). Rule: tags live in frontmatter only. |
| Properties (frontmatter) | **Compatible**: Obsidian Properties = YAML frontmatter, gray-matter parses it. Two shape traps → CI-red with fix hint (existing `assertFrontmatter`): Obsidian may save `tags: foo` (string, pipeline needs array) and unquoted `date:` (pipeline needs parseable date). `new-post.mjs` scaffolding emits the correct shape; pasted-from-Obsidian files get validated, not trusted. |
| Canvas / Dataview / Tasks / Excalidraw / Publish-only | **Breaks.** `.canvas` files, live queries, plugin views have no markdown serialization the build can read. Rule: export-to-MD first or don't author posts with them. |

### R2. Bridge options

**(a) Obsidian vault pointed at `posts/` — RECOMMENDED.** Zero sync:
open `posts/` as a vault (or symlink it into an existing vault), write
`posts/<slug>.md` with standard image syntax, preview in Obsidian reading
view ≈ blog (same GFM + callout titles + details folds; theme matched via
R3 snippet). Attachments setting: "same folder as current file" so
`./hero.png` lands next to the md — exactly where `renderPostImages`
resolves it. Frontmatter validated by the build, not by the editor.
Cost: one CSS snippet file, one settings line, zero deps, zero CI touch.

**(b) Notion → Markdown — NOT recommended, documented for completeness.**
Native "Markdown & CSV" export degrades precisely the blocks P2 cares
about: callouts → raw HTML or `>` quote + emoji prefix (color/semantics
lost); toggles → `<summary>/<details>` HTML (renderer-dependent) or
flattened to headings + loose paragraphs (collapse lost); columns →
stacked sequentially (layout lost); databases → CSV of rows only (views,
filters, sorts, relations, rollups, formulas all dropped — formulas frozen
to last computed value); images → sidecar folders with relative paths that
break when a single `.md` is copied out; filenames carry 32-char page IDs.
`notion-to-md` (npm) is better than raw export (toggle→`md.toggle`,
callout→icon-prefixed quote, columns joined, tables→GFM) but carries open
rendering bugs (upstream issue #173: toggle children merged/indented,
callout double-`>` prefix) and needs a Notion integration token + API
script + per-export fixups (rewrite image paths, strip page IDs, re-add
frontmatter the build requires, re-fold flattened toggles into
`<details>`). Every export is a lossy migration; every post pays the
fixup tax. Databases stay out entirely — no post content should live in a
Notion DB.

**(c) Single-source plugins (Notion-to-blog sync actions, Obsidian
publish-to-git plugins) — SKIP.** A daemon with tokens that pushes to git
reintroduces auth + unattended-write failure modes App D5 rejected, to
save a `git commit` the owner already does. The vault-pointer (a) gets
100% of the authoring win with none of the moving parts.

### R3. Minimal path (all of it)

1. **Write in Obsidian over `posts/`** (vault root = `posts/`, attachments =
   same-folder). Standard `![alt](./x.png)`, `> [!tip] Title` callouts,
   raw `<details>` for toggles. `bun preview` (M2) remains the true
   shell-styled proof — Obsidian preview is the draft view, the local
   build is the publish view.
2. **One Obsidian CSS snippet** (`<vault>/.obsidian/snippets/dvxb.css`,
   enable in Settings → Appearance): mirrors `css/tokens.css` so reading
   view ≈ blog. Exact vars to mirror:
   `--font-text`←`--font-body` (Space Grotesk), `--font-monospace`←
   `--font-mono` (JetBrains Mono), `--background-primary`←`--color-bg`
   (`oklch(0 0 0)` — Chromium snippets accept oklch verbatim),
   `--text-normal`←`--color-text`, `--text-muted`←`--color-text-muted`,
   `--background-secondary`←`--color-panel`; callout accents
   `note`←`--color-primary`, `tip`←`--color-terminal-green`,
   `warning`←`--color-accent` via `.callout[data-callout="…"]`
   (`--callout-color` + `--callout-icon`, the documented override shape).
   Sketch (~20 lines):
   ```css
   :root {
     --font-text: 'Space Grotesk', sans-serif;
     --font-monospace: 'JetBrains Mono', monospace;
     --background-primary: oklch(0 0 0);
     --background-secondary: oklch(0.055 0.006 260 / 0.94);
     --text-normal: oklch(0.93 0.01 260);
     --text-muted: oklch(0.65 0.03 260);
   }
   .markdown-preview-view { max-width: 880px; }
   .callout[data-callout="note"] { --callout-color: 100, 80, 255; --callout-icon: lucide-info; }
   .callout[data-callout="tip"] { --callout-color: 60, 200, 140; --callout-icon: lucide-check; }
   .callout[data-callout="warning"] { --callout-color: 230, 180, 80; --callout-icon: lucide-alert-triangle; }
   ```
   (Snippet `--callout-color` takes r,g,b triplets per Obsidian docs; values
   above approximate the oklch tokens. Fine-tune once against a real post.)
3. **Wikilink lint in the build — fail loud with fix hint (~6 lines).**
   In `loadDir()` after `matter()`, before returning the post:
   ```js
   if (/!?\[\[/.test(parsed.content)) throw new Error(
     `wikilinks ${file}: use standard ![alt](./x.png) / [text](./y) — Obsidian renders both, the blog only builds standard syntax`);
   ```
   Catches `[[page]]`, `[[alias|x]]`, `![[embed]]`, `![[note#h]]` in one
   regex (every wikilink contains `[[`, optionally `!`-prefixed). Same
   fail-loud posture as `assertFrontmatter`/missing-image. No auto-convert:
   silent rewrites ship broken refs; CI-red keeps the author in standard
   syntax that previews identically in both tools.
4. **Explicitly out:** Notion dependency of any kind, transclusion
   resolver, backlink index, DB-backed content (App D5 stands), second
   theme to maintain (snippet tracks tokens by hand, ~annual drift).

---
## Appendix Q — Image variant math + source optimization (2026-10-13 UTC, research-only, no site code)

Context: Aggie Ring draft wants 1 hero (3024×4032 WhatsApp JPEG, 1.09 MB) +
optionally 1 group shot (768×1024, 138 KB); 22 stay out (App P). Pipeline =
`tools/build-blog.mjs` `renderPostImages`; budget = images total ≤500,000 B
gzip (`tools/check-budgets.mjs:52`, `docs/perf-budgets.md:63-69`). Measured
this pass: fixture 1280×720 PNG → 12 files, 81,906 gzip; Ring hero via sharp
(AVIF q60/effort 6, WebP q80, JPEG q85 — the pipeline's exact settings).

### Q1. Why "18 variants" (exact lines)

- `IMG_WIDTHS = [320, 640, 960, 1280, 1920]` (`build-blog.mjs:35`).
- `targets = [...IMG_WIDTHS.filter((w) => w < meta.width), meta.width]`
  (`:235`) — every width below native PLUS native (never upscale, always
  include full-res).
- `for (width of targets) for ([fmt] of [avif, webp, jpg])` (`:239-245`) —
  tiers × 3 formats. LQIP (`:246`) is an inline 32px data-URI (pressures the
  15k HTML budget, not a file); OG default card is one shared 30 KB asset.
- Math (files per photo = tiers × 3):

| Source | Tiers | Files |
|---|---|---|
| >1920px (ALL Ring photos: 3024–5120) | 320,640,960,1280,1920+native = 6 | **18** |
| 1280 (fixture-hero.png, verified) | 320,640,960+1280 = 4 | 12 |
| 768 (group `(8).jpeg`) | 320,640+768 = 3 | 9 |
| ≤320 | native only | 3 |

- "4000px = 15+2" is off by a tier: 4000px gives 6 tiers × 3 = 18 files too
  (all 5 widths < 4000, +4000 native). 18 is the max for ANY source >1920px.
- Display cap matters: `sizes="(max-width: 960px) 100vw, 960px"` (`:250`) —
  CSS width never exceeds 960px, so the 1280/1920/native tiers serve DPR≥2
  only, and the >1920 native tier serves ~nobody (960×3 = 2880 ≈ only 3x
  phones at full-bleed).

### Q2. Source optimization (ImgBot / pre-commit / EXIF)

- **ImgBot (what it is):** GitHub App that opens auto-PRs recompressing
  images in-repo (lossless by default: Huffman re-opt, metadata strip;
  lossy only if configured). Free for public repos. Verdict: **skip** —
  (a) WhatsApp JPEGs are already lossy-compressed, so lossless re-encode
  saves ~5–10%, not ~30–50%; (b) PR-per-photo noise at ~10 posts/yr;
  (c) third-party write access for near-zero gain; (d) it optimizes
  SOURCES, but the 18× multiply happens at build — shrinking sources 8%
  still leaves Q3's budget problem intact.

| Alternative | Fit |
|---|---|
| `bun optimize-images` via **already-pinned sharp 0.35.5** (new ~25-line `tools/optimize-images.mjs`, zero new deps) | **RECOMMENDED.** Max-width 1920, JPEG q82, PNG lossless, strip EXIF. Same dep the build uses; author runs once per photo. |
| squoosh CLI / browser | Good for one-off quality eyeballing (E3), not repeatable; WASM ~25× slower than sharp. Use to pick q-values once, not per photo. |
| ImageOptim / TinyPNG | mac-only GUI / third-party upload — wrong shape for a CLI+CI repo; skip. |
| husky / lefthook pre-commit framework | Skip per M9 (one sample file max). Commit `docs/pre-push.sample` 3-liner calling `bun run check` (M5 pattern); copy to `.git/hooks/` manually. |

- **Lossy vs lossless:** photos (all Ring JPEGs) → lossy q80–85 at
  author time; a second lossy generation on an already-q~75 WhatsApp file
  shows no visible delta at blog display sizes. PNG graphics/text
  screenshots → lossless only (lossy smears edges). Never lossless-JPEG
  as a "quality" move — it only wastes bytes.
- **EXIF/privacy (measured):** both WhatsApp sources carry **0 EXIF
  entries** (WhatsApp strips on send — verified via PIL this pass), and
  `renderPostImages` never calls `.withMetadata()`, so sharp drops
  metadata from variants by default. The privacy surface is the
  COMMITTED SOURCE: a future camera original (not via WhatsApp) keeps
  GPS/timestamps in `posts/` (which is `rm -rf`'d from the deploy
  artifact but lives in git history forever). The optimizer script MUST
  strip EXIF (sharp default — just never add `withMetadata()`), and the
  `.gitattributes` line below keeps diffs sane:
  ```
  *.jpeg binary diff=exif linguist-generated=false
  *.jpg binary diff=exif linguist-generated=false
  *.png binary diff=exif
  blog/ export-ignore
  ```
- **Max-width cap before commit: 1920.** Ring sources are 3024–5120px /
  1–3 MB each; nothing on the page renders above 960 CSS px (Q1). Cap
  1920 covers 2x DPR with headroom; larger sources only feed the
  nobody-serves native tier.

### Q3. Cutting variant count (measured byte tradeoffs, Ring hero 3024px)

Per-tier bytes (avif+webp+jpg): 320w 81,817 · 640w 301,858 · 960w 578,174 ·
1280w 901,354 · 1920w 1,539,371 → 5 tiers ≈ **3.40 MB raw** (+3024 native
tier, est ~2 MB → ~5.5 MB/photo). Images barely gzip, so gzip ≈ raw:
**ONE hero ≈ 11× the 500k budget.** JPEG is the fattest leg every tier
(1280w: 423,132/901,354 = 47%; same ~44–50% everywhere).

| Cut | Files | Bytes saved (hero) | Cost |
|---|---|---|---|
| Cap native tier at 1920 (drop `meta.width` append when native >1920; ~4-line change) | 18→15 | ~−2 MB (~−35%) | Serves-nobody tier per Q1; legit but touches the pipeline |
| Drop JPEG fallback (AVIF+WebP only; AVIF ~93–95% + WebP ~97%+ per E3) | 18→12 | ~−45% (~−2.5 MB) | Ancient browsers get AVIF/WebP decode failure → broken hero; needs `<img>` fallback rethink |
| 5→3 widths (e.g. keep 640/1280/1920) | 18→12 (with native) | ~−11% if dropping small end; more if dropping top | Small screens fetch 640w for a 320px slot (~2× over-fetch) |
| Quality q-tweaks (AVIF 60→50, WebP 80→75) | 18 (same) | ~−15–25% | Visible on gradients; needs squoosh eyeball per photo |
| Per-image `widths:` frontmatter override (e.g. group shot `[320,640]`, hero full set) | varies | Proportional | ~15 lines + validation + docs; only pays when photos differ in role |

- Combined max (cap + drop-JPEG + 3 widths): 3 tiers × 2 fm = 6 files,
  ~−75% bytes — but costs pipeline complexity + legacy-browser risk for a
  1-photo blog. Ponytail says no.
- **Recommendation (no pipeline change):** (1) author-time cap 1920 +
  q82 via `tools/optimize-images.mjs` (Q2 — zero new deps, zero build
  change); (2) **retune image-total 500k → 2 MB gzip on first-real-photo
  evidence** (L3.3 permits retune on evidence — this appendix IS the
  evidence: 500k fits zero real photos; 2 MB fits 1 hero + group + OG
  card with headroom while still gating a 24-photo repeat of App P);
  (3) keep all 18 variants, keep JPEG, keep 5 widths. Revisit Q3 cuts
  only if the budget binds again — the next lever in order is the
  native-tier cap (biggest bytes, least risk), never JPEG-drop first
  (smallest usefulness loss per byte is wrong: JPEG is the fallback
  that keeps old browsers alive).

---
## Appendix S — R2 for blog images vs free S3 alternatives (2026-10-13 UTC, research-only, no site code)

Context: sharp AVIF→WebP→JPEG pipeline (`renderPostImages`, ≤18 variants/photo
per Q1), image-total ceiling 2 MB proposed (Q3), git-MD source + frozen HTML
(Flow A, App D5), R2 TELEMETRY live for private PGP blobs only (H4), no D1/KV
in the blog read path. Sources: R2 pricing / public-buckets / wrangler-commands
docs + B2 / Storj / Supabase / GH-LFS / jsDelivr docs, all fetched 2026-10-13.

### S1. R2 for blog images

- **Setup:** new bucket `blog-media` (NOT `telemetry` — that holds private
  PGP blobs, never public): `wrangler r2 bucket create blog-media`. Public
  via custom domain `cdn.dvxb.io` (R2 → Settings → Custom Domains → Connect;
  auto-CNAME, zone must be in the same account). `pub-<hash>.r2.dev` is
  rate-limited, cache/WAF-less, dev-only — use for draft checks, disable once
  the custom domain is live (else it bypasses WAF).
- **Build-time upload recipe** (per hashed variant; wrangler put = one object
  at a time, ≤315 MB — fine here; bulk galleries via `r2 bulk put`/rclone):
  ```
  wrangler r2 object put blog-media/media/<slug>/<hash>-<name>-<w>.avif \
    --file ./out.avif --content-type image/avif \
    --cache-control "public, max-age=31536000, immutable" --remote
  ```
  Same for webp (`image/webp`) / jpg (`image/jpeg`); `.cast` with
  `--content-type application/octet-stream` (immutable only if the key is
  hashed, else a short max-age). `--remote` is load-bearing (without it you
  write to local simulation).
- **URL shape:** prod `https://cdn.dvxb.io/media/<slug>/<hash>-<name>-<w>.avif`;
  draft `https://pub-<hash>.r2.dev/media/...`. `build-blog.mjs` switches on a
  `MEDIA_BASE` constant — one string, no logic change.
- **Cost:** 10 GB-mo storage + 1M Class-A + 10M Class-B free/mo (Standard class
  only — do NOT use Infrequent Access: no free tier + retrieval fees + 30-day
  minimum). Overage $0.015/GB-mo, $4.50/M A, $0.36/M B; egress $0 always;
  deletes free. Blog math: 100 posts × 5 MB ≈ 0.5 GB (~20× headroom), puts in
  the hundreds/mo vs 1M, media GETs in the thousands/mo vs 10M → **$0/mo**.
- **When R2 beats git:** repo-size pain ~50–100 MB or slow clones (App D4.1
  trigger stands); concretely, one 3024px photo ≈ 5.5 MB of variants (Q3) —
  a 24-photo post is the trigger incarnate. Bodies NEVER leave git.
- **Cache + invalidation:** content-hash in every key (dodeca base12 pattern,
  §6) + immutable headers = no purge path needed, ever; edited photo = new
  URL. Composes with G5.2 unlisted-hash draft URLs (hash rotates on rebuild).
- **Local preview:** `bun preview` serves `blog/` offline; R2 URLs are absolute
  remote, so preview needs network for overflow images — acceptable because
  the hero stays local (S3 rule below) and covers the common case.

### S2. Free S3-compatible alternatives

| Service | Free storage | Free egress | Ops | Custom domain | Effort / verdict |
|---|---|---|---|---|---|
| Cloudflare R2 | 10 GB-mo | unlimited, $0 | 1M A + 10M B/mo | yes (same-account zone) | Low — wrangler already auth'd. **RECOMMENDED** |
| Backblaze B2 | 10 GB always-free | 3× stored/mo, then $0.01/GB (unlimited via CDN partners incl. Cloudflare) | A/B/C transactions free | yes (behind CDN) | Medium — second account + keys. Runner-up iff avoiding CF lock-in |
| Storj | 25 GB × 30-day trial ONLY, then $7/TB + $7/TB egress + $5/mo floor | none permanent | no API fees, 30-day min duration | Linksharing (paid tiers) | First recurring bill. **REJECT** |
| Supabase Storage | 1 GB (+5 GB egress/mo) | 5 GB/mo then $0.09/GB | n/a | paid add-on | App-backend shape + projects pause after 7d idle. **REJECT** |
| GitHub LFS | 10 GiB store + 10 GiB/mo bandwidth (Free/Pro) | capped — over-quota w/o payment = LFS disabled rest of month | n/a | n/a | Bandwidth cap kills image serving. **REJECT** |
| jsDelivr + GitHub raw | "unlimited" CDN (open-source only) | $0 | n/a | no (`cdn.jsdelivr.net/gh/…`) | Zero setup but ToS = packages/repos not media hosting; upstream GitHub-fetch flakiness (May-2026 429 incident); no cache-control. **REJECT** as primary |

### S3. Interaction with responsive variants → recommendation

Ops are never the constraint: 18 variants = 18 Class-A PUTs one-time per photo;
a 24-photo post is 432 PUTs vs 1M free/mo. Bytes are (Q3: ~5.5 MB for one
3024px source). So: **upload all variants the pipeline emits for any photo that
earns R2** — srcset stays intact, the browser still picks; do NOT invent a
second variant set per host. Rule: **hero stays git** (author-time 1920-cap +
q82 per Q2 keeps 1 hero + group + OG card inside the 2 MB ceiling);
**galleries (4+ photos, P1 carousel) + `.cast` overflow → R2** with hashed
keys; `build-blog.mjs` per-file rule (extends D6.2): local ref below cap →
in-repo hashed URL, above cap → `https://cdn.dvxb.io/media/<slug>/<hash>-…`.
RSS `content:encoded` already uses absolute URLs (steps 5–6) so feeds survive
the split; Pagefind indexes HTML only, unaffected.

### S4. LinkedIn/Substack portability

Standard Markdown `![alt](https://cdn.dvxb.io/…)` images and `[text](url)` links
paste cleanly into LinkedIn (first-image unfurl) and Substack (URL embed/import)
because both consume plain HTML/Markdown primitives. Obsidian `![[embed]]` /
`[[wikilink]]` transclusions and callout/fold extensions do not transfer — they
render as literal text outside Obsidian (same reason R3 lint-rejects them).
Custom fences (```` ```gallery ````) are build-local: flatten to stacked
images + captions before cross-posting.

---
## Appendix T — Mounting R2 as a local filesystem for Obsidian editing (2026-10-13 UTC, research-only, no site code)

Context: `posts/*.md` stay git-local (Flow A, App D5); binaries overflow to
R2 `blog-media` behind `cdn.dvxb.io` (App S); author edits in Obsidian on a
Linux workstation and wants overflow images visible/browseable without
copying them into git. Sources: rclone S3/R2 + `rclone mount` docs, Cloudflare
R2 rclone guide, s3fs-fuse README + R2 community threads, geesefs README,
JuiceFS docs, Obsidian-over-FUSE reports — all fetched 2026-10-13. Neither
`rclone` nor `s3fs` is installed on this workstation today (verified
`which`: both absent).

### T1. Option matrix (all speak the R2 S3 API at `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)

| Tool | R2 support | Read/write | Offline | Obsidian fit | Verdict |
|---|---|---|---|---|---|
| **rclone mount** (+ VFS cache) | First-class: `type=s3, provider=Cloudflare` (Cloudflare documents it); `rclone copy/ls` also = the bulk-upload path | R/W with `--vfs-cache-mode full` (buffers writes locally; required — bare mount fails multipart `rcat`/streaming writes per rclone S3 docs) | `--vfs-cache-mode full` = cached files readable offline until `--vfs-cache-max-age` expiry; writes queue and flush on reconnect (conflict = last-writer-wins, no merge) | Best of the FUSE set with `full`: inotify-ish polling + local write buffering keeps the editor responsive; still not a real fs (single uid/gid, fake mtime unless `--use-server-modtime`) | **RECOMMENDED (primary)** — best maintained, already the upload tool, one config covers mount + copy |
| s3fs-fuse | Compatible with flags (`-o url=<endpoint> -o use_path_request_style`), but second-class: community R2-mount threads report auth/region friction; no Cloudflare doc page | R/W, but every update re-downloads + re-uploads the WHOLE file (no partial writes); renames = copy+delete | None — network-required, no cache (there is no VFS layer) | Worst editor fit: no offline, slow saves on multi-MB JPEGs, mtime churn confuses sync/watchers | **FALLBACK only** (install: `sudo apt install s3fs`; use when rclone is unavailable) |
| geesefs (goofys fork; goofys itself stale — use geesefs) | Yes: `--endpoint <r2-endpoint> --region auto --list-type 2` (list-type flag required for non-Yandex S3 per README) | R/W, fast reads, weaker POSIX (no full chmod/chown/symlink semantics) | None (stateless, no local cache) | Snappy browser, mediocre editor: directory renames + small-file metadata ops are its weak spot per its own comparison table | Runner-up for read-heavy browsing; not the editor mount |
| JuiceFS | Yes as object backend, but needs a SEPARATE metadata engine (Redis/SQLite/MySQL) + `juicefs format` before first mount | Full POSIX (best semantics of all five) | Client data+metadata cache (closest to local fs when warm) | Excellent — but you now operate a database for a ~10-posts/yr blog | **REJECT** — a metadata DB to preview JPEGs violates every ponytail cut in M9 |
| Mountain Duck (GUI, paid) | Yes — generic S3-compatible connection profile (endpoint + keys), same as ExpanDrive class | R/W via Files-On-Demand | Smart-sync offline pin per file | Nicest UX, zero CLI — but per-seat license, unscriptable, no CI story | Only if the owner wants zero terminal; never the documented path |

### T2. Why the vault root stays local (non-negotiable)

`.obsidian/` (workspace state, plugin code, indexedDB-ish caches, lock files)
needs atomic renames + inotify + stable mtime — none of which an object store
provides (no real directories, rename = copy+delete, mtime = upload time
unless flagged). Failure modes of a full-vault mount: stale directory cache
shows deleted drafts; partial multipart writes leave 0-byte md files on
disconnect; mtime jumps retrigger full reindex + merge-dialog spam. Rule:
**vault root = local `posts/` (git); ONLY the overflow-media subdir is a
mount.** Obsidian setting: Attachments → "same folder as current file" for
local heroes (R3 stands); overflow originals live under the mount and are
referenced in committed md as absolute `https://cdn.dvxb.io/…` URLs (App S3
passthrough — the build never opens them, so CI needs no mount).

### T3. Minimal setup (recommended: rclone)

```ini
# ~/.config/rclone/rclone.conf — placeholders only, secrets live here (chmod 600), never in the repo
[r2-blog-media]
type = s3
provider = Cloudflare
access_key_id = <R2_ACCESS_KEY_ID>
secret_access_key = <R2_SECRET_ACCESS_KEY>
endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
region = auto
# optional: acl = private
```

```bash
# install (Debian/Ubuntu) + FUSE prerequisite
sudo apt install fuse3
curl https://rclone.org/install.sh | sudo bash   # or: sudo apt install rclone (older)

# one-time: create bucket (or dashboard) + verify
wrangler r2 bucket create blog-media
rclone lsd r2-blog-media:            # lists blog-media among buckets
rclone ls r2-blog-media:blog-media   # empty until first overflow upload

# mount for editing/preview (foreground test first, --daemon once happy)
mkdir -p ~/mnt/blog-media
rclone mount r2-blog-media:blog-media ~/mnt/blog-media \
  --vfs-cache-mode full --vfs-cache-max-size 5G --vfs-cache-max-age 24h \
  --vfs-read-chunk-size 32M --dir-cache-time 5m --poll-interval 1m \
  --no-modtime --allow-other --daemon \
  --log-file ~/.cache/rclone-blog-media.log --log-level INFO
ls ~/mnt/blog-media/<slug>/          # overflow originals per App S key shape media/<slug>/<hash>-<name>-<w>.<fmt>

# unmount / remount
fusermount -u ~/mnt/blog-media
```

s3fs fallback (same mountpoint, never both at once):
```bash
sudo apt install s3fs
echo <R2_ACCESS_KEY_ID>:<R2_SECRET_ACCESS_KEY> > ~/.passwd-s3fs && chmod 600 ~/.passwd-s3fs
s3fs blog-media ~/mnt/blog-media -o passwd_file=$HOME/.passwd-s3fs \
  -o url=https://<ACCOUNT_ID>.r2.cloudflarestorage.com -o use_path_request_style \
  -o uid=$(id -u),gid=$(id -g),allow_other,mp_umask=002
fusermount -u ~/mnt/blog-media
```

systemd (optional, user unit `~/.config/systemd/user/rclone-blog-media.service`):
```ini
[Unit]
Description=rclone blog-media (R2) mount
After=network-online.target
Wants=network-online.target
[Service]
Type=notify
ExecStart=/usr/bin/rclone mount r2-blog-media:blog-media %h/mnt/blog-media --vfs-cache-mode full --vfs-cache-max-size 5G --vfs-cache-max-age 24h --dir-cache-time 5m --poll-interval 1m --no-modtime --allow-other --config %h/.config/rclone/rclone.conf
ExecStop=/bin/fusermount -u %h/mnt/blog-media
Restart=on-failure
RestartSec=10
[Install]
WantedBy=default.target
```
`systemctl --user daemon-reload && systemctl --user enable --now rclone-blog-media`.
No `/etc/fstab` entry (user mount + secrets file don't belong in fstab; the
unit above is the autostart story).

Authoring flow with the mount: hero stays `posts/<slug>/hero.png` (relative,
pipeline-processed, Q2 1920-cap); overflow originals are staged via
`rclone copy ./new.jpeg r2-blog-media:blog-media/media/<slug>/` (the PUBLISH
path — prefer copy over mount-write: single-shot, retryable, logged), then
referenced as `![alt](https://cdn.dvxb.io/media/<slug>/<hash>-new.jpeg)`.
The mount is the BROWSE/preview surface (Obsidian attachment folder pointed
at `~/mnt/blog-media/<slug>/` shows the same files; `bun preview` renders
remote URLs with network). 24-photo Aggie post: all 22 non-hero photos live
here — zero bytes in git, zero variant builds, LinkedIn carousel sources
browsable in the file manager.

### T4. Caveats (load-bearing)

1. **CI never mounts.** `static.yml` uses `wrangler r2 object put … --remote`
   (+ `rclone copy` equivalently); absolute cdn URLs pass through
   `renderPostImages` untouched, so builds are hermetic. The mount is
   workstation-only.
2. **Git ignores the mountpoint.** Nothing under `~/mnt/` is in the repo
   (home-dir mount, not a repo subdir — no `.gitignore` change needed); never
   mount INSIDE `posts/` (a mount over tracked paths hides sources from git
   status and `BUILD_DRAFTS=1` rebuilds).
3. **EXIF/size pipeline still runs at build — for local heroes only.**
   R2-overflow files skip sharp entirely (no variants, no LQIP, no budget
   pressure); therefore strip EXIF + 1920-cap BEFORE `rclone copy`
   (`tools/optimize-images.mjs` per Q2 — run it on the staging file, then
   copy). WhatsApp sources arrive EXIF-free (Q2 measured); camera originals
   do not — the optimizer is the privacy gate.
4. **Failure modes to respect:** stale `--dir-cache-time` hides fresh uploads
   from other machines (keep 5m + `--poll-interval 1m`; S3 backend polling is
   best-effort); mount-write of a >`--s3-upload-cutoff` file without VFS-full
   fails mid-stream (hence `full` + prefer `rclone copy` for publishes);
   `--no-modtime` avoids per-object HEAD storms but means mtime = local cache
   time (never sort posts by mtime — frontmatter date only, E1 rule stands).

---
## Appendix U — Gitignored local images + rclone-to-R2-on-push (2026-10-14 UTC, design-only, no site code)

Owner proposal: images live in a gitignored local dir, rclone'd to R2 on push
somehow. This appendix designs it without building it, resolves it against the
current pipeline (`tools/build-blog.mjs` `renderPostImages`: relative refs
resolved against the md dir, missing source throws CI-red; App S: hero stays
git, galleries/`.cast` overflow → R2 `blog-media` behind `cdn.dvxb.io`, hashed
immutable keys; App T: workstation-only `~/mnt/blog-media` rclone mount, CI
never mounts; App Q2: `tools/optimize-images.mjs` NOT yet built — 1920-cap +
q82 + EXIF-strip gate still open), and gives the verdict.

### U0. The load-bearing contradiction (read first)

**Gitignored + CI-upload is contradictory as stated.** CI (`static.yml`) only
ever sees committed bytes (`actions/checkout` → build → `rm -rf full-cv posts`
→ artifact). A gitignored file is invisible to CI by definition: there is
nothing for a CI rclone/wrangler step to upload, retry, or log. Any design
that says "CI uploads the images" while the images are gitignored is incoherent.

The coherent split, used throughout this appendix:

- **Bytes move on the workstation** (`rclone copy` before/with push — the only
  place the bytes exist).
- **CI verifies, never uploads** (key-existence check against the public CDN —
  no secret needed since overflow media is public — and fails loud when the
  author forgot the copy).

If this split is unacceptable (owner wants push-and-forget with zero local
step), the proposal fails outright: the only push-and-forget shape is
committed bytes (current behavior), because git is the only channel CI reads.

### U1. Layout: per-post `posts/<slug>/local-images/` wins over root `media/`

| Axis | A. `posts/<slug>/local-images/` (RECOMMENDED) | B. `media/` at repo root (REJECT) |
|---|---|---|
| Build resolution | Zero logic change: `renderPostImages` joins `srcDir` (the md dir) + `src`, so `./local-images/x.jpg` resolves exactly like `./hero.png` today | Breaks colocation: posts reference `../../media/x.jpg` (fragile to moves) or a second resolve-root must be taught to the builder (~15 lines + validation + docs) |
| Obsidian (vault = `posts/`, App R2a) | Renders inline; attachment setting "in subfolder under current folder" = `local-images` lands files exactly here | Out-of-vault refs (`../../media/`) don't resolve in reading view; vault-rooted `media/` forces the vault to be repo-root (drags `.obsidian/` state next to the site, App T2's warning) |
| Move/rename a post | `md` + `local-images/` + manifest move as one directory | Refs rot; manifest paths must be rewritten |
| `.gitignore` | One scoped line: `posts/**/local-images/` (covers `posts/_drafts/` too; the committed per-post `media.json` in U3 sits beside the md, unaffected) | One line `/media/` — simpler, but buys the rows above |
| Author friction | One real cost: Obsidian has ONE attachment-location setting, so hero (same-folder, committed, App R3) vs overflow (`local-images/`, ignored) can't both be automatic — overflow files are dragged manually. Document the rule, accept it | Same friction plus all of the above |

Authoring rule (extends `_TEMPLATE.md` image line, no code): hero → `./hero.png`
same-folder committed (Q2 optimizer before commit); overflow → 
`./local-images/<name>.jpg` gitignored (U4 optimizer gate before copy).
`![alt](./local-images/x.jpg)` is the ONLY overflow syntax the md ever carries
— never an absolute `https://cdn.dvxb.io/…` URL in committed md (portability,
U3).

`.gitignore` addition (the whole layout change — 1 line, zero code):
```
posts/**/local-images/
```
(Bare `local-images/` would also work today; the scoped form survives a future
root-level dir of the same name. Never mount anything inside `posts/` per App
T4.2 — `local-images/` holds real local files, not a mountpoint.)

### U2. Sync triggers: local push is the write path, CI is the verifier

| Trigger | How it would work | Robustness | Verdict |
|---|---|---|---|
| CI upload step (`static.yml` rclone/wrangler reading a manifest) | Cannot work: CI has no bytes (U0). The closest coherent CI role is **verify-only**: for each manifest entry, HTTP HEAD the CDN URL, fail the build on non-200. Secrets: none (public bucket). Retries/logs: CI-native. | Strong as a net, useless as a write path | **ADOPT as verifier** (U4 guardrail #2), never as uploader |
| Local pre-push hook (`.git/hooks/pre-push` → `bun media:push` or `media:status`) | Uploads where the bytes live; blocks the push on optimizer/manifest/R2 failure. Bypassable (`--no-verify`), absent on fresh clones until `docs/pre-push.sample` is copied (M5 pattern — no husky/lefthook dep, M9 stands). | Best effort, not a guarantee | **ADOPT as convenience**, never as the only guardrail |
| Manual `bun media:push` | Explicit `rclone copy --checksum` of `local-images/` → `r2-blog-media:blog-media/media/<slug>/`, updating the manifest (U3). Forgotten ≈ broken prod images until CI goes red. | Weakest alone (forgotten at ~10 posts/yr exactly when it matters) | **ADOPT as the write path** (nothing else can move the bytes), but always paired with the CI net |

Recommended shape: **`bun media:push` (write) + pre-push hook calling
`bun media:status --strict` (fast local net) + CI CDN HEAD-check (slow
authoritative net).** CI is the source of truth for *correctness* ("every
referenced key exists and is immutable"); the workstation is the source of
truth for *bytes*. "CI as source of truth with local dry-run" in the brief is
exactly this, with the upload direction corrected: local dry-run =
`media:status` (manifest-vs-file-vs-R2 three-column report, read-only);
CI = the same check with `--ci` teeth (exit 1, no rclone needed).

Concretely (~60 lines total, NOT built here): `tools/media-push.mjs`
(optimizer gate → `rclone copy --checksum` per slug dir → write manifest) +
`tools/media-status.mjs` (U4 table; `--strict` for the hook, `--ci` doing
CDN HEADs only so CI needs no rclone config/secrets) + two `package.json`
lines (`media:push`, `media:status`) + `docs/pre-push.sample` 3-liner (M5
pattern). `rclone` itself stays a workstation prerequisite (App T3 install
lines); CI deliberately never installs it.

### U3. Manifest: committed per-post `media.json`, hash-of-optimized-bytes keys

The build must map `srcDir/local-images/x.jpg` → R2 key WITHOUT the bytes
being present (fresh clone, CI). Options ranked:

- **Per-post `posts/<slug>/media.json`, committed (RECOMMENDED).** Moves with
  the post, diffs alongside the md edit that introduced the image, survives
  `rm -rf posts` from the artifact (it's a source, like the md — the STRIPPED
  thing is the artifact, the manifest never deploys). Shape per entry:
  `{"local": "local-images/x.jpg", "key": "media/<slug>/<sha12>-x.jpg",
  "sha256": "<of the OPTIMIZED bytes>", "bytes": N, "optimized": true}`.
  `frontmatter r2:true` rejected: frontmatter is per-post, refs are per-image —
  one flag can't name N keys. Root-level `media.json` rejected: drifts from the
  posts it describes, merge-conflicts across concurrent posts.
- **Keys = content-hash of optimized bytes** (dodeca base12 pattern, §6; App
  S/D6.2): `media/<slug>/<sha12>-<leaf>`. Hash AFTER the optimizer (U5), never
  before — the manifest must describe what's actually in R2. Immutable +
  `Cache-Control: public, max-age=31536000, immutable` (App S1) = no purge path
  ever; edited photo = new key, old key orphans (U4 GC note). No sharp variants
  for overflow (App T4.3: overflow skips the pipeline — no LQIP, no budget
  pressure, no 18× multiply).
- **Dual-mode resolution in `renderPostImages` (the one risky touch, NOT built
  here):** relative ref under `local-images/` + manifest HIT → emit absolute
  `https://cdn.dvxb.io/<key>` `<img>` (plain tag, no `<picture>` — single
  optimized file, exactly what was uploaded) WITHOUT opening the file. Local
  file present → same URL (prod-identical output locally; needs network for the
  pixels — acceptable, App S1 already concedes this). Manifest MISS + file
  missing → keep today's throw (CI-red, message must say `bun media:push`,
  not "commit the file"). Manifest MISS + file present → throw "run
  `bun media:push` first" (catches forgot-push at author time, before CI).
  Absolute (`/...`, `https:`) and hero-relative refs behave exactly as today.
- **Portability + offline preview fall out:** committed md carries only
  `./local-images/x.jpg` (Obsidian-readable, fresh-clone-readable as a path);
  prod HTML carries only the CDN URL (feeds survive — RSS already absolute,
  steps 5–6); preview works fully offline when the files exist, degrades to
  remote-fetch when they don't. `image:` frontmatter (OG hero) stays
  committed-file-only — OG cards must never point at gitignored bytes (card
  validators + scrapers fetch without manifest context).

### U4. Failure modes (head-on) + guardrails

| Failure | Symptom without guardrails | Guardrail (layered, cheapest first) |
|---|---|---|
| Author commits md, forgets `media:push` | Prod ships `<img>` to a 404 key (silent — WORSE than today's CI-red throw) | 1. `media:status --strict` in pre-push hook (local, fast). 2. CI HEAD-check fails loud with the fix line (`bun media:push && git …` — note: manifest IS committed, so a forgot-push fix is a second commit+push; say so). The silent-404 is THE failure this design exists to prevent — both nets target it |
| Fresh clone: md + manifest present, `local-images/` absent | Today's builder throws "not found" — wrong (bytes are in R2, build should pass) | Dual-mode U3: manifest HIT skips the file-open. `BUILD_DRAFTS=1` preview renders CDN URLs (network needed — document, don't code around) |
| Edited photo, stale manifest (hash drift) | Immutable-key lie: manifest points at old key, new pixels never uploaded | `media:status` compares file-sha vs manifest-sha → red with "re-run `bun media:push`". Push writes a NEW key (never overwrites — immutability), updates the entry |
| Deleted ref leaves R2 orphan | Pennies of storage, no breakage (immutable keys are never re-read after dereference) | Never auto-delete in CI. Periodic `bun media:status --orphans` (list keys unreferenced by any manifest, `--dry-run` default) + R2 lifecycle rule as the backstop. ~10 posts/yr: annual eyeball suffices |
| Hook bypassed (`--no-verify`) or hook never installed (fresh clone) | Local net skipped | CI net is the backstop by design (U2) — bypassing the hook only forfeits early warning, never correctness |
| Manifest hand-edited / hash lies about R2 | CI HEAD passes (key exists) but pixels differ | `media:status` full mode re-hashes local file vs manifest AND byte-compares via `rclone check` on demand (workstation-only, slow path — not in hook, not in CI) |
| `.cast` overflow | Same shape as images (App S3 already routes `.cast` overflow → R2) | Same manifest + same nets; `cast:` frontmatter value stays a relative `local-images/` path, embed emits the CDN URL (deliberate divergence from today's same-origin cast copy, documented at build time) |

`bun media:status` report shape (read-only, the local dry-run): per ref one
row — `local ✓/✗ · manifest ✓/stale/missing · r2 ✓/✗` + exit code. `--strict`
(nonzero on stale/missing) for the hook; `--ci` (R2 column via CDN HEADs,
no rclone, no secrets) for `static.yml` after `assert-rss.mjs`.

### U5. Privacy: optimizer gate runs BEFORE bytes move (no exceptions)

Ground truth (App Q2, measured): WhatsApp sources arrive EXIF-free, but camera
originals don't; `renderPostImages` never calls `.withMetadata()`, so sharp
variants are clean — but overflow files SKIP sharp (U3/T4.3), so the ONLY
privacy boundary for this proposal is the pre-upload optimizer. Therefore:

1. Build `tools/optimize-images.mjs` FIRST (App Q2 spec stands: max-width
   1920, JPEG q82, PNG lossless, strip EXIF by never adding `withMetadata()`;
   ~25 lines, zero new deps, already-pinned sharp). It is a prerequisite of
   this entire appendix, not a nice-to-have — and it pays off under the CURRENT
   design too (committed heroes get the same treatment).
2. `media:push` REFUSES unoptimized input: per file, check max-dimension ≤1920
   + zero EXIF entries (sharp metadata read, ~5 lines); on violation, print the
   exact `bun optimize-images …` invocation and exit 1. Auto-optimizing inside
   push is rejected — silent rewrites of author pixels hide quality decisions;
   fail-loud keeps the author in the loop (same posture as `assertFrontmatter`
   and the wikilink lint, App R3.3).
3. Manifest records `"optimized": true` + the hash OF THE OPTIMIZED BYTES (U3)
   so the chain file → optimizer → R2 → manifest is auditable via
   `media:status` alone.
4. Ingest rule: camera originals NEVER land in `local-images/` directly —
   they stage outside the repo, pass through the optimizer, then enter
   `local-images/` upload-ready. (WhatsApp-forwarded files are already
   EXIF-free but still pass the 1920 check.)

### U6. Verdict

- **Layout:** `posts/<slug>/local-images/` + `posts/**/local-images/` ignore
  line. Uncontested on resolution-simplicity and Obsidian-fit grounds (U1).
- **Sync trigger:** `bun media:push` (workstation write) + pre-push
  `media:status --strict` (local net) + CI CDN HEAD-check (authoritative net,
  zero secrets). CI uploads nothing — it cannot (U0). "CI as source of truth"
  holds for correctness, not for bytes.
- **Guardrails:** committed per-post `media.json` (hash-of-optimized-keys) +
  dual-mode builder (manifest HIT skips file-open; every MISS classes throws
  with the `media:push` fix line) + `media:status` three-column report +
  orphan listing + optimizer gate (U5) as the privacy boundary.
- **Does this beat current git-local-heroes + explicit-R2-overflow (Apps
  D5/S3/T)? NO — not at this scale, not yet.** Current design: heroes committed
  (1 fixture ≈ 82k/500k-2M budget — headroom is ample), overflow = manual
  `rclone copy` + absolute CDN URL in md, CI-hermetic, missing-file throws,
  zero new code, zero manifest discipline, zero dual-mode risk. The proposal
  buys two things — md portability (relative refs survive host moves) and
  fresh-clone preview without bytes — at the price of ~100–150 new lines
  across the riskiest file in the pipeline (`renderPostImages`'s throw
  invariant), a manifest that must be kept in lockstep with every image edit,
  and an orphan-GC tail. At ~10 posts/yr with 1 hero + occasional gallery,
  that trade loses.
- **Adopt now (zero code):** the U1 ignore line + the U1 authoring rule
  (heroes committed, overflow staged under `local-images/` even before any
  tooling exists — the dir convention costs nothing and keeps the future
  manifest paths stable) + U5's optimizer (Q2 — worth building regardless,
  privacy under BOTH designs).
- **Trigger to build the rest:** the SECOND overflow post (first gallery that
  actually exercises App S3/P1: 4+ photos or a `.cast` that earns R2). If
  overflow stays at zero-to-one posts, the manifest machinery never pays back
  its complexity — re-read this appendix then and confirm the deferral.
  Revisit conditions inherited from App D4.1/D4.5 also stand (repo-size pain,
  multi-author, weekly galleries).

---
## Appendix W — Auto EXIF-strip `media:push` for R2-only flow (2026-10-14 UTC, design-only, no site code)

Context: R2-only variant — images NEVER committed (no `local-images/`, no
`media.json` manifest like App U3); originals live outside the repo, only
`https://cdn.dvxb.io/…` URLs enter md. Author always online, so tmp-remote
preview is fine. `sharp 0.35.5` pinned; `tools/optimize-images.mjs` (Q2/U5)
still unbuilt — this wrapper absorbs it (one script, not two).

**Command shape (only new surface):**
```
bun media:push <file> [--slug <slug>]   # -> tools/media-push.mjs, ~50 lines, sharp only
```
Pipeline per file: `sharp(in).rotate()` → resize inside 1920 (no upscale) →
JPEG q82 (PNG screenshots: lossless; HEIC/HEIF input: `.toFormat('jpeg')`) →
write `os.tmpdir()/media-push-<rand>.jpg` (never repo) → hash optimized bytes
(sha12) → key `media/<slug|inbox>/<sha12>-<leaf>.jpg` → upload (rclone primary:
`rclone copyto <tmp> r2-blog-media:blog-media/<key> --header-upload
"Content-Type: image/jpeg" --header-upload "Cache-Control: public,
max-age=31536000, immutable"`; wrangler fallback: `r2 object put … --file
<tmp> --content-type image/jpeg --cache-control "public, max-age=31536000,
immutable" --remote`) → verify → print `https://cdn.dvxb.io/<key>` to paste
into md. Optional triggers call the SAME script: OS folder-action
(`inotifywait -e close_write ~/Inbox | xargs bun media:push`, or macOS
Automator Folder Action) / Obsidian Templater user-script (`tp.user.mediaPush()`).

**Load-bearing details:** (1) Orientation: `.rotate()` with no args applies
EXIF orientation to pixels THEN drops the tag — must run before any strip;
strip-first (or `withMetadata()`, which preserves ALL EXIF/XMP/GPS/ICC)
rotates photos wrong. Sharp default (no `withMetadata()`) strips everything.
(2) HEIC: sharp/libvips decodes HEIC on stock builds — same pipeline, out is
always `.jpg`; on decode fail, exit 1 with "export JPEG from Photos first"
(no second converter dep). (3) Verify: `sharp(tmp).metadata()` shows no
`exif/exifFocal` etc (or `exiftool -a <tmp>` → 0 GPS/EXIF lines); fail loud
otherwise. (4) Failure modes: already-stripped WhatsApp files pass through
unchanged (rotate/resize/q82 idempotent, still hashed/uploaded); oversized
still capped at 1920; non-image input exits 1; upload retry ×3 then exit 1
with key (never partial print). (5) CI HEAD-check (U2/U4) STAYS as typo guard
— md carries a bare CDN URL, so a pasted-typo 404 is the only failure left.
(6) Budgets: remote bytes are UNCOUNTED by `check-budgets.mjs` (scans only
in-repo dirs) — accepted: R2 egress $0 + Standard free tier ~20× headroom
(App H2/S1); the 2 MB ceiling keeps gating committed heroes only.

---
## Appendix W implementation — media-push + folder-action watcher (2026-10-14 UTC, uncommitted — owner review)

Built per the App W design above. Sibling work (gates, BiDi, steps 5–9, Apps M–U)
taken as baseline, untouched. No site output touched (`js/ css/ index.html
templates/`, `build-blog.mjs` byte-untouched). Left UNCOMMITTED on
`feat/blog-dx` (like the aggie-ring draft) — nothing pushed, nothing enabled.

**Files (new, uncommitted):** `tools/media-push.mjs` (~100 lines, stdlib +
pinned sharp 0.35.5 only); `tools/media-watch.sh` + `tools/media-watch.path` +
`tools/media-watch.service` (39 lines total, in the 30–50 band); both scripts
chmod +x. **Edited:** `package.json` (+2 scripts), `.gitignore` (+4 patterns).
No repo writes at runtime (tmp in `os.tmpdir()` only, `finally`-unlinked).

**`bun media:push <file> [--slug s]`** — `rotate()` (orientation→pixels first)
→ resize inside 1920 (`withoutEnlargement`) → PNG lossless
(`compressionLevel: 9`) else JPEG q82 (heic/heif/webp/avif/jpg all → `.jpg`;
leaf sanitized, 64-char cap) → sha12-of-optimized-bytes key
`media/<slug|inbox>/<sha12>-<leaf>.<jpg|png>` → EXIF-verify
(`meta.exif/xmp/iptc` must all be absent, else exit 1) → upload (rclone
`copyto` primary with `Content-Type` + `Cache-Control: public,
max-age=31536000, immutable`, wrangler `r2 object put --remote` fallback when
rclone is absent, retry ×3) → prints `https://cdn.dvxb.io/<key>` ONLY on
success. **Dry-run is the default** (optimize + verify, prints would-be
key/URL, no upload); `--upload` is the explicit copy flag. Fail-loud exit 1:
missing file, bad slug (`^[a-z0-9-]+$`), unsupported ext, sharp decode fail
("export JPEG from Photos first" — the HEIC-no-decode path), EXIF remain,
upload ×3 fail (names the unpublished key), neither uploader installed.

**Folder action** — `tools/media-watch.sh`: `INBOX="${1:-${INBOX_DIR:-`
`$HOME/Pictures/Blog-Inbox}}`, `inotifywait -m -e close_write,moved_to` for
jpg/jpeg/png/heic/heif/webp/avif (case-insensitive), per-file
`media-push --upload`, `notify-send` + `$INBOX/media-watch.log` on both
outcomes, success → `mv` to `.done/`, failure → left in place. Fails loud
when `inotifywait` is absent (`sudo apt install inotify-tools`). Units are
install-samples, NOT installed/enabled: copy the two files to
`~/.config/systemd/user/` (edit `ExecStart` if the repo moves), then
`systemctl --user daemon-reload && systemctl --user enable --now
media-watch.path` — the path unit starts the service on first inbox change;
never `enable` the service directly, and neither is enabled by default.

**Verify (this pass):** `node --check` + `bash -n` OK; `--help` exit 0;
fixture COPIES (originals untouched) via optimize path only, zero uploads:
`fixture-hero.png` copy → 1280×720 PNG, no upscale, EXIF-free, key
`media/wtest/82c8c196162f-fixture-copy.png`; generated 3000px JPEG →
1920×1280 q82, default slug `inbox`; missing file / bad slug / fake-JPEG all
exit 1. `git check-ignore` confirms the new ignore lines swallow neither tool.
Budgets 6/6, registry 52 OK, assert-rss green (0 items) — site output
unaffected by construction (no build ran, no `blog/` bytes written).
`git status`: `M .gitignore, package.json` + `?? tools/media-push.mjs,
media-watch.{sh,path,service}` (+ pre-existing `M PLAN-BLOG.md`, `??
posts/_drafts/aggie-ring.md` — not mine).

**How to enable:** (1) `sudo apt install inotify-tools`, configure rclone
remote `r2-blog-media` per App T3 (or rely on wrangler, already present);
(2) `bun media:push ~/Pictures/Blog-Inbox/shot.jpg --slug <post> --upload`,
paste printed URL; (3) watcher: `bun media:watch [dir]` in a terminal, or the
systemd copy+enable above. CI HEAD-check (U2/U4) still to be added when the
first R2-only post lands — pasted-typo 404s are the one remaining failure.

Skipped: HEIC-decode live test (no heic fixture; libvips-dependent, fail-loud
covers it), `optimize-images.mjs` as a separate script (absorbed into push
per App W), manifest/`media-status.mjs` (App U — R2-only flow needs neither).
Risk: stripping ICC can shift colors slightly on wide-gamut originals
(privacy wins per design); `--upload` against real R2 untested here (no
rclone on this workstation, dry-run only).

---
## Run log — Aggie Ring photo curation + draft workflow E2E (2026-10-14 ~16:10–16:35 UTC, subagent, uncommitted)

Curation (24 → 5, originals untouched in Downloads):
- HERO `aggie-ring-hero.jpeg` ← `...6.36.39 PM (4).jpeg` (solo fountain chest-up; ring largest/sharpest on thumb, face + Brown Honors polo legible). Overrides draft TODO's pick (`...6.36.38 PM.jpeg`, ring small at full-body distance).
- GALLERY `aggie-ring-order.jpeg` ← `38 (2)` (signing order sheet); `aggie-ring-dinner.jpeg` ← `38 (8)` (group dinner, 138 KB); `aggie-ring-friends.jpeg` ← `39 (5)` (6 friends, landscape, fountain); `aggie-ring-family.jpeg` ← `39 (9)` (family + Association banners; sharpest of 4 near-identical takes).
- OUT (19): `38 base,(1)` solo-fountain dupes (ring tiny); `38 (3)` backs-walking, no faces; `38 (4),(7)` hall backs; `38 (5)` signing dupe; `38 (6)` + `39 (6),(10)` family dupes; `38 (9)` solo dupe; `38 (10)` order-table dupe; `38 (11),(12)` sister+Reveille (owner absent); `39 base` profile, no ring; `39 (1)` friends dupe (kept wider); `39 (2)` cookie cake (cute, off-theme for 4 slots); `39 (3)` hands dupe; `39 (7)` stadium-solo dupe; `39 (8)` indoor thumbs-up dupe.
- Copies live next to the md (`posts/_drafts/`, = `renderPostImages` srcDir for drafts); 5 files ≤ 6 budget-count.

Workflow: md body = hero inline + ` ```gallery ` fence (App P3 literal). Prod `node tools/build-blog.mjs` → 0 published, 2 drafts skipped, blog/ 20K, exit 0. `BUILD_DRAFTS=1` → first attempt timed out at 120 s (sharp AVIF-effort-6 on 4 large JPEGs); background rerun OK (~4–6 min): draft `blog/draft/922d1035f3f0/`, hero → 18 variants (6 tiers incl. 3840 native × 3 fmt), 8.8 MB raw, 1 `<picture>` + LQIP. Gallery fence renders as literal `<pre><code class="language-gallery">` — photos NOT displayed (P3 island unbuilt; Shiki keeps unknown-lang block). `assert-rss` PASS (0 items), `assert-registry` PASS (52 entries), `check-budgets` 5/6 — `blog images total` OVER (gzip 9,248,454 / 500,000; 8.8 MB is our hero, fixture draft only 104 K). Per-post HTML worst 6928 / 15000 OK. Final prod rebuild: 0 draft bytes. Word count 508 body (566 incl. fence) → 3 min. Nothing committed (git status dirty as instructed).

Pain points: (1) gallery fence renders as code, photos invisible [blocker for gallery posts / fix: build P3 island or lint-reject fence]; (2) draft build 120 s+ on 5 photos, no progress output [annoyance / fix: per-photo progress line + document expected minutes]; (3) 500 k image budget fits zero real photos — first hero alone is 18× over [annoyance (local-only gate) / fix: adopt App Q3 2 MB retune]; (4) ` ```gallery ` contents skip missing-file CI-red (inside code fence, never an `<img>`) — a typo'd gallery filename fails silent, unlike inline refs [blocker if fence adopted / fix: fence-aware existence check]; (5) native >1920 tier emitted (3840w) that Q1 shows serves nobody [polish / fix: cap native at 1920]. Time ~25 min (mostly 24 image reads + sharp encode wait).

---
## Run log — gallery fence fallback + annoyances verification (2026-10-14 ~21:40 UTC, subagent, uncommitted)

Prior session's background draft build (PID 1581493) was found still running on takeover — mid-encode, hero-1920w + order tiers landing. It died mid-run after a verification misstep on my side: importing `tools/build-blog.mjs` from `node -e` executes the module's top-level prod build (`rmSync(blog/)`), wiping its in-flight draft output. Lesson: `build-blog.mjs` has no import guard — never import it for unit tests without expecting a prod rebuild; run fence unit tests after the draft HTML is captured, or against a copy. Recovered with one clean foreground `BUILD_DRAFTS=1 node tools/build-blog.mjs` (mtime-skip resumed partial `img/`, exit 0, full log at `/tmp/opencode/draft-build.log` — workstation-only, not in repo).

**Gallery fence fallback — all 4 prior pain points closed:** (1) fence no longer renders as code: draft `blog/draft/922d1035f3f0/index.html` has 0 `language-gallery`, 1 `gallery-fallback` div, 4 `<figure class="gallery-item">` with captions, 5 `<picture>` total (hero + 4 gallery, all AVIF→WebP→JPEG + LQIP), noindex present. (2) Per-photo progress lines present, e.g. `img aggie-ring/aggie-ring-hero.jpeg 3840x5120 -> 15 variants` (all 5 photos + fixture logged). (3) Budgets **6/6** with retuned 2 MB ceiling — actuals: js/ 227665/228000, commands.js 64541/64600, css/ 23552/23600, index.html 9985/10000, per-post HTML worst 3362/15000, **images total gzip 15872 / 2000000 (raw 30370)** on prod output (0 draft bytes; draft preview is 13 MB raw — budgets gate committed/prod bytes only, by design). (4) Missing gallery file throws CI-red through the real `renderPostImages` path: `"image ./typo-missing.jpeg: not found relative to ..."`; bad-line and empty-fence throw at expand time with fix hints. (5) Native tier capped at 1920: hero/order/friends/family top out at `*-1920w.avif 1920w` (no 3024/3840/5120 tiers); small dinner (768x1024) emits 9 variants (320/640/960-capped tiers × 3 fmt). Registry 52/52, assert-rss green (0 items). `bun tools/build.mjs` (sibling Full-CV): all 5 outputs + root `index.html` sha256-identical before/after. Final state: prod `blog/` (index/posts.json/rss.xml, no draft dir). Nothing committed (git status dirty as instructed: `M .gitignore, PLAN-BLOG.md, docs/perf-budgets.md, package.json, tools/build-blog.mjs, tools/check-budgets.mjs` + `??` draft md/photos, media-push/watch tools).

Skipped: live HEIC decode test (no fixture; fail-loud path unchanged), R2 upload test (no rclone here). Risk: `build-blog.mjs` top-level side effect on import (this log's own incident) — any future tooling that imports its exports will nuke `blog/`; worth an import guard if exports get reused.

---
## Gallery-fence fallback + build annoyances — DONE (2026-10-14 ~16:45–17:10 UTC, subagent, uncommitted)

Fixes all 5 pain points above, no new features beyond guardrails. Files:
`tools/build-blog.mjs` (+~25 lines), `tools/check-budgets.mjs` (1 number +
history comment), `docs/perf-budgets.md` (1 cell + history lines). Nothing
pushed, tree left in prod state (`blog/` = index/posts.json/rss.xml, 0 draft
bytes).

1. **Fence guardrail (a) stacked fallback.** New exported
   `expandGalleryFences(md, slug)`: ` ```gallery ` fence → `<div
   class="gallery-fallback">` of `<figure class=gallery-item><img
   src><figcaption>` (alt/caption escaped; bad line / empty fence throws
   with the fix line). Wired in `buildPostBody` pre-`marked`, so each
   gallery `<img>` flows through `renderPostImages` — same variants + same
   missing-file throw as inline images; RSS/noscript-correct per App P (no
   island, no JS, no CSS).
2. **Progress.** `renderPostImages` takes `label` (caller passes
   `post.slug`): `img <slug>/<file> <w>x<h> -> N variants` per photo
   (svg/gif: `copy-through`); draft loop gains `draft preview start/done`
   lines. Output stays one line per photo.
3. **Budget retune 500k→2M** in checker + doc table + append-only history
   lines (App Q3 evidence cited in both).
4. **Native cap:** `targets` capped at `min(native, 1920)` — ≤1920 sources
   byte-identical behavior; >1920 drops the serves-nobody tier (18→15
   files/photo).

**Verify.** Prod build exit 0 (0 published, 2 skipped). Draft build
(~4 min, background) exit 0: hash stable `922d1035f3f0`, all 5 photos
15/15/9/15/15 variants + fixture 12. Gallery visible: 1 fallback div, 4
figures, 5 `<picture>`, 4/4 captions, 0 `language-gallery` residue. Missing
gallery file throws (probed figure-wrapped `<img>` → same `not found`
throw); bad-line/empty-fence throw at expand time. Hero srcset tops at
1920w, zero `(3840|5120)w` files. Budgets: prod **6/6** (images
15,872/2,000,000); draft-preview 5/6 — images **13,185,292/2,000,000 gzip**
(actual: 5 full-res photos ≈ 13.2 MB raw; 2 MB fits 1–2 photos per Q3, the
5-photo gallery still exceeds it — local-only gate, not CI). Per-post HTML
worst 8221/15000 (draft) / 3362 (prod). Registry 52/52, assert-rss green (0
items). `bun tools/build.mjs` ×5 byte-identical to HEAD (nav-inclusive
baseline; pre-nav lock prefixes no longer apply since the 2026-10-12 nav
change).

**Incident:** first draft-build attempt crashed (`ENOENT` on 2nd photo) —
a sibling session's `node -e` probe imported `build-blog.mjs` mid-run, and
the module runs a full prod build (E6 `rm -rf blog/`) on import, wiping the
draft tree mid-encode. Reran clean. **Hazard (not fixed, out of scope):**
`build-blog.mjs` has no main-guard — importing it rebuilds prod. Recommend
a `process.argv[1]` guard or splitting pure fns out before two authors
import it in one session again.

Skipped: carousel island (fallback covers P3's RSS/noscript requirement),
per-image `widths:` overrides, JPEG-drop, q-tweaks (all Q3-deferred); gallery
CSS (unstyled stack is the safe fallback, not a feature).

---
## Appendix X — Obsidian-static publishers worth copying (2026-10-15 UTC, research-only, no site code)

Context: pipeline is `marked` gfm → Shiki → 11-slot `shell.html` → frozen HTML
(Apps B–W); callouts planned as `> [!NOTE]` → `<aside class="callout …">`
~15-line post-process (App P2); wikilinks lint-rejected (App R3.3);
Obsidian-as-editor over `posts/` recommended with a tokens-mirroring CSS
snippet (App R3.2). Question: what do the 6–10 best-in-class Obsidian-static
publishers do that this pipeline should steal — with zero-runtime frozen-HTML
fit as the filter. Stars/pushed via `api.github.com` 2026-10-15 unless noted.

### X1. Survey table (8 surveyed)

| # | Project | Repo / stars / pushed | Obsidian features rendered | Theme approach | Build vs runtime cost | Verdict |
|---|---|---|---|---|---|---|
| 1 | Quartz v5 | `jackyzha0/quartz` ★13,390, pushed 2026-10-04, MIT, default branch `v5` | wikilinks (all variants + aliases/headings/block refs), callouts (12 types + aliases, collapsible `+`/`-`, nested), highlights `==`, comments `%%`, tags + tag pages, task chars, mermaid, YT/tweet embeds, video/audio, footnotes, Canvas pages, Bases pages, backlinks, graph, full-text search, TOC, breadcrumbs, RSS, darkmode | SCSS + CSS vars; `callouts.scss` per-type `--color/--border/--bg/--callout-icon`; `custom.scss` override hook; `data-callout="…"` selectors (Obsidian-compatible shape) | Build: parallel worker-pool parse + incremental rebuilds. Runtime: SPA routing (micromorph), d3-force graph canvas, FlexSearch index, explorer JS — heaviest runtime here | **Reference impl, don't adopt** |
| 2 | MkDocs Material | `squidfunk/mkdocs-material` ★27,574, pushed 2026-10-14, MIT | Admonitions ≈ callouts (`!!! note "title"`, collapsible `???`/`???+`), annotations, tables, footnotes, tags; NO wikilinks/backlinks/graph (docs-tree, not garden) | `palette:` primary/accent slots + CSS vars; zero per-type authoring — type is a class | Build: Python MkDocs. Runtime: search web-worker, instant-loading navigation — medium | **Steal admonition pattern** |
| 3 | Digital Garden plugin + Eleventy template | `oleeskild/obsidian-digital-garden` ★2,516 (plugin, pushed 2026-10-12) + `oleeskild/digitalgarden` ★491 (template, pushed 2026-10-13), both MIT | Publish-gated notes, backlinks, graph, link previews, timestamps, math — as Eleventy/markdown-it plugins on layout slots (`dg-search`, `dg-link-preview`, `dg-timestamps`, `dg-math`) | **CSS vars mirroring Obsidian theme vars** (`--text-normal`, `--link-color`, `--link-unresolved-color`, …) overridden in `custom-style.scss` — exactly the App R3.2 snippet idea, already proven | Build: Eleventy static. Runtime: per-plugin islands (search, preview, graph) — pay-per-feature | **Closest philosophy; steal theming + island shape** |
| 4 | Dendron | `dendronhq/dendron` ★7,466, pushed 2025-11-13 (publishing template `nextjs-template` untouched since 2022; `dendron-site` stale May 2024), Apache-2.0 | Hierarchies (`a.b.c`), note refs, schemas, mermaid, backlinks, Fuse.js search; publish = `publish build/export` → Next.js static-out | Site config + custom header; theming is template code, not var-mirroring | Build: Next.js export (heavy toolchain). Runtime: full Next.js payload — worst frozen-HTML fit | **Skip (stale publishing, heavy)** |
| 5 | Flowershow | `flowershow/flowershow` ★1,107, pushed 2026-10-14, **AGPL-3.0** | wikilinks, callouts, math, backlinks, interactive graph, Canvas → **static SVG** (via `@trbn/jsoncanvas` + `rehype-jsoncanvas`), Bases blocks → live table/cards/list views, blog listings, comments | Tailwind default theme + custom layouts/components | Build: Next.js/MDX. Runtime: hosted SaaS or self-host Next.js — no frozen-HTML path | **Ideas only (AGPL + SaaS)** |
| 6 | BrainDB + astro-digital-garden | `stereobooster/braindb` ★59, pushed 2025-05-27, no license declared; recipes at `astro-digital-garden.stereobooster.com` | wikilinks (`@braindb/remark-wiki-link`), backlinks (build-time component), tags, graph — as Astro recipes over a build-time link-index DB | Astro theme default (Starlight-compatible) | Build: link index at build (remark plugins). Runtime: **zero JS by default** (Astro) — best frozen-HTML fit of the frameworks | **Steal backlink recipe shape** |
| 7 | unified/remark callout lane | `escwxyz/remark-obsidian-callout` ★34 (DEPRECATED → `rehype-callouts`); `adrianoaraujods/remark-obsidian-md` ★1 (2026, wikilinks+embeds+callouts+highlights, fs-resolving); `@thecae/remark-obsidian` 1.1.1 (MIT, tiny) | callouts → `blockquote[data-callout][data-expandable][data-expanded] > .callout-title(icon+text) + .callout-content`; embeds `![[x]]`, block refs `^id`, `%%` comments, `==` highlights | Ships an `obsidian.module.css` with Obsidian-compliant vars | Build: unified plugin (drops into any pipeline). Runtime: none for HTML shape; collapse needs a few lines of JS | **Steal HTML attr contract, not the JS** |
| 8 | Hugo lane (v3-era Quartz + Grdn) | Quartz v3 = Hugo + `jackyzha0/hugo-obsidian` (Go link-indexer → backlinks + graph JSON); `hfactor/Grdn` Hugo theme (Obsidian-first garden) | wikilinks, admonition-style callouts, backlinks, link previews, local graph, CJK/LaTeX | Hugo templates + SCSS | Build: single binary (fastest). Runtime: graph/search JS islands | Superseded by Quartz v4+; single-binary virtue already covered by Zola analysis (App C2) — **skip** |

Also noted, editor-side only (no publish path — out of scope): `foam-framework/foam`
(★783, VSCode graph/backlinks while editing; publish via separate template).

### X2. What to steal (concrete, sized for `build-blog.mjs`)

1. **Callout attr contract — align with Obsidian/Quartz, not a private dialect.**
   Emit `data-callout="<lowercased-type>"` on the P2 `<aside>` (Quartz #1,
   remark lane #7, and Obsidian itself all select on `data-callout`; unknown
   types fall back to `note` — same rule everywhere). One-line consequence:
   the App R3.2 Obsidian snippet and the blog stylesheet share selectors, so
   reading view ≈ blog for free. Fold suffixes `+`/`-` → `<details open?>`
   inside the aside (Quartz collapsible semantics, MkDocs `???+` default-open
   semantics, zero JS — matches App P2/R1). Skip: nested-beyond-one (flatten,
   cap like the 8k transcript precedent) and custom-icon plumbing (URL-encoded
   SVG in CSS per Quartz docs — theme work, not pipeline work).
2. **Wikilink resolution rule, for the day the lint is ever relaxed.**
   Quartz CrawlLinks: matching is **case-insensitive**, emitted URL lowercased
   (`[[My Note]]` → `my-note`). If R3.3's reject ever becomes a resolver, copy
   exactly this (5 lines: lowercase index + longest-match). Until then the rule
   still pays: document it in `_TEMPLATE.md` so hand-written standard links use
   lowercase slugs that would resolve identically in Obsidian.
3. **CSS-var mirroring is proven — keep App R3.2 as designed.**
   oleeskild #3 overrides `--text-normal / --link-color /
   --link-unresolved-color / …` in one file; the blog's R3.2 snippet mirrors
   `--color-bg/text/panel + --font-body/mono`. Same pattern, opposite
   direction. Steal their variable LIST as a checklist the next time the
   snippet drifts (link colors + unresolved-link color are the two R3.2
   doesn't name).
4. **Backlinks = build-time link index, never a runtime query.**
   BrainDB #6 builds the graph at build time and renders backlinks as a static
   component — the frozen-HTML-native shape. Current rule stays (manual
   `related:` links, App R1) at ~10 posts/yr; if ever automated, the module is
   a `Map<slug, Set<slug>>` over `\[…\](…)` hrefs emitted into `__META__`,
   ~15 lines, no dep, no index file, no JS. Skip: BrainDB itself (★59, no
   license, Astro-only).
5. **Canvas → static SVG is the only canvas shape that fits.**
   Flowershow #5 renders `.canvas` (JSON Canvas spec) to inline SVG via
   `rehype-jsoncanvas` — zero runtime, RSS-safe. Adopt the FORMAT
   (commit `.canvas` JSON, render SVG at build) if a canvas post ever appears;
   until then the App R1 rule stands (export-to-MD first). Skip: Quartz's
   interactive canvas pages (pannable JS) and Bases live views (needs a query
   runtime — frontmatter `tags:` + `getFilteredByTag` already cover it).
6. **MkDocs `???+` convention for fold default.**
   Collapsible admonition `???+ note` = collapsed-by-default-off (open);
   maps 1:1 onto `[!x]+` / `[!x]-`. No code — just cite it in the template
   comment so the fold suffixes look familiar to docs readers too.

### X3. What to skip (with reason)

- **Graph view everywhere** (Quartz d3-force, digitalgarden force-graph,
  Flowershow interactive). All are runtime JS canvases with per-page payload;
  violates zero-runtime + 15k gzip/post. No surveyed project emits a
  build-time static SVG graph — noted as a gap, not a steal. Revisit only as a
  single hand-built SVG island if post count ever justifies it.
- **SPA routing / instant navigation** (Quartz micromorph, MkDocs instant
  load). Saves ~100 ms navigations at the price of a JS router on every page;
  wrong trade at this scale.
- **Adopting any framework** (Quartz, Eleventy template, Dendron Next.js,
  Flowershow SaaS, Hugo). All require rewriting `shell.html` + `build.mjs`
  idioms to fit theirs — the App C10/B2 verdict (custom wins) is unchanged by
  every row in X1.
- **remark lane deps** (#7). The blog parses with `marked`, not unified; a
  remark plugin would drag the whole unified stack for what P2 already specs
  as ~15 lines of post-process. Steal the attr contract (X2.1), not the dep.
- **Flowershow code copying caution: AGPL-3.0.** Ideas (Canvas→SVG, Bases
  views) are fine; vendoring their code would AGPL-taint. Prefer MIT/Apache
  sources (Quartz, oleeskild, rehype-callouts) for any line-level borrowing.
- **Dendron publishing + Foam-as-publisher.** Former is stale (template
  untouched since 2022, site docs May 2024); latter is an editor, not a
  publisher.

### X4. Ranked top 5 for this repo (best fit first)

1. **oleeskild digitalgarden (plugin ★2.5k + template ★491)** — steal-this:
   per-feature plugin islands on layout slots (= `__SCRIPTS__` island rule
   already built) + Obsidian-var-mirroring stylesheet (validates R3.2; borrow
   their var list). Zero framework adoption.
2. **Quartz v5 (★13.4k)** — steal-this: `data-callout` attr contract +
   12-type/alias table + case-insensitive→lowercase wikilink rule +
   worker-pool/incremental build pattern (matches dodeca note, §6). Skip the
   runtime (SPA + graph + search JS).
3. **MkDocs Material (★27.6k)** — steal-this: `???`/`???+` collapsible-details
   zero-JS pattern for callout folds. Docs-shaped, not garden-shaped; nothing
   else transfers.
4. **BrainDB + astro-digital-garden recipes (★59)** — steal-this: build-time
   link-index → static backlinks component shape (15-line future module, not
   today). Astro's zero-JS default is the philosophical match.
5. **Flowershow (★1.1k, AGPL)** — steal-this: Canvas→static-SVG via
   `rehype-jsoncanvas` when the first `.canvas` post lands. Ideas only; mind
   the license.

Bottom line: X changes no architecture (custom `build.mjs` + P2 callout plan +
R3 wikilink-lint + R3.2 snippet all confirmed by independent implementations).
Only action: when P2 callouts land, emit `data-callout` lowercase attrs (X2.1)
so one selector serves Obsidian, Quartz convention, and `doc.css`.

---
## Appendix Y — External launch advice, distilled (2026-10-15 UTC, research-only, no site code)

Method: `websearch` 2026-10-15 over five queries (first-post advice,
Obsidian-to-static, image/gallery, RSS/Buttondown launch, terminal-theme
readability). 12 tips below, each one line + source URL + file mapping.
Nothing above touched; nothing built.

1. Ship one narrow finished post first, not a manifesto/about-page —
   a single complete post beats a perfect theme (first-post guides agree:
   publish post #1 before tuning anything else).
   Source: https://www.godaddy.com/resources/skills/how-to-write-a-blog-post
   → maps to `posts/_drafts/aggie-ring.md` (still `draft:true` + 6 VERIFY tags = the actual publish blocker).
2. Run a fixed pre-publish checklist every time (SEO, perf, a11y, links,
   feed, OG) instead of eyeballing — this repo's version is `bun run check`
   (App M5: prod build → preview build → assert-rss → budgets).
   Source: https://www.digitalapplied.com/blog/website-launch-checklist-150-items-2026
   → maps to `package.json` `check` script + `tools/assert-rss.mjs`.
3. Write in Obsidian with the vault pointed at `posts/` and standard Markdown
   only — wikilinks/transclusions/plugins don't survive any static pipeline,
   so author syntax that previews identically in both tools.
   Source: https://cassidoo.co/post/publishing-from-obsidian/
   → maps to `posts/_TEMPLATE.md` + App R (R3 wikilink lint already encodes this).
4. Keep attachments next to the note ("same folder") so relative `./hero.png`
   refs resolve both in Obsidian reading view and in `renderPostImages`
   (which joins srcDir + src).
   Source: https://berry.sh/posts/obsidian-publishing-guide/
   → maps to `tools/build-blog.mjs` `renderPostImages` + App R3.1.
5. Prefer a custom minimal CI pipeline over a CMS when the shape is
   md→html+shell — one script you own beats plugin churn at ~10 posts/yr
   (independent confirmation of the App B8/C10 custom verdict).
   Source: https://grahamhelton.com/blog/custom-obsidian-publish
   → maps to `tools/build-blog.mjs` (no framework adoption, verdict stands).
6. WebP is the right default in 2026 (universal support, ~25–35% smaller than
   JPEG); AVIF is progressive enhancement, not the baseline — matches the
   pipeline's AVIF→WebP→JPEG order with JPEG kept as fallback (App Q3: never
   drop JPEG first).
   Source: https://hiredigital.com/blog/jpg-vs-webp-vs-avif-2026
   → maps to `tools/build-blog.mjs` `renderPostImages`.
7. Serve at least 3 width variants via srcset+sizes, lazy-load below the fold,
   and always emit width/height attrs (CLS-safe) — all already in the
   pipeline; hero alone gets eager + fetchpriority.
   Source: https://logoswebdesigns.com/blog/image-optimization-website-speed-2026/
   → maps to `tools/build-blog.mjs` (`<picture>` + LQIP + w/h) + App P1/Q1.
8. Give every image a descriptive filename + meaningful alt text — responsive
   formats win performance, but alt/filenames win image SEO and screen readers.
   Source: https://www.digitalapplied.com/blog/image-seo-complete-optimization-guide-2026
   → maps to `posts/_TEMPLATE.md` (`![Hero alt text](./hero.png)` line) + gallery `<figcaption>`.
9. Buttondown RSS-to-email: point the automation at the feed and keep it in
   create-draft/review mode — every issue gets a human approval before send,
   and drafts can never trigger email because they're excluded from `rss.xml`
   by construction.
   Source: https://docs.buttondown.com/rss-to-email
   → maps to `docs/buttondown.md` + `tools/build-blog.mjs` feed gen (published-only).
10. Feed emails need full text (`content:encoded`) + absolute URLs or the email
    copy ships broken images — both already asserted in CI.
    Source: https://www.beehiiv.com/blog/rss-to-email-newsletter
    → maps to `tools/assert-rss.mjs` (absolute-URL + content checks).
11. Dark/terminal themes must still hit WCAG contrast ratios — dark mode is not
    automatically accessible; check muted/secondary text first (that's where
    terminal palettes usually fail), and avoid oversaturated accent colors
    that strain eyes on black.
    Source: https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/
    → maps to `css/tokens.css` (`--color-text-muted`, callout accents).
12. Respect user choice on theme (honor `prefers-color-scheme` / provide a
    toggle — never force dark), and prefer lighter-tone text (200–50 range)
    on dark backgrounds for body copy.
    Source: https://stephaniewalter.design/blog/dark-mode-accessibility-myth-debunked/
    → maps to `css/tokens.css` + `templates/shell.html` (non-gating a11y note; no change made).

Net effect on this repo: zero architecture changes. Tips 1–2 confirm the
launch spine (finish aggie-ring VERIFYs → flip draft → `bun run check` green);
tips 3–5 confirm Apps R/U/W positions; tips 6–8 confirm the sharp pipeline +
template alt rule; tips 9–10 confirm `buttondown.md` + assert-rss as built;
tips 11–12 are a non-gating contrast audit note for `tokens.css`.

---
## Appendix Z — Aggie Ring VERIFY 1–3 (2026-10-15 UTC, research-only, no site code)

Context: `posts/_drafts/aggie-ring.md` body VERIFY tags need official grounding.
Sources fetched 2026-10-15 (Association of Former Students + tamu.edu). No site
code touched.

### Z1. Order process + Fall 2026 timeline

- Where: order online via Association portal
  (`https://ascend.aggienetwork.com/aggieringorder/ring-configuration`,
  linked as "Order Your Aggie Ring" from aggienetwork.com/ring) + in-person
  sizing appointments at Clayton W. Williams, Jr. Alumni Center,
  505 George Bush Drive, College Station. Contact:
  AggieRing@AggieNetwork.com / (979) 845-1050.
- Source: https://www.aggienetwork.com/ring/
  + https://www.aggienetwork.com/ring/upcomingdeliveries.aspx
- Fall 2026 published dates (all 5 p.m. CT deadlines, subject to change):
  - Current students, qualified Aug 2026: orders Aug 14–31, appointments
    Aug 17–Sep 2 → Ring Day Nov 6, 2026.
  - Current students, qualified May 2026: orders May 15–Jun 24 → Ring Days
    Oct 9–10, 2026.
  - Upcoming Dec 2026 graduates (won't meet reqs until degree posts): orders
    Sep 16–Oct 21, 2026 → delivery Dec 11–12, 2026 (degree must post;
    Registrar posts Dec 11 6 p.m., after some ceremonies).
  - Former/replacement: Sep 16–Oct 22 → pickup Dec 11, 2026.
- "Ordered this week" (mid-Oct 2026) reading: too late for the Aug-qualifier
  Nov-6 batch (closed Aug 31); fits ONLY the Upcoming-Grad Dec batch or
  former-student batch — do NOT claim a Nov Ring Day unless the order
  confirmation says so.
- Ring Day pickup: ticketed time blocks at the Alumni Center; Thu Nov 5 =
  mobility/low-crowd pickup (9–3, 30-min blocks, lot parking); Fri Nov 6 =
  traditional day (9–6, 15-min blocks, NO lot parking, shuttles from West
  Campus Garage, photographers + marketplace in Aggie Park). Wear new Ring
  year-facing-you until graduation/Ring Dance, then turn outward.
- Source: https://www.aggienetwork.com/ring/ringday
  + https://www.aggienetwork.com/ring/ringday/faq/
- Dunk/Reveille: ring dunk (ring in ~60 oz chuggable beverage, e.g. Chicken
  Oil Co) is longstanding Aggie culture since ~1970s but NOT an official
  Association tradition — phrase as personal/peer custom, never as program.
  Do NOT claim Reveille appeared unless a photo/receipt proves it.
- Sources: https://www.tamu.edu/campus-community/traditions/aggie-culture/aggie-ring.html
  (3×/yr celebration, Alumni Center grounds); Collin County Aggie Moms
  ring-dunk note (unofficial); Chicken Oil Co Ring Day posts.

### Z2. 90-hour rule (official)

- Undergraduate (current): 90 total completed undergrad hours + 45 completed
  institutional (TAMU) undergrad hours + 2.0 minimum cumulative Institutional
  GPR + not on probation/suspension/dismissal/expulsion/honor-violation
  probation. Transfer counts toward the 90 only once posted on the TAMU
  record; credit-by-exam/military counts to cumulative only, never
  institutional. Hours/GPR checked in Howdy → Academic Record & Planning
  Summary. Pre-1994 entrants: 30 institutional hours rule instead.
- Graduate: thesis → defend; non-thesis → 75% of TAMU coursework + degree
  plan on file; PhD/EdD → admitted to candidacy (coursework done, ≥3.0
  cumulative + degree-plan GPR, residency, prelim passed, approved proposal);
  OR hold a TAMU degree + good standing.
- Source (cite this): https://www.aggienetwork.com/ring/eligibility

### Z3. Safe paste-in sentences (no overclaim, [order date] fill-in)

- Order: "I ordered my Ring on [order date] through the Association of Former
  Students (online order + sizing at the Clayton W. Williams, Jr. Alumni
  Center), per the delivery schedule at
  aggienetwork.com/ring/upcomingdeliveries.aspx."
- Timeline: "Orders placed [order date] fall under the [Aug-qualifier /
  Upcoming-Dec-graduate / former-student — delete as per confirmation] window;
  my confirmation lists [Ring Day / delivery date — fill in], so I claim
  nothing beyond that email."
- Eligibility: "Per the Association's eligibility page
  (aggienetwork.com/ring/eligibility), undergraduates need 90 total hours
  including 45 institutional TAMU hours at a 2.0 institutional GPR; I met the
  [undergraduate — delete graduate lines if N/A] bar in Howdy before ordering."
- Pickup (use only if attended): "I picked up my Ring on [date] at the
  Clayton W. Williams, Jr. Alumni Center on a ticketed Ring Day block."
  Do NOT add Reveille/dunk sentences unless witnessed — if dunk happened:
  "Friends marked it the usual unofficial way — a personal ring dunk offsite,
  not part of the official Ring Day program."

---
## 2026-10-15 — `ring` easter egg + aggie-ring hero polish (feat/blog-dx, uncommitted)

- `ring` terminal easter egg (`js/commands.js: runRingCommand` + registry entry after `dmesg`): 4-line ASCII ring art + `Ordered May 18, 2026 · picked up Oct 9, 2026` + `Texas A&M University · Class of 2029` + link line `/blog/aggie-ring/ (first post, publishing soon)`. Unlisted (`listed:false`, `helpDisplay/Pos:null`, `allow:false`) per convention — no `sl`/`sudo` commands exist; the actual convention is the WAVE 8/PR1/PG unlisted set, so the 36/34 goldens hold and `man ring` works via the registry automatically.
- `tools/assert-registry.mjs`: added `'ring'` to `UNLISTED_EXECUTABLE` (completion-extras pin) + header comment; no count changes. `assert-registry: all checks passed (53 entries, 36 listed)`.
- Budgets: `ring` pushed `js/commands.js` gzip 64,600 → 64,871, so ceiling raised 64,600 → 65,000 (`tools/check-budgets.mjs` + `docs/perf-budgets.md` history line, per append-only convention). Prod verify: `node tools/build-blog.mjs` → 0 published / 2 drafts skipped; `check-budgets: 6/6 hold`; `assert-rss: feed valid (0 items)`.
- Draft preview: `BUILD_DRAFTS=1` builds clean — `blog/draft/beb4a361c13c/index.html` (aggie-ring, noindex) + `blog/draft/b5b29a4f191b/` (fixture). Note: budgets gate prod bytes only by design; draft preview output is ~13 MB images and breaches the image-total ceiling when present — expected, not a regression.
- `posts/_drafts/aggie-ring.md` (572 words, `draft:true` kept, Markdown-only): hero frontmatter already `image: "aggie-ring-hero.jpeg"` resolving to the copied file next to the .md; hero alt already descriptive (`Thumbs-up at the fountain, Aggie Ring visible`); closing line now opens the blog (`This is post one — the blog is back, starting personal before it goes technical.`).
- Snapshots: harness `SESSION_LIST` (`tools/snapshot-terminal.mjs:42-83`) is fixed with no single-command flag — full `npm run snapshot` NOT run; goldens need regen at publish time (new `ring.ans` golden; `help.*` goldens unaffected since `ring` is unlisted).
- Nothing committed, nothing pushed (this append + all edits above left uncommitted per instruction).

---
## 2026-10-16 — Terminal vs thermal-ascii height fix (feat/blog-dx, uncommitted)

Per diagnosis (ses_ebd6148b7ffe36JlhucQRjsI7h): the xterm column scrolled as an
outer page scroller (`overflow-y:auto`) while the thermal column stayed centered,
so the two panes never matched heights.

- `css/terminal.css`: `.two-column` gains `align-items:stretch`; `.terminal-column`
  is now `height:100%; min-height:0; max-height:70vh; overflow:hidden; display:flex;
  flex-direction:column` (outer `overflow-y:auto` removed — the xterm viewport
  keeps internal scroll); `#terminal-container` is `flex:1; min-height:0;
  overflow:hidden` (keeps `touch-action:none`). Stacked ≤900px override gains
  `height:auto` so the 100% rule doesn't force the piled layout.
- `js/terminal.js`: new `syncRowsToThermal()` — `fit()` first, then `term.resize`
  rows from thermal-sibling measured height minus toolbar/guided chrome and 16px
  xterm padding, divided by cell height (`container.clientHeight/rows`, probe
  fallback); skipped when stacked (≤900px). Re-runs on `document.fonts.ready`,
  `ResizeObserver` on `#terminal-container` AND `.terminal-column` (was container
  only), plus a `MutationObserver` on toolbar/guided (toggle/wrap/panel fill),
  with the existing `stopLiveUptime` freeze + cell-cache invalidation preserved.
- Budgets: `js/` total 229,000→229,500 (measured 229,181; history line added per
  convention). `node --check` ×3 OK; budgets 6/6; registry 53/36 OK; assert-rss
  green (0 items); prod build 0 published/2 skipped + `BUILD_DRAFTS=1` preview
  (both draft hashes) exit 0, tree restored to prod (`blog/` = index/posts.json/
  rss.xml, 0 draft bytes). No terminal output strings touched — goldens
  unaffected by construction (full `npm run snapshot` NOT run; no `.ans` regen).
- Headless render check (system chromium, 1280×800, boot + fonts settled):
  column `scrollHeight == clientHeight == 460`, thermal rect == 460 (matched),
  container 336/336 `overflow:hidden`, xterm 17 rows × 97 cols — no outer scroll.
- Nothing committed, nothing pushed (this append + all edits above left uncommitted).
