// thermal-ascii.js — sparse ASCII field that shimmers under cursor
// Vanilla port of andriidrok's AsciiDraw.tsx

const RAMP = " `.:-=+*cs#%@";
const HEIGHT = 240;

function getPalette() {
  const dark = document.documentElement.dataset.theme === "dark";
  return dark
    ? { base: [88, 96, 105], hot: [240, 246, 252], boost: 1.4 }
    : { base: [175, 184, 193], hot: [0, 0, 0], boost: 2.4 };
}

function createStaticLayer(canvas, field, cols, rows, cellW, cellH, dpr, fontPx, fontFamily, pal) {
  const staticLayer = document.createElement("canvas");
  staticLayer.width = canvas.width;
  staticLayer.height = canvas.height;
  const staticCtx = staticLayer.getContext("2d");
  if (!staticCtx) return null;
  staticCtx.scale(dpr, dpr);
  staticCtx.font = `${fontPx}px ${fontFamily}`;
  staticCtx.textBaseline = "top";
  staticCtx.fillStyle = `rgb(${pal.base.join(",")})`;
  for (let i = 0; i < field.length; i++) {
    if (field[i] === 0) continue;
    staticCtx.fillText(
      RAMP[field[i]],
      (i % cols) * cellW,
      ((i / cols) | 0) * cellH,
    );
  }
  return staticLayer;
}

export function initThermalAscii(canvas, options = {}) {
  const {
    fontPx = 11,
    cellWidthRatio = 0.6,
    cellHeightRatio = 1.163,
    heatRadius = 3,
    heatDecay = 0.93,
    heatThreshold = 0.02,
    ramp = RAMP,
    maxDpr = 2,
  } = options;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.warn("thermal-ascii: no 2D context");
    return { destroy() {} };
  }

  let width = 0, dpr = 1, cellW = 0, cellH = 0;
  let COLS = 0, ROWS = 0;
  let field = new Int8Array(0);
  let heat = new Float32Array(0);
  let pal = getPalette();
  let staticLayer = null;
  let raf = 0;
  let loopRunning = false;
  let disposed = false;

  function layout() {
    if (!canvas) return;
    width = canvas.parentElement?.clientWidth || canvas.clientWidth;
    cellW = fontPx * cellWidthRatio;
    cellH = fontPx * cellHeightRatio;
    COLS = Math.floor(width / cellW);
    ROWS = Math.floor(HEIGHT / cellH);
    if (field.length !== ROWS * COLS) {
      field = new Int8Array(ROWS * COLS);
      heat = new Float32Array(ROWS * COLS);
      for (let i = 0; i < field.length; i++) {
        const randVal = Math.random();
        field[i] = randVal < 0.55 ? 0 : 1 + Math.floor(Math.pow(Math.random(), 2) * 3);
      }
    }
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${HEIGHT}px`;

    pal = getPalette();
    const fontFamily = getComputedStyle(canvas).fontFamily || "'JetBrains Mono', monospace";
    staticLayer = createStaticLayer(canvas, field, COLS, ROWS, cellW, cellH, dpr, fontPx, fontFamily, pal);
  }

  function frame() {
    raf = 0;
    if (disposed || !ctx || !staticLayer) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);
    ctx.drawImage(staticLayer, 0, 0, width, HEIGHT);
    const fontFamily = getComputedStyle(canvas).fontFamily || "'JetBrains Mono', monospace";
    ctx.font = `${fontPx}px ${fontFamily}`;
    ctx.textBaseline = "top";
    const currentPal = pal; // capture palette for this frame
    let maxHeat = 0;
    for (let i = 0; i < heat.length; i++) {
      let currentHeat = heat[i];
      if (currentHeat < heatThreshold) continue;
      currentHeat *= heatDecay;
      heat[i] = currentHeat;
      if (currentHeat > maxHeat) maxHeat = currentHeat;
      const base = field[i];
      if (base === 0 && currentHeat < 0.2) continue;
      const idx = Math.min(ramp.length - 1, base + Math.round(currentHeat * 6));
      const mix = Math.min(1, currentHeat * currentPal.boost);
      const col = currentPal.base.map((baseColor, colorIdx) => Math.round(baseColor + (currentPal.hot[colorIdx] - baseColor) * mix));
      const colIdx = i % COLS;
      const rowIdx = (i / COLS) | 0;
      ctx.clearRect(colIdx * cellW, rowIdx * cellH, cellW, cellH);
      ctx.fillStyle = `rgb(${col.join(",")})`;
      ctx.fillText(ramp[idx], colIdx * cellW, rowIdx * cellH);
    }
    if (maxHeat >= heatThreshold) {
      raf = requestAnimationFrame(frame);
    } else {
      loopRunning = false;
    }
  }

  function ensureLoop() {
    if (!loopRunning && !disposed) {
      loopRunning = true;
      raf = requestAnimationFrame(frame);
    }
  }

  function stamp(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const colPos = (clientX - rect.left) / cellW;
    const rowPos = (clientY - rect.top) / cellH;
    const radius = heatRadius;
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const r = Math.round(rowPos + dr);
        const c = Math.round(colPos + dc);
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        const distSq = dr * dr + dc * dc;
        if (distSq > radius * radius) continue;
        const i = r * COLS + c;
        heat[i] = Math.min(1, heat[i] + Math.exp(-distSq / 3));
      }
    }
    ensureLoop();
  }

  function onMouse(e) { stamp(e.clientX, e.clientY); }
  function onTouch(e) {
    for (const t of Array.from(e.touches)) stamp(t.clientX, t.clientY);
  }
  function onResize() { layout(); ensureLoop(); }

  layout();
  ensureLoop();
  canvas.addEventListener("mousemove", onMouse);
  canvas.addEventListener("touchstart", onTouch, { passive: true });
  canvas.addEventListener("touchmove", onTouch, { passive: true });
  window.addEventListener("resize", onResize);

  const mo = new MutationObserver(() => { layout(); ensureLoop(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return {
    destroy() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      mo.disconnect();
      canvas.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("touchstart", onTouch);
      canvas.removeEventListener("touchmove", onTouch);
      window.removeEventListener("resize", onResize);
    },
  };
}