// js/backgrounds.js — the single owner for every background layer (WAVE 12).
//
// Before this module each background layer scheduled itself: three-particles
// ran its own rAF, dev.js ran a second color-sync rAF, TopoField ran a third
// inside topolines.global.js, and flow-field plus matrix-rain each owned one
// more. This module is now the ONLY place that schedules background frames:
// layers expose step() functions (takeParticleLoop / takeTopoLoop /
// takeMatrixLoop hand ownership over) and the owner calls them once per tick.
// Scheduling is unified; each layer's render code is untouched.
//
// Modes (persisted as dvxb.background, switched via `background <mode>`):
//   off        — every background loop stopped, all canvases hidden/cleared.
//   static     — one frame per layer as a poster, then no loop.
//   ambient    — the current calm behavior (particle field + slow topo drift).
//   expressive — opt-in full motion: topo at full clock speed, tighter color
//                sync, flow-field layer when its canvas exists. Honored only
//                while the motion policy gate (js/motion.js motionOK()) passes.
//
// The motion policy always wins: reduced-motion, Data-Saver / slow links, or
// a manual motion-off pin clamps ambient/expressive down to static (off stays
// off). The loop also pauses while the tab is hidden or the layers scroll
// off-screen, reusing the visibility / IntersectionObserver disciplines.
//
// Untouched by this wave: thermal portrait, orb, CRT overlay, devmode, and
// the matrix opt-in (matrix still starts via `matrix` / konami — the owner
// simply steps it while it is active and kills it in off/static).

import { isMotionOK, onMotionChange } from './motion.js';
import {
  initParticles,
  takeParticleLoop,
  stepParticleFrame,
  isParticleAvailable,
  isParticleSelfScheduled,
  setParticleVisible,
  paintStaticGradient,
} from './three-particles.js';
import {
  takeTopoLoop,
  stepTopoColorSync,
  driveTopoClock,
  renderTopoPoster,
  setTopoVisible,
  isTopoRunning,
  isTopoSelfScheduled,
} from './dev.js';
import {
  takeMatrixLoop,
  stepMatrixFrame,
  stopMatrixRain,
  isMatrixActive,
  isMatrixSelfScheduled,
} from './matrix-rain.js';
import { createFlowField } from './flow-field.js';

const BACKGROUND_MODES = [`off`, `static`, `ambient`, `expressive`];
const BACKGROUND_STORAGE_KEY = `dvxb.background`;
const DEFAULT_BACKGROUND_MODE = `ambient`;
const FALLBACK_TOPO_SPEED = 0.25;
const AMBIENT_SYNC_CADENCE = 30;
const EXPRESSIVE_SYNC_CADENCE = 5;
const PARTICLE_READY_RETRIES = 60;
const PARTICLE_READY_DELAY_MILLIS = 50;
const STATIC_GRADIENT_TEXT = `linear-gradient(135deg, #0b0e1a 0%, #141b2e 55%, #1d2440 100%)`;

let requestedMode = DEFAULT_BACKGROUND_MODE;
let effectiveMode = DEFAULT_BACKGROUND_MODE;
let ownerLoopId = 0;
let previousTickMillis = 0;
let topoClockSeconds = 0;
let colorSyncCounter = 0;
let pageVisible = true;
let layersOnScreen = true;
let flowHandle = null;
let flowCanvasNode = null;
let backgroundsReady = false;
let backgroundsStarted = false;
const screenStateById = new Map();

function normalizeBackgroundMode(rawMode) {
  if (rawMode === null || rawMode === undefined) return null;
  const modeText = String(rawMode).trim().toLowerCase();
  return BACKGROUND_MODES.includes(modeText) ? modeText : null;
}

function readStoredBackgroundMode() {
  try {
    if (typeof window === `undefined` || !window.localStorage) return null;
    return normalizeBackgroundMode(window.localStorage.getItem(BACKGROUND_STORAGE_KEY));
  } catch (storageError) {
    console.warn(`[backgrounds] stored mode read skipped: ${storageError.message}`);
    return null;
  }
}

