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
  const s = staticLayer.getContext("2d");
  if (!s) return null;
  s.scale(dpr, dpr);
  s.font = `${fontPx}px ${fontFamily}`;
  s.textBaseline = "top";
  s.fillStyle = `rgb(${pal.base.join(",")})`;
  for (let i = 0; i < field.length; i++) {
    if (field[i] === 0) continue;
    s.fillText(
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
    return { destroy: () => {} };
  }

  let W = 0, dpr = 1, cellW = 0, cellH = 0;
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
    W = canvas.parentElement?.clientWidth || canvas.clientWidth;
    cellW = fontPx * cellWidthRatio;
    cellH = fontPx * cellHeightRatio;
    COLS = Math.floor(W / cellW);
    ROWS = Math.floor(HEIGHT / cellH);
    if (field.length !== ROWS * COLS) {
      field = new Int8Array(ROWS * COLS);
      heat = new Float32Array(ROWS * COLS);
      for (let i = 0; i < field.length; i++) {
        const r = Math.random();
        field[i] = r < 0.55 ? 0 : 1 + Math.floor(Math.pow(Math.random(), 2) * 3);
      }
    }
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${HEIGHT}px`;

    pal = getPalette();
    const fontFamily = getComputedStyle(canvas).fontFamily || "'JetBrains Mono', monospace";
    staticLayer = createStaticLayer(canvas, field, COLS, ROWS, cellW, cellH, dpr, fontPx, fontFamily, pal);
  }

  function frame() {
    raf = 0;
    if (disposed || !ctx || !staticLayer) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, HEIGHT);
    ctx.drawImage(staticLayer, 0, 0, W, HEIGHT);
    const fontFamily = getComputedStyle(canvas).fontFamily || "'JetBrains Mono', monospace";
    ctx.font = `${fontPx}px ${fontFamily}`;
    ctx.textBaseline = "top";
    let maxHeat = 0;
    for (let i = 0; i < heat.length; i++) {
      let h = heat[i];
      if (h < heatThreshold) continue;
      h *= heatDecay;
      heat[i] = h;
      if (h > maxHeat) maxHeat = h;
      const base = field[i];
      if (base === 0 && h < 0.2) continue;
      const idx = Math.min(ramp.length - 1, base + Math.round(h * 6));
      const mix = Math.min(1, h * pal.boost);
      const col = pal.base.map((b, k) => Math.round(b + (pal.hot[k] - b) * mix));
      const c = i % COLS;
      const r = (i / COLS) | 0;
      ctx.clearRect(c * cellW, r * cellH, cellW, cellH);
      ctx.fillStyle = `rgb(${col.join(",")})`;
      ctx.fillText(ramp[idx], c * cellW, r * cellH);
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
    const col = (clientX - rect.left) / cellW;
    const row = (clientY - rect.top) / cellH;
    const R = heatRadius;
    for (let dr = -R; dr <= R; dr++) {
      for (let dc = -R; dc <= R; dc++) {
        const r = Math.round(row + dr);
        const c = Math.round(col + dc);
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        const d2 = dr * dr + dc * dc;
        if (d2 > R * R) continue;
        const i = r * COLS + c;
        heat[i] = Math.min(1, heat[i] + Math.exp(-d2 / 3));
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