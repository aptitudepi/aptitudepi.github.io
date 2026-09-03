// thermal-ascii.js — colored ASCII portrait that glows under the cursor.
// A vanilla, dependency-free canvas effect. It renders a cell grid (by default
// the site's neofetch portrait) and, as you move the cursor across it, stamps
// "heat" that decays each frame and lerps the stuck glyphs toward the site
// accent — a warm, living terminal-print feel.
//
// Two modes:
//   • portrait (default): options.art = array of ANSI 38;2;R;G;B strings
//     (e.g. shell.js's ASCII_ART). Glyphs + true colors are decoded so the
//     portrait renders at its native 30×60 geometry, recolored by the palette.
//   • spaRse noise fallback: same heat behaviour over a sparse glyph field,
//     used when no art is supplied (kept for the old look).

const RAMP = " `.:-=+*cs#%@";
const HEIGHT = 240; // CSS px height for the sparse-noise fallback mode

// Site accent — matched to --color-primary (oklch .45 .31 264 ≈ indigo/blue).
const ACCENT = [130, 156, 255];
const ACCENT_HOT = [235, 242, 255];

function getPalette() {
  const dark = document.documentElement.dataset.theme === "dark";
  return dark
    ? { base: [86, 94, 103], hot: ACCENT_HOT, boost: 1.5 }
    : { base: [150, 158, 168], hot: ACCENT, boost: 2.6 };
}

// Parse one ANSI fragment into { glyph, r, g, b }. Each fragment is a run of
// <ESC[38;2;R;G;Bm> + a single glyph <ESC[0m> (the line is split on ESC[0m
// in parseAnsiArt). We avoid putting the ESC control char in a regex literal
// (JS-0004) by stripping the prefix with a string compare instead.
const ESC_CHAR = String.fromCharCode(27);
const FRAG_PREFIX = `${ESC_CHAR}[38;2;`;
const COLOR_RE = /^(\d+);(\d+);(\d+)m([\s\S])$/u;

function parseFragment(frag) {
  if (!frag.startsWith(FRAG_PREFIX)) return null;
  const colorMatch = frag.slice(FRAG_PREFIX.length).match(COLOR_RE);
  if (!colorMatch) return null;
  return {
    glyph: colorMatch[4],
    r: Number(colorMatch[1]),
    g: Number(colorMatch[2]),
    b: Number(colorMatch[3]),
  };
}

