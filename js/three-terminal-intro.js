// js/three-terminal-intro.js — WAVE 13 establishing-shot 3D terminal intro.
//
// A dedicated beat immediately after the hero: a red-blue/black modern
// monitor (thin dark chassis, screen plane with boot-text texture, fake
// gradient contact shadow, 3 named lights, fog + ACES). Fly-in deliberately
// TABLED — the object opens on its static solved frame. Explicitly NOT
// built: green-phosphor/CRT/scanlines, bloom, GLB models, HDR assets,
// postprocessing, edge-light cycles, or ambient mode mirrors.
//
// Boot echo: the screen texture is painted from the shared BOOT_SCRIPT
// constant ({ text, fill } reusing the commands.js palette), the same source
// js/shell.js bootSequence consumes, so the xterm transcript and the texture
// can never drift. Lines tick at ~100ms during boot only, the texture
// uploads on change (needsUpdate), and freezes at handoff.
//
// Lifecycle (one-shot-then-poster): the solved frame doubles as the poster
// (pre-first-frame + fallback + exit-frame triple-use). Exits land on the
// poster; re-entry rebuilds from the kept scene description + CPU caches
// while every GPU object is ephemeral. The loop is fully dead outside boot:
// single on-demand renders only, renderer.setAnimationLoop(null) at all
// times, plus IntersectionObserver + visibilitychange gating. Idle ~30s
// dims to the poster. Hover/focus gives ±3° parallax + brighten only.
//
// Sole interaction (enter beacon): hover-brighten, then click/Enter runs a
// ≤200ms phosphor-flash crossfade and focuses the REAL xterm terminal
// (preventScroll + aria-live + Escape returns to the beacon). Native
// <button>, keyboard operable throughout.
//
// Fallbacks (poster + live DOM terminal, three never in the critical path):
// reduced-motion / Save-Data / slow links (via js/motion.js motionOK()),
// mobile (coarse pointer or narrow viewport: poster + Enter only, no canvas
// flight, no tilt), WebGL-off, and context-lost. This module itself loads
// only via dynamic import from an idle callback in js/main.js, after first
// DOM paint. It never touches js/backgrounds.js loop ownership and adds no
// terminal output, so golden transcripts stay byte-identical.

import { BOOT_SCRIPT } from './commands.js';
import { isMotionOK, onMotionChange } from './motion.js';

const INTRO_MOUNT_ID = `terminal-intro`;
const INTRO_STAGE_SELECTOR = `.terminal-intro-stage`;
const INTRO_POSTER_SELECTOR = `.terminal-intro-poster`;
const INTRO_ENTER_ID = `terminal-intro-enter`;
const INTRO_STATUS_ID = `terminal-intro-status`;
const INTRO_CANVAS_CLASS = `terminal-intro-gl`;
const INTRO_FLASH_CLASS = `terminal-intro-flash`;
const INTRO_DIMMED_CLASS = `is-dimmed`;
const INTRO_FRAMED_CLASS = `has-frame`;
const COARSE_POINTER_QUERY = `(pointer: coarse)`;
const NARROW_VIEWPORT_QUERY = `(max-width: 768px)`;
const BOOT_TICK_MILLIS = 100;
const IDLE_DIM_MILLIS = 30000;
const FLASH_MILLIS = 160;
const FIRST_BUILD_DELAY_MILLIS = 400;
const PARALLAX_RADIANS = 0.0524;
const REST_EMISSIVE_INTENSITY = 0.75;
const HOVER_EMISSIVE_INTENSITY = 0.95;
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 640;
const TEXTURE_LEFT_MARGIN = 56;
const TEXTURE_FIRST_BASELINE = 96;
const TEXTURE_LINE_HEIGHT = 52;
const TEXTURE_FONT_TEXT = `28px "JetBrains Mono", monospace`;
const TEXTURE_BACKGROUND_TEXT = `#06080e`;
const TEXTURE_FALLBACK_TEXT = `#9aa0b4`;
const ANSI_FILL_PATTERN = /38;2;(\d+);(\d+);(\d+)m/;
const SCENE_BACKGROUND_HEX = 0x05070c;
const FOG_NEAR_DISTANCE = 12;
const FOG_FAR_DISTANCE = 26;
const CAMERA_FIELD_OF_VIEW = 40;
const CAMERA_NEAR_PLANE = 0.1;
const CAMERA_FAR_PLANE = 100;
const FALLBACK_STAGE_WIDTH = 960;
const FALLBACK_STAGE_HEIGHT = 600;
const MAX_PIXEL_RATIO = 2;

