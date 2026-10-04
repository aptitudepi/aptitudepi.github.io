// js/spark.js — `spark` command: zero-dependency terminal-native twin of the
// `sparkline` panel. Renders the same jogruber contributions payload (fetched
// via js/sparkline.js — no second endpoint) as a Unicode block sparkline, or
// as a GitHub-style activity grid with `spark graph`.
import { ANSI_RESET, SITE_GREEN, SITE_MUTED } from './commands.js';
import { fetchContributionDays } from './sparkline.js';

const BLOCKS = '▁▂▃▄▅▆▇█';
const RAMP = '·░▒▓█';

// Block-sparkline + activity-grid binning adapted from microcharts (MIT,
// © 2026 Ganapati V S) — see src/charts/activity-grid/geometry.ts levelOf():
// 0 for ≤0/empty, else 1+floor(frac*(levels-1-ε)); all-positive span → top level.
// sanity (node -e verified): [0,5,10] → levels 0,4,7 ⇒ '▁▅█'.
const levelOf = (v, min, max, levels) => {
  if (v <= 0) return 0;
  if (max <= 0 || max === min) return levels - 1;
  const frac = (v - Math.max(0, min)) / (max - Math.max(0, min));
  return Math.min(levels - 1, Math.max(1, 1 + Math.floor(frac * (levels - 1 - 1e-9))));
};
const extent = (vals) => [Math.min(...vals), Math.max(...vals)];

// Weekly sums for the trailing `weeks` ISO weeks (oldest → newest), same
// bucketing sparkline.js uses.
function weeklySeries(days, weeks) {
  const byDate = new Map(days.map((d) => [d.date, d.count]));
  const today = new Date();
  const out = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    let sum = 0;
    for (let d = 6; d >= 0; d -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - (w * 7 + d));
      sum += Number(byDate.get(day.toISOString().slice(0, 10))) || 0;
    }
    out.push(sum);
  }
  return out;
}

function renderLine(term, days) {
  const values = weeklySeries(days, 26);
  const [min, max] = extent(values);
  const line = values.map((v) => BLOCKS[levelOf(v, min, max, BLOCKS.length)]).join('');
  term.writeln(`${SITE_GREEN}${line}${ANSI_RESET}`);
  term.writeln(`min ${String(min)} · max ${String(max)} weekly commits, last 26 weeks`);
}

// 7 rows (Sun→Sat) × N week columns, leading offset aligns slot 0 to the first
// day's weekday — the activity-grid geometry's calendar retrofit.
function renderGraph(term, days) {
  const tail = days.slice(-26 * 7);
  const values = tail.map((d) => Number(d.count) || 0);
  const [min, max] = extent(values);
  const offset = new Date(`${tail[0].date}T00:00:00Z`).getUTCDay();
  const cols = Math.ceil((values.length + offset) / 7);
  for (let row = 0; row < 7; row += 1) {
    let line = `${SITE_MUTED}${'SMTWTFS'[row]}${ANSI_RESET} `;
    for (let col = 0; col < cols; col += 1) {
      const slot = col * 7 + row - offset;
      if (slot < 0 || slot >= values.length) { line += ' '; continue; }
      const level = levelOf(values[slot], min, max, RAMP.length);
      line += `${level ? SITE_GREEN : SITE_MUTED}${RAMP[level]}${ANSI_RESET}`;
    }
    term.writeln(line);
  }
  const total = values.reduce((acc, v) => acc + v, 0);
  term.writeln(`${String(total)} commits, last 26 weeks (min ${min} · max ${max} per day)`);
}

export async function runSparkCommand(term, args, runSignal) {
  const days = await fetchContributionDays(runSignal);
  if (!days) {
    term.writeln(`${SITE_MUTED}spark: contributions unavailable right now — try again later${ANSI_RESET}`);
    return;
  }
  if (String(args[0] ?? '').toLowerCase() === 'graph') {
    renderGraph(term, days);
  } else {
    renderLine(term, days);
  }
}