function persistBackgroundMode(modeText) {
  try {
    if (typeof window === `undefined` || !window.localStorage) return;
    window.localStorage.setItem(BACKGROUND_STORAGE_KEY, modeText);
  } catch (persistError) {
    console.warn(`[backgrounds] stored mode persist skipped: ${persistError.message}`);
  }
}

// The motion policy (js/motion.js) always wins: anything but an explicit off
// collapses to static while reduced-motion / Data-Saver / slow-link holds.
function resolveEffectiveMode() {
  if (requestedMode === `off`) return `off`;
  if (!isMotionOK()) return `static`;
  return requestedMode;
}

function isLoopMode(modeText) {
  return modeText === `ambient` || modeText === `expressive`;
}

function currentTopoMult() {
  if (effectiveMode === `expressive`) return 1;
  try {
    const configuredSpeed = Number(window.ParticleDev?.getTopoSpeed?.());
    if (Number.isFinite(configuredSpeed) && configuredSpeed > 0) return configuredSpeed;
  } catch (speedError) {
    console.warn(`[backgrounds] topo speed read skipped: ${speedError.message}`);
  }
  return FALLBACK_TOPO_SPEED;
}

function currentSyncCadence() {
  return effectiveMode === `expressive` ? EXPRESSIVE_SYNC_CADENCE : AMBIENT_SYNC_CADENCE;
}

function clampTickDelta(nowMillis) {
  const rawDelta = (nowMillis - previousTickMillis) / 1000;
  if (!Number.isFinite(rawDelta) || rawDelta < 0) return 0;
  return Math.min(rawDelta, 0.1);
}

function pauseOwnerLoop() {
  if (ownerLoopId !== 0) {
    cancelAnimationFrame(ownerLoopId);
    ownerLoopId = 0;
  }
}

function resumeOwnerLoop() {
  if (ownerLoopId !== 0) return;
  if (!isLoopMode(effectiveMode)) return;
  if (!pageVisible || !layersOnScreen) return;
  previousTickMillis = performance.now();
  ownerLoopId = requestAnimationFrame(tickBackground);
}

function hideFlowLayer() {
  if (flowHandle) {
    try {
      flowHandle.stop();
    } catch (flowStopError) {
      console.warn(`[backgrounds] flow stop skipped: ${flowStopError.message}`);
    }
  }
  if (flowCanvasNode) {
    flowCanvasNode.style.display = `none`;
  }
}

function showFlowLayer() {
  if (!flowCanvasNode) {
    const hostCanvas = document.getElementById(`flow-field`);
    if (!hostCanvas) return;
    flowCanvasNode = hostCanvas;
    flowHandle = createFlowField(flowCanvasNode, { driven: true, density: `sparse` });
    if (!flowHandle) {
      flowCanvasNode = null;
      return;
    }
  }
  flowCanvasNode.style.display = ``;
}

// Static = one frame per layer as a poster, then no loop. Missing pieces fall
// back to the static gradient — never an exception.
function paintStaticMode() {
  let paintedParticleFrame = false;
  try {
    if (isParticleAvailable() && window.ParticleDev?.renderPoster) {
      window.ParticleDev.renderPoster();
      paintedParticleFrame = true;
    }
  } catch (posterError) {
    console.warn(`[backgrounds] particle poster skipped: ${posterError.message}`);
  }
  try {
    renderTopoPoster();
  } catch (topoPosterError) {
    console.warn(`[backgrounds] topo poster skipped: ${topoPosterError.message}`);
  }
  if (flowHandle) {
    try {
      flowHandle.renderPoster();
    } catch (flowPosterError) {
      console.warn(`[backgrounds] flow poster skipped: ${flowPosterError.message}`);
    }
  }
  if (!paintedParticleFrame && !isParticleAvailable()) {
    const particleCanvas = document.getElementById(`c`);
    if (particleCanvas) {
      particleCanvas.style.background = STATIC_GRADIENT_TEXT;
    }
    paintStaticGradient(particleCanvas);
  }
}

