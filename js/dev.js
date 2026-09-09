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
// WAVE 12 single-owner flag: while true the background owner
// (js/backgrounds.js) steps the color sync via stepTopoColorSync() and drives
// the topo clock via driveTopoClock() — this module schedules nothing, and
// the TopoField instance stays paused, so exactly one background loop runs.
let schedulerOwned = false;
let topoStartPatched = false;

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

/* The motion policy query lives in js/motion.js: initTopolines consults the
   live gate when kicking the color-sync loop, and the subscription below
   parks the loop on a static blue when the policy flips off mid-session. */
import { isMotionOK, onMotionChange as subscribeMotionChange } from './motion.js';

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
  // WAVE 12: a topo created after takeTopoLoop() must start paused — the
  // owner drives it, so its own loop must never run.
  if (schedulerOwned) {
    applyOwnershipToTopo();
  } else if (!rafId && isMotionOK()) tickColorSync();
}
initTopolines._retries = 0;

function tickColorSync() {
  // Always re-schedule so the loop is never permanently lost — unless the
  // single background owner drives (WAVE 12), in which case scheduling here
  // would leave a second loop behind.
  if (!schedulerOwned && !document.hidden) {
    rafId = requestAnimationFrame(tickColorSync);
  }

  if (!syncEnabled || !topo?.ok) return;

  runColorSyncStep();
}

// One color-sync iteration without scheduling: the single background owner
// calls this at its own (throttled) cadence.
function runColorSyncStep() {
  const navNode = document.querySelector('.doc-nav');
  if (navNode) {
    const cycleColor = getComputedStyle(navNode).getPropertyValue('--nav-cycle').trim();
    if (cycleColor && cycleColor !== lastColor) {
      // Lerp between glass base and nav-cycle based on syncSaturation
      if (syncSaturation < 1) {
        const glassRGB = parseColor('#C9B8E8');
        const navRGB = parseColor(cycleColor);
        const mixRatio = syncSaturation;
        const mixRed = Math.round((glassRGB[0] + (navRGB[0] - glassRGB[0]) * mixRatio) * 255);
        const mixGreen = Math.round((glassRGB[1] + (navRGB[1] - glassRGB[1]) * mixRatio) * 255);
        const mixBlue = Math.round((glassRGB[2] + (navRGB[2] - glassRGB[2]) * mixRatio) * 255);
        const mixedColor = `#${mixRed.toString(16).padStart(2, '0')}${mixGreen.toString(16).padStart(2, '0')}${mixBlue.toString(16).padStart(2, '0')}`;
        log('color sync →', mixedColor, `(sat=${mixRatio.toFixed(2)})`);
        topo.setOptions({ color: mixedColor });
      } else {
        log('color sync →', cycleColor);
        topo.setOptions({ color: cycleColor });
      }
      lastColor = cycleColor;
    }
  }
}

/* ── WAVE 12 single-owner hooks ─────────────────── */

// Keep an owned topo paused even when its own observers (IntersectionObserver,
// visibilitychange, motion) call start(): under ownership the background owner
// is the only scheduler, and a self-restart would leave two loops behind.
function applyOwnershipToTopo() {
  if (!topo?.ok) return;
  if (!topoStartPatched) {
    topoStartPatched = true;
    const originalStart = topo.start.bind(topo);
    topo.start = () => {
      if (schedulerOwned) return;
      originalStart();
    };
  }
  topo.pause();
}

// Hand scheduling to the single background owner: stop the color-sync loop
// and park the TopoField instance (it renders via driveTopoClock() below).
function takeTopoLoop() {
  schedulerOwned = true;
  if (rafId !== 0) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  applyOwnershipToTopo();
}

// One owner tick of color sync. Honors the sidebar sync toggle.
function stepTopoColorSync() {
  if (!syncEnabled || !topo?.ok) return;
  runColorSyncStep();
}

// Advance the topo clock directly (TopoField.setClock renders internally while
// paused, so no own loop is needed).
function driveTopoClock(clockSeconds) {
  if (topo?.ok && !topo.contextLost) {
    topo.setClock(clockSeconds);
  }
}

// Paint one static topo frame for static mode / posters.
function renderTopoPoster() {
  if (topo?.ok && !topo.contextLost) {
    topo.resize();
    topo.render();
  }
}

function setTopoVisible(visibleValue) {
  const hostNode = document.getElementById('topo-host');
  if (hostNode) {
    hostNode.style.display = visibleValue ? `` : `none`;
  }
}

function isTopoRunning() {
  return topo?.running === true;
}

function isTopoOwned() {
  return schedulerOwned;
}

function isTopoSelfScheduled() {
  return rafId !== 0 && !schedulerOwned;
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

/* ── Motion policy ─────────────────────────── */

function handleMotionPolicy(motionOff) {
  if (motionOff) {
    log('motion policy OFF → pushing blue');
    // Owned → the background owner applies the policy; touching rafId here
    // would fight the single loop.
    if (!schedulerOwned) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    topo?.setOptions({ color: '#0000ff' });
  } else {
    lastColor = '';
    // The subscription notifies immediately on attach (before TopoField
    // exists); only (re)start the loop once there is a field to drive —
    // initTopolines kicks it for the boot case. Owned → the owner restarts.
    if (topo && !rafId && !schedulerOwned) tickColorSync();
  }
}

subscribeMotionChange(handleMotionPolicy);

/* ── Visibility ──────────────────────────────── */

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  } else {
    // Owned → the background owner resumes its own loop.
    if (!rafId && !schedulerOwned) tickColorSync();
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

export { takeTopoLoop, stepTopoColorSync, driveTopoClock, renderTopoPoster, setTopoVisible, isTopoRunning, isTopoOwned, isTopoSelfScheduled };