let introState = `idle`;
let threeLibrary = null;
let rendererObject = null;
let sceneObject = null;
let cameraObject = null;
let screenMaterial = null;
let bootTextureObject = null;
let textureCanvas = null;
let textureContext = null;
let canvasElement = null;
let flashElement = null;
let stageNode = null;
let posterNode = null;
let enterButtonNode = null;
let statusNode = null;
let keptSceneDescription = null;
let keptPosterDataUrl = null;
let bootTickTimeout = 0;
let idleDimTimeout = 0;
let pendingParallaxFrame = 0;
let restPitchAngle = 0;
let restYawAngle = 0;
let stageOnScreen = true;
let pageVisibleState = true;

function readSaveDataSignal() {
  try {
    if (typeof navigator === `undefined` || !navigator.connection) return false;
    return navigator.connection.saveData === true;
  } catch (connectionError) {
    console.warn(`[terminal-intro] saveData read skipped: ${connectionError.message}`);
    return false;
  }
}

function readCoarsePointerSignal() {
  try {
    if (typeof window === `undefined` || typeof window.matchMedia !== `function`) return false;
    return window.matchMedia(COARSE_POINTER_QUERY).matches;
  } catch (pointerError) {
    console.warn(`[terminal-intro] pointer query skipped: ${pointerError.message}`);
    return false;
  }
}

function readNarrowViewportSignal() {
  try {
    if (typeof window === `undefined` || typeof window.matchMedia !== `function`) return false;
    return window.matchMedia(NARROW_VIEWPORT_QUERY).matches;
  } catch (viewportError) {
    console.warn(`[terminal-intro] viewport query skipped: ${viewportError.message}`);
    return false;
  }
}

function readWebglAvailable() {
  try {
    if (typeof document === `undefined`) return false;
    const probeCanvas = document.createElement(`canvas`);
    const probeContext = probeCanvas.getContext(`webgl2`) || probeCanvas.getContext(`webgl`);
    if (probeContext && typeof probeContext.getParameter === `function`) {
      const loseExtension = probeContext.getExtension(`WEBGL_lose_context`);
      if (loseExtension && typeof loseExtension.loseContext === `function`) {
        loseExtension.loseContext();
      }
      return true;
    }
    return false;
  } catch (probeError) {
    console.warn(`[terminal-intro] webgl probe skipped: ${probeError.message}`);
    return false;
  }
}

// Poster-only unless every gate passes: motion policy (reduced-motion /
// Save-Data / slow links / manual pin), desktop-class pointer + viewport,
// and a working WebGL context. Poster + live DOM terminal + Enter button
// remain in every fallback path.
function readIntroEligible() {
  if (isMotionOK() === false) return false;
  if (readSaveDataSignal()) return false;
  if (readCoarsePointerSignal()) return false;
  if (readNarrowViewportSignal()) return false;
  return readWebglAvailable();
}

function announceIntroStatus(messageText) {
  try {
    if (statusNode) statusNode.textContent = messageText;
  } catch (announceError) {
    console.warn(`[terminal-intro] announce skipped: ${announceError.message}`);
  }
}

// BOOT_SCRIPT fills are ANSI palette constants (e.g. SITE_OK); the texture
// painter parses the embedded 38;2;r;g;b triple back to a CSS color so both
// consumers share one source of truth.
function parseAnsiFillToCss(fillText) {
  try {
    const fillMatch = ANSI_FILL_PATTERN.exec(String(fillText));
    if (!fillMatch) return TEXTURE_FALLBACK_TEXT;
    const redChannel = Math.max(0, Math.min(255, Number(fillMatch[1])));
    const greenChannel = Math.max(0, Math.min(255, Number(fillMatch[2])));
    const blueChannel = Math.max(0, Math.min(255, Number(fillMatch[3])));
    return `rgb(${redChannel}, ${greenChannel}, ${blueChannel})`;
  } catch (parseError) {
    console.warn(`[terminal-intro] fill parse skipped: ${parseError.message}`);
    return TEXTURE_FALLBACK_TEXT;
  }
}

