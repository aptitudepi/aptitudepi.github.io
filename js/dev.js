// dev.js — Topolines init + color sync with --nav-cycle
//
// Reads the site's --nav-cycle CSS variable each frame and pushes the
// value to the TopoField via setOptions({ color }). The sync rAF loop
// is the only source of frames — no double loop, no idle wake-ups.
//
// Exposes window.TopoDev for the dev.html sidebar (setOptions, setSync,
// destroy). On the production site the panel is absent and the module
// just runs the sync silently.

const TAG = '[topo]';
const DEV = Boolean(document.getElementById('dev-panel')); // only log on dev.html
function noop() {}
const log = DEV ? console.log.bind(console, TAG) : noop;
let topo = null;
let lastColor = '';
let syncEnabled = true;
let rafId = 0;

const DEFAULTS = {
  seed: 'topo',
  speed: 0.012,
  scale: 3,
  levels: 30,
  lineWidth: 1.2,
  opacity: 0.25,
  color: '#C3D82C',
  drift: [0.004, 0.002],
  warp: 0,
  scrollPan: [0, 0],
  scrollEase: 0.18,
  maxDpr: 1.5,
  interactive: false,
  mouseStrength: 0.35,
  mouseRadius: 0.35,
};

function getTopoGlobal() {
  const topoLower = window.topolines;
  const topoUpper = window.Topolines;
  log('global lookup:', 'topolines=', typeof topoLower, 'Topolines=', typeof topoUpper);
  return topoLower || topoUpper || null;
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
  lastColor = '';
  log('starting color sync loop');
  tickColorSync();
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
      log('color sync →', color);
      topo.setOptions({ color });
      lastColor = color;
    }
  }
}

/* ── Public API for dev.html sidebar ────────── */

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
