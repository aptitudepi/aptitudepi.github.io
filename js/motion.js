// js/motion.js — the single motion policy every module reads.
//
// Before this file each module took its own one-off
// `matchMedia('(prefers-reduced-motion: reduce)').matches` snapshot at load:
// animations.js, nav.js, orb.js (twice), particle-badge.js, perf.js, dev.js
// and the inline favicon script in index.html. A snapshot never notices a
// mid-session change (OS toggle flipped while the page is open), and the
// data-saver signals (saveData / slow 2G) were only hints inside perf.js.
//
// This module owns the whole decision in one place:
//
//   motion off  ←  prefers-reduced-motion
//               ←  manual override (?motion= / localStorage dvxb.motion)
//               ←  saveData / slow-2g / 2g (unless manually forced on)
//   motion on   ←  otherwise
//
// Consumers call `isMotionOK()` (also exposed as `window.motionOK()` for the
// inline favicon script) instead of keeping their own snapshot, and subscribe
// with `onMotionChange(listener)` to react mid-session — the CSS kill-switch
// (`html[data-motion="off"]`, see css/motion.css) freezes the declarative
// animations instantly while subscribers park their rAF loops on a static
// frame. Expressive extras (always-on glitch, text colour cycling) sit behind
// a separate opt-in (`?expressive=1`, localStorage dvxb.expressive, or
// `window.setExpressive(true)`), reflected as `html[data-expressive]` and
// honoured only under `prefers-reduced-motion: no-preference`.

const REDUCE_QUERY_TEXT = `(prefers-reduced-motion: reduce)`;
const MOTION_STORAGE_KEY = `dvxb.motion`;
const EXPRESSIVE_STORAGE_KEY = `dvxb.expressive`;
const MODE_OFF_TEXT = `off`;
const MODE_ON_TEXT = `on`;
const EXPRESSIVE_FULL_TEXT = `full`;
const EXPRESSIVE_CALM_TEXT = `calm`;
const SLOW_LINK_TYPES = new Set([`slow-2g`, `2g`]);

function readReduceMatcher() {
  try {
    if (typeof window === `undefined` || typeof window.matchMedia !== `function`) return null;
    return window.matchMedia(REDUCE_QUERY_TEXT);
  } catch (matcherError) {
    console.warn(`motion policy matcher unavailable: ${matcherError.message}`);
    return null;
  }
}

function readQueryParam(paramName) {
  try {
    if (typeof window === `undefined` || !window.location) return null;
    return new URLSearchParams(window.location.search).get(paramName);
  } catch (paramError) {
    console.warn(`motion policy query read skipped: ${paramError.message}`);
    return null;
  }
}

function readStoredValue(storageKey) {
  try {
    if (typeof window === `undefined` || !window.localStorage) return null;
    return window.localStorage.getItem(storageKey);
  } catch (storageError) {
    console.warn(`motion policy storage read skipped: ${storageError.message}`);
    return null;
  }
}

function storeValue(storageKey, storedText) {
  try {
    if (typeof window === `undefined` || !window.localStorage) return;
    window.localStorage.setItem(storageKey, storedText);
  } catch (storageError) {
    console.warn(`motion policy storage persist skipped: ${storageError.message}`);
    return;
  }
}

function normalizeMotionToken(rawToken) {
  if (rawToken === null || rawToken === undefined) return null;
  const tokenText = String(rawToken).trim().toLowerCase();
  if (tokenText === MODE_OFF_TEXT) return MODE_OFF_TEXT;
  if (tokenText === MODE_ON_TEXT) return MODE_ON_TEXT;
  if (tokenText === `auto`) return `auto`;
  return null;
}

function readConnectionInfo() {
  try {
    if (typeof navigator === `undefined`) return null;
    return navigator.connection || null;
  } catch (connectionError) {
    console.warn(`motion policy connection read skipped: ${connectionError.message}`);
    return null;
  }
}

function readSaveDataSignal() {
  const connectionInfo = readConnectionInfo();
  if (!connectionInfo) return false;
  try {
    return connectionInfo.saveData === true;
  } catch (saveDataError) {
    console.warn(`motion policy saveData read skipped: ${saveDataError.message}`);
    return false;
  }
}

