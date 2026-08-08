/*
 * orb.js — dotted 3D "thought orbs" on a plain 2D canvas. Two uses on the
 * site: a status indicator inside the terminal while the local LLM loads and
 * generates, and the animated mark in front of `dvxb.io` in the nav bar.
 *
 * Ported from thinking-orbs by Jakub Antalik (MIT):
 * https://github.com/Jakubantalik/thinking-orbs
 *
 * The engine math is carried over verbatim — the spin/tilt orthographic
 * projection, the lat/long dot fields, the solve cycle, the band undulation
 * and the z-sorted grayscale painter. This is a partial port; the deviations:
 *
 *   - Three of the nine states (searching, composing, solving), each tuned
 *     for the one size this site renders it at.
 *   - The React component, live theme resolution and the (state × size)
 *     preset cache are replaced by a plain rAF loop and a static table. Dark
 *     ink is pinned, since the site has no light mode.
 *   - Dots can be tinted, which upstream has no notion of: the nav mark always
 *     takes the site's blue↔red cycle off `--nav-cycle`; the wordmark joins
 *     that ink on hover.
 *   - Composing's ghost sphere and its face-on `breathing` variant are
 *     dropped, along with the knobs nothing here varies.
 *   - Composing's 3D tumble, which its own preset freezes, is restored. The
 *     renormalisation that keeps the band on its sphere also pins its
 *     silhouette, so a frozen band reads as a striped barrel with some
 *     shimmer inside it; tumbling, the band's outline is the animation.
 */

const TAU = Math.PI * 2;

/* ── Shared primitives ─────────────────────── */

