// thermal-ascii.js — colored ASCII portrait that SHIMMERS under the cursor.
// A vanilla, framework-free canvas effect. It renders a cell grid (by default
// the site's neofetch portrait) and, as you move the cursor across it, stamps
// "heat" that decays each frame. A hot cell SCRAMBLES — its glyph gains weight
// through the ramp (. → + → @) — and its colour lerps toward the site's live
// --nav-cycle tone (blue↔red), so the flare moves in phase with the nav bar.
//
// Two modes:
//   • portrait (default): options.art = array of art lines (shell.js's
//     ASCII_ART). Lines may be ANSI 38;2;R;G;B runs (true colours) OR plain
//     braille (a detailed headshot) — blank braille keeps transparency while
//     drawn cells get a gray shaded by dot density; heat scrambles the cells.
//   • spaRse noise fallback: same heat behaviour over a sparse glyph field,
//     used when no art is supplied (kept for the old look).

const RAMP = " `.:-=+*cs#%@";
// Bengali shimmer ramp: blank, singular do (দ) and bo (ব), then every
// ordered do/bo conjunct pairing — dda (দ্দ), dba (দ্ব), bda (ব্দ),
// bba (ব্ব) — with dba doubled as the finale. Each conjunct is multiple
// code units, so ALWAYS index this via segmentRamp() below: plain string
// indexing would land inside a ligature and paint dangling fragments.
export const RAMP_BENGALI = ' দবদ্দব্দব্বদ্বদ্ব';

// Split a ramp string into visual graphemes (one entry per rendered unit)
// so multi-unit ligatures are never split. Intl.Segmenter keeps each
// conjunct (e.g. দ্ব = দ + ্ + ব) whole per UTS-18 grapheme rules.
let rampSegmenter = null;
export function segmentRamp(rampStr) {
  try {
    if (!rampSegmenter) rampSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(rampSegmenter.segment(rampStr), (s) => s.segment);
  } catch (_) {
    return Array.from(rampStr);
  }
}
const HEIGHT = 240; // CSS px height for the sparse-noise fallback mode

// Fallback flare colour when the site's --nav-cycle can't be read yet (e.g.
// before the nav bar mounts). Kept as a dim neutral so the field still flares.
const CYCLE_FALLBACK = [205, 214, 244];

function getPalette() {
  const dark = document.documentElement.dataset.theme === "dark";
  // base: quiet glyph ink. hot: filled live from --nav-cycle each frame; the
  // boost is the light-page inversion (the cursor BURNS the paper darker).
  return dark
    ? { base: [88, 96, 105], boost: 1.4 }
    : { base: [175, 184, 193], boost: 2.4 };
}

// Parse an arbitrary CSS colour string into an [r,g,b] triple (0-255) using a
// tiny cached 1x1 canvas, mirroring topolines.parseColor. Returns null when the
// string is empty/invalid so the caller can fall back to a static baseline.
let cssParseCtx = null;
const colorCache = new Map();
function parseColorToRgb(colorStr) {
  const cached = colorCache.get(colorStr);
  if (cached) return cached;
  if (!cssParseCtx) {
    if (typeof document === "undefined") return null;
    const cv = document.createElement("canvas");
    cv.width = 1;
    cv.height = 1;
    cssParseCtx = cv.getContext("2d", { willReadFrequently: true });
  }
  if (!cssParseCtx) return null;
  cssParseCtx.clearRect(0, 0, 1, 1);
  cssParseCtx.fillStyle = colorStr;
  cssParseCtx.fillRect(0, 0, 1, 1);
  const data = cssParseCtx.getImageData(0, 0, 1, 1).data;
  const rgb = [data[0], data[1], data[2]];
  colorCache.set(colorStr, rgb);
  return rgb;
}

