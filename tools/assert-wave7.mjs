#!/usr/bin/env node
// tools/assert-wave7.mjs — acceptance evidence for WAVE 7 (palette, guided
// mode, suggestions, VM entry). Two halves:
//
//   UNIT (no browser): registry-driven palette arg preservation, vm
//   help/plain copy, guided actions resolving via the registry, abortable
//   boot + retry copy present in the VM launcher.
//
//   BROWSER (playwright, local server): palette opens on Ctrl+K with grouped
//   rows + EXAMPLES footer, Enter keeps full args, Esc restores focus,
//   unknown input never silently closes, guided button output equals typed
//   output, MODE pill syncs via setMode, ghost suggestions accept, Ctrl+R
//   history search opens, VM boot aborts cleanly via the foreground runner.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The shell modules assume browser globals at import time (window owner
// hook, navigator sniff, prefetched-location fetch). Stub the smallest
// surface that keeps the unit half hermetic; the real fetch is restored
// before the browser half serves the page.
globalThis.window = globalThis.window ?? {};
// Node 26 ships a read-only global navigator; the shell modules only read
// it inside try/catch, so no stub is needed.
const realFetch = globalThis.fetch;
globalThis.fetch = () => Promise.reject(new Error('network disabled in wave7 unit asserts'));

const {
  COMMAND_REGISTRY,
  resolveCommand,
} = await import('../js/commands.js');
const { filterPaletteEntries, buildPaletteLine } = await import('../js/palette.js');
const { GUIDED_ACTIONS } = await import('../js/guided.js');

globalThis.fetch = realFetch;

const TOOL_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(TOOL_DIRECTORY, '..');
const SERVER_PORT = Number(process.env.WAVE7_PORT || '8903');
const SERVER_ORIGIN = `http://127.0.0.1:${SERVER_PORT}`;

let failureCount = 0;

function check(condition, label) {
  if (condition) {
    process.stdout.write(`ok: ${label}\n`);
  } else {
    failureCount += 1;
    process.stderr.write(`FAIL: ${label}\n`);
  }
}

// ── UNIT ────────────────────────────────────────────────────────────────
const allEntries = filterPaletteEntries('');
check(allEntries.length === COMMAND_REGISTRY.length, `palette lists every registry entry (${allEntries.length})`);

const weatherTop = filterPaletteEntries('weath')[0];
check(weatherTop?.name === 'weather', `fuzzy 'weath' ranks weather first (saw ${weatherTop?.name})`);

const linuxTop = filterPaletteEntries('linux')[0];
check(linuxTop?.name === 'vm', `fuzzy 'linux' ranks vm first (saw ${linuxTop?.name})`);

const manEntry = resolveCommand('man');
const searchEntry = resolveCommand('search');
const aiEntry = resolveCommand('ai');
check(buildPaletteLine(manEntry, 'man ai') === 'man ai', `palette keeps 'man ai' args verbatim`);
check(buildPaletteLine(searchEntry, 'search terminal portfolios') === 'search terminal portfolios', `palette keeps 'search <q>' args verbatim`);
check(buildPaletteLine(aiEntry, 'ai what did Devkumar research?') === 'ai what did Devkumar research?', `palette keeps 'ai <prompt>' args verbatim`);
check(buildPaletteLine(searchEntry, 'man ai') === 'search ai', `palette carries trailing args onto a picked row`);
check(buildPaletteLine(resolveCommand('weather'), '') === 'weather', `palette falls back to the row example on empty input`);

const vmEntry = resolveCommand('vm');
check(vmEntry?.plain === 'Run Linux in your browser (5–15s to boot)', `vm plain states the boot expectation`);
check(vmEntry?.helpDesc === 'Run Linux in your browser (5–15s to boot)', `vm help states the boot expectation`);

let guidedProblem = false;
for (const guidedAction of GUIDED_ACTIONS) {
  if (guidedAction.command === null) continue;
  const actionHead = guidedAction.command.trim().split(/\s+/)[0];
  if (!resolveCommand(actionHead)) {
    guidedProblem = true;
    process.stderr.write(`  guided action '${guidedAction.label}' head '${actionHead}' does not resolve\n`);
  }
}
check(!guidedProblem, `every guided button command resolves via the registry`);

