// js/flow-field.js — 2D flow-field background layer (owner-driven).
//
// The single background owner (js/backgrounds.js) drives this layer: it
// creates the field with `{ driven: true }` and calls `step()` once per
// owner tick, so this layer never schedules its own rAF while owned and
// exactly one background loop runs at a time. Standalone use (the default)
// keeps the legacy self-scheduling path. The pixel ratio is capped at 1.5,
// matching the topo `maxDpr` discipline.

const PARTICLE_COUNTS = { sparse: 600, medium: 1200, dense: 2000 };

const FLOW_THEMES = {
  aurora: { hueStart: 120, hueRange: 200, saturation: 90, lightness: 62, bg: `5, 5, 8`, trailAlpha: 0.06 },
  ember: { hueStart: 0, hueRange: 55, saturation: 95, lightness: 58, bg: `8, 4, 2`, trailAlpha: 0.07 },
  ocean: { hueStart: 180, hueRange: 90, saturation: 88, lightness: 60, bg: `2, 6, 10`, trailAlpha: 0.06 },
};

const FLOW_DPR_CAP = 1.5;
const FLOW_POSTER_WARM_STEPS = 24;

function fieldAngle(fieldX, fieldY, fieldTime) {
  const fieldScale = 0.0025;
  return (
    Math.sin(fieldX * fieldScale + fieldTime * 0.0007) * Math.PI +
    Math.cos(fieldY * fieldScale + fieldTime * 0.0005) * Math.PI +
    Math.sin((fieldX + fieldY) * fieldScale * 0.6 + fieldTime * 0.0009) * Math.PI * 0.6 +
    Math.cos((fieldX - fieldY) * fieldScale * 0.4 + fieldTime * 0.0006) * Math.PI * 0.4
  );
}

export function createFlowField(flowCanvas, flowOpts = {}) {
  if (!flowCanvas) return null;
  const renderCtx = flowCanvas.getContext(`2d`);
  if (!renderCtx) return null;

  const themeName = flowOpts.theme;
  const activeTheme = FLOW_THEMES[themeName] || FLOW_THEMES.aurora;
  const densityName = flowOpts.density;
  const particleTotal = PARTICLE_COUNTS[densityName] || PARTICLE_COUNTS.medium;
  const drivenExternally = flowOpts.driven === true;

  function readCappedDpr() {
    const rawDpr = Number(window.devicePixelRatio || 1);
    const safeDpr = Number.isFinite(rawDpr) ? rawDpr : 1;
    return Math.min(safeDpr, FLOW_DPR_CAP);
  }

  let fieldWidth = 0;
  let fieldHeight = 0;
  let frameHandle = 0;
  let fieldTime = 0;
  let fieldParticles = [];
  let destroyedFlag = false;

  function spawnParticle() {
    const maxLife = 200 + Math.floor(Math.random() * 300);
    return {
      x: Math.random() * fieldWidth,
      y: Math.random() * fieldHeight,
      speed: 1.1 + Math.random() * 1.8,
      hue: activeTheme.hueStart + Math.random() * activeTheme.hueRange,
      life: Math.floor(Math.random() * maxLife),
      maxLife,
    };
  }

  function resizeFlow() {
    if (destroyedFlag) return;
    const cappedDpr = readCappedDpr();
    fieldWidth = window.innerWidth;
    fieldHeight = window.innerHeight;
    flowCanvas.width = Math.round(fieldWidth * cappedDpr);
    flowCanvas.height = Math.round(fieldHeight * cappedDpr);
    flowCanvas.style.width = `${fieldWidth}px`;
    flowCanvas.style.height = `${fieldHeight}px`;
    renderCtx.setTransform(cappedDpr, 0, 0, cappedDpr, 0, 0);
    renderCtx.fillStyle = `rgb(${activeTheme.bg})`;
    renderCtx.fillRect(0, 0, fieldWidth, fieldHeight);
    fieldParticles = Array.from({ length: particleTotal }, spawnParticle);
  }

  function stepFlow() {
    if (destroyedFlag) return;
    fieldTime += 1;
    renderCtx.fillStyle = `rgba(${activeTheme.bg}, ${activeTheme.trailAlpha})`;
    renderCtx.fillRect(0, 0, fieldWidth, fieldHeight);

    for (const flowParticle of fieldParticles) {
      const particleAngle = fieldAngle(flowParticle.x, flowParticle.y, fieldTime);
      flowParticle.x += Math.cos(particleAngle) * flowParticle.speed;
      flowParticle.y += Math.sin(particleAngle) * flowParticle.speed;
      flowParticle.life += 1;

      if (flowParticle.life > flowParticle.maxLife) {
        flowParticle.x = Math.random() * fieldWidth;
        flowParticle.y = Math.random() * fieldHeight;
        flowParticle.life = 0;
        flowParticle.hue = activeTheme.hueStart + Math.random() * activeTheme.hueRange;
        continue;
      }

      if (flowParticle.x < 0) flowParticle.x += fieldWidth;
      else if (flowParticle.x > fieldWidth) flowParticle.x -= fieldWidth;
      if (flowParticle.y < 0) flowParticle.y += fieldHeight;
      else if (flowParticle.y > fieldHeight) flowParticle.y -= fieldHeight;

      const lifeProgress = flowParticle.life / flowParticle.maxLife;
      const fadeIn = Math.min(lifeProgress * 8, 1);
      const fadeOut = Math.min((1 - lifeProgress) * 6, 1);
      const particleAlpha = fadeIn * fadeOut * 0.9;
      const hueMod = (flowParticle.hue + (particleAngle / (Math.PI * 2)) * 70 + 360) % 360;

      renderCtx.beginPath();
      renderCtx.arc(flowParticle.x, flowParticle.y, 1.3, 0, Math.PI * 2);
      renderCtx.fillStyle = `hsla(${hueMod}, ${activeTheme.saturation}%, ${activeTheme.lightness}%, ${particleAlpha})`;
      renderCtx.fill();
    }
  }

  function flowTick() {
    if (destroyedFlag || drivenExternally) return;
    stepFlow();
    frameHandle = requestAnimationFrame(flowTick);
  }

  function startFlow() {
    if (destroyedFlag || drivenExternally || frameHandle !== 0) return;
    frameHandle = requestAnimationFrame(flowTick);
  }

  function stopFlow() {
    if (frameHandle !== 0) {
      cancelAnimationFrame(frameHandle);
      frameHandle = 0;
    }
  }

  function destroyFlow() {
    destroyedFlag = true;
    stopFlow();
    window.removeEventListener(`resize`, resizeFlow);
  }

  function renderFlowPoster() {
    for (let warmIndex = 0; warmIndex < FLOW_POSTER_WARM_STEPS; warmIndex += 1) {
      stepFlow();
    }
  }

  function isFlowRunning() {
    return frameHandle !== 0;
  }

  resizeFlow();
  window.addEventListener(`resize`, resizeFlow);
  if (!drivenExternally) {
    startFlow();
  }

  return {
    step: stepFlow,
    start: startFlow,
    stop: stopFlow,
    destroy: destroyFlow,
    renderPoster: renderFlowPoster,
    isRunning: isFlowRunning,
  };
}