function readSlowLinkSignal() {
  const connectionInfo = readConnectionInfo();
  if (!connectionInfo) return false;
  try {
    return SLOW_LINK_TYPES.has(String(connectionInfo.effectiveType || ``));
  } catch (linkError) {
    console.warn(`motion policy effectiveType read skipped: ${linkError.message}`);
    return false;
  }
}

// Boot precedence: ?motion= URL > localStorage dvxb.motion > auto. Invalid
// tokens warn and fall through to the next source, never pin.
function resolveBootOverride() {
  const urlToken = normalizeMotionToken(readQueryParam(`motion`));
  if (urlToken === null && readQueryParam(`motion`) !== null) {
    console.warn(`[motion] ignoring invalid ?motion value, expected off|on|auto`);
  }
  if (urlToken === MODE_OFF_TEXT || urlToken === MODE_ON_TEXT) {
    manualOverride = urlToken;
    overrideSource = `url`;
    return;
  }
  if (urlToken === `auto`) {
    manualOverride = null;
    overrideSource = `auto`;
    return;
  }
  const storedToken = normalizeMotionToken(readStoredValue(MOTION_STORAGE_KEY));
  if (storedToken === MODE_OFF_TEXT || storedToken === MODE_ON_TEXT) {
    manualOverride = storedToken;
    overrideSource = `stored`;
    return;
  }
  manualOverride = null;
  overrideSource = `auto`;
}

function resolveBootExpressive() {
  const urlFlag = readQueryParam(`expressive`);
  if (urlFlag !== null) {
    expressiveOptIn = urlFlag === `1` || String(urlFlag).toLowerCase() === `full`;
    storeValue(EXPRESSIVE_STORAGE_KEY, expressiveOptIn ? `1` : `0`);
    return;
  }
  expressiveOptIn = readStoredValue(EXPRESSIVE_STORAGE_KEY) === `1`;
}

let reduceMatcher = readReduceMatcher();
let manualOverride = null;
let overrideSource = `auto`;
let expressiveOptIn = false;
const motionListeners = new Set();

function computeMotionOff() {
  // prefers-reduced-motion always wins: an access need beats any preference.
  try {
    if (reduceMatcher && reduceMatcher.matches) return true;
  } catch (reduceError) {
    console.warn(`motion policy reduce read skipped: ${reduceError.message}`);
  }
  if (manualOverride === MODE_OFF_TEXT) return true;
  if (manualOverride === MODE_ON_TEXT) return false;
  return readSaveDataSignal() || readSlowLinkSignal();
}

function currentMotionOff() {
  return computeMotionOff();
}

function isMotionOK() {
  return !currentMotionOff();
}

function isExpressive() {
  return expressiveOptIn;
}

function applyMotionState() {
  const motionOff = currentMotionOff();
  try {
    if (typeof document !== `undefined` && document.documentElement) {
      document.documentElement.dataset.motion = motionOff ? MODE_OFF_TEXT : MODE_ON_TEXT;
      document.documentElement.dataset.expressive = expressiveOptIn ? EXPRESSIVE_FULL_TEXT : EXPRESSIVE_CALM_TEXT;
    }
  } catch (datasetError) {
    console.warn(`motion policy dataset apply skipped: ${datasetError.message}`);
  }
  for (const listener of Array.from(motionListeners)) {
    try {
      listener(motionOff);
    } catch (listenerError) {
      console.warn(`motion policy listener skipped: ${listenerError.message}`);
    }
  }
  return motionOff;
}

// Subscribe to mid-session changes. Fires immediately with the current state
// so callers settle once in one place. Returns an unsubscribe function.
function onMotionChange(listener) {
  motionListeners.add(listener);
  try {
    listener(currentMotionOff());
  } catch (listenerError) {
    console.warn(`motion policy initial notify skipped: ${listenerError.message}`);
  }
  return () => {
    motionListeners.delete(listener);
  };
}

function handleMatcherChange() {
  applyMotionState();
}

function handleConnectionChange() {
  // Connection saveData/effectiveType flips re-resolve only when no manual pin
  // holds the scalar — a manual choice always wins over the network hint.
  if (manualOverride === null) applyMotionState();
}

