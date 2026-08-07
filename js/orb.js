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
 *   - Three of the nine states (searching, solving, composing), each tuned
 *     for the one size this site renders it at.
 *   - The React component, live theme resolution and the (state × size)
 *     preset cache are replaced by a plain rAF loop and a static table. Dark
 *     ink is pinned, since the site has no light mode.
 *   - Painters append to a caller-owned dot list instead of painting it, so
 *     the nav mark can crossfade solving into composing and back with the two
 *     z-sorted as one body.
 *   - Composing's ghost sphere and its face-on `breathing` variant are
 *     dropped; at 24px the ghost is eight dots at a tenth alpha.
 *   - Composing's 3D tumble, which its own preset freezes, is restored — see
 *     the note on the `logo` state.
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
 * Z-sort far→near and fill matte grayscale dots. Ink is mirrored for the
 * dark substrate (1 - white) so near dots read bright. Plain 2D fills only:
 * no ctx.filter, no SVG filters, so it renders identically everywhere.
 */
function paint(ctx, dots) {
  dots.sort((a, b) => a.z - b.z);
  for (const d of dots) {
    const alpha = d.a;
    if (alpha < 0.02) continue;
    const g = Math.round((1 - Math.min(1, Math.max(0, d.white))) * 255);
    ctx.fillStyle = `rgba(${g},${g},${g},${alpha})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fill();
  }
}

/* ── Globe: a scan meridian sweeps the lattice — searching ── */

function globeDots(dots, size, t, o) {
  const spin = 0.5;
  const half = size / 2;
  const R = half * 0.82;
  const tilt = 0.4 + 0.06 * Math.sin(t * 0.35);
  const pt = makeProj(t * spin, tilt, half, half, R);
  // the scan sweeps relative to the spin; scanMul scales that relative rate
  const scan = t * (spin + (1.7 - spin) * o.scanMul);
  const rs = radiusScale(size, o.rsPow);
  const zScale = R / half;

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
        z: z * zScale,
        r: Math.max(o.rMin, (o.rBase + o.rDepth * depth + o.rBoost * boost) * rs),
        white: o.inkFar - o.inkSpan * depth,
        // dimBase < 1 fades un-scanned dots so the meridian reads clearly
        a: o.dimBase + (1 - o.dimBase) * Math.min(1, boost),
      });
    }
  }
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

function rubikDots(dots, size, t, o) {
  const half = size / 2;
  const R = half * 0.82;
  const pt = makeProj(t * 0.55, 0.35 + 0.1 * Math.sin(t * 0.9), half, half, R);
  const rs = radiusScale(size, o.rsPow);
  const moves = makeMoves(o.moveCount);
  const sc = solveCycle(t, o.moveCount, 0.42, 1.2);
  const zScale = R / half;

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
        z: zr * zScale,
        r: Math.max(o.rMin, (o.rBase + o.rDepth * depth + (inActive ? o.rActive : 0)) * rs),
        white: o.inkFar - o.inkSpan * depth - (inActive ? 0.14 : 0),
        a: 1,
      });
    }
  }
}

/* ── Sash: an undulating band rides a great circle — composing ── */

function sashDots(dots, size, t, o) {
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
        z: zr / half,
        r: Math.max(o.rMin, (o.rBase + o.rDepth * depth) * (1 - 0.25 * edge) * rs),
        white: 0.52 - 0.44 * depth + 0.18 * edge,
        a: 0.4 + 0.6 * depth,
      });
    }
  }
}

/* ── Profiles and presets ──────────────────── */

const PAINTERS = { globe: globeDots, rubik: rubikDots, sash: sashDots };

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

// The nav mark alternates between its two layers on this cycle (seconds of
// wall clock), crossfading over FADE. A 24px frame only has ink for one of
// them at a time: composing needs most of its dots on the band to read as a
// band at all, which leaves nothing to spend on a lattice inside it.
const CYCLE = 12;
const FADE = 0.5;

/** Weight for a layer held over [from, to) of the cycle, fading either end. */
function holdWeight(t, from, to) {
  const wrap = (x) => ((x % CYCLE) + CYCLE) % CYCLE;
  const elapsed = wrap(t - from);
  const span = wrap(to - from);
  if (elapsed < FADE) return elapsed / FADE;
  if (elapsed < span) return 1;
  if (elapsed < span + FADE) return 1 - (elapsed - span) / FADE;
  return 0;
}

/**
 * The shipped tunings. `count` and `size` are multipliers over the base
 * profiles, `speed` multiplies the shared clock, `extra` is merged verbatim
 * after scaling, and `hold` is the layer's window in the crossfade cycle.
 * Every state is baked for the single `size` (CSS px) it is rendered at — the
 * upstream presets are separate designs per size, not a scale factor, so
 * there is no size knob here.
 */
const STATES = {
  // 64px, bottom-right of the terminal while the model downloads
  searching: {
    size: 64,
    layers: [
      {
        painter: 'globe',
        speed: 2.015,
        count: 0.42,
        size: 1.15,
        extra: { scanMul: 4.08, dimBase: 0.45 },
      },
    ],
  },

  // 64px, same spot while tokens are being generated
  solving: {
    size: 64,
    layers: [{ painter: 'rubik', speed: 1.82, count: 0.35, size: 1.05 }],
  },

  // 24px nav mark: solving's twisting lattice for half the cycle, composing's
  // sash for the other half. The sash keeps the 3D tumble that composing's
  // own preset freezes — a fixed band is pinned to its silhouette by the
  // renormalisation, so at this size it reads as a static striped barrel
  // rather than a ribbon. Tumbling, the band's outline is the animation.
  logo: {
    size: 24,
    layers: [
      {
        painter: 'rubik',
        speed: 1.95,
        count: 0.18,
        size: 1.9,
        hold: [0, CYCLE / 2],
      },
      {
        painter: 'sash',
        speed: 3.12,
        count: 0.09,
        size: 1.073,
        hold: [CYCLE / 2, CYCLE],
        extra: { bandMul: 2.2 },
      },
    ],
  },
};

const resolved = new Map();

/** Resolve a state to its size + fully-scaled layer draw options. */
function resolve(state) {
  const hit = resolved.get(state);
  if (hit) return hit;

  const def = STATES[state];
  const out = {
    size: def.size,
    layers: def.layers.map((layer) => {
      const opts = { ...BASE_PROFILES[layer.painter] };
      if (layer.count !== 1) scaleCounts(opts, layer.count);
      if (layer.size !== 1) scaleRadii(opts, layer.size);
      return {
        draw: PAINTERS[layer.painter],
        speed: layer.speed,
        hold: layer.hold,
        opts: { ...opts, ...layer.extra },
      };
    }),
  };
  resolved.set(state, out);
  return out;
}

/* ── Runtime ───────────────────────────────── */

// The frame reduced-motion users get instead of the animation. Mid-scramble
// for the solver, mid-undulation for the sash — representative, not resting.
const STATIC_T = 0.6;

/**
 * Drive an existing canvas. Pauses while offscreen or on a hidden tab, and
 * renders a single static frame when the user prefers reduced motion.
 */
function attachOrb(canvas, state) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { setState() {}, destroy() {} };

  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let current = resolve(state);
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

  // `t` is seconds on the shared clock, which each layer scales by its own
  // tempo; `tempo: false` passes it through as painter time instead.
  const frame = (t, tempo = true) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, current.size, current.size);
    const dots = [];
    for (const layer of current.layers) {
      const weight = layer.hold ? holdWeight(t, layer.hold[0], layer.hold[1]) : 1;
      if (weight < 0.02) continue;
      const first = dots.length;
      layer.draw(dots, current.size, tempo ? t * layer.speed : t, layer.opts);
      if (weight < 1) {
        for (let i = first; i < dots.length; i++) dots[i].a *= weight;
      }
    }
    paint(ctx, dots);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  const loop = () => {
    frame(performance.now() / 1000);
    if (running) raf = requestAnimationFrame(loop);
  };

  const start = () => {
    if (!visible || document.visibilityState === 'hidden') return;
    if (reduceMq && reduceMq.matches) {
      stop();
      frame(STATIC_T, false);
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
// the orb is shared: it goes away when the last caller is done with it.
let thinkingCallers = 0;

/**
 * Claim the terminal orb, creating it in `state` if it is not up yet. Every
 * call must be paired with a stopThinkingOrb().
 */
function startThinkingOrb(state) {
  thinkingCallers++;
  if (thinking) return;

  const host = document.getElementById('terminal-container');
  if (!host) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'thinking-orb';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Thinking');
  host.appendChild(canvas);
  thinking = { canvas, orb: attachOrb(canvas, state) };
}

/** Switch the orb that is already up — 'searching' → 'solving'. */
function setThinkingOrbState(state) {
  thinking?.orb.setState(state);
}

function stopThinkingOrb() {
  thinkingCallers = Math.max(0, thinkingCallers - 1);
  if (thinkingCallers > 0 || !thinking) return;
  thinking.orb.destroy();
  thinking.canvas.remove();
  thinking = null;
}

/** Bring the nav bar's mark to life. Every page ships the canvas in markup. */
function mountNavOrb() {
  const canvas = document.querySelector('canvas.nav-orb');
  if (canvas) attachOrb(canvas, 'logo');
}

export { startThinkingOrb, setThinkingOrbState, stopThinkingOrb, mountNavOrb };