// Upload-on-change: repaints the CPU canvas and flags needsUpdate only when
// a boot tick adds lines. Frozen after the solved frame / at handoff.
function paintBootTextureLines(paintedLineCount) {
  if (!textureContext) return;
  const clampedCount = Math.max(0, Math.min(BOOT_SCRIPT.length, paintedLineCount));
  textureContext.fillStyle = TEXTURE_BACKGROUND_TEXT;
  textureContext.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  textureContext.font = TEXTURE_FONT_TEXT;
  textureContext.textBaseline = `alphabetic`;
  BOOT_SCRIPT.forEach((scriptEntry, entryIndex) => {
    if (entryIndex >= clampedCount) return;
    textureContext.fillStyle = parseAnsiFillToCss(scriptEntry.fill);
    const baselineY = TEXTURE_FIRST_BASELINE + entryIndex * TEXTURE_LINE_HEIGHT;
    textureContext.fillText(scriptEntry.text, TEXTURE_LEFT_MARGIN, baselineY);
  });
  if (bootTextureObject) bootTextureObject.needsUpdate = true;
}

// Kept CPU-side scene description: plain data (no GPU handles), so re-entry
// rebuilds the scene without re-deriving anything after a kill.
function buildSceneDescription() {
  const measuredWidth = stageNode ? stageNode.clientWidth : 0;
  const measuredHeight = stageNode ? stageNode.clientHeight : 0;
  return {
    stageWidth: measuredWidth > 0 ? measuredWidth : FALLBACK_STAGE_WIDTH,
    stageHeight: measuredHeight > 0 ? measuredHeight : FALLBACK_STAGE_HEIGHT,
    backgroundHex: SCENE_BACKGROUND_HEX,
    fogNear: FOG_NEAR_DISTANCE,
    fogFar: FOG_FAR_DISTANCE,
    cameraFov: CAMERA_FIELD_OF_VIEW,
    cameraPosition: [0.7, 0.5, 9.6],
    cameraTarget: [0, -0.2, 0],
    bootLineCount: BOOT_SCRIPT.length,
  };
}

function paintContactShadowTexture() {
  const shadowCanvas = document.createElement(`canvas`);
  shadowCanvas.width = 256;
  shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext(`2d`);
  const shadowGradient = shadowContext.createRadialGradient(128, 32, 8, 128, 32, 120);
  shadowGradient.addColorStop(0, `rgba(0, 0, 0, 0.55)`);
  shadowGradient.addColorStop(1, `rgba(0, 0, 0, 0)`);
  shadowContext.fillStyle = shadowGradient;
  shadowContext.fillRect(0, 0, 256, 64);
  const shadowTexture = new threeLibrary.CanvasTexture(shadowCanvas);
  shadowTexture.colorSpace = threeLibrary.SRGBColorSpace;
  return shadowTexture;
}

