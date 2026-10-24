# Performance budgets (Phase 5)

Measured 2026-10-23 on `feat/blog-dx` (prior measurement 2026-09-09 on `dev-20260907`).
Sizes are gzip (level 6, Node zlib default) over the working-tree files.
Enforced locally by `npm run check:budgets` (`tools/check-budgets.mjs`);
no CI gate — run it before pushing a wave that touches `js/` or `css/`.

## Bundle budgets (enforced)

| Asset | Measured gzip | Budget gzip | Headroom |
|---|---|---|---|
| `js/` total (37 modules) | 231,474 B (~226 KiB) | ≤ 233,000 B | ~0.7% |
| `js/commands.js` (largest single module) | 68,634 B | ≤ 69,000 B | ~0.5% |
| `css/` total (12 sheets) | 24,023 B (~23 KiB) | ≤ 24,100 B | ~0.3% |
| `index.html` | 9,928 B | ≤ 10,000 B | ~0.7% |

Budget history: raised 2026-10-04 for the playground wave — `js/` gained the
lazy-loaded `pg-life.js` module (dynamic import, `pg life` only) and `css/`
gained the one-rule `@view-transition { navigation: auto }` opt-in in
`base.css`. Ceilings sit on top of the mainline PR1 bumps (`js/` ≤ 220,000 B,
`js/commands.js` ≤ 64,000 B, covering the `host`/`changelog`/`dmesg`,
`imgcat`, and playground registry entries).

Budget note (PR3, `imgcat`): the `js/` total ceiling moved 215,000 →
216,000 B (+0.5%) to admit the lazy `imgcat` command (~1 KiB gzip, all in
`commands.js`, whose own 60,000 B ceiling still holds). Per-module and other
ceilings are unchanged.

Why totals, not per-file (except commands.js): most modules load lazily
(`ai.js`, `devtools.js`, `wall-telemetry.js`, `v86-launcher.js` are dynamic
imports; three.js/xterm/anime ride the CDN importmap), so a per-file budget
for every module would be noise. `commands.js` is the only module big enough
to deserve its own ceiling — it ships with the boot bundle via `shell.js`.

If the checker fails: prefer code-splitting (dynamic `import()`) over
minification tricks; the site ships unminified sources deliberately
(readable View-Source is a feature here). A failing budget is a prompt to
split, not to minify.

