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

// Phase-3 manual override (URL > stored > auto) + auto clamps. Declared
// before first use (declare-before-use): resolveBootOverride() at the file
// bottom pins these during module eval, before any subscriber attaches.
const QUALITY_STORAGE_KEY = 'perf.quality';
const TIER_QUALITY_MAP = { ultra: 1, high: 0.62, medium: 0.37, low: 0.12 };
const TIER_STEP = 0.25; // one-tier quality distance for hint-only boot drops
const BATTERY_LOW_LEVEL = 0.2;
const SOURCE_AUTO = 'auto';
const SOURCE_URL = 'url';
const SOURCE_STORED = 'stored';
const SOURCE_SIDEBAR = 'sidebar';

let manualTierName = null; // pinned tier name, or null when the scaler owns it
let manualQualityPin = null; // pinned raw scalar (dev-slider path), or null
let overrideSource = SOURCE_AUTO; // auto | url | stored | sidebar
let qualityFloor = 0; // auto-scaler lower clamp
let qualityCeiling = 1; // auto-scaler upper clamp

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
  // A manual pin holds the scalar exactly (tier representative or raw slider
  // value) and ignores the auto clamps — the user always wins.
  if (isScalerPinned()) {
    const pinnedScalar = manualTierName !== null ? tierQualityValue(manualTierName) : manualQualityPin;
    if (pinnedScalar === quality) return;
    quality = pinnedScalar;
    notify();
    return;
  }
  const unitClamped = Math.max(0, Math.min(1, next));
  const clamped = Math.max(qualityFloor, Math.min(qualityCeiling, unitClamped));
  if (clamped === quality) return;
  quality = clamped;
  notify();
}

/* ── Phase-3 override + hint helpers ───────── */

// All helpers are hoisted function declarations; the const/let state above is
// declared textually first (declare-before-use), and every call happens at
// module bottom or runtime, after the whole module evaluated.

// Normalize a raw override token (URL param or stored string) to a tier name,
// the string 'auto', or null when invalid. Accepts low/med/medium/high/ultra,
// tier indices 0-3 (0 = ultra … 3 = low; 4 aliases the floor), and auto.
function normalizeTierToken(rawToken) {
  if (rawToken === null || rawToken === undefined) return null;
  const tokenText = String(rawToken).trim().toLowerCase();
  if (tokenText === SOURCE_AUTO) return SOURCE_AUTO;
  if (tokenText === 'ultra' || tokenText === '0') return 'ultra';
  if (tokenText === 'high' || tokenText === '1') return 'high';
  if (tokenText === 'medium' || tokenText === 'med' || tokenText === '2') return 'medium';
  if (tokenText === 'low' || tokenText === '3' || tokenText === '4') return 'low';
  return null;
}

// Quality scalar pinned for a tier (representative inside the tier band, so
// the particle ladder in three-particles.js lands in the matching bucket).
function tierQualityValue(tierName) {
  const pinnedValue = TIER_QUALITY_MAP[tierName];
  return typeof pinnedValue === 'number' ? pinnedValue : 1;
}

// True while a manual pin holds the scalar and the live loop must stay inert.
function isScalerPinned() {
  return manualTierName !== null || manualQualityPin !== null;
}

function hasQualityParam() {
  try {
    if (typeof window === 'undefined' || !window.location) return false;
    return new URLSearchParams(window.location.search).has('quality');
  } catch {
    return false;
  }
}

function readUrlTierToken() {
  try {
    if (typeof window === 'undefined' || !window.location) return null;
    const searchParams = new URLSearchParams(window.location.search);
    return normalizeTierToken(searchParams.get('quality'));
  } catch {
    return null;
  }
}

function readStoredTierToken() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return normalizeTierToken(window.localStorage.getItem(QUALITY_STORAGE_KEY));
  } catch {
    return null;
  }
}