const launcherSource = readFileSync(join(SITE_ROOT, 'js', 'v86-launcher.js'), 'utf8');
check(launcherSource.includes('throwIfAborted'), `VM boot checks the foreground abort signal`);
check(launcherSource.includes('Next: retry') && launcherSource.includes('or reload the page and try again'), `VM failure path shows the retry action`);
check(launcherSource.includes('5–15s'), `VM pre-boot line states the boot expectation`);

// ── BROWSER ─────────────────────────────────────────────────────────────
function sleepMillis(durationMillis) {
  return new Promise((wakeUp) => { setTimeout(wakeUp, durationMillis); });
}

async function waitForServerReady() {
  const deadline = Date.now() + 15000;
  while (true) {
    try {
      const response = await fetch(`${SERVER_ORIGIN}/`);
      if (response.ok) return;
    } catch (readyError) {
      if (Date.now() > deadline) throw new Error(`wave7: server never ready (${readyError.message})`);
      await sleepMillis(150);
    }
  }
}

const INIT_SCRIPT = `window.__snapshotChunks = [];
(function wave7Wrap() {
  function wrapInstance(instance) {
    if (!instance || instance.__wave7Wrapped) return;
    for (const methodName of ['write', 'writeln']) {
      const original = instance[methodName];
      if (typeof original !== 'function') continue;
      instance[methodName] = function wrappedWrite() {
        const writeArgs = Array.prototype.slice.call(arguments);
        const textValue = writeArgs.length > 0 ? String(writeArgs[0]) : '';
        window.__snapshotChunks.push(methodName === 'writeln' ? \`\${textValue}\\r\\n\` : textValue);
        return original.apply(instance, writeArgs);
      };
    }
    instance.__wave7Wrapped = true;
  }
  let patchTries = 0;
  const patchTimer = setInterval(() => {
    patchTries += 1;
    const TerminalCtor = window.Terminal;
    const openFunction = TerminalCtor && TerminalCtor.prototype && TerminalCtor.prototype.open;
    if (typeof openFunction === 'function' && !openFunction.__wave7Wrapped) {
      const originalOpen = openFunction;
      const patchedOpen = function patchedOpen() {
        const openArgs = Array.prototype.slice.call(arguments);
        const openResult = originalOpen.apply(this, openArgs);
        wrapInstance(this);
        return openResult;
      };
      patchedOpen.__wave7Wrapped = true;
      TerminalCtor.prototype.open = patchedOpen;
    }
    if ((TerminalCtor && TerminalCtor.prototype && TerminalCtor.prototype.open && TerminalCtor.prototype.open.__wave7Wrapped) || patchTries > 1000) clearInterval(patchTimer);
  }, 25);
})();`;