function applyBackgroundMode() {
  if (effectiveMode === `off`) {
    pauseOwnerLoop();
    stopMatrixRain();
    setParticleVisible(false);
    setTopoVisible(false);
    hideFlowLayer();
    return;
  }
  setParticleVisible(true);
  setTopoVisible(true);
  if (effectiveMode === `static`) {
    pauseOwnerLoop();
    stopMatrixRain();
    hideFlowLayer();
    paintStaticMode();
    return;
  }
  if (effectiveMode === `expressive`) {
    showFlowLayer();
  } else {
    hideFlowLayer();
  }
  syncScreenStateNow();
  resumeOwnerLoop();
}

function tickBackground(nowMillis) {
  ownerLoopId = 0;
  if (!isLoopMode(effectiveMode)) return;
  if (!pageVisible || !layersOnScreen) return;
  const deltaSeconds = clampTickDelta(nowMillis);
  previousTickMillis = nowMillis;
  try {
    if (isParticleAvailable()) {
      stepParticleFrame(nowMillis);
    }
    topoClockSeconds += deltaSeconds * currentTopoMult();
    driveTopoClock(topoClockSeconds);
    colorSyncCounter += 1;
    if (colorSyncCounter % currentSyncCadence() === 0) {
      stepTopoColorSync();
    }
    if (effectiveMode === `expressive` && flowHandle) {
      flowHandle.step();
    }
    if (isMatrixActive()) {
      stepMatrixFrame();
    }
  } catch (tickError) {
    console.warn(`[backgrounds] tick skipped: ${tickError.message}`);
  }
  if (isLoopMode(effectiveMode) && pageVisible && layersOnScreen) {
    ownerLoopId = requestAnimationFrame(tickBackground);
  }
}

function refreshScreenState() {
  if (screenStateById.size === 0) {
    layersOnScreen = true;
  } else {
    layersOnScreen = Array.from(screenStateById.values()).includes(true);
  }
  if (layersOnScreen) {
    resumeOwnerLoop();
  } else {
    pauseOwnerLoop();
  }
}

// Synchronous screen read for explicit transitions (mode switches, tab
// visible again): the IntersectionObserver callback lags a turn behind
// display toggles, and trusting its stale value here strands the loop
// paused after a rapid off→ambient. The observer still owns later
// scroll-driven changes.
function syncScreenStateNow() {
  try {
    const layerNodes = [
      document.getElementById(`c`),
      document.getElementById(`topo-host`),
    ].filter((candidateNode) => candidateNode !== null);
    if (layerNodes.length === 0) {
      layersOnScreen = true;
      return;
    }
    screenStateById.clear();
    for (const layerNode of layerNodes) {
      const layerRect = layerNode.getBoundingClientRect();
      const nodeOnScreen = layerNode.style.display !== `none` && layerRect.width > 0 && layerRect.height > 0;
      screenStateById.set(layerNode.id, nodeOnScreen);
    }
    layersOnScreen = Array.from(screenStateById.values()).includes(true);
  } catch (screenError) {
    console.warn(`[backgrounds] screen sync skipped: ${screenError.message}`);
  }
}

function watchLayerVisibility() {
  try {
    if (typeof IntersectionObserver === `undefined`) return;
    const observedNodes = [
      document.getElementById(`c`),
      document.getElementById(`topo-host`),
    ].filter((candidateNode) => candidateNode !== null);
    if (observedNodes.length === 0) return;
    const screenObserver = new IntersectionObserver((entryList) => {
      for (const screenEntry of entryList) {
        screenStateById.set(screenEntry.target.id, screenEntry.isIntersecting);
      }
      refreshScreenState();
    });
    for (const observedNode of observedNodes) {
      screenObserver.observe(observedNode);
    }
  } catch (observerError) {
    console.warn(`[backgrounds] layer visibility watch skipped: ${observerError.message}`);
  }
}