function persistStoredTierToken(tokenText) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(QUALITY_STORAGE_KEY, tokenText);
  } catch {
    return;
  }
}

// Hint-only boot signals (all optional with safe defaults on Firefox/Safari):
// slow effectiveType forces the floor tier; saveData / prefers-reduced-data
// each cost one tier. The scaler may recover — hints, never pins.
function readSlowLinkHint() {
  try {
    const connectionInfo = navigator.connection || null;
    if (!connectionInfo) return false;
    const effectiveKind = String(connectionInfo.effectiveType || '');
    return effectiveKind === 'slow-2g' || effectiveKind === '2g';
  } catch {
    return false;
  }
}

function readSaveDataHint() {
  try {
    const connectionInfo = navigator.connection || null;
    if (!connectionInfo) return false;
    return connectionInfo.saveData === true;
  } catch {
    return false;
  }
}

function readReducedDataHint() {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-data: reduce)').matches;
  } catch {
    return false;
  }
}

function ignoreBatteryFailure() {
  return;
}

// Chromium-only battery hint: discharging below 20% caps the auto ceiling one
// tier down (never a pin — user override still wins). Promise-based, never
// blocks boot; charging/level events keep the clamp live. No-ops elsewhere.
function applyBatteryHint(batteryInfo) {
  try {
    if (!batteryInfo || batteryInfo.charging !== false) return;
    const batteryLevel = Number(batteryInfo.level || 0);
    if (batteryLevel >= BATTERY_LOW_LEVEL) return;
    const loweredCeiling = Math.max(tierQualityValue('low'), quality - TIER_STEP);
    qualityCeiling = Math.min(qualityCeiling, loweredCeiling);
    setQuality(quality);
  } catch {
    return;
  }
}

function onBatteryInfo(batteryInfo) {
  applyBatteryHint(batteryInfo);
  batteryInfo.addEventListener('chargingchange', function refreshChargingHint() {
    applyBatteryHint(batteryInfo);
  });
  batteryInfo.addEventListener('levelchange', function refreshLevelHint() {
    applyBatteryHint(batteryInfo);
  });
}

function watchBatteryHint() {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') return;
    navigator.getBattery().then(onBatteryInfo, ignoreBatteryFailure);
  } catch {
    return;
  }
}

// Resume helper: a ?quality= tier pin still wins over everything except a new
// explicit pin; otherwise the scaler owns the scalar again.
function adoptUrlPinOrAuto() {
  manualTierName = null;
  manualQualityPin = null;
  const urlToken = readUrlTierToken();
  if (urlToken !== null && urlToken !== SOURCE_AUTO) {
    manualTierName = urlToken;
    overrideSource = SOURCE_URL;
    setQuality(tierQualityValue(urlToken));
    return;
  }
  overrideSource = SOURCE_AUTO;
}