function buildRendererAndScene(description) {
  canvasElement = document.createElement(`canvas`);
  canvasElement.className = INTRO_CANVAS_CLASS;
  canvasElement.setAttribute(`aria-hidden`, `true`);
  canvasElement.addEventListener(`webglcontextlost`, handleIntroContextLost);
  rendererObject = new threeLibrary.WebGLRenderer({
    canvas: canvasElement,
    antialias: true,
    alpha: false,
    powerPreference: `low-power`,
  });
  const deviceRatio = typeof window.devicePixelRatio === `number` ? window.devicePixelRatio : 1;
  rendererObject.setPixelRatio(Math.min(deviceRatio, MAX_PIXEL_RATIO));
  rendererObject.setSize(description.stageWidth, description.stageHeight, false);
  rendererObject.toneMapping = threeLibrary.ACESFilmicToneMapping;
  rendererObject.toneMappingExposure = 1;
  rendererObject.setAnimationLoop(null);

  sceneObject = new threeLibrary.Scene();
  sceneObject.background = new threeLibrary.Color(description.backgroundHex);
  sceneObject.fog = new threeLibrary.Fog(description.backgroundHex, description.fogNear, description.fogFar);

  cameraObject = new threeLibrary.PerspectiveCamera(
    description.cameraFov,
    description.stageWidth / description.stageHeight,
    CAMERA_NEAR_PLANE,
    CAMERA_FAR_PLANE
  );
  cameraObject.position.set(description.cameraPosition[0], description.cameraPosition[1], description.cameraPosition[2]);
  cameraObject.lookAt(description.cameraTarget[0], description.cameraTarget[1], description.cameraTarget[2]);
  restPitchAngle = cameraObject.rotation.x;
  restYawAngle = cameraObject.rotation.y;

  const keyLight = new threeLibrary.DirectionalLight(0xdfe8ff, 1.2);
  keyLight.name = `intro-key`;
  keyLight.position.set(4, 6, 7);
  const fillLight = new threeLibrary.DirectionalLight(0x8fb0ff, 0.45);
  fillLight.name = `intro-fill`;
  fillLight.position.set(-6, 1, 4);
  const rimLight = new threeLibrary.DirectionalLight(0xff8a6a, 0.45);
  rimLight.name = `intro-rim`;
  rimLight.position.set(-2, 3, -6);
  sceneObject.add(keyLight);
  sceneObject.add(fillLight);
  sceneObject.add(rimLight);

  textureCanvas = document.createElement(`canvas`);
  textureCanvas.width = TEXTURE_WIDTH;
  textureCanvas.height = TEXTURE_HEIGHT;
  textureContext = textureCanvas.getContext(`2d`);
  bootTextureObject = new threeLibrary.CanvasTexture(textureCanvas);
  bootTextureObject.colorSpace = threeLibrary.SRGBColorSpace;

  const monitorGroup = new threeLibrary.Group();
  monitorGroup.name = `intro-monitor`;
  const chassisMaterial = new threeLibrary.MeshStandardMaterial({
    color: 0x0b0d13,
    roughness: 0.5,
    metalness: 0.6,
  });
  const chassisMesh = new threeLibrary.Mesh(new threeLibrary.BoxGeometry(6.4, 4.0, 0.18), chassisMaterial);
  chassisMesh.position.set(0, 0.6, -0.1);
  screenMaterial = new threeLibrary.MeshStandardMaterial({
    map: bootTextureObject,
    emissive: 0xffffff,
    emissiveMap: bootTextureObject,
    emissiveIntensity: REST_EMISSIVE_INTENSITY,
    roughness: 0.6,
    metalness: 0.1,
  });
  const screenMesh = new threeLibrary.Mesh(new threeLibrary.PlaneGeometry(6.0, 3.6), screenMaterial);
  screenMesh.position.set(0, 0.6, 0.0);
  const neckMesh = new threeLibrary.Mesh(new threeLibrary.BoxGeometry(0.5, 0.9, 0.25), chassisMaterial);
  neckMesh.position.set(0, -1.85, -0.2);
  const baseMesh = new threeLibrary.Mesh(new threeLibrary.BoxGeometry(2.4, 0.12, 1.4), chassisMaterial);
  baseMesh.position.set(0, -2.35, 0);
  const shadowTexture = paintContactShadowTexture();
  const shadowMaterial = new threeLibrary.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
  });
  const shadowMesh = new threeLibrary.Mesh(new threeLibrary.PlaneGeometry(7.5, 2.2), shadowMaterial);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(0, -2.42, 0);
  monitorGroup.add(chassisMesh);
  monitorGroup.add(screenMesh);
  monitorGroup.add(neckMesh);
  monitorGroup.add(baseMesh);
  monitorGroup.add(shadowMesh);
  sceneObject.add(monitorGroup);

  flashElement = document.createElement(`div`);
  flashElement.className = INTRO_FLASH_CLASS;
  flashElement.setAttribute(`aria-hidden`, `true`);
  flashElement.hidden = true;
  stageNode.appendChild(flashElement);
  stageNode.appendChild(canvasElement);
}

// Single on-demand frame. Never a loop: callers render exactly one frame per
// event/tick, and the renderer animation loop stays null at all times.
function requestSolvedRender() {
  if (!rendererObject || !sceneObject || !cameraObject) return;
  if (!stageOnScreen || !pageVisibleState) return;
  try {
    rendererObject.render(sceneObject, cameraObject);
  } catch (renderError) {
    console.warn(`[terminal-intro] frame skipped: ${renderError.message}`);
  }
}

function cancelPendingParallax() {
  if (pendingParallaxFrame !== 0) {
    cancelAnimationFrame(pendingParallaxFrame);
    pendingParallaxFrame = 0;
  }
}

function applyCameraTilt(yawRadians, pitchRadians) {
  if (!cameraObject) return;
  cameraObject.rotation.set(restPitchAngle + pitchRadians, restYawAngle + yawRadians, 0);
  requestSolvedRender();
}