function attachPolicyListeners() {
  if (attachPolicyListeners.attached) return;
  attachPolicyListeners.attached = true;
  try {
    if (reduceMatcher && typeof reduceMatcher.addEventListener === `function`) {
      reduceMatcher.addEventListener(`change`, handleMatcherChange);
    }
  } catch (matcherListenError) {
    console.warn(`motion policy matcher listen skipped: ${matcherListenError.message}`);
  }
  try {
    const connectionInfo = readConnectionInfo();
    if (connectionInfo && typeof connectionInfo.addEventListener === `function`) {
      connectionInfo.addEventListener(`change`, handleConnectionChange);
    }
  } catch (connectionListenError) {
    console.warn(`motion policy connection listen skipped: ${connectionListenError.message}`);
  }
}
attachPolicyListeners.attached = false;

// Manual override: `off` | `on` | `auto` (resume). Sidebar/console pins
// persist to localStorage; URL pins never persist. Invalid tokens warn.
function setMotionOverride(modeName, sourceName) {
  const normalizedMode = normalizeMotionToken(modeName);
  if (normalizedMode === null) {
    console.warn(`[motion] ignoring invalid motion override, expected off|on|auto`);
    return manualOverride;
  }
  const resolvedSource = sourceName === `url` ? `url` : `sidebar`;
  if (normalizedMode === `auto`) {
    manualOverride = null;
    overrideSource = `auto`;
    if (resolvedSource === `sidebar`) storeValue(MOTION_STORAGE_KEY, `auto`);
  } else {
    manualOverride = normalizedMode;
    overrideSource = resolvedSource;
    if (resolvedSource === `sidebar`) storeValue(MOTION_STORAGE_KEY, normalizedMode);
  }
  applyMotionState();
  return manualOverride;
}

function setExpressive(expressiveOn) {
  expressiveOptIn = Boolean(expressiveOn);
  storeValue(EXPRESSIVE_STORAGE_KEY, expressiveOptIn ? `1` : `0`);
  applyMotionState();
  return expressiveOptIn;
}

// One-shot audit for the calm-default guarantee: every element whose computed
// style still runs an infinite CSS animation. Static default (and the
// mid-session off state) must report zero entries.
function auditRunningAnimations(sampleLimit) {
  const parsedLimit = Number(sampleLimit);
  const cappedLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(50, parsedLimit)) : 10;
  const offenders = [];
  try {
    if (typeof document === `undefined`) return offenders;
    const allNodes = document.querySelectorAll(`*`);
    for (const candidate of Array.from(allNodes)) {
      if (offenders.length >= cappedLimit) break;
      const computedStyle = getComputedStyle(candidate);
      const iterationText = String(computedStyle.animationIterationCount || ``);
      const nameText = String(computedStyle.animationName || ``);
      const playText = String(computedStyle.animationPlayState || ``);
      const isInfinite = iterationText.includes(`infinite`) && nameText !== `` && nameText !== `none`;
      if (!isInfinite || playText !== `running`) continue;
      const labelText = candidate.id
        ? `#${candidate.id}`
        : `${candidate.tagName.toLowerCase()}${candidate.className ? `.${String(candidate.className).split(` `).slice(0, 2).join(`.`)}` : ``}`;
      offenders.push(`${labelText} :: ${nameText}`);
    }
  } catch (auditError) {
    console.warn(`motion audit skipped: ${auditError.message}`);
  }
  return offenders;
}

// Boot: resolve pins, paint the dataset before first paint consumers run,
// expose the gate the inline favicon script and console use.
resolveBootOverride();
resolveBootExpressive();
attachPolicyListeners();
applyMotionState();

if (typeof window !== `undefined`) {
  window.motionOK = isMotionOK;
  window.setMotionOverride = setMotionOverride;
  window.setExpressive = setExpressive;
  window.auditMotion = auditRunningAnimations;
}

function initMotionPolicy() {
  attachPolicyListeners();
  applyMotionState();
  return currentMotionOff() === false;
}

export { initMotionPolicy, isMotionOK, isExpressive, onMotionChange, setMotionOverride, setExpressive, auditRunningAnimations };
