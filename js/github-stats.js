const USER = 'aptitudepi';
const JGR = `https://github-contributions-api.jogruber.de/v4/${USER}`;
const GH_API = 'https://api.github.com';
const CACHE_KEY = 'gh-stats-cache';
const CACHE_TTL = 6 * 3600 * 1000;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LEVEL_CLASSES = ['lvl-0', 'lvl-1', 'lvl-2', 'lvl-3', 'lvl-4'];
const RADAR_KEYS = ['prs', 'issues', 'reviews', 'commits', 'stars', 'followers'];

const ok = r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`));

async function fetchContributions() {
  const j = await (await fetch(JGR, { headers: { accept: 'application/json' } })).json();
  const total = j.total || {};
  const allTime = Object.values(total).reduce((s, n) => s + (Number(n) || 0), 0);
  return { total, allTime, contributions: Array.isArray(j.contributions) ? j.contributions : [] };
}

async function fetchRadarAxes() {
  const [user, repos, prs, issues, reviews] = await Promise.all([
    fetch(`${GH_API}/users/${USER}`).then(ok).catch(() => null),
    fetch(`${GH_API}/users/${USER}/repos?per_page=100`).then(ok).catch(() => null),
    fetch(`${GH_API}/search/issues?q=${encodeURIComponent(`type:pr author:${USER}`)}`).then(ok).catch(() => null),
    fetch(`${GH_API}/search/issues?q=${encodeURIComponent(`type:issue author:${USER}`)}`).then(ok).catch(() => null),
    fetch(`${GH_API}/search/issues?q=${encodeURIComponent(`type:pr reviewed-by:${USER}`)}`).then(ok).catch(() => null),
  ]);
  const stars = (Array.isArray(repos) ? repos : []).reduce((s, r) => s + (Number(r.stargazers_count) || 0), 0);
  return {
    prs: prs && Number.isFinite(prs.total_count) ? prs.total_count : null,
    issues: issues && Number.isFinite(issues.total_count) ? issues.total_count : null,
    reviews: reviews && Number.isFinite(reviews.total_count) ? reviews.total_count : null,
    stars: Number.isFinite(stars) ? stars : null,
    followers: user && Number.isFinite(user.followers) ? user.followers : null,
  };
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return Date.now() - c.ts < CACHE_TTL ? c.data : null;
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function levelFor(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  return 4;
}

function renderHeatmap(host, data) {
  const grid = host.querySelector('.gh-heatmap');
  const totalsEl = host.querySelector('.gh-totals');
  if (!grid) return;

  const byDate = new Map(data.contributions.map(c => [c.date, c.count]));

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 52 * 7);
  start.setDate(start.getDate() - start.getDay());

  const weeks = [];
  let cursor = new Date(start);
  while (cursor <= today) {
    const week = [];
    for (let r = 0; r < 7; r++) {
      const d = new Date(cursor);
      d.setDate(d.getDate() + r);
      week.push(d);
    }
    weeks.push(week);
    cursor.setDate(cursor.getDate() + 7);
  }
  const cols = weeks.length;

  let lastMonth = -1;
  const monthCells = weeks.map(week => {
    const m = week[0].getMonth();
    const changed = m !== lastMonth;
    lastMonth = m;
    return changed ? MONTHS[m] : '';
  });

  grid.innerHTML = '';
  const monthsRow = document.createElement('div');
  monthsRow.className = 'gh-months';
  monthsRow.style.gridTemplateColumns = `repeat(${cols}, var(--gh-cell))`;
  monthCells.forEach(label => {
    const c = document.createElement('span');
    c.className = 'gh-month' + (label ? ' is-label' : '');
    c.textContent = label;
    monthsRow.appendChild(c);
  });

  const body = document.createElement('div');
  body.className = 'gh-body';

  const wd = document.createElement('div');
  wd.className = 'gh-weekdays';
  const wdLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  wdLabels.forEach((t, i) => {
    const el = document.createElement('span');
    el.className = 'gh-weekday';
    el.dataset.row = i;
    el.textContent = t;
    wd.appendChild(el);
  });

  const gridEl = document.createElement('div');
  gridEl.className = 'gh-grid';
  const frag = document.createDocumentFragment();
  weeks.forEach(week => week.forEach(d => {
    const day = fmt(d);
    const count = byDate.get(day) || 0;
    const cell = document.createElement('span');
    cell.className = `gh-cell ${LEVEL_CLASSES[levelFor(count)]}`;
    cell.title = `${day}: ${count} contribution${count === 1 ? '' : 's'}`;
    frag.appendChild(cell);
  }));
  gridEl.appendChild(frag);
  body.appendChild(wd);
  body.appendChild(gridEl);

  const legend = document.createElement('div');
  legend.className = 'gh-legend';
  const legLabel = document.createElement('span');
  legLabel.className = 'gh-legend-cap';
  legLabel.textContent = 'Number of GitHub contributions';
  legend.appendChild(legLabel);
  const legStart = document.createElement('span');
  legStart.className = 'gh-legend-cap';
  legStart.textContent = 'Less';
  legend.appendChild(legStart);
  LEVEL_CLASSES.forEach(lc => {
    const s = document.createElement('span');
    s.className = `gh-cell gh-swatch ${lc}`;
    legend.appendChild(s);
  });
  const legEnd = document.createElement('span');
  legEnd.className = 'gh-legend-cap';
  legEnd.textContent = 'More';
  legend.appendChild(legEnd);

  grid.appendChild(monthsRow);
  grid.appendChild(body);
  grid.appendChild(legend);

  if (totalsEl && data.allTime) {
    const year = String(today.getFullYear());
    const thisYear = data.total && data.total[year];
    totalsEl.textContent = `${data.allTime.toLocaleString()} contributions · ` +
      (thisYear ? `${Number(thisYear).toLocaleString()} in ${year}` : '');
  }

  body.style.setProperty('--gh-cols', String(cols));
}

function renderRadar(host, data) {
  const slot = host.querySelector('.gh-radar');
  if (!slot) return;

  const values = { ...data };
  const sqrt = v => Math.sqrt(Math.max(Number(v) || 0, 0));
  const maxSqrt = Math.max(...RADAR_KEYS.map(k => sqrt(values[k])));
  const ratio = k => maxSqrt ? sqrt(values[k]) / maxSqrt : 0;
  const labels = { prs: 'Pull Requests', issues: 'Issues', reviews: 'Code Reviews', commits: 'Commits', stars: 'Stars', followers: 'Followers' };
  const fmt = k => String(values[k] && isFinite(values[k]) ? values[k].toLocaleString() : '0');

  const N = RADAR_KEYS.length;
  const W = 320, H = 280, CX = W / 2, CY = 142, R = 86;
  const angle = i => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (i, f) => [CX + R * f * Math.cos(angle(i)), CY + R * f * Math.sin(angle(i))];
  const ring = f => RADAR_KEYS.map((_, i) => pt(i, f).join(',')).join(' ');
  const poly = RADAR_KEYS.map((k, i) => pt(i, ratio(k)).join(',')).join(' ');

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub activity radar with ${N} axes">`;
  svg += `<defs><linearGradient id="ghRad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0000FF"/><stop offset="100%" stop-color="#FF0000"/></linearGradient></defs>`;
  [0.25, 0.5, 0.75, 1].forEach(f => { svg += `<polygon points="${ring(f)}" class="gh-radar-ring"/>`; });
  RADAR_KEYS.forEach((k, i) => {
    const [x, y] = pt(i, 1);
    svg += `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" class="gh-radar-spoke"/>`;
    const ca = Math.cos(angle(i));
    const anchor = Math.abs(ca) < 0.2 ? 'middle' : (ca > 0 ? 'start' : 'end');
    const lx = CX + (R + 24) * ca;
    const ly = CY + (R + 24) * Math.sin(angle(i)) + 4;
    const vx = CX + (R + 40) * ca;
    const vy = CY + (R + 40) * Math.sin(angle(i)) + 4;
    svg += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${anchor}" class="gh-radar-label">${labels[k]}</text>`;
    svg += `<text x="${vx.toFixed(2)}" y="${vy.toFixed(2)}" text-anchor="${anchor}" class="gh-radar-value">${fmt(k)}</text>`;
  });
  svg += `<polygon points="${poly}" class="gh-radar-poly"/>`;
  svg += `</svg>`;
  slot.innerHTML = svg;
}

function markUnavailable(host, sel, msg) {
  const el = host.querySelector(sel);
  if (el) {
    el.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'gh-unavailable';
    p.textContent = msg;
    el.appendChild(p);
  }
}

export function initGitHubStats() {
  const host = document.querySelector('[data-github-stats]');
  if (!host) return;

  const cached = readCache();
  if (cached) {
    if (cached.contributions) renderHeatmap(host, cached.contributions);
    if (cached.radar) renderRadar(host, cached.radar);
    return;
  }

  Promise.all([fetchContributions().catch(() => null), fetchRadarAxes().catch(() => null)]).then(([contrib, axes]) => {
    if (contrib) {
      renderHeatmap(host, contrib);
    } else {
      markUnavailable(host, '.gh-heatmap', 'GitHub contribution data is temporarily unavailable.');
    }
    if (axes && contrib) {
      renderRadar(host, { ...axes, commits: contrib.allTime });
    } else {
      markUnavailable(host, '.gh-radar', 'GitHub activity data is temporarily unavailable.');
    }
    if (contrib || axes) writeCache({ contributions: contrib, radar: axes && contrib ? { ...axes, commits: contrib.allTime } : null });
  });
}