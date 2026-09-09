# Performance budgets (Phase 5)

Measured 2026-09-09 on `dev-20260907` (after the Phase 5 pause/hardening wave).
Sizes are gzip (level 6, Node zlib default) over the working-tree files.
Enforced locally by `npm run check:budgets` (`tools/check-budgets.mjs`);
no CI gate — run it before pushing a wave that touches `js/` or `css/`.

## Bundle budgets (enforced)

| Asset | Measured gzip | Budget gzip | Headroom |
|---|---|---|---|
| `js/` total (35 modules) | 204,957 B (~200 KiB) | ≤ 215,000 B | ~5% |
| `js/commands.js` (largest single module) | 55,818 B | ≤ 60,000 B | ~7% |
| `css/` total (12 sheets) | 20,263 B (~20 KiB) | ≤ 23,000 B | ~13% |
| `index.html` | 8,589 B | ≤ 10,000 B | ~16% |

Why totals, not per-file (except commands.js): most modules load lazily
(`ai.js`, `devtools.js`, `wall-telemetry.js`, `v86-launcher.js` are dynamic
imports; three.js/xterm/anime ride the CDN importmap), so a per-file budget
for every module would be noise. `commands.js` is the only module big enough
to deserve its own ceiling — it ships with the boot bundle via `shell.js`.

If the checker fails: prefer code-splitting (dynamic `import()`) over
minification tricks; the site ships unminified sources deliberately
(readable View-Source is a feature here). A failing budget is a prompt to
split, not to minify.

## Lab targets (documented, verified on demand via Lighthouse)

| Metric | Target | Notes |
|---|---|---|
| LCP | ≤ 2.5 s | Desktop, throttled Moto G4 profile; the 3D intro paints a poster first, live WebGL after |
| TBT | ≤ 200 ms | The perf scaler (`js/perf.js`) sheds particle count/post/DPR within ~2 s of sustained jank |
| CLS | ≤ 0.1 | Canvases are fixed-position with explicit sizes; heatmap/radar reserve layout boxes |

## Runtime invariants (Phase 5 acceptance)

- Offscreen/hidden tabs run **zero** background RAF loops: the particle field
  freezes its GPU-texture swaps (`ParticleDev.isPaused()`), the perf scaler
  suspends preserving ema/warmup (`perf.getSuspendDepth()`), and the owner
  loop parks (`Backgrounds.getActiveLoopCount() === 0`).
- Exactly one `perf.onChange` subscriber for the particle ladder across any
  number of pause/resume cycles (`perf.getListenerCount() === 1`).
- Boot GPU probes (`perf.js` `readRenderer`, `shell.js` `getGPU`) release
  their throwaway GL contexts immediately (`WEBGL_lose_context` + nulled refs).
- Every external fetch races a wall-clock timeout (`js/fetch-timeout.js`:
  10 s default, 15 s search, 60 s AI stream cap) with a status check and a
  degraded terminal message naming the next action.
