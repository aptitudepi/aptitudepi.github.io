// js/sparkline.js — `sparkline` command (PR4): a small commit-activity
// sparkline panel pinned inside the terminal column. TradingView's
// lightweight-charts is pulled from jsDelivr on first use only (dynamic
// import, no bundling, nothing in vendor/); its license requires the
// "Powered by TradingView" attribution rendered in the panel footer.
import { combinedTimeoutSignal } from './fetch-timeout.js';
import { ANSI_RESET, SITE_GREEN, SITE_MUTED } from './commands.js';
import { sanitizeTerminalText } from './markdown.js';

// NB: must be the ES-module build (.mjs) — the standalone .js is a UMD bundle
// with no exports, so `createChart` would be undefined.
const CDN_URL = 'https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.0/dist/lightweight-charts.production.mjs';
const JGR_URL = 'https://github-contributions-api.jogruber.de/v4/aptitudepi';
const WEEKS = 26;
let chartsModulePromise = null;

const loadLightweightCharts = () =>
  (chartsModulePromise ??= import(/* webpackIgnore: true */ CDN_URL));

async function fetchWeeklyCounts(runSignal) {
  try {
    const res = await fetch(JGR_URL, { headers: { accept: 'application/json' }, signal: combinedTimeoutSignal(runSignal, 10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const days = Array.isArray(data.contributions) ? data.contributions : [];
    if (days.length === 0) throw new Error('empty contributions');
    const byDate = new Map(days.map((d) => [d.date, d.count]));
    const today = new Date();
    const weeks = [];
    for (let w = WEEKS - 1; w >= 0; w -= 1) {
      let sum = 0;
      let label = '';
      for (let d = 6; d >= 0; d -= 1) {
        const day = new Date(today);
        day.setDate(today.getDate() - (w * 7 + d));
        label = day.toISOString().slice(0, 10);
        sum += Number(byDate.get(label)) || 0;
      }
      weeks.push({ time: label, value: sum });
    }
    return weeks;
  } catch (error) {
    console.warn('sparkline: contributions fetch failed:', error.message);
    return null;
  }
}

function closePanel(panel) {
  panel?.remove();
}

export async function runSparklineCommand(term, runSignal) {
  const host = document.getElementById('terminal-container')?.parentElement;
  if (!host) {
    term.writeln(`${SITE_MUTED}sparkline: terminal host not mounted${ANSI_RESET}`);
    return;
  }
  host.querySelector('.sparkline-panel')?.remove();
  term.writeln(`${SITE_MUTED}loading lightweight-charts…${ANSI_RESET}`);
  let charts = null;
  try {
    charts = await loadLightweightCharts();
  } catch {
    term.writeln(`${SITE_MUTED}sparkline: could not load lightweight-charts from the CDN (offline?)${ANSI_RESET}`);
    return;
  }
  const data = await fetchWeeklyCounts(runSignal);
  if (!data) {
    term.writeln(`${SITE_MUTED}sparkline: contributions unavailable right now — try again later${ANSI_RESET}`);
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'sparkline-panel';
  panel.setAttribute('role', 'img');
  panel.setAttribute('aria-label', `Commit activity sparkline, last ${WEEKS} weeks`);
  const chartHost = document.createElement('div');
  chartHost.className = 'sparkline-chart';
  const caption = document.createElement('a');
  caption.className = 'sparkline-attribution';
  // Required by the lightweight-charts license: visible credit + link.
  caption.href = 'https://www.tradingview.com/';
  caption.target = '_blank';
  caption.rel = 'noopener noreferrer';
  caption.textContent = 'Powered by TradingView Lightweight Charts™';
  panel.append(chartHost, caption);
  host.appendChild(panel);

  const chart = charts.createChart(chartHost, {
    width: chartHost.clientWidth || 260,
    height: 96,
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: 'rgba(212,212,216,0.7)' },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    rightPriceScale: { visible: false },
    timeScale: { visible: false },
    crosshair: { visible: false },
  });
  chart.addAreaSeries({
    lineColor: '#50c878',
    topColor: 'rgba(80,200,120,0.35)',
    bottomColor: 'rgba(80,200,120,0.02)',
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
  }).setData(data);
  chart.timeScale().fitContent();

  const totalCount = data.reduce((sum, wk) => sum + wk.value, 0);
  term.writeln(`${SITE_GREEN}sparkline: ${sanitizeTerminalText(String(totalCount))} contributions over the last ${WEEKS} weeks${ANSI_RESET}`);
  panel.addEventListener('click', () => closePanel(panel));
  const onKey = (event) => { if (event.key === 'Escape') { closePanel(panel); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}