async function runBrowserAsserts() {
  const serverProcess = spawn('python3', ['-m', 'http.server', `${SERVER_PORT}`, '--bind', '127.0.0.1'], {
    cwd: SITE_ROOT,
    stdio: 'ignore',
  });
  let browser = null;
  try {
    await waitForServerReady();
    const playwrightPackage = await import('playwright');
    browser = await playwrightPackage.chromium.launch({ headless: true });
    const browserContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await browserContext.addInitScript(INIT_SCRIPT);
    const page = await browserContext.newPage();
    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.hostname === '127.0.0.1' || requestUrl.hostname === 'localhost' || requestUrl.hostname === 'cdn.jsdelivr.net') {
        await route.continue();
        return;
      }
      await route.abort('blockedbyclient');
    });
    await page.goto(`${SERVER_ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const chunkLength = () => page.evaluate(() => window.__snapshotChunks.length);
    const chunkSlice = (sliceStart) => page.evaluate((sliceOffset) => window.__snapshotChunks.slice(sliceOffset).join(''), sliceStart);
    async function waitQuiet(sliceStart, timeoutMillis) {
      const startedAt = Date.now();
      let lastLength = sliceStart;
      let quietSince = Date.now();
      while (true) {
        const currentLength = await chunkLength();
        if (currentLength !== lastLength) {
          lastLength = currentLength;
          quietSince = Date.now();
        }
        const sliceText = await chunkSlice(sliceStart);
        if (sliceText.includes('❯') && Date.now() - quietSince >= 500) return sliceText;
        if (Date.now() - startedAt > timeoutMillis) throw new Error('wave7: timed out waiting for prompt');
        await sleepMillis(100);
      }
    }

    await waitQuiet(0, 60000);
    check(true, 'browser booted to a prompt');

    const terminalLocator = page.locator('#terminal-container');
    async function typeLine(lineText) {
      const sliceStart = await chunkLength();
      await terminalLocator.click();
      await page.keyboard.type(lineText);
      await page.keyboard.press('Enter');
      return waitQuiet(sliceStart, 20000);
    }

    // Palette opens on Ctrl+K with grouped rows + EXAMPLES footer.
    await terminalLocator.click();
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#command-palette[open]', { timeout: 5000 });
    const groupLabels = await page.$$eval('.palette-group', (groupNodes) => groupNodes.map((groupNode) => groupNode.textContent));
    check(groupLabels.includes('CORE') && groupLabels.includes('ADDITIONAL'), `palette groups CORE/ADDITIONAL (${groupLabels.join('/')})`);
    const firstRow = await page.$eval('.palette-row .palette-title', (titleNode) => titleNode.textContent);
    const firstCommand = await page.$eval('.palette-row .palette-command', (commandNode) => commandNode.textContent);
    check(firstRow.length > 0 && firstCommand.length > 0, `palette rows show plain title + raw command (${firstCommand})`);
    const examplesText = await page.$eval('#palette-examples', (examplesNode) => examplesNode.textContent);
    check(examplesText.includes('EXAMPLES') && examplesText.includes('$'), 'palette footer shows EXAMPLES');

    // Enter executes with args preserved: `man ai` must render the ai page,
    // not the bare-man usage line.
    let sliceStart = await chunkLength();
    await page.keyboard.type('man ai');
    await page.keyboard.press('Enter');
    const manSlice = await waitQuiet(sliceStart, 20000);
    check(manSlice.includes('USAGE') && manSlice.includes('ai <prompt>'), 'palette Enter preserves args (man ai renders the ai page)');
    const dialogClosed = await page.evaluate(() => !document.getElementById('command-palette').open);
    check(dialogClosed, 'palette closes after a successful run');

    // Unknown input never silently closes: hint stays, dialog stays open.
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#command-palette[open]', { timeout: 5000 });
    await page.keyboard.type('zzz-no-such-cmd');
    await page.keyboard.press('Enter');
    await sleepMillis(300);
    const stillOpen = await page.evaluate(() => document.getElementById('command-palette').open);
    const hintText = await page.$eval('#palette-hint', (hintNode) => hintNode.textContent);
    check(stillOpen && hintText.includes('No match'), `unknown palette input shows a No-match hint, stays open (${hintText})`);

    // Esc closes and restores focus to the opener.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('command-palette').open, null, { timeout: 5000 });
    await page.$eval('.hero-explore-row [data-open-palette]', (exploreButton) => exploreButton.focus());
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#command-palette[open]', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('command-palette').open, null, { timeout: 5000 });
    await sleepMillis(100);
    const focusRestored = await page.evaluate(() => {
      const activeElement = document.activeElement;
      return activeElement && activeElement.hasAttribute && activeElement.hasAttribute('data-open-palette');
    });
    check(focusRestored, 'palette Esc restores focus to the opener');

    // Guided button output equals typed output (minus narration lines).
    const typedSlice = await typeLine('ls links');
    const guidedSliceStart = await chunkLength();
    await page.click('.guided-button:has-text("Show projects")');
    const guidedSlice = await waitQuiet(guidedSliceStart, 20000);
    const stripNarration = (sliceText) => sliceText.split('\n').filter((sliceLine) => !sliceLine.includes('◈') && !sliceLine.includes('ls links')).join('\n').trim();
    check(stripNarration(typedSlice) === stripNarration(guidedSlice), 'guided Show-projects output equals typed `ls links` output');

    // MODE pill syncs via setMode; Exit Linux button follows.
    const pillBefore = await page.$eval('#mode-pill', (pillNode) => pillNode.textContent);
    await page.evaluate(() => window.__wave7.setMode('v86'));
    const pillLinux = await page.$eval('#mode-pill', (pillNode) => pillNode.textContent);
    const exitVisible = await page.evaluate(() => !document.getElementById('exit-vm-button').hidden);
    await page.evaluate(() => window.__wave7.setMode('local'));
    const pillAfter = await page.$eval('#mode-pill', (pillNode) => pillNode.textContent);
    const exitHidden = await page.evaluate(() => document.getElementById('exit-vm-button').hidden);
    check(pillBefore === 'shell' && pillLinux === 'linux' && pillAfter === 'shell', `MODE pill shell→linux→shell (${pillBefore}/${pillLinux}/${pillAfter})`);
    check(exitVisible && exitHidden, 'Exit Linux button shows only in linux mode');

    // Ghost suggestion appears and Right-arrow accepts it.
    sliceStart = await chunkLength();
    await terminalLocator.click();
    await page.keyboard.press('Escape');
    await page.keyboard.type('wea');
    await page.waitForFunction(() => {
      const ghostNode = document.getElementById('terminal-ghost');
      return ghostNode && ghostNode.style.display !== 'none' && ghostNode.textContent.length > 0;
    }, null, { timeout: 5000 });
    const ghostText = await page.$eval('#terminal-ghost', (ghostNode) => ghostNode.textContent);
    check(ghostText === 'ther', `fish-style ghost completes 'wea' (${ghostText})`);
    const boxVisible = await page.evaluate(() => {
      const boxNode = document.getElementById('terminal-suggestions');
      return boxNode && !boxNode.hidden;
    });
    check(boxVisible, 'live suggestion dropdown appears while typing');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    const weatherSliceStart = await chunkLength();
    await page.keyboard.press('Enter');
    const weatherSlice = await waitQuiet(weatherSliceStart, 20000);
    check(weatherSlice.includes('Could not determine location'), 'ghost-accepted buffer runs as `weather`');

    // Ctrl+R opens reverse-history search; Esc cancels.
    await terminalLocator.click();
    await page.keyboard.press('Control+r');
    await page.waitForFunction(() => {
      const boxNode = document.getElementById('terminal-suggestions');
      return boxNode && !boxNode.hidden && boxNode.textContent.includes('reverse-i-search');
    }, null, { timeout: 5000 });
    check(true, 'Ctrl+R opens reverse-history search');
    await page.keyboard.press('Escape');
    await sleepMillis(200);
    const historyBoxHidden = await page.evaluate(() => document.getElementById('terminal-suggestions').hidden);
    check(historyBoxHidden, 'Esc closes history search');

    // Paste auto-clean: a docs-style prompt prefix is stripped.
    const pasteSliceStart = await chunkLength();
    await terminalLocator.click();
    await page.keyboard.insertText('db@dvxb.io ~ ❯ whoami');
    await sleepMillis(300);
    await page.keyboard.press('Enter');
    const pasteSlice = await waitQuiet(pasteSliceStart, 20000);
    check(pasteSlice.includes('command not found') === false, 'paste auto-clean strips the prompt prefix');

    // VM boot aborts cleanly through the foreground runner.
    const abortResult = await page.evaluate(async () => {
      const activeTerm = window.__wave7.getTerm();
      const abortController = new AbortController();
      abortController.abort();
      try {
        await window.bootVM(activeTerm, abortController.signal);
        return 'resolved';
      } catch (bootError) {
        return bootError && bootError.name ? bootError.name : String(bootError);
      }
    });
    check(abortResult === 'AbortError', `aborted VM boot surfaces AbortError, never a hang (${abortResult})`);
  } finally {
    if (browser !== null) await browser.close();
    serverProcess.kill();
  }
}

await runBrowserAsserts();

if (failureCount > 0) {
  process.stderr.write(`assert-wave7: ${failureCount} failure(s)\n`);
  process.exit(1);
}
process.stdout.write('assert-wave7: all checks passed\n');