function handleVisibilityChange() {
  pageVisible = typeof document === `undefined` ? true : !document.hidden;
  if (pageVisible) {
    syncScreenStateNow();
    resumeOwnerLoop();
  } else {
    pauseOwnerLoop();
  }
}

function handleMotionPolicyChange() {
  const nextEffective = resolveEffectiveMode();
  if (nextEffective === effectiveMode) return;
  effectiveMode = nextEffective;
  applyBackgroundMode();
}

function setBackgroundMode(modeName) {
  const normalizedMode = normalizeBackgroundMode(modeName);
  if (!normalizedMode) {
    console.warn(`[backgrounds] ignoring invalid mode, expected off|static|ambient|expressive`);
    return null;
  }
  requestedMode = normalizedMode;
  persistBackgroundMode(normalizedMode);
  const nextEffective = resolveEffectiveMode();
  effectiveMode = nextEffective;
  applyBackgroundMode();
  return { requested: requestedMode, effective: effectiveMode };
}

function getBackgroundMode() {
  return { requested: requestedMode, effective: effectiveMode };
}

// Acceptance probe: how many background rAF loops are actually scheduled
// right now. Under ownership this is 1 while animating, 0 while static/off —
// any stray self-scheduled layer loop pushes it above 1.
function getActiveLoopCount() {
  let runningTotal = 0;
  if (ownerLoopId !== 0) runningTotal += 1;
  if (isTopoRunning()) runningTotal += 1;
  if (isTopoSelfScheduled()) runningTotal += 1;
  if (isParticleSelfScheduled()) runningTotal += 1;
  if (isMatrixSelfScheduled()) runningTotal += 1;
  return runningTotal;
}

function assertSingleLoop() {
  const runningTotal = getActiveLoopCount();
  if (runningTotal > 1) {
    throw new Error(`[backgrounds] expected at most one background loop, saw ${runningTotal}`);
  }
  return true;
}

function finishBackgroundInit() {
  backgroundsReady = true;
  // The boot-time static poster may have gradient-fallbacked before
  // ParticleDev existed; repaint now that the real renderer is up.
  if (effectiveMode === `static`) {
    applyBackgroundMode();
  }
  if (typeof window !== `undefined`) {
    window.Backgrounds = {
      getMode: getBackgroundMode,
      setMode: setBackgroundMode,
      getActiveLoopCount,
      assertSingleLoop,
      isReady: () => backgroundsReady,
    };
  }
}

function pollParticleApi(retriesLeft) {
  const particleApiReady = typeof window !== `undefined` && Boolean(window.ParticleDev);
  if (particleApiReady || retriesLeft <= 0) {
    finishBackgroundInit();
    return;
  }
  window.setTimeout(() => {
    pollParticleApi(retriesLeft - 1);
  }, PARTICLE_READY_DELAY_MILLIS);
}

function initBackgrounds() {
  if (backgroundsStarted) return getBackgroundMode();
  backgroundsStarted = true;
  const storedMode = readStoredBackgroundMode();
  if (storedMode) {
    requestedMode = storedMode;
  }
  effectiveMode = resolveEffectiveMode();
  pageVisible = typeof document === `undefined` ? true : !document.hidden;

  // Take ownership BEFORE any layer schedules: with the flags set, layer
  // boot paths never self-schedule and no transient second loop appears.
  takeParticleLoop();
  initParticles();
  takeTopoLoop();
  takeMatrixLoop();

  try {
    document.addEventListener(`visibilitychange`, handleVisibilityChange);
  } catch (visibilityError) {
    console.warn(`[backgrounds] visibility watch skipped: ${visibilityError.message}`);
  }
  watchLayerVisibility();
  onMotionChange(handleMotionPolicyChange);

  applyBackgroundMode();
  pollParticleApi(PARTICLE_READY_RETRIES);
  return getBackgroundMode();
}

export { initBackgrounds, setBackgroundMode, getBackgroundMode, getActiveLoopCount, assertSingleLoop };