// Boot precedence: ?quality= URL > localStorage > auto-detect (estimate +
// hint drops). Manual pins set the scalar to the tier representative and the
// live loop stays inert until cleared; auto applies hint drops and clamps.
function resolveBootOverride() {
  const urlToken = readUrlTierToken();
  if (urlToken === null && hasQualityParam()) {
    console.warn('[perf] ignoring invalid ?quality value, expected low|med|high|ultra|auto');
  }
  if (urlToken !== null && urlToken !== SOURCE_AUTO) {
    manualQualityPin = null;
    manualTierName = urlToken;
    overrideSource = SOURCE_URL;
    setQuality(tierQualityValue(urlToken));
    return;
  }
  if (urlToken === SOURCE_AUTO) {
    adoptUrlPinOrAuto();
    return;
  }
  const storedToken = readStoredTierToken();
  if (storedToken !== null && storedToken !== SOURCE_AUTO) {
    manualTierName = storedToken;
    overrideSource = SOURCE_STORED;
    setQuality(tierQualityValue(storedToken));
    return;
  }
  overrideSource = SOURCE_AUTO;
  if (readSlowLinkHint()) {
    setQuality(tierQualityValue('low'));
    return;
  }
  let hintDrops = 0;
  if (readSaveDataHint()) hintDrops += 1;
  if (readReducedDataHint()) hintDrops += 1;
  if (hintDrops > 0) setQuality(quality - hintDrops * TIER_STEP);
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
  } else if (!isScalerPinned()) {
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
      // Re-resolve URL/stored pins so a manual choice survives the
      // reduced-motion round-trip; auto re-applies hint drops on the fresh
      // estimate. Notifies only when re-pinning (same no-op as before in auto).
      resolveBootOverride();
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

  /** Pinned tier name ('ultra'|'high'|'medium'|'low') or null when auto. */
  getTier() {
    return manualTierName;
  },

  /** Effective source: 'auto' | 'url' | 'stored' | 'sidebar'. */
  getOverrideSource() {
    return overrideSource;
  },

  /** True while a manual pin holds the scalar and the live loop is inert. */
  isManual() {
    return isScalerPinned();
  },

  /**
   * Pin a tier ('low'|'med'|'medium'|'high'|'ultra', indices 0-4, or 'auto'
   * to resume). Manual pins disable the scaler; sidebar pins persist to
   * localStorage (URL pins never persist); invalid tokens warn and no-op.
   */
  setTierOverride(tierNameOrAuto, sourceName) {
    const normalizedTier = normalizeTierToken(tierNameOrAuto);
    if (normalizedTier === null) {
      console.warn('[perf] ignoring invalid quality override, expected low|med|high|ultra|auto');
      return manualTierName;
    }
    const resolvedSource = sourceName === SOURCE_URL ? SOURCE_URL : SOURCE_SIDEBAR;
    manualQualityPin = null;
    if (normalizedTier === SOURCE_AUTO) {
      if (resolvedSource === SOURCE_SIDEBAR) persistStoredTierToken(SOURCE_AUTO);
      adoptUrlPinOrAuto();
      return manualTierName;
    }
    manualTierName = normalizedTier;
    overrideSource = resolvedSource;
    if (resolvedSource === SOURCE_SIDEBAR) persistStoredTierToken(normalizedTier);
    setQuality(tierQualityValue(normalizedTier));
    return manualTierName;
  },

  /** Pin an arbitrary scalar (dev-slider path); scaler inert while pinned. */
  pinQuality(pinnedValue, sourceName) {
    const parsedPin = Number(pinnedValue);
    manualTierName = null;
    manualQualityPin = Number.isNaN(parsedPin) ? quality : Math.max(0, Math.min(1, parsedPin));
    overrideSource = sourceName === SOURCE_URL ? SOURCE_URL : SOURCE_SIDEBAR;
    setQuality(manualQualityPin);
  },

  /** Resume: sidebar yields to URL/stored pins, else full auto. */
  clearTierOverride() {
    setTierOverride(SOURCE_AUTO, SOURCE_SIDEBAR);
  },

  /** Clamp the auto scaler into [floor, ceiling]; manual pins ignore clamps. */
  setClamp(floorValue, ceilingValue) {
    const parsedFloor = Math.max(0, Math.min(1, Number(floorValue)));
    const parsedCeiling = Math.max(0, Math.min(1, Number(ceilingValue)));
    qualityFloor = Math.min(parsedFloor, parsedCeiling);
    qualityCeiling = Math.max(parsedFloor, parsedCeiling);
    if (!isScalerPinned()) setQuality(quality);
  },

  /** Current auto clamps ({ floor, ceiling }). */
  getClamp() {
    return { floor: qualityFloor, ceiling: qualityCeiling };
  },
};

// Handy for eyeballing the live value from the console.
if (typeof window !== 'undefined') window.perf = perf;

// Phase-3 boot: URL > stored > auto(+hints), then live battery hints.
resolveBootOverride();
watchBatteryHint();

export default perf;
export { perf };