// Read the site's live --nav-cycle colour (blue<->red on .doc-nav). Returns an
// [r,g,b] triple, or the fallback when the cycle can't be resolved.
function readCycleColor(navEl) {
  if (navEl) {
    const raw = getComputedStyle(navEl).getPropertyValue("--nav-cycle").trim();
    if (raw) {
      const rgb = parseColorToRgb(raw);
      if (rgb) return rgb;
    }
  }
  return CYCLE_FALLBACK;
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

// Exactly how many dots a braille char stamps (0-8). Used to shade a plain
// (monochrome) art: the denser the glyph, the brighter its resting ink, so the
// headshot keeps dimensionality before the cursor even passes over it.
function brailleDotCount(ch) {
  const codePoint = ch.codePointAt(0);
  if (codePoint < 0x2800 || codePoint > 0x28ff) return 0; // not a braille cell (space etc.)
  let bits = codePoint - 0x2800;
  let count = 0;
  // U+2800 blank braille has 0 dots -> treated as transparent background.
  while (bits !== 0) {
    count += bits & 1;
    bits >>= 1;
  }
  return count;
}

// Decode an array of art lines into { cols, rows, cells: {glyph,r,g,b}[] }.
// Each line is either ANSI-colorized (38;2 runs) OR plain braille (a headshot):
//   • ANSI  -> true colors come straight from the escape codes.
//   • plain -> blank cells stay transparent (field 0) at their native grid
//              position; drawn cells get a neutral gray whose value scales with
//              braille dot density (dimmer shadows, brighter faces), so the
//              headshot reads before heat colours it in.
export function parseAnsiArt(artLines) {
  const rows = [];
  for (const line of artLines) {
    const row = [];
    if (line.includes(FRAG_PREFIX)) {
      // Split into <ESC[38;2;R;G;Bm> + single char + <ESC[0m> runs
      const toks = line.split('\u001b[0m');
      for (const tok of toks) {
        const frag = parseFragment(tok);
        if (frag) row.push(frag);
      }
    } else {
      for (const ch of line) {
        const dots = brailleDotCount(ch);
        if (dots === 0) {
          // Blank braille / space -> keep the cell position but mark it empty
          // (field 0) so nothing draws yet the grid geometry stays intact.
          row.push({ glyph: ' ', r: 0, g: 0, b: 0 });
        } else {
          // Base gray from 68 (sparse edges) up to 152 (dense highlights).
          const gray = Math.round(68 + (dots / 8) * 84);
          row.push({ glyph: ch, r: gray, g: gray, b: gray });
        }
      }
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

  // Grapheme steps for the active ramp (see RAMP_BENGALI note above): one
  // entry per rendered unit, so conjuncts stay whole when indexed below.
  const rampGlyphs = segmentRamp(ramp);

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
  let hotColor = readCycleColor(document.querySelector('.doc-nav')); // live --nav-cycle
  let navEl = document.querySelector('.doc-nav');
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
      // aspect so every column/row of the art renders (no wrap, no cut).
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
    navEl = document.querySelector('.doc-nav');
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
        layerCtx.fillText(rampGlyphs[field[i]] ?? ' ', colIdx * cellW, rowIdx * cellH);
      }
    }
    return layer;
  }

  function frame() {
    raf = 0;
    if (disposed || !ctx || !staticLayer) return;
    // Track the site's live --nav-cycle so the flare colour moves with the bar.
    hotColor = readCycleColor(navEl) || hotColor;
    const darkTheme = document.documentElement.dataset.theme === "dark";
    // On a dark page the cursor flares toward the cycle colour; on a light page
    // it BURNS the paper — grey down to pure black (steep mix, contrast reads
    // weaker on white).
    const hotTarget = darkTheme ? hotColor : [0, 0, 0];
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
      // Character scramble: a heated glyph gains WEIGHT through the ramp
      // (`.`` becomes `+` becomes `@`) as heat rises — on the portrait too.
      const scrambleIdx = Math.min(rampGlyphs.length - 1, base + Math.round(currentHeat * 6));
      const scrambleGlyph = rampGlyphs[scrambleIdx];
      // Lerp the cell's ink toward the live nav-cycle flare (or burn to black
      // on a light page). Portrait cells start from their decoded colour;
      // noise cells start from the shared base grey.
      const col = portraitMode
        ? [
            Math.round(baseColors[i * 3] + (hotTarget[0] - baseColors[i * 3]) * mix),
            Math.round(baseColors[i * 3 + 1] + (hotTarget[1] - baseColors[i * 3 + 1]) * mix),
            Math.round(baseColors[i * 3 + 2] + (hotTarget[2] - baseColors[i * 3 + 2]) * mix),
          ]
        : currentPal.base.map((baseColor, colorIdx) => Math.round(baseColor + (hotTarget[colorIdx] - baseColor) * mix));
      ctx.clearRect(colIdx * cellW, rowIdx * cellH, cellW, cellH);
      ctx.fillStyle = `rgb(${col.join(",")})`;
      ctx.fillText(scrambleGlyph, colIdx * cellW, rowIdx * cellH);
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