Budget history: PR1 (`host` hardware command, `changelog`/`dmesg` build
commands, OSC-8 links, `uname -a` build-info) bumped `js/` 215,000→220,000
and `js/commands.js` 60,000→64,000 to cover the new registry entries. PR15
(`spark`, ANSI/Unicode commit-activity renderers ported from microcharts)
bumped `js/` 220,000→224,000: the delta is the lazy `js/spark.js` module and
its registry entry — all output is ANSI, so `css/` is untouched.
Budget history: feat/uptime-live (live in-place uptime ticker) bumped `js/`
224,000→226,000: the delta is the shared deploy-epoch clock + single-flight
1s rewrite in `commands.js` plus the shell submit stop-hook — no new modules,
no CSS, and `js/commands.js` still holds its 64,000 B ceiling.
Budget history: uptime-live follow-up (refit-safe ticker) bumped `js/`
226,000→226,500 and `js/commands.js` 64,000→64,600: the rows-below offset
became a per-tick thunk over live `term.cols` (plus an Uptime-wrap stop
guard) so a webfont refit between arming and a tick can't strand a stale
row on the divider — no new modules, no CSS.
Budget history: feat/radar-goals (fixed-goal radar normalization) bumped
`js/` 226,500→228,000: the delta is `RADAR_GOALS` + last-365-day numerators
(`created:>=` search qualifiers, `commitsLastYear`) in `js/github-stats.js`
— no new modules, no CSS.
Budget history: feat/activity-wide (no-h-scroll activity pane) bumped `css/`
23,500→23,600: the delta is the wider pane (1180px breakout + 2.2fr share,
10px cells, clip/auto overflow) — no new sheets, no JS.
Budget history: feat/blog-dx (gallery carousel) bumped `css/` 23,600→24,100
(measured gzip 23,963): the delta is the `.gallery` / `.gallery-item` /
`.gallery-nav` block in `doc.css` — flex row, `overflow-x:auto`,
`scroll-snap-type:x mandatory`, `scroll-behavior:smooth` with a
`prefers-reduced-motion` opt-out, and a thin scrollbar themed with existing
`--color-terminal-border`. Pure CSS enhancement over the existing stacked
`<figure>` markup: post pages inject a `<noscript>` sheet that reverts
`.gallery` to the vertical stack, and the prev/next controls are fragment
links, so the carousel costs zero JS and no-JS/RSS readers keep every photo
stacked in document order. No new sheets, no new colours, no new tokens.
Budget history: feat/blog-dx (`ring` easter egg) bumped `js/commands.js`
64,600→65,000: the delta is the unlisted registry entry + `runRingCommand`
(ASCII art + 3 lines, no help row, no allowlist change — 36/34 goldens hold).
Budget history: feat/blog-dx (`ring` art upgrade) bumped `js/`
228,000→229,000 and `js/commands.js` 65,000→65,500: the 4-line glyph
became a 23-line converter-rendered ring-face seal (official Association
art, mono `SITE_WHITE`, facts + publishing-soon link order unchanged).
Budget history: feat/blog-dx (`ring` aspect fix) bumped `js/commands.js`
65,500→65,600 (measured gzip 65,502): the 50-wide seal was sampled
pixel-faithful from its 700x370 source with no cell-aspect correction, so
1:2 terminal cells stretched the oval ~1.8x tall; the replacement 64x25
art is the same official crop center-cut to the seal, sampled at the
cell-corrected height (`H = W·Hs/(2·Ws)`), default charset.
Budget history: feat/blog-dx (terminal/thermal height fix) bumped `js/`
229,000→229,500 (measured gzip 229,181): the delta is `syncRowsToThermal`
in `js/terminal.js` (thermal-matched row resize + column/chrome observers,
no terminal strings changed — goldens hold).
Budget history: feat/blog-dx (`ring` braille upgrade) bumped `js/`
229,500→230,000 and `js/commands.js` 65,600→66,200 (measured gzip 65,718):
the 23-line mono ASCII seal became a 14-line braille seal (36 cols max,
72x56 dots, equalize + plain threshold from the same face-tight official
crop, mono `SITE_WHITE`, facts + publishing-soon link order unchanged,
still unlisted — 53/36 goldens hold).
Budget history: feat/blog-dx (`ring` mono revert) needs no bump
(measured gzip 65,505, under the 66,200 ceiling): the 14-line braille
seal became a 20-line mono seal (64 cols, cell-corrected 64x20 from a
tighter 560x345 face crop of the same official art, autocontrast +
contrast + sharpen, mono `SITE_WHITE`, facts + publishing-soon link
order unchanged, still unlisted — 53/36 hold).
Budget history: feat/blog-dx (`ring` crest re-render) bumped `js/`
230,000→230,600 and `js/commands.js` 66,200→66,800 (measured gzip
66,376): the 13-line seal became a 20-line bg-removed crest (52 cols
max, `-W 64` braille at threshold 170, margin-trimmed, mono
`SITE_WHITE`, facts + publishing-soon link order unchanged, still
unlisted — 53/36 hold).
Budget history: feat/blog-dx (`ring` art 65-wide) bumped `js/`
230,600→231,200 and `js/commands.js` 66,800→67,500 (measured gzip
66,981): the 20-line 52-col crest became the 25-line 65-col crest
(raw `-W 81` braille at threshold 170, margin-trimmed, mono
`SITE_WHITE`, facts + publishing-soon link order unchanged, still
unlisted — 53/36 hold).
Budget history: feat/blog-dx (`ring` responsive dual art) bumped `js/`
231,200→233,000 and `js/commands.js` 67,500→69,000 (measured gzip
68,426 / `js/` total 232,105): both arts ship — 25-line 65-col detailed
crest at term.cols >= 75, 20-line 52-col compact crest below/fallback —
picked at runtime from `term.cols` (bytes ~ sum: the compact 20-liner
duplicates the crest with no shared encoding, the lazy tradeoff for zero
runtime cost), facts + publishing-soon link order unchanged, still
unlisted.