// Decode an array of ANSI art lines into { cols, rows, cells: {glyph,r,g,b}[] }.
export function parseAnsiArt(artLines) {
  const rows = [];
  for (const line of artLines) {
    const row = [];
    // Split into <ESC[38;2;R;G;Bm> + single char + <ESC[0m> runs
    const toks = line.split('\u001b[0m');
    for (const tok of toks) {
      const frag = parseFragment(tok);
      if (frag) row.push(frag);
    }
    rows.push(row);
  }
  const cols = rows.reduce((max, r) => Math.max(max, r.length), 0);
  return { cols, rows: rows.length, cells: rows };
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
    art = null, // array of ANSI lines (shell.js ASCII_ART) — portrait mode
  } = options;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.warn("thermal-ascii: no 2D context");
    return { destroy() { /* no-op */ } };
  }

  let width = 0, dispW = 0, dispH = 0, dpr = 1, cellW = 0, cellH = 0;
  let renderFontPx = fontPx; // actual font size used for glyphs
  let COLS = 0, ROWS = 0;
  let field = new Int8Array(0);
  let baseColors = null;   // Float32Array R*G*B per cell (portrait mode)
  let glyphs = null;       // Array of cell chars (portrait mode)
  let heat = new Float32Array(0);
  let pal = getPalette();
  let staticLayer = null;
  let raf = 0;
  let loopRunning = false;
  let disposed = false;
  let fontFamily = "'JetBrains Mono', ui-monospace, monospace";

  // Portrait mode: decode the art once into a cell grid.
  let artGrid = null;
  if (art && Array.isArray(art)) {
    const decoded = parseAnsiArt(art);
    if (decoded && decoded.rows > 0 && decoded.cols > 0) artGrid = decoded;
  }
  const portraitMode = Boolean(artGrid);

  function getFont() {
    fontFamily = getComputedStyle(canvas).fontFamily || "'JetBrains Mono', ui-monospace, monospace";
  }

  function layout() {
    if (!canvas) return;
    getFont();
    width = canvas.parentElement?.clientWidth || canvas.clientWidth;

    if (portraitMode) {
      // Size the canvas to the container width while keeping the portrait
      // aspect so every column/row of the 60×30 art renders (no wrap, no cut).
      cellW = width / artGrid.cols;
      cellH = cellW / cellWidthRatio * cellHeightRatio; // keep glyph aspect
      // If column is too tall for the space, cap by height instead.
      const maxH = canvas.parentElement?.clientHeight || (window.innerHeight * 0.7);
      if (cellH * artGrid.rows > maxH) {
        cellH = maxH / artGrid.rows;
        cellW = cellH / cellHeightRatio * cellWidthRatio;
      }
      renderFontPx = cellW / cellWidthRatio; // glyph advance ≈ cellW
      COLS = artGrid.cols;
      ROWS = artGrid.rows;
      const bufW = Math.round(COLS * cellW);
      const bufH = Math.round(ROWS * cellH);

      if (field.length !== ROWS * COLS) {
        field = new Int8Array(ROWS * COLS);
        heat = new Float32Array(ROWS * COLS);
        baseColors = new Float32Array(ROWS * COLS * 3);
        glyphs = new Array(ROWS * COLS);
        for (let r = 0; r < ROWS; r++) {
          const rowCells = artGrid.cells[r] || [];
          for (let c = 0; c < COLS; c++) {
            const cellInfo = rowCells[c] || { glyph: ' ', r: 0, g: 0, b: 0 };
            const i = r * COLS + c;
            glyphs[i] = cellInfo.glyph;
            baseColors[i * 3] = cellInfo.r;
            baseColors[i * 3 + 1] = cellInfo.g;
            baseColors[i * 3 + 2] = cellInfo.b;
            field[i] = cellInfo.glyph === ' ' ? 0 : 1;
          }
        }
      }

      dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.round(bufW * dpr);
      canvas.height = Math.round(bufH * dpr);
      canvas.style.width = `${bufW}px`;
      canvas.style.height = `${bufH}px`;
      dispW = bufW;
      dispH = bufH;
    } else {
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
      dispW = width;
      dispH = HEIGHT;
    }

    pal = getPalette();
    staticLayer = createStaticLayer();
  }

  function createStaticLayer() {
    const layer = document.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    const layerCtx = layer.getContext("2d");
    if (!layerCtx) return null;
    layerCtx.scale(dpr, dpr);
    layerCtx.font = `${renderFontPx}px ${fontFamily}`;
    layerCtx.textBaseline = "top";
    for (let i = 0; i < field.length; i++) {
      if (field[i] === 0) continue;
      const colIdx = i % COLS;
      const rowIdx = (i / COLS) | 0;
      if (portraitMode) {
        layerCtx.fillStyle = `rgb(${baseColors[i * 3] | 0},${baseColors[i * 3 + 1] | 0},${baseColors[i * 3 + 2] | 0})`;
        layerCtx.fillText(glyphs[i], colIdx * cellW, rowIdx * cellH);
      } else {
        layerCtx.fillStyle = `rgb(${pal.base.join(",")})`;
        layerCtx.fillText(ramp[field[i]], colIdx * cellW, rowIdx * cellH);
      }
    }
    return layer;
  }

  function frame() {
    raf = 0;
    if (disposed || !ctx || !staticLayer) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dispW, dispH);
    ctx.drawImage(staticLayer, 0, 0, dispW, dispH);
    ctx.font = `${renderFontPx}px ${fontFamily}`;
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
      const colIdx = i % COLS;
      const rowIdx = (i / COLS) | 0;
      const mix = Math.min(1, currentHeat * currentPal.boost);
      if (portraitMode) {
        const baseR = baseColors[i * 3];
        const baseG = baseColors[i * 3 + 1];
        const baseB = baseColors[i * 3 + 2];
        const col = [
          Math.round(baseR + (currentPal.hot[0] - baseR) * mix),
          Math.round(baseG + (currentPal.hot[1] - baseG) * mix),
          Math.round(baseB + (currentPal.hot[2] - baseB) * mix),
        ];
        ctx.clearRect(colIdx * cellW, rowIdx * cellH, cellW, cellH);
        ctx.fillStyle = `rgb(${col.join(",")})`;
        ctx.fillText(glyphs[i], colIdx * cellW, rowIdx * cellH);
      } else {
        const idx = Math.min(ramp.length - 1, base + Math.round(currentHeat * 6));
        const col = currentPal.base.map((baseColor, colorIdx) => Math.round(baseColor + (currentPal.hot[colorIdx] - baseColor) * mix));
        ctx.clearRect(colIdx * cellW, rowIdx * cellH, cellW, cellH);
        ctx.fillStyle = `rgb(${col.join(",")})`;
        ctx.fillText(ramp[idx], colIdx * cellW, rowIdx * cellH);
      }
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
        const rowIdx = Math.round(rowPos + dr);
        const colIdx = Math.round(colPos + dc);
        if (rowIdx < 0 || rowIdx >= ROWS || colIdx < 0 || colIdx >= COLS) continue;
        const distSq = dr * dr + dc * dc;
        if (distSq > radius * radius) continue;
        const i = rowIdx * COLS + colIdx;
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