/** Deterministic hash in [0, 1). */
function hashD(a, b) {
  const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/** Shortest signed angular distance, wrapped to (-π, π]. */
function angleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/** Spin + tilt + orthographic projection. Returns [screenX, screenY, depth]. */
function makeProj(yaw, tilt, cx, cy, scale) {
  const st = Math.sin(tilt);
  const ct = Math.cos(tilt);
  const sy = Math.sin(yaw);
  const cyw = Math.cos(yaw);
  return (x, y, z) => {
    const x1 = x * cyw + z * sy;
    const z1 = -x * sy + z * cyw;
    const y1 = y * ct - z1 * st;
    const z2 = y * st + z1 * ct;
    return [cx + x1 * scale, cy - y1 * scale, z2];
  };
}

/**
 * Dot radii were tuned for a 300pt frame; sub-linear scaling keeps small
 * marks legible. Lower pow = radii shrink less with size.
 */
function radiusScale(size, pow) {
  return (size / 300) ** pow;
}

/**
 * Z-sort far→near and fill matte dots. Ink is mirrored for the dark substrate
 * (1 - white) so near dots read bright. Plain 2D fills only: no ctx.filter, no
 * SVG filters, so it renders identically everywhere.
 *
 * `tint` is an optional per-channel scale in [0, 1]. Scaling the gray level
 * rather than replacing it keeps the near/far ink ramp — and with it the sense
 * of depth — intact under any hue.
 */
function paint(ctx, dots, tint) {
  dots.sort((a, b) => a.z - b.z);
  for (const d of dots) {
    const alpha = d.a ?? 1;
    if (alpha < 0.02) continue;
    const g = Math.round((1 - Math.min(1, Math.max(0, d.white))) * 255);
    ctx.fillStyle = tint
      ? `rgba(${Math.round(g * tint[0])},${Math.round(g * tint[1])},${Math.round(g * tint[2])},${alpha})`
      : `rgba(${g},${g},${g},${alpha})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fill();
  }
}

/* ── Globe: a scan meridian sweeps the lattice — searching ── */

function drawGlobe(ctx, size, t, o, tint) {
  const spin = 0.5;
  const half = size / 2;
  const tilt = 0.4 + 0.06 * Math.sin(t * 0.35);
  const pt = makeProj(t * spin, tilt, half, half, half * 0.82);
  // the scan sweeps relative to the spin; scanMul scales that relative rate
  const scan = t * (spin + (1.7 - spin) * o.scanMul);
  const rs = radiusScale(size, o.rsPow);

  const dots = [];
  for (let li = 0; li <= o.latRings; li++) {
    const lat = -Math.PI / 2 + (li / o.latRings) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const lonCount = Math.max(1, Math.round(Math.abs(cosLat) * o.lonDensity));
    for (let lj = 0; lj < lonCount; lj++) {
      const lon = (lj / lonCount) * TAU;
      const [px, py, z] = pt(cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon));
      const depth = (z + 1) / 2;
      // the scan: a moving meridian read as a size ripple, not a shine
      const d = angleDelta(lon + t * spin, scan);
      const boost = Math.exp(-(d * d) / 0.18) * Math.max(0, z);
      dots.push({
        x: px,
        y: py,
        z,
        r: Math.max(o.rMin, (o.rBase + o.rDepth * depth + o.rBoost * boost) * rs),
        white: o.inkFar - o.inkSpan * depth,
        // dimBase < 1 fades un-scanned dots so the meridian reads clearly
        a: o.dimBase + (1 - o.dimBase) * Math.min(1, boost),
      });
    }
  }
  paint(ctx, dots, tint);
}

/* ── Rubik: bands twist in quarter turns, scramble → solve — solving ── */

/**
 * The solver heartbeat: rapid eased moves scramble, then replay in reverse
 * (palindrome) so everything clicks back to solved, rests, repeats.
 */
function solveCycle(time, count, slotDur, rest) {
  const cyc = 2 * count * slotDur + rest;
  const tc = time % cyc;
  const amount = new Array(count).fill(0);
  let active = -1;
  if (tc < 2 * count * slotDur) {
    const slot = Math.floor(tc / slotDur);
    const p = (tc - slot * slotDur) / slotDur;
    const cl = Math.min(1, p / 0.7);
    const ep = 1 - (1 - cl) ** 3; // machine ease-out
    if (slot < count) {
      for (let i = 0; i < slot; i++) amount[i] = 1;
      amount[slot] = ep;
      active = slot;
    } else {
      const u = 2 * count - 1 - slot;
      for (let i = 0; i < u; i++) amount[i] = 1;
      amount[u] = 1 - ep;
      active = u;
    }
  }
  return { amount, active };
}

function makeMoves(count) {
  const moves = [];
  for (let i = 0; i < count; i++) {
    const axis = Math.min(2, Math.floor(hashD(i, 2.3) * 3));
    const lo = -1.0 + 0.5 * Math.min(3, Math.floor(hashD(i, 5.9) * 4));
    const dir = hashD(i, 7.7) < 0.5 ? 1 : -1;
    moves.push({ axis, lo, hi: lo + 0.5, ang: (dir * Math.PI) / 2 });
  }
  return moves;
}

function applyMoves(pt3, moves, sc) {
  let [x, y, z] = pt3;
  let inActive = false;
  for (let i = 0; i < moves.length; i++) {
    if (sc.amount[i] <= 0) continue;
    const mv = moves[i];
    const coord = mv.axis === 0 ? x : mv.axis === 1 ? y : z;
    if (coord < mv.lo || coord >= mv.hi) continue;
    if (i === sc.active) inActive = true;
    const a = mv.ang * sc.amount[i];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    if (mv.axis === 0) {
      const y2 = y * ca - z * sa;
      z = y * sa + z * ca;
      y = y2;
    } else if (mv.axis === 1) {
      const x2 = x * ca + z * sa;
      z = -x * sa + z * ca;
      x = x2;
    } else {
      const x2 = x * ca - y * sa;
      y = x * sa + y * ca;
      x = x2;
    }
  }
  return [x, y, z, inActive];
}

function drawRubik(ctx, size, t, o, tint) {
  const half = size / 2;
  const pt = makeProj(t * 0.55, 0.35 + 0.1 * Math.sin(t * 0.9), half, half, half * 0.82);
  const rs = radiusScale(size, o.rsPow);
  const moves = makeMoves(o.moveCount);
  const sc = solveCycle(t, o.moveCount, 0.42, 1.2);

  const dots = [];
  for (let li = 0; li <= o.latRings; li++) {
    const lat = -Math.PI / 2 + (li / o.latRings) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const lonCount = Math.max(1, Math.round(Math.abs(cosLat) * o.lonDensity));
    for (let lj = 0; lj < lonCount; lj++) {
      const lon = (lj / lonCount) * TAU;
      const src = [cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon)];
      const [x, y, z, inActive] = applyMoves(src, moves, sc);
      const [px, py, zr] = pt(x, y, z);
      const depth = (zr + 1) / 2;
      // the band being turned inks a touch darker — the "hand"
      dots.push({
        x: px,
        y: py,
        z: zr,
        r: Math.max(o.rMin, (o.rBase + o.rDepth * depth + (inActive ? o.rActive : 0)) * rs),
        white: o.inkFar - o.inkSpan * depth - (inActive ? 0.14 : 0),
      });
    }
  }
  paint(ctx, dots, tint);
}

/* ── Sash: an undulating band tumbles on a great circle — composing ── */

function drawSash(ctx, size, t, o, tint) {
  const half = size / 2;
  const R = half * 0.78;
  const camTilt = 0.3;
  const pt = makeProj(t * 0.1, camTilt, half, half, 1);
  const rs = radiusScale(size, o.rsPow);

  // the band plane, precessing
  const ya = t * 0.24;
  const ta = 0.55 + 0.3 * Math.sin(t * 0.18);
  const ux = Math.cos(ya);
  const uy = 0;
  const uz = Math.sin(ya);
  const vx = -uz * Math.sin(ta);
  const vy = Math.cos(ta);
  const vz = ux * Math.sin(ta);
  // plane normal n = u × v
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;

  const dots = [];
  const lanes = Math.max(1, Math.round(o.lanes * o.bandMul));
  for (let w = 0; w < lanes; w++) {
    const laneOff = (w - (lanes - 1) / 2) * 0.075;
    const edge = Math.abs(w - (lanes - 1) / 2) / Math.max(1, (lanes - 1) / 2);
    for (let k = 0; k < o.segs; k++) {
      const a = (k / o.segs) * TAU;
      // the undulation: two traveling waves along the band
      const wob = 0.16 * Math.sin(a * 3 - t * 1.7 + w * 0.22) + 0.07 * Math.sin(a * 5 + t * 1.1);
      const off = laneOff + wob;
      const x = ux * Math.cos(a) + vx * Math.sin(a) + nx * off;
      const y = uy * Math.cos(a) + vy * Math.sin(a) + ny * off;
      const z = uz * Math.cos(a) + vz * Math.sin(a) + nz * off;
      // renormalising pins the silhouette at R however hard the wobble
      // pushes, so the band can only ever be pulled inward
      const l = Math.sqrt(x * x + y * y + z * z);
      const [px, py, zr] = pt((x / l) * R, (y / l) * R, (z / l) * R);
      const depth = (zr / R + 1) / 2;
      dots.push({
        x: px,
        y: py,
        z: zr,
        r: Math.max(o.rMin, (o.rBase + o.rDepth * depth) * (1 - 0.25 * edge) * rs),
        white: 0.52 - 0.44 * depth + 0.18 * edge,
        a: 0.4 + 0.6 * depth,
      });
    }
  }
  paint(ctx, dots, tint);
}

/* ── Profiles and presets ──────────────────── */

const PAINTERS = { globe: drawGlobe, rubik: drawRubik, sash: drawSash };

// Base (fine) densities per painter, before the per-state multipliers.
const BASE_PROFILES = {
  globe: {
    latRings: 17,
    lonDensity: 44,
    rBase: 0.6,
    rDepth: 1.7,
    rBoost: 1.0,
    inkFar: 0.62,
    inkSpan: 0.54,
    scanMul: 1,
    dimBase: 1,
    rsPow: 0.6,
    rMin: 0.3,
  },
  rubik: {
    latRings: 15,
    lonDensity: 40,
    moveCount: 14,
    rBase: 0.6,
    rDepth: 1.7,
    rActive: 0.3,
    inkFar: 0.62,
    inkSpan: 0.54,
    rsPow: 0.6,
    rMin: 0.3,
  },
  sash: {
    lanes: 5,
    segs: 88,
    rBase: 1.1,
    rDepth: 1.7,
    bandMul: 1,
    rsPow: 0.6,
    rMin: 0.3,
  },
};

// 2D lattices come in (rings × dots-per-ring) pairs — each side takes √scale
// so the TOTAL dot count scales by `scale`.
const COUNT_PAIRS = [
  ['latRings', 'lonDensity'],
  ['lanes', 'segs'],
];

// Every key that sets a dot's rendered radius — scaling all of them keeps a
// dot's near/far falloff intact while shrinking or growing the mark.
const RADIUS_KEYS = ['rBase', 'rDepth', 'rActive'];

function scaleCounts(opts, scale) {
  const rt = Math.sqrt(scale);
  for (const [a, b] of COUNT_PAIRS) {
    if (opts[a] == null || opts[b] == null) continue;
    opts[a] = Math.max(2, Math.round(opts[a] * rt));
    opts[b] = Math.max(2, Math.round(opts[b] * rt));
  }
}

function scaleRadii(opts, scale) {
  for (const k of RADIUS_KEYS) {
    if (opts[k] != null) opts[k] *= scale;
  }
}

/**
 * The shipped tunings. `count` scales the dot count and `dotScale` the dot
 * radii, both as multipliers over the base profile; `speed` multiplies the
 * clock; `extra` is merged verbatim after scaling. `size` is the rendered size
 * in CSS px, baked per state — the upstream presets are separate designs per
 * size rather than one design times a scale factor.
 */
const STATES = {
  // The terminal pair sits at the foot of the text column, a little over one
  // 17px row tall, so it reads as the running command's own spinner. That
  // rules out upstream's 64px tunings — at chat-avatar scale the mark buries
  // the last three lines of live output — so both use the inline-text ones.
  //
  // While the model downloads:
  searching: {
    size: 24,
    painter: 'globe',
    speed: 2.665,
    count: 0.105,
    dotScale: 1.75,
    extra: { scanMul: 4.335, dimBase: 0.45 },
  },

  // same spot, while it generates:
  composing: {
    size: 24,
    painter: 'sash',
    speed: 3.12,
    count: 0.09,
    dotScale: 1.073,
    extra: { bandMul: 2.2 },
  },

  // the nav bar mark
  solving: {
    size: 24,
    painter: 'rubik',
    speed: 1.95,
    count: 0.18,
    dotScale: 1.9,
  },
};

const resolved = new Map();

/**
 * Resolve a state to its size, tempo and fully-scaled draw options.
 * `countOverride` skips the cache so a density preview can re-tune the lattice
 * without poisoning the named-state table the rest of the site shares.
 */
function resolve(state, countOverride) {
  if (countOverride == null) {
    const hit = resolved.get(state);
    if (hit) return hit;
  }

  const def = STATES[state];
  const count = countOverride ?? def.count;
  const opts = { ...BASE_PROFILES[def.painter] };
  if (count !== 1) scaleCounts(opts, count);
  if (def.dotScale !== 1) scaleRadii(opts, def.dotScale);

  const out = {
    size: def.size,
    speed: def.speed,
    draw: PAINTERS[def.painter],
    opts: { ...opts, ...def.extra },
  };
  if (countOverride == null) resolved.set(state, out);
  return out;
}

/* ── Runtime ───────────────────────────────── */

// The frame reduced-motion users get instead of the animation. Mid-scramble
// for the solver, mid-tumble for the sash — representative, not resting.
const STATIC_T = 0.6;

/**
 * Drive an existing canvas. Pauses while offscreen or on a hidden tab, and
 * renders a single static frame when the user prefers reduced motion.
 *
 * `tint` is called once a frame for a per-channel ink scale, or null to stay
 * gray. It is a pull rather than a setter so a caller can hand back a colour
 * that is still moving under it — see mountNavOrb.
 */
function attachOrb(canvas, state, { tint = null, count = null } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { setState() {}, repaint() {}, destroy() {} };

  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let current = resolve(state, count);
  let dpr = 1;
  let raf = 0;
  let running = false;
  let visible = true;

  const measure = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = `${current.size}px`;
    canvas.style.height = `${current.size}px`;
    canvas.width = Math.round(current.size * dpr);
    canvas.height = Math.round(current.size * dpr);
  };

  const frame = (t) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, current.size, current.size);
    current.draw(ctx, current.size, t, current.opts, tint ? tint() : null);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  const loop = () => {
    frame((performance.now() / 1000) * current.speed);
    if (running) raf = requestAnimationFrame(loop);
  };

  const start = () => {
    if (!visible || document.visibilityState === 'hidden') return;
    if (reduceMq && reduceMq.matches) {
      stop();
      frame(STATIC_T);
      return;
    }
    if (running) return;
    running = true;
    raf = requestAnimationFrame(loop);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') stop();
    else start();
  };
  const onReduce = () => {
    stop();
    start();
  };
  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible) start();
          else stop();
        })
      : null;

  measure();
  start();
  io?.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);
  reduceMq?.addEventListener('change', onReduce);

  return {
    setState(next) {
      current = resolve(next);
      measure();
      if (!running) start();
    },
    // For the paused cases — reduced motion draws one frame and stops, so a
    // change of ink has nothing to pick it up otherwise.
    repaint() {
      if (!running) frame(STATIC_T);
    },
    destroy() {
      stop();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reduceMq?.removeEventListener('change', onReduce);
    },
  };
}

let thinking = null;
// Nothing stops a second `ai` being typed while the first is still loading, so
// the mark is shared: it goes away when the last caller is done with it.
let thinkingCallers = 0;

// The mark is a decoration on the terminal buffer rather than an overlay on the
// viewport: it gets rows of its own, scrolls with the scrollback, and the cursor
// and every line printed after it land below the animation instead of behind it.
const MARK_ROWS = 2;
const MARK_COLS = 4;

/**
 * Open the terminal mark in `state` if it is not up yet. Every call must be
 * paired with a stopThinkingOrb().
 */
function startThinkingOrb(term, state) {
  thinkingCallers++;
  if (thinking) return;
  if (typeof term?.registerMarker !== 'function' || typeof term.registerDecoration !== 'function') return;

  const session = { state, canvas: null, orb: null, marker: null, decoration: null, closed: false };
  thinking = session;

  // The buffer lags behind writes, so open the rows first and anchor the marker
  // back up to the first of them once the parser has caught up.
  term.write('\r\n'.repeat(MARK_ROWS), () => {
    if (session.closed) return;

    // Anything thrown in here escapes into xterm's write queue and takes the
    // rest of the command's output down with it, so the mark is strictly
    // optional: on any failure it gives up and leaves the terminal alone.
    let marker = null;
    try {
      marker = term.registerMarker(-MARK_ROWS);
      const decoration =
        marker && term.registerDecoration({ marker, x: 0, width: MARK_COLS, height: MARK_ROWS });
      if (!decoration) throw new Error('decoration unavailable');

      const canvas = document.createElement('canvas');
      canvas.className = 'thinking-orb';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Thinking');

      // Fires on every render pass, and the element is rebuilt across some of
      // them; the orb starts on the first one, once the canvas is in the DOM.
      decoration.onRender((el) => {
        if (canvas.parentElement !== el) el.appendChild(canvas);
        if (!session.orb) session.orb = attachOrb(canvas, session.state);
      });

      session.canvas = canvas;
      session.marker = marker;
      session.decoration = decoration;
    } catch {
      marker?.dispose();
      session.closed = true;
    }
  });
}

/** Switch the mark that is already up — 'searching' → 'composing'. */
function setThinkingOrbState(state) {
  if (!thinking) return;
  thinking.state = state;
  thinking.orb?.setState(state);
}

function stopThinkingOrb() {
  thinkingCallers = Math.max(0, thinkingCallers - 1);
  if (thinkingCallers > 0 || !thinking) return;

  const session = thinking;
  thinking = null;
  session.closed = true;
  session.orb?.destroy();
  session.canvas?.remove();
  session.decoration?.dispose();
  session.marker?.dispose();
}

/* ── The nav mark's ambient ink ─────────────── */

/**
 * How far the hue is allowed to pull the ink off gray. The cycle's own colours
 * are dark in absolute terms — pure blue especially — so the tint is normalised
 * to full brightness (below) and then held short of a full channel cut, or
 * sub-pixel dots would drop out at the blue and red ends of the cycle.
 */
const TINT_DEPTH = 0.8;

// Keyframe rest of --nav-cycle / blueRedColor — the frozen hue under
// prefers-reduced-motion, when the bar's colour clock is stopped.
const CYCLE_STATIC = '#0000ff';

let probeCtx = null;
let lastColorStr = '';
let lastColorRGB = null;

/**
 * Computed colours are all but always `rgb(...)`, but an interpolated one can
 * serialise in another space; anything unrecognised goes through a 1px canvas
 * and lets the browser do the conversion.
 */
function readRGB(str) {
  if (str === lastColorStr) return lastColorRGB;
  let rgb = null;

  const m = /^rgba?\(([^)]+)\)/.exec(str);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number).slice(0, 3);
    if (parts.length === 3 && parts.every(Number.isFinite)) rgb = parts;
  }

  if (!rgb) {
    probeCtx ??= document
      .createElement('canvas')
      .getContext('2d', { willReadFrequently: true });
    if (probeCtx) {
      probeCtx.clearRect(0, 0, 1, 1);
      probeCtx.fillStyle = str;
      probeCtx.fillRect(0, 0, 1, 1);
      const d = probeCtx.getImageData(0, 0, 1, 1).data;
      rgb = [d[0], d[1], d[2]];
    }
  }

  lastColorStr = str;
  lastColorRGB = rgb;
  return rgb;
}

/** Per-channel ink scale for a CSS colour string, or null if unreadable. */
function tintFromColor(str) {
  const rgb = readRGB(str);
  if (!rgb) return null;
  const peak = Math.max(rgb[0], rgb[1], rgb[2]);
  if (!peak) return null;
  return rgb.map((c) => 1 - TINT_DEPTH + (TINT_DEPTH * c) / peak);
}

/**
 * Bring the nav bar's mark to life. Every page ships the canvas in markup,
 * inside the `dvxb.io` link, so the two are one hover group for free.
 *
 * Design B: the lattice always takes the bar's `--nav-cycle` ink. On
 * :hover/:focus-visible the wordmark is painted from that same clock each
 * frame — CSS `color: var(--nav-cycle)` with `transition: color` was
 * re-interpolating toward a moving target and never looked like a cycle.
 * Under reduced motion the clock freezes and both hold rest blue.
 */
function mountNavOrb() {
  const canvas = document.querySelector('canvas.nav-orb');
  if (!canvas) return;

  const bar = canvas.closest('.doc-nav');
  const group = canvas.closest('a');
  const reduceMq = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  const cycleColor = () => {
    if (reduceMq?.matches || !bar) return CYCLE_STATIC;
    return getComputedStyle(bar).getPropertyValue('--nav-cycle').trim() || CYCLE_STATIC;
  };

  const orb = attachOrb(canvas, 'solving', {
    tint() {
      const cycle = cycleColor();
      // Read :hover each frame (not an event latch) so the text stays locked
      // to the same ink the lattice is using right now.
      if (group) {
        if (group.matches(':hover, :focus-visible')) group.style.color = cycle;
        else if (group.style.color) group.style.color = '';
      }
      return tintFromColor(cycle);
    },
  });

  // Reduced-motion can flip after mount; the lattice loop already restarts, but
  // a paused static frame needs an explicit redraw to drop animated ink.
  const onReduce = () => orb.repaint();
  reduceMq?.addEventListener('change', onReduce);
}

export { attachOrb, startThinkingOrb, setThinkingOrbState, stopThinkingOrb, mountNavOrb };