## Blog budgets (appended 2026-10-11, existing 4 entries untouched)

| Asset | Budget gzip | Notes |
|---|---|---|
| `blog/` per-post HTML (max per file) | ≤ 15,000 B | Worst-file ceiling over `blog/**/*.html` (shell + `__META__` + body); missing dir = 0, passes |
| blog images total (`assets/blog/` + `images/blog/`) | ≤ 2,000,000 B | Sum over AVIF/WebP/JPEG/PNG/GIF/SVG; post images belong in those dirs so base budgets stay unaffected |
| `blog/` generated images (step 5–6, 2026-10-12) | included in blog images total | `check-budgets.mjs` image-total also scans `blog/` for image extensions (responsive `<picture>` variants under `blog/<slug>/img/` + OG cards; HTML/RSS/JSON untouched). `.gitignore` artifact rule re-scoped to root `/blog/` so `assets/blog/` + `images/blog/` stay committable. Read-UX island JS rides inline `__SCRIPTS__` (same island-exclusion as player/search). |

Budget history: gallery fallback (2026-10-14, App Q3 evidence): blog images
total 500,000→2,000,000 — 500k fits zero real photos (one 3024px hero ≈
5.5 MB raw, images barely gzip); 2 MB fits 1–2 photos + OG card while still
gating a 24-photo repeat of App P. Native tier capped at 1920 the same pass
(Q1: the >1920 tier serves nobody at 960 CSS px).
Budget history: variant cut (2026-10-16): 5 widths × 3 formats (≤15 files)
→ single 960w AVIF + JPEG (2 files per photo, 768w for the 768-native
dinner shot; WebP dropped as redundant between AVIF and JPEG). Measured
aggie-ring 5-photo total 2.43 MB (1280w) → 1.60 MB gzip, so the 2,000,000
ceiling holds unchanged with ~20% headroom. sizes already capped at 960
CSS px, so 960w is exact-fit at 1x, soft at 2x retina (accepted tradeoff).

Island-exclusion rule: blog islands (asciinema player, Pagefind search UI)
ship via shell.html `__SCRIPTS__` as CDN/vendor payloads inside generated blog
HTML — never under `js/` — so they are excluded from the `js/` total by
construction (`check-budgets.mjs` does not scan `blog/` for JS). If an island
ever gets vendored into `js/`, the `js/` ceiling gates it and must be bumped
explicitly with a budget-history line like the ones above.

## Lab targets (documented, verified on demand via Lighthouse)

| Metric | Target | Notes |
|---|---|---|
| LCP | ≤ 2.5 s | Desktop, throttled Moto G4 profile; the hero live terminal paints first, ambient WebGL layers after |
| TBT | ≤ 200 ms | The perf scaler (`js/perf.js`) sheds particle count/post/DPR within ~2 s of sustained jank |
| CLS | ≤ 0.1 | Canvases are fixed-position with explicit sizes; heatmap/radar reserve layout boxes |

## Runtime invariants (Phase 5 acceptance)

- Offscreen/hidden tabs run **zero** background RAF loops: the particle field
  freezes its GPU-texture swaps (`ParticleDev.isPaused()`), the perf scaler
  suspends preserving ema/warmup (`perf.getSuspendDepth()`), and the owner
  loop parks (`Backgrounds.getActiveLoopCount() === 0`).
- Exactly two `perf.onChange` subscribers in steady state — particle quality
  ladder (`js/three-particles.js:1086`) plus badge spawn re-cadence
  (`js/particle-badge.js:260`) — stable across pause/resume
  (`perf.getListenerCount() === 2`); each handle subscribed once, never stacked.
- Boot GPU probes (`perf.js` `readRenderer`, `shell.js` `getGPU`) release
  their throwaway GL contexts immediately (`WEBGL_lose_context` + nulled refs).
- Every external fetch races a wall-clock timeout (`js/fetch-timeout.js`:
  10 s default, 15 s search, 60 s AI stream cap) with a status check and a
  degraded terminal message naming the next action.
