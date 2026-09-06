// dev.js — Topolines init + color sync with --nav-cycle
//
// Reads the site's --nav-cycle CSS variable each frame and pushes the
// value to the TopoField via setOptions({ color }). The sync rAF loop
// is the only source of frames — no double loop, no idle wake-ups.
//
// Exposes window.TopoDev for the dev sidebar (devmode) (setOptions, setSync,
// destroy). On the production site the panel is absent and the module
// just runs the sync silently.

const TAG = '[topo]';
const DEV = Boolean(document.getElementById('dev-panel')); // only log when #dev-panel pre-exists at load
function noop() { /* silence */ }
const log = DEV ? console.log.bind(console, TAG) : noop;
let topo = null;
let lastColor = '';
let syncEnabled = true;
let syncSaturation = 0.25; // 0 = fixed glass, 1 = full colorcycle
let rafId = 0;

const DEFAULTS = {
  seed: 'topo',
  speed: 0.05,
  scale: 3,
  levels: 30,
  lineWidth: 0.5,
  opacity: 0.10,
  color: '#C9B8E8',
  drift: [0.004, 0.002],
  warp: 0,
  scrollPan: [0, 0],
  scrollEase: 0.18,
  maxDpr: 1.5,
  interactive: true,
  mouseStrength: 0.35,
  mouseRadius: 0.35,
};

function getTopoGlobal() {
  const topoLower = window.topolines;
  const topoUpper = window.Topolines;
  log('global lookup:', 'topolines=', typeof topoLower, 'Topolines=', typeof topoUpper);
  return topoLower || topoUpper || null;
}

/** Parse a CSS color string to [r, g, b] in 0–1 range */
function parseColor(c) {
  const topoGlobal = getTopoGlobal();
  if (topoGlobal?.parseColor) return topoGlobal.parseColor(c);
  // Fallback: use 2D canvas
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = '#000';
  if (ctx.fillStyle !== '#000') {
    ctx.fillStyle = '#fff';
  }
  ctx.fillStyle = c;
  ctx.clearRect(0, 0, 1, 1); ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

function initTopolines() {
  log('initTopolines called, retry #', initTopolines._retries);

  const host = document.getElementById('topo-host');
  log('topo-host element:', host ? `found (${host.offsetWidth}x${host.offsetHeight})` : 'NOT FOUND');

  if (!host) {
    console.warn(TAG, 'no #topo-host in DOM — bailing');
    return;
  }

  const topoGlobal = getTopoGlobal();
  if (!topoGlobal?.TopoField) {
    console.warn(TAG, 'topolines global missing or incomplete, retrying in 100ms…');
    if (initTopolines._retries < 30) {
      initTopolines._retries++;
      setTimeout(initTopolines, 100);
    } else {
      console.error(TAG, 'gave up after 30 retries');
    }
    return;
  }

  log('global found, TopoField=', typeof topoGlobal.TopoField, ', creating instance…');

  topo = new topoGlobal.TopoField(host, DEFAULTS);
  log('TopoField.ok =', topo.ok);

  if (!topo.ok) {
    console.warn(TAG, 'TopoField failed to init — no WebGL or derivatives');
    return;
  }

  syncEnabled = true;
  syncSaturation = 0.25;
  lastColor = '';
  // Live boot matches the dev sidebar defaults (influence 1.00, sync on):
  // influence is additive in the topo shader and a no-op until a particle
  // canvas is wired, so pinning it here is safe even when particles boot late.
  if (topo.setParticleInfluence) topo.setParticleInfluence(1);
  const readyParticleCanvas = window.ParticleDev?.getParticleCanvas?.();
  if (readyParticleCanvas && topo.setParticleTex) topo.setParticleTex(readyParticleCanvas);
  if (!rafId && !reduceMq?.matches) tickColorSync();
}
initTopolines._retries = 0;

function tickColorSync() {
  // Always re-schedule so the loop is never permanently lost.
  if (!document.hidden) {
    rafId = requestAnimationFrame(tickColorSync);
  }

  if (!syncEnabled || !topo?.ok) return;

  const nav = document.querySelector('.doc-nav');
  if (nav) {
    const color = getComputedStyle(nav).getPropertyValue('--nav-cycle').trim();
    if (color && color !== lastColor) {
      // Lerp between glass base and nav-cycle based on syncSaturation
      if (syncSaturation < 1) {
        const glassRGB = parseColor('#C9B8E8');
        const navRGB = parseColor(color);
        const t = syncSaturation;
        const red = Math.round((glassRGB[0] + (navRGB[0] - glassRGB[0]) * t) * 255);
        const green = Math.round((glassRGB[1] + (navRGB[1] - glassRGB[1]) * t) * 255);
        const blue = Math.round((glassRGB[2] + (navRGB[2] - glassRGB[2]) * t) * 255);
        const mixed = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
        log('color sync →', mixed, `(sat=${t.toFixed(2)})`);
        topo.setOptions({ color: mixed });
      } else {
        log('color sync →', color);
        topo.setOptions({ color });
      }
      lastColor = color;
    }
  }
}

/* ── Public API for dev sidebar (devmode) ────────── */

window.TopoDev = {
  /** Merge arbitrary TopolinesOptions into the live field. */
  setOptions(patch) {
    log('setOptions:', JSON.stringify(patch));
    if (topo) topo.setOptions(patch);
  },

  /** Read the current resolved options (handy for serializing). */
  getOptions() {
    return topo ? { ...topo.live } : { ...DEFAULTS };
  },

  /** Raw topo instance (for external drivers like the particle sync). */
  getTopo() { return topo; },

  /** Bind a 2D canvas as the particle density texture. */
  setParticleTex(canvas) {
    if (topo?.setParticleTex) topo.setParticleTex(canvas);
  },

  /** 0 = pure noise, 1 = pure particles. */
  setParticleInfluence(v) {
    if (topo?.setParticleInfluence) topo.setParticleInfluence(v);
  },

  /** Read the topo's accumulated animation clock (seconds × speed). */
  getClock() {
    return topo ? topo.clock : 0;
  },

  /** Enable / disable the --nav-cycle colour sync loop. */
  setSync(enabled) {
    log('setSync:', enabled);
    syncEnabled = enabled;
    if (!enabled) lastColor = ''; // force a re-push when re-enabled
  },

  isSyncing() {
    return syncEnabled;
  },

  /** 0 = fixed glass, 1 = full colorcycle. */
  setSyncSaturation(v) {
    syncSaturation = Math.max(0, Math.min(1, v));
    lastColor = ''; // force re-push with new saturation
  },

  getSyncSaturation() {
    return syncSaturation;
  },

  destroy() {
    log('destroy');
    cancelAnimationFrame(rafId);
    rafId = 0;
    topo?.destroy();
    topo = null;
  },
};

/* ── Reduced-motion ──────────────────────────── */

const reduceMq = window.matchMedia?.('(prefers-reduced-motion: reduce)');

function onMotionChange() {
  if (reduceMq?.matches) {
    log('prefers-reduced-motion ON → pushing blue');
    cancelAnimationFrame(rafId);
    rafId = 0;
    topo?.setOptions({ color: '#0000ff' });
  } else {
    lastColor = '';
    if (!rafId) tickColorSync();
  }
}

reduceMq?.addEventListener('change', onMotionChange);

/* ── Visibility ──────────────────────────────── */

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  } else {
    if (!rafId) tickColorSync();
  }
});

/* ── Auto-init ───────────────────────────────── */

log('module loaded, readyState=', document.readyState);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded fired');
    initTopolines();
  });
} else {
  initTopolines();
}

export {};
