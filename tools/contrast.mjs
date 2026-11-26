#!/usr/bin/env node
// tools/contrast.mjs — WCAG contrast gate for the shared colour tokens.
//
// Reads the --color-* values from css/tokens.css (and the two --nav-cycle
// stops from css/nav.css), converts OKLCH/hex to sRGB, and checks the pairs
// that carry text or UI meaning against the page background. Dependency-free
// (node:fs/node:path only). Exits 1 when a pair misses its threshold.
//
// Usage: npm run assert:contrast

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const TOKENS = readFileSync(join(ROOT, 'css/tokens.css'), 'utf8');
const NAV = readFileSync(join(ROOT, 'css/nav.css'), 'utf8');

// OKLCH → OKLab → linear sRGB (Björn Ottosson's matrices), clipped to the
// sRGB gamut exactly as the browser does before it displays the colour.
function toLinearSrgb(value) {
  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(value);
  if (oklch) {
    const [lightness, chroma, hue] = oklch.slice(1).map(Number);
    const a = chroma * Math.cos((hue * Math.PI) / 180);
    const b = chroma * Math.sin((hue * Math.PI) / 180);
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    return [0, 2, 4].map((offset) => {
      const channel = parseInt(hex[1].slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
  }
  throw new Error(`contrast: unsupported colour value ${JSON.stringify(value)}`);
}

const clip = (channel) => Math.min(1, Math.max(0, channel));

function luminance(value) {
  const [r, g, b] = toLinearSrgb(value).map(clip);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground, background) {
  const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

function token(source, name) {
  const match = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(source);
  if (!match) throw new Error(`contrast: token --${name} not found`);
  return match[1].trim();
}

const BACKGROUND = token(TOKENS, 'color-bg');

// The cycle runs blue → red → blue; both extremes paint the wordmark/crumb
// hover + focus colour, so both must stay usable as a focus indicator.
const CYCLE_STOPS = [...new Set([...NAV.matchAll(/--nav-cycle:\s*(#[0-9a-f]{6})/gi)].map((match) => match[1]))];

const PAIRS = [
  { label: 'body text', foreground: token(TOKENS, 'color-text'), background: BACKGROUND, min: 4.5 },
  { label: 'secondary text', foreground: token(TOKENS, 'color-text-muted'), background: BACKGROUND, min: 4.5 },
  { label: 'faint text', foreground: token(TOKENS, 'color-text-faint'), background: BACKGROUND, min: 4.5 },
  { label: 'primary link', foreground: token(TOKENS, 'color-primary'), background: BACKGROUND, min: 4.5 },
  { label: 'focus ring', foreground: token(TOKENS, 'color-primary'), background: BACKGROUND, min: 3 },
  ...CYCLE_STOPS.map((stop) => ({ label: `nav-cycle ${stop}`, foreground: stop, background: BACKGROUND, min: 3 })),
];

let failures = 0;
for (const pair of PAIRS) {
  const measured = ratio(pair.foreground, pair.background);
  const passing = measured >= pair.min;
  if (!passing) failures += 1;
  process.stdout.write(
    `${passing ? 'ok  ' : 'FAIL'} ${pair.label}: ${pair.foreground} on ${pair.background} = ${measured.toFixed(2)}:1 (min ${pair.min}:1)\n`,
  );
}

if (failures > 0) {
  process.stderr.write(`assert-contrast: ${failures} pair(s) below WCAG minimum\n`);
  process.exit(1);
}
process.stdout.write('assert-contrast: all pairs pass\n');
