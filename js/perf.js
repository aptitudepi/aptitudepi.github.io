/*
 * perf.js — one continuous "quality" scalar the whole site scales against.
 *
 * Every animated system on the page (the Three.js particle field, the badge
 * emitters, the animated favicon) used to assume a strong machine and run flat
 * out at the display's native refresh rate. On weaker GPUs that pegs the fans.
 *
 * This module exposes a single number, quality() ∈ [0, 1], and nothing else:
 *
 *   1 → render everything at full fidelity and frame rate
 *   0 → the cheapest the site is willing to draw (also where
 *       prefers-reduced-motion pins it)
 *
 * The value starts from a coarse device estimate, then a live control loop
 * nudges it continuously based on measured frame time — down fast when frames
 * run long, back up slowly when there's headroom, with a dead-band so it
 * settles instead of hunting. Consumers read quality() (or subscribe via
 * onChange) and map it to their own parameters with lerp(); the mapping is
 * theirs, this module only owns the scalar.
 */

const reduceMq =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

/* ── Initial device estimate ───────────────── */

// Cheap one-off read of the GPU renderer string. Returns '' if unavailable.
function readRenderer() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return '';
    // Modern engines report the real GPU on plain RENDERER; reaching for the
    // deprecated WEBGL_debug_renderer_info extension first (or at all, when
    // RENDERER is already useful) makes Firefox log a deprecation warning.
    let raw = '';
    try { raw = String(gl.getParameter(gl.RENDERER) || '').trim(); } catch (_) { raw = ''; }
    if (/^(webkit webgl|mozilla|generic|unknown)/i.test(raw)) raw = '';
    if (!raw) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        try { raw = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').trim(); } catch (_) { raw = ''; }
      }
    }
    return raw.toLowerCase();
  } catch (_) {
    return '';
  }
}

// Map the assorted device signals to a starting quality in [0, 1]. This is a
// guess, not a verdict — the live loop corrects it within a second or two.
function estimate() {
  if (reduceMq && reduceMq.matches) return 0;

  const r = readRenderer();
  let gpu = 0.55; // unknown GPU → middle of the road
  if (/rtx|rx 6|rx 7|rx 8|m1|m2|m3|m4|a100|4090|4080|3090|3080|radeon pro|apple gpu/i.test(r)) {
    gpu = 1;
  } else if (/gtx|rx 5|quadro|adreno 7|adreno 8|apple m/i.test(r)) {
    gpu = 0.8;
  } else if (/intel|hd graphics|uhd|iris|mali|adreno 5|adreno 6|swiftshader|llvmpipe|软件/i.test(r)) {
    gpu = 0.3;
  }

  const cores = navigator.hardwareConcurrency || 4;
  const cpu = Math.max(0, Math.min(1, (cores - 2) / 10)); // 2 cores → 0, 12+ → 1

  const mem = navigator.deviceMemory || 4;
  const ram = Math.max(0, Math.min(1, (mem - 2) / 6)); // 2GB → 0, 8GB+ → 1

  const mobile =
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '') ||
    (navigator.maxTouchPoints || 0) > 1;
  const formFactor = mobile ? 0.45 : 1;

  // A very high DPR on a weak GPU is a trap (lots of pixels, little muscle);
  // fold it in gently rather than trusting it as a strength signal.
  const dpr = window.devicePixelRatio || 1;
  const dprPenalty = dpr > 2 ? 0.85 : 1;

  // Weighted blend, GPU dominant since it's the real bottleneck here.
  const q = (gpu * 0.55 + cpu * 0.2 + ram * 0.15 + 0.1) * formFactor * dprPenalty;
  return Math.max(0.12, Math.min(1, q));
}

/* ── State ─────────────────────────────────── */

let quality = estimate();
const listeners = new Set();

// onChange fires only when the value has moved enough to matter, so consumers
// aren't churned every frame by sub-perceptual drift.
const NOTIFY_EPS = 0.02;
let lastNotified = quality;

function notify() {
  if (Math.abs(quality - lastNotified) < NOTIFY_EPS) return;
  lastNotified = quality;
  for (const cb of listeners) {
    try {
      cb(quality);
    } catch (_) {
      /* a bad listener must not take the loop down */
    }
  }
}

function setQuality(next) {
  const clamped = Math.max(0, Math.min(1, next));
  if (clamped === quality) return;
  quality = clamped;
  notify();
}

/* ── Live FPS control loop ─────────────────── */

// Target frame budget. We aim a touch below 60fps (≈52fps) so the controller
// treats an occasional long frame as normal and only reacts to sustained
// slowness — chasing a hard 60 would make it twitchy.
const TARGET_MS = 1000 / 52;

// Asymmetric gains: shed quality quickly when we're slow, claw it back slowly
// when we're fast, so a momentary stall doesn't cost fidelity permanently and
// recovery doesn't overshoot into another stall.
const DOWN_GAIN = 0.045;
const UP_GAIN = 0.006;

// Dead-band around the target (in ms) inside which we leave quality alone.
const DEAD_MS = 4;

let ema = TARGET_MS; // exponential moving average of frame time
let last = 0;
let running = false;
let rafId = 0;
let warmup = 0; // let the EMA settle before acting on it

function tick(ts) {
  if (!running) return;

  if (last) {
    const dt = ts - last;
    // Ignore absurd gaps (tab was backgrounded, breakpoint hit, etc.).
    if (dt < 500) ema += (dt - ema) * 0.1;
  }
  last = ts;

  if (warmup < 30) {
    warmup++;
  } else {
    const err = ema - TARGET_MS;
    if (err > DEAD_MS) {
      setQuality(quality - DOWN_GAIN * Math.min(1, err / TARGET_MS));
    } else if (err < -DEAD_MS) {
      setQuality(quality + UP_GAIN);
    }
  }

  rafId = requestAnimationFrame(tick);
}

function start() {
  if (running) return;
  // Reduced-motion users are pinned at 0 and get no live loop — there is
  // nothing running for it to measure or rebalance.
  if (reduceMq && reduceMq.matches) {
    setQuality(0);
    return;
  }
  running = true;
  last = 0;
  warmup = 0;
  ema = TARGET_MS;
  rafId = requestAnimationFrame(tick);
}

function stop() {
  running = false;
  cancelAnimationFrame(rafId);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stop();
    else start();
  });
  reduceMq?.addEventListener('change', () => {
    if (reduceMq.matches) {
      stop();
      setQuality(0);
    } else {
      quality = estimate();
      lastNotified = quality;
      notify();
      start();
    }
  });
  start();
}

/* ── Public API ────────────────────────────── */

const perf = {
  /** Current quality scalar in [0, 1]. */
  quality() {
    return quality;
  },

  /** Map the current quality onto [min, max] linearly. */
  lerp(min, max) {
    return min + (max - min) * quality;
  },

  /**
   * Subscribe to meaningful quality changes. Fires immediately with the
   * current value so callers can do initial setup in one place. Returns an
   * unsubscribe function.
   */
  onChange(cb) {
    listeners.add(cb);
    try {
      cb(quality);
    } catch (_) {
      /* ignore */
    }
    return () => listeners.delete(cb);
  },
};

// Handy for eyeballing the live value from the console.
if (typeof window !== 'undefined') window.perf = perf;

export default perf;
export { perf };