function handleStagePointerMove(pointerEvent) {
  if (!rendererObject || introState !== `live` || !stageNode) return;
  cancelPendingParallax();
  const stageRect = stageNode.getBoundingClientRect();
  const normX = (pointerEvent.clientX - stageRect.left) / Math.max(1, stageRect.width) - 0.5;
  const normY = (pointerEvent.clientY - stageRect.top) / Math.max(1, stageRect.height) - 0.5;
  const yawRadians = normX * 2 * PARALLAX_RADIANS;
  const pitchRadians = normY * 2 * PARALLAX_RADIANS * -1;
  pendingParallaxFrame = window.requestAnimationFrame(() => {
    pendingParallaxFrame = 0;
    applyCameraTilt(yawRadians, pitchRadians);
  });
}

function setScreenBrighten(brightened) {
  if (!screenMaterial) return;
  screenMaterial.emissiveIntensity = brightened ? HOVER_EMISSIVE_INTENSITY : REST_EMISSIVE_INTENSITY;
  requestSolvedRender();
}

function clearDimToPoster() {
  if (stageNode) stageNode.classList.remove(INTRO_DIMMED_CLASS);
}

function handleStagePointerEnter() {
  if (introState !== `live`) return;
  cancelIdleDimTimer();
  clearDimToPoster();
  setScreenBrighten(true);
  armIdleDimTimer();
}

function handleStagePointerLeave() {
  cancelPendingParallax();
  setScreenBrighten(false);
  applyCameraTilt(0, 0);
  armIdleDimTimer();
}

function handleBeaconFocus() {
  if (introState !== `live`) return;
  cancelIdleDimTimer();
  clearDimToPoster();
  setScreenBrighten(true);
}

function handleBeaconBlur() {
  setScreenBrighten(false);
  armIdleDimTimer();
}

function cancelIdleDimTimer() {
  if (idleDimTimeout !== 0) {
    window.clearTimeout(idleDimTimeout);
    idleDimTimeout = 0;
  }
}

function armIdleDimTimer() {
  cancelIdleDimTimer();
  if (introState !== `live`) return;
  idleDimTimeout = window.setTimeout(() => {
    idleDimTimeout = 0;
    if (introState !== `live` || !stageNode) return;
    stageNode.classList.add(INTRO_DIMMED_CLASS);
    stageNode.dataset.state = `poster`;
  }, IDLE_DIM_MILLIS);
}

// Solved-frame poster triple-use: the captured first frame upgrades the
// static poster (pre-first-frame), serves every fallback, and is the frame
// every exit lands on.
function captureSolvedPoster() {
  try {
    if (!canvasElement || !posterNode) return;
    keptPosterDataUrl = canvasElement.toDataURL(`image/png`);
    posterNode.style.backgroundImage = `url("${keptPosterDataUrl}")`;
    posterNode.classList.add(INTRO_FRAMED_CLASS);
  } catch (captureError) {
    console.warn(`[terminal-intro] poster capture skipped: ${captureError.message}`);
  }
}

function applyPosterState() {
  if (stageNode) {
    stageNode.classList.remove(INTRO_DIMMED_CLASS);
    stageNode.dataset.state = `poster`;
  }
}

function runBootEchoTick(nextLineCount) {
  if (!rendererObject || introState !== `booting`) return;
  if (nextLineCount > BOOT_SCRIPT.length) {
    introState = `live`;
    requestSolvedRender();
    captureSolvedPoster();
    armIdleDimTimer();
    return;
  }
  bootTickTimeout = window.setTimeout(() => {
    bootTickTimeout = 0;
    if (!rendererObject || introState !== `booting`) return;
    paintBootTextureLines(nextLineCount);
    requestSolvedRender();
    runBootEchoTick(nextLineCount + 1);
  }, BOOT_TICK_MILLIS);
}

