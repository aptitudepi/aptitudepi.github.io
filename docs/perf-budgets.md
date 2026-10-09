# Performance budgets (Phase 5)

Measured 2026-09-09 on `dev-20260907` (after the Phase 5 pause/hardening wave).
Sizes are gzip (level 6, Node zlib default) over the working-tree files.
Enforced locally by `npm run check:budgets` (`tools/check-budgets.mjs`);
no CI gate — run it before pushing a wave that touches `js/` or `css/`.

## Bundle budgets (enforced)

| Asset | Measured gzip | Budget gzip | Headroom |
|---|---|---|---|
| `js/` total (37 modules) | 225,554 B (~220 KiB) | ≤ 226,500 B | ~0.4% |
| `js/commands.js` (largest single module) | 63,818 B | ≤ 64,600 B | ~1.2% |
| `css/` total (12 sheets) | 23,309 B (~23 KiB) | ≤ 23,600 B | ~1.2% |
| `index.html` | 9,975 B | ≤ 10,000 B | ~0.3% |

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
