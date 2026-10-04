// js/pg-life.js — Conway's Game of Life playground module (WAVE: playground).
// Lazy-loaded by the unlisted `pg life` command (see js/commands.js), so its
// cost only lands when the visitor actually asks for it — same precedent as
// the ai.js / backgrounds.js dynamic imports in js/shell.js / js/commands.js.
//
// Renders straight into the xterm surface with ANSI truecolor and redraws the
// grid in place by moving the cursor back up GRID_HEIGHT lines each tick.

const GRID_WIDTH = 32;
const GRID_HEIGHT = 14;
const TICK_MILLIS = 140;
// ponytail: hard cap on generations so an unattended tab can't spin forever;
// raise or drop the cap if a longer-lived demo is ever wanted.
const MAX_GENERATIONS = 600;

const ANSI_RESET = '\x1b[0m';
const LIFE_ALIVE = '\x1b[38;2;60;200;120m';
const LIFE_DEAD = '\x1b[38;2;70;70;85m';
const LIFE_MUTED = '\x1b[38;2;140;140;155m';

function seedGrid() {
  const grid = Array.from({ length: GRID_HEIGHT }, () =>
    Array.from({ length: GRID_WIDTH }, () => (Math.random() < 0.22 ? 1 : 0)),
  );
  // Guarantee at least one glider so the demo always shows motion.
  const gliderOriginRow = 2;
  const gliderOriginCol = 2;
  grid[gliderOriginRow][gliderOriginCol + 1] = 1;
  grid[gliderOriginRow + 1][gliderOriginCol + 2] = 1;
  grid[gliderOriginRow + 2][gliderOriginCol] = 1;
  grid[gliderOriginRow + 2][gliderOriginCol + 1] = 1;
  grid[gliderOriginRow + 2][gliderOriginCol + 2] = 1;
  return grid;
}

function stepGrid(grid) {
  // Toroidal wrap: cells leaving one edge re-enter on the opposite edge.
  return grid.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      let neighbors = 0;
      for (let dRow = -1; dRow <= 1; dRow += 1) {
        for (let dCol = -1; dCol <= 1; dCol += 1) {
          if (dRow === 0 && dCol === 0) continue;
          const wrappedRow = (rowIndex + dRow + GRID_HEIGHT) % GRID_HEIGHT;
          const wrappedCol = (colIndex + dCol + GRID_WIDTH) % GRID_WIDTH;
          neighbors += grid[wrappedRow][wrappedCol];
        }
      }
      return cell ? (neighbors === 2 || neighbors === 3 ? 1 : 0) : (neighbors === 3 ? 1 : 0);
    }),
  );
}

function renderGrid(grid) {
  return grid
    .map((row) => row.map((cell) => (cell ? `${LIFE_ALIVE}█` : `${LIFE_DEAD}·`)).join('') + ANSI_RESET)
    .join('\r\n');
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runLife(term, runSignal) {
  let grid = seedGrid();
  term.writeln(`${LIFE_MUTED}conway's game of life — ${GRID_WIDTH}x${GRID_HEIGHT}, toroidal wrap. ctrl+c to stop.${ANSI_RESET}`);
  term.write(`\r\n${renderGrid(grid)}\r\n`);
  for (let generation = 1; generation <= MAX_GENERATIONS; generation += 1) {
    if (runSignal?.aborted) break;
    await sleep(TICK_MILLIS);
    grid = stepGrid(grid);
    // Redraw in place: up over the grid, then rewrite every row.
    term.write(`\x1b[${GRID_HEIGHT}A\r${renderGrid(grid)}\r\n`);
  }
  if (runSignal?.aborted) term.writeln(`\r\n${LIFE_MUTED}life: stopped${ANSI_RESET}`);
}

// Smallest runnable check: `node js/pg-life.js` verifies a blinker oscillates.
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('pg-life.js')) {
  // Blinker period-2 oscillator around the origin of an empty 14x32 grid.
  const empty = Array.from({ length: GRID_HEIGHT }, () => Array.from({ length: GRID_WIDTH }, () => 0));
  empty[0][0] = 1; empty[0][1] = 1; empty[0][2] = 1;
  const next = stepGrid(empty);
  if (!(next[GRID_HEIGHT - 1][1] === 1 && next[0][1] === 1 && next[1][1] === 1)) throw new Error('pg-life: blinker did not rotate');
  const back = stepGrid(next);
  if (!(back[0][0] === 1 && back[0][1] === 1 && back[0][2] === 1)) throw new Error('pg-life: blinker did not return');
  process.stdout.write('pg-life self-check ok\n');
}