async function constructIntroGraphics(firstBootEcho) {
  if (rendererObject || !stageNode) return;
  let loadedThree = null;
  try {
    loadedThree = await import(`three`);
  } catch (importError) {
    console.warn(`[terminal-intro] three import skipped: ${importError.message}`);
    applyPosterState();
    return;
  }
  threeLibrary = loadedThree;
  try {
    if (!keptSceneDescription) keptSceneDescription = buildSceneDescription();
    buildRendererAndScene(keptSceneDescription);
  } catch (buildError) {
    console.warn(`[terminal-intro] scene build skipped: ${buildError.message}`);
    threeLibrary = null;
    applyPosterState();
    return;
  }
  if (firstBootEcho) {
    introState = `booting`;
    stageNode.dataset.state = `live`;
    paintBootTextureLines(0);
    requestSolvedRender();
    runBootEchoTick(1);
    return;
  }
  paintBootTextureLines(BOOT_SCRIPT.length);
  introState = `live`;
  stageNode.dataset.state = `live`;
  requestSolvedRender();
  captureSolvedPoster();
  armIdleDimTimer();
}

// Scroll the hero terminal into view before focusing it: the intro beat
// sits a full viewport below the hero, so focusing xterm alone leaves the
// visitor staring at the poster (a "static pane"). Smooth-scroll only while
// the motion policy is on; instant when it is off.
function scrollHeroTerminalIntoView() {
  try {
    const heroTarget = document.getElementById(`hero-target`);
    if (heroTarget && typeof heroTarget.scrollIntoView === `function`) {
      const scrollBehavior = isMotionOK() ? `smooth` : `auto`;
      heroTarget.scrollIntoView({ behavior: scrollBehavior, block: `start` });
      return true;
    }
    return false;
  } catch (scrollError) {
    console.warn(`[terminal-intro] hero scroll skipped: ${scrollError.message}`);
    return false;
  }
}

function focusRealTerminal() {
  try {
    scrollHeroTerminalIntoView();
    // Focus the xterm helper textarea directly with preventScroll: the
    // programmatic scroll above stays the only movement, so the inner
    // terminal scrollers never jump underneath the page scroll.
    const helperArea = document.querySelector(`#terminal-container textarea`);
    if (helperArea && typeof helperArea.focus === `function`) {
      helperArea.focus({ preventScroll: true });
      return true;
    }
    const waveSeven = window.__wave7;
    if (waveSeven && typeof waveSeven.getTerm === `function`) {
      const liveTerm = waveSeven.getTerm();
      if (liveTerm && typeof liveTerm.focus === `function`) {
        liveTerm.focus();
        return true;
      }
    }
  } catch (focusError) {
    console.warn(`[terminal-intro] terminal focus skipped: ${focusError.message}`);
  }
  return false;
}

// Escape story: after a handoff, Escape leaves the live terminal and returns
// focus to the enter beacon with an announcement. Capture phase: the xterm
// textarea stops propagation for handled keys, so a bubble listener would
// never fire while the terminal holds focus.
function handleHandoffEscape(keyboardEvent) {
  try {
    if (!keyboardEvent || keyboardEvent.key !== `Escape`) return;
    document.removeEventListener(`keydown`, handleHandoffEscape, true);
    if (enterButtonNode && typeof enterButtonNode.focus === `function`) {
      enterButtonNode.focus({ preventScroll: true });
    }
    announceIntroStatus(`Returned to the intro. Press Enter to step back into the terminal.`);
  } catch (escapeError) {
    console.warn(`[terminal-intro] escape return skipped: ${escapeError.message}`);
  }
}

function showFlashOverlay() {
  if (!flashElement) return;
  flashElement.hidden = false;
  flashElement.classList.add(`is-flashing`);
}

function hideFlashOverlay() {
  if (!flashElement) return;
  flashElement.classList.remove(`is-flashing`);
  flashElement.hidden = true;
}

// ENTER BEACON: phosphor-flash crossfade (≤200ms), focus the real terminal,
// land on the poster with every GPU handle destroyed.
function handoffToTerminal() {
  if (introState === `handed-off`) {
    focusRealTerminal();
    return;
  }
  introState = `handed-off`;
  cancelIdleDimTimer();
  cancelPendingParallax();
  clearDimToPoster();
  showFlashOverlay();
  announceIntroStatus(`Entering the live terminal.`);
  window.setTimeout(() => {
    hideFlashOverlay();
    focusRealTerminal();
    announceIntroStatus(`Terminal focused. Press Escape to return to the intro.`);
    document.addEventListener(`keydown`, handleHandoffEscape, true);
    destroyIntroGraphics(`handoff`);
    applyPosterState();
  }, FLASH_MILLIS);
}

function disposeSingleMaterial(materialObject) {
  if (!materialObject) return;
  const textureSlots = [materialObject.map, materialObject.emissiveMap];
  for (const textureEntry of textureSlots) {
    if (textureEntry && typeof textureEntry.dispose === `function`) {
      try {
        textureEntry.dispose();
      } catch (textureError) {
        console.warn(`[terminal-intro] texture dispose skipped: ${textureError.message}`);
      }
    }
  }
  if (typeof materialObject.dispose === `function`) {
    try {
      materialObject.dispose();
    } catch (materialError) {
      console.warn(`[terminal-intro] material dispose skipped: ${materialError.message}`);
    }
  }
}

function disposeSceneChild(sceneChild) {
  try {
    const childGeometry = sceneChild.geometry;
    if (childGeometry && typeof childGeometry.dispose === `function`) {
      childGeometry.dispose();
    }
    const childMaterial = sceneChild.material;
    if (Array.isArray(childMaterial)) {
      for (const materialEntry of childMaterial) {
        disposeSingleMaterial(materialEntry);
      }
    } else if (childMaterial) {
      disposeSingleMaterial(childMaterial);
    }
  } catch (disposeError) {
    console.warn(`[terminal-intro] child dispose skipped: ${disposeError.message}`);
  }
}

function verifyGraphicsMemory() {
  const emptyMemory = { geometries: 0, textures: 0, programs: 0 };
  try {
    if (!rendererObject || !rendererObject.info || !rendererObject.info.memory) return emptyMemory;
    const liveMemory = rendererObject.info.memory;
    const programList = rendererObject.info.programs;
    return {
      geometries: Number(liveMemory.geometries) || 0,
      textures: Number(liveMemory.textures) || 0,
      programs: Array.isArray(programList) ? programList.length : 0,
    };
  } catch (memoryError) {
    console.warn(`[terminal-intro] memory verify skipped: ${memoryError.message}`);
    return emptyMemory;
  }
}

// KILL: cancel pending frames + null the (always-null) animation loop,
// traverse-dispose every geometry/material/texture, renderer dispose,
// force context loss, remove the canvas, null every ref, then verify
// info.memory reads zero geometries/textures.
function destroyIntroGraphics(reasonText) {
  cancelIdleDimTimer();
  cancelPendingParallax();
  if (bootTickTimeout !== 0) {
    window.clearTimeout(bootTickTimeout);
    bootTickTimeout = 0;
  }
  const destroyReason = typeof reasonText === `string` ? reasonText : `unknown`;
  let memorySnapshot = { geometries: 0, textures: 0, programs: 0 };
  try {
    if (rendererObject) {
      rendererObject.setAnimationLoop(null);
      if (sceneObject) {
        sceneObject.traverse((sceneChild) => {
          disposeSceneChild(sceneChild);
        });
      }
      rendererObject.dispose();
      memorySnapshot = verifyGraphicsMemory();
      rendererObject.forceContextLoss();
    }
  } catch (destroyError) {
    console.warn(`[terminal-intro] destroy skipped: ${destroyError.message}`);
  }
  if (canvasElement && typeof canvasElement.remove === `function`) {
    canvasElement.remove();
  }
  if (flashElement && typeof flashElement.remove === `function`) {
    flashElement.remove();
  }
  rendererObject = null;
  sceneObject = null;
  cameraObject = null;
  screenMaterial = null;
  bootTextureObject = null;
  textureCanvas = null;
  textureContext = null;
  canvasElement = null;
  flashElement = null;
  threeLibrary = null;
  const memoryClean = memorySnapshot.geometries === 0 && memorySnapshot.textures === 0;
  if (!memoryClean) {
    console.warn(`[terminal-intro] destroy memory nonzero: ${memorySnapshot.geometries} geometries, ${memorySnapshot.textures} textures`);
  }
  if (introState !== `handed-off`) introState = `destroyed`;
  return { reason: destroyReason, memory: memorySnapshot, clean: memoryClean };
}

function handleIntroContextLost(contextEvent) {
  try {
    if (contextEvent && typeof contextEvent.preventDefault === `function`) {
      contextEvent.preventDefault();
    }
  } catch (contextError) {
    console.warn(`[terminal-intro] context-lost guard skipped: ${contextError.message}`);
  }
  announceIntroStatus(`3D context lost. Showing the poster with the live terminal below.`);
  destroyIntroGraphics(`context-lost`);
  applyPosterState();
}

function handleIntroVisibilityChange() {
  pageVisibleState = typeof document === `undefined` ? true : !document.hidden;
  if (pageVisibleState && introState === `live`) requestSolvedRender();
}

function handleIntroResize() {
  if (!rendererObject || !cameraObject || !stageNode || introState !== `live`) return;
  try {
    const measuredWidth = stageNode.clientWidth || FALLBACK_STAGE_WIDTH;
    const measuredHeight = stageNode.clientHeight || FALLBACK_STAGE_HEIGHT;
    rendererObject.setSize(measuredWidth, measuredHeight, false);
    cameraObject.aspect = measuredWidth / measuredHeight;
    cameraObject.updateProjectionMatrix();
    requestSolvedRender();
  } catch (resizeError) {
    console.warn(`[terminal-intro] resize skipped: ${resizeError.message}`);
  }
}

// Re-entry: rebuild from the kept scene description + CPU caches (poster,
// boot texture dimensions) when the beat scrolls back into view after a
// non-handoff destroy. GPU objects are always rebuilt, never reused.
function maybeRebuildAfterExit() {
  if (introState !== `destroyed`) return;
  if (!readIntroEligible()) return;
  constructIntroGraphics(false);
}

function observeStageVisibility() {
  try {
    if (typeof IntersectionObserver === `undefined`) return;
    const stageObserver = new IntersectionObserver((entryList) => {
      for (const entryItem of entryList) {
        if (entryItem.target !== stageNode) continue;
        stageOnScreen = entryItem.isIntersecting;
        if (stageOnScreen) maybeRebuildAfterExit();
      }
    }, { threshold: 0.15 });
    stageObserver.observe(stageNode);
  } catch (observerError) {
    console.warn(`[terminal-intro] stage observe skipped: ${observerError.message}`);
  }
}

function handleMotionPolicyChange(motionOff) {
  if (motionOff === true && rendererObject) {
    announceIntroStatus(`Motion parked. Showing the poster with the live terminal below.`);
    destroyIntroGraphics(`motion-off`);
    applyPosterState();
  }
}

function initTerminalIntro() {
  const mountNode = document.getElementById(INTRO_MOUNT_ID);
  if (!mountNode) return false;
  stageNode = mountNode.querySelector(INTRO_STAGE_SELECTOR);
  posterNode = mountNode.querySelector(INTRO_POSTER_SELECTOR);
  enterButtonNode = document.getElementById(INTRO_ENTER_ID);
  statusNode = document.getElementById(INTRO_STATUS_ID);
  if (!stageNode || !enterButtonNode) return false;
  enterButtonNode.addEventListener(`click`, handoffToTerminal);
  stageNode.addEventListener(`pointermove`, handleStagePointerMove);
  stageNode.addEventListener(`pointerenter`, handleStagePointerEnter);
  stageNode.addEventListener(`pointerleave`, handleStagePointerLeave);
  enterButtonNode.addEventListener(`focus`, handleBeaconFocus);
  enterButtonNode.addEventListener(`blur`, handleBeaconBlur);
  try {
    document.addEventListener(`visibilitychange`, handleIntroVisibilityChange);
    window.addEventListener(`resize`, handleIntroResize);
  } catch (listenerError) {
    console.warn(`[terminal-intro] listeners skipped: ${listenerError.message}`);
  }
  observeStageVisibility();
  onMotionChange(handleMotionPolicyChange);
  if (!readIntroEligible()) {
    introState = `poster`;
    stageNode.dataset.state = `poster`;
    announceIntroStatus(`3D intro parked. Poster shown with the live terminal below.`);
    return true;
  }
  introState = `poster`;
  stageNode.dataset.state = `poster`;
  window.setTimeout(() => {
    if (stageOnScreen && readIntroEligible() && introState === `poster` && !rendererObject) {
      constructIntroGraphics(true);
    }
  }, FIRST_BUILD_DELAY_MILLIS);
  return true;
}

if (typeof window !== `undefined`) {
  window.__terminalIntro = {
    getState: function getIntroState() {
      return introState;
    },
    isEligible: function readEligible() {
      return readIntroEligible();
    },
    verify: function verifyIntroMemory() {
      return verifyGraphicsMemory();
    },
    destroy: function destroyIntro() {
      return destroyIntroGraphics(`manual`);
    },
  };
}

export { initTerminalIntro, readIntroEligible, destroyIntroGraphics, verifyGraphicsMemory };
