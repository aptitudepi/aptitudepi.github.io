#!/usr/bin/env node
// tools/snapshot-terminal.mjs — capture deterministic xterm golden snapshots.
//
// Serves the repo over a local python http.server, loads index.html in a
// headless browser, drives the terminal through a canonical command list,
// and stores byte-exact ANSI streams plus prompt counts under
// logs/terminal-goldens/ with a manifest.json. Timing-sensitive output
// (system clock, uptime durations, Date strings, search network errors) is
// masked so two runs are byte-identical.
//
// Usage:
//   npm run snapshot
//   SNAPSHOT_PORT=8901 SNAPSHOT_FORCE_CDP=1 node tools/snapshot-terminal.mjs
//
// Driver selection: uses playwright when node_modules/playwright (or
// playwright-core) is present, otherwise falls back to the system chromium
// binary driven over CDP with the global WebSocket client (zero new deps).

import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm as removePath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(TOOL_DIRECTORY, `..`);
const GOLDEN_ROOT = join(SITE_ROOT, `logs`, `terminal-goldens`);
const SERVER_PORT = Number(process.env.SNAPSHOT_PORT || `8901`);
const SNAPSHOT_ORIGIN = `http://127.0.0.1:${SERVER_PORT}`;
const DEBUG_PORT = Number(process.env.SNAPSHOT_DEBUG_PORT || `9001`);
const BOOT_TIMEOUT_MILLIS = Number(process.env.SNAPSHOT_BOOT_TIMEOUT || `60000`);
const COMMAND_TIMEOUT_MILLIS = Number(process.env.SNAPSHOT_COMMAND_TIMEOUT || `20000`);
const QUIET_MILLIS = Number(process.env.SNAPSHOT_QUIET_MILLIS || `500`);
const POLL_MILLIS = 100;
const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 800;
const FIXED_EPOCH_MILLIS = Date.UTC(2026, 8, 7, 12, 0, 0);
const SEARCH_STUB_HOST = `0.supernovadkb.workers.dev`;

const SESSION_LIST = [
  { commandText: `help`, goldenFile: `help.ans` },
  { commandText: `unknown-cmd`, goldenFile: `unknown-cmd.ans` },
  { commandText: `whoami`, goldenFile: `whoami.ans` },
  { commandText: `date`, goldenFile: `date.ans` },
  { commandText: `neofetch`, goldenFile: `neofetch.ans` },
  { commandText: `about`, goldenFile: `about.ans` },
  { commandText: `ls`, goldenFile: `ls.ans` },
  { commandText: `cat`, goldenFile: `cat.ans` },
  { commandText: `history`, goldenFile: `history.ans` },
  { commandText: `ai-models`, goldenFile: `ai-models.ans` },
  { commandText: `weather --help`, goldenFile: `weather-help.ans` },
  { commandText: `search --help`, goldenFile: `search-help.ans` },
  { commandText: `hn --help`, goldenFile: `hn-help.ans` },
  { commandText: `cat resume.md`, goldenFile: `cat-resume.ans` },
  { commandText: `projects`, goldenFile: `projects.ans` },
  { commandText: `projects python`, goldenFile: `projects-filter.ans` },
  { commandText: `projects --json`, goldenFile: `projects-json.ans` },
  { commandText: `case pcpg`, goldenFile: `case-pcpg.ans` },
  { commandText: `skills`, goldenFile: `skills.ans` },
  { commandText: `timeline`, goldenFile: `timeline.ans` },
  { commandText: `export about`, goldenFile: `export-about.ans` },
  { commandText: `md https://bad.invalid/post.md`, goldenFile: `md-fallback.ans` },
  // `md --help` opens the fullscreen viewer iframe (legacy golden pin), so
  // it runs last: the iframe would intercept terminal clicks for any later
  // session.
  { commandText: `md --help`, goldenFile: `md-help.ans` },
];

function sleepMillis(durationMillis) {
  return new Promise((wakeUp) => {
    setTimeout(wakeUp, durationMillis);
  });
}

function countPrompts(streamText) {
  const promptMarks = streamText.match(/❯/g);
  return promptMarks === null ? 0 : promptMarks.length;
}

function maskTiming(streamText) {
  const escChar = String.fromCharCode(27);
  const clockPattern = new RegExp(`System clock: [^${escChar}\\n]*`, `g`);
  const durationPattern = /\d+ days?, \d+ hours?, \d+ minutes?/g;
  const datePattern = new RegExp(
    `(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \\d{1,2} \\d{4} \\d{2}:\\d{2}:\\d{2}[^${escChar}\\n]*`,
    `g`,
  );
  const searchErrorPattern = new RegExp(`Search error: [^${escChar}\\n]*`, `g`);
  let masked = streamText.replace(clockPattern, `System clock: <MASKED-CLOCK>`);
  masked = masked.replace(durationPattern, `<MASKED-DURATION>`);
  masked = masked.replace(datePattern, `<MASKED-DATE>`);
  masked = masked.replace(searchErrorPattern, `Search error: <MASKED-NETWORK>`);
  return masked;
}

function sha256Hex(payload) {
  return createHash(`sha256`).update(payload, `utf8`).digest(`hex`);
}

function readCommitSha() {
  try {
    const rawOutput = execFileSync(`git`, [`rev-parse`, `HEAD`], { cwd: SITE_ROOT, encoding: `utf8` });
    return rawOutput.trim();
  } catch (gitError) {
    process.stderr.write(`snapshot: git rev-parse failed: ${gitError.message}\n`);
    return `unknown`;
  }
}

function shouldAllowUrl(targetUrl) {
  let parsedUrl = null;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (allowMatchError) {
    process.stderr.write(`snapshot: allow-list match failed: ${allowMatchError.message}\n`);
    return false;
  }
  const hostName = parsedUrl.hostname;
  return hostName === `127.0.0.1` || hostName === `localhost` || hostName === `cdn.jsdelivr.net`;
}

function isSearchStubUrl(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    return parsedUrl.hostname === SEARCH_STUB_HOST && parsedUrl.pathname.startsWith(`/search`);
  } catch (stubMatchError) {
    process.stderr.write(`snapshot: search-stub match failed: ${stubMatchError.message}\n`);
    return false;
  }
}

function playwrightPresent() {
  return (
    existsSync(join(SITE_ROOT, `node_modules`, `playwright`)) ||
    existsSync(join(SITE_ROOT, `node_modules`, `playwright-core`))
  );
}

function buildInitScript() {
  return `(function snapshotSetup() {
  var FIXED_MILLIS = ${FIXED_EPOCH_MILLIS};
  var RealDate = Date;
  function FrozenDate() {
    var ctorArgs = Array.prototype.slice.call(arguments);
    if (ctorArgs.length === 0) { ctorArgs = [FIXED_MILLIS]; }
    return Reflect.construct(RealDate, ctorArgs, RealDate);
  }
  FrozenDate.now = function frozenNow() { return FIXED_MILLIS; };
  FrozenDate.UTC = RealDate.UTC;
  FrozenDate.parse = RealDate.parse;
  FrozenDate.prototype = RealDate.prototype;
  Date = FrozenDate;
  var randomSeed = 20260907;
  Math.random = function frozenRandom() {
    randomSeed = (randomSeed + 0x6D2B79F5) | 0;
    var mixer = Math.imul(randomSeed ^ (randomSeed >>> 15), 1 | randomSeed);
    mixer = (mixer + Math.imul(mixer ^ (mixer >>> 7), 61 | mixer)) ^ mixer;
    return ((mixer ^ (mixer >>> 14)) >>> 0) / 4294967296;
  };
  window.__snapshotChunks = [];
  function recordTerminalWrite(kind, text) {
    window.__snapshotChunks.push(kind === 'writeln' ? text + '\\r\\n' : text);
  }
  function wrapTerminalInstance(term) {
    if (!term || term.__snapshotWrapped) { return; }
    var methodNames = ['write', 'writeln'];
    for (var index = 0; index < methodNames.length; index += 1) {
      (function wrapOne(methodName) {
        var original = term[methodName];
        if (typeof original !== 'function' || original.__snapshotWrapped) { return; }
        var patched = function patchedWrite() {
          var callArgs = Array.prototype.slice.call(arguments);
          var text = callArgs.length > 0 ? String(callArgs[0]) : '';
          recordTerminalWrite(methodName, text);
          return original.apply(term, callArgs);
        };
        patched.__snapshotWrapped = true;
        term[methodName] = patched;
      })(methodNames[index]);
    }
    term.__snapshotWrapped = true;
  }
  function patchTerminalConstructor() {
    var TerminalCtor = window.Terminal;
    if (!TerminalCtor || !TerminalCtor.prototype || typeof TerminalCtor.prototype.open !== 'function') { return false; }
    var proto = TerminalCtor.prototype;
    if (!proto.open.__snapshotWrapped) {
      var originalOpen = proto.open;
      var patchedOpen = function patchedOpen() {
        var openArgs = Array.prototype.slice.call(arguments);
        var result = originalOpen.apply(this, openArgs);
        wrapTerminalInstance(this);
        return result;
      };
      patchedOpen.__snapshotWrapped = true;
      proto.open = patchedOpen;
    }
    return true;
  }
  var patchAttempts = 0;
  var patchTimer = setInterval(function patchTick() {
    patchAttempts += 1;
    if (patchTerminalConstructor() || patchAttempts > 1000) { clearInterval(patchTimer); }
  }, 25);
})();`;
}

async function waitForServerReady() {
  const deadline = Date.now() + 15000;
  let warnedWaiting = false;
  let ready = false;
  while (ready === false) {
    try {
      const response = await fetch(`${SNAPSHOT_ORIGIN}/`);
      const bodyText = await response.text();
      if (response.ok && bodyText.length > 0) {
        ready = true;
      }
    } catch (readyError) {
      if (warnedWaiting === false) {
        warnedWaiting = true;
        process.stderr.write(`snapshot: waiting for static server (${readyError.message})\n`);
      }
    }
    if (ready === false) {
      if (Date.now() > deadline) {
        throw new Error(`snapshot: static server did not become ready`);
      }
      await sleepMillis(150);
    }
  }
}

async function startStaticServer() {
  const serverProcess = spawn(`python3`, [`-m`, `http.server`, `${SERVER_PORT}`, `--bind`, `127.0.0.1`], {
    cwd: SITE_ROOT,
    stdio: `ignore`,
  });
  serverProcess.on(`error`, (spawnError) => {
    process.stderr.write(`snapshot: static server process error: ${spawnError.message}\n`);
  });
  await waitForServerReady();
  return serverProcess;
}

async function waitForSegment(driver, sliceStart, timeoutMillis) {
  const startedAt = Date.now();
  let lastLength = sliceStart;
  let quietSince = Date.now();
  let currentSlice = ``;
  let settled = false;
  while (settled === false) {
    const snapshotLength = await driver.snapshotLength();
    if (snapshotLength !== lastLength) {
      lastLength = snapshotLength;
      quietSince = Date.now();
    }
    currentSlice = await driver.snapshotSlice(sliceStart);
    const promptTotal = countPrompts(currentSlice);
    const quietFor = Date.now() - quietSince;
    if (promptTotal >= 1 && quietFor >= QUIET_MILLIS) {
      settled = true;
    } else if (Date.now() - startedAt > timeoutMillis) {
      throw new Error(`snapshot: timed out waiting for terminal segment (start=${sliceStart}, prompts=${promptTotal})`);
    } else {
      await sleepMillis(POLL_MILLIS);
    }
  }
  return currentSlice;
}

function writeGolden(fileName, payload) {
  writeFileSync(join(GOLDEN_ROOT, fileName), payload, `utf8`);
}

function buildManifest(sessionEntries) {
  let promptTotal = 0;
  for (const sessionEntry of sessionEntries) {
    promptTotal += sessionEntry.prompts;
  }
  const manifestObject = {
    version: 1,
    tool: `tools/snapshot-terminal.mjs`,
    commit: readCommitSha(),
    origin: `${SNAPSHOT_ORIGIN}/`,
    viewport: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
    masked: [
      `System clock: <MASKED-CLOCK>`,
      `uptime durations: <MASKED-DURATION>`,
      `Date().toString(): <MASKED-DATE>`,
      `search network errors: <MASKED-NETWORK>`,
    ],
    sessions: sessionEntries,
    totalPrompts: promptTotal,
  };
  return `${JSON.stringify(manifestObject, null, 2)}\n`;
}

async function createPlaywrightDriver(initScriptText, serverOrigin) {
  let playwrightPackage = null;
  try {
    playwrightPackage = await import(`playwright`);
  } catch (playwrightError) {
    process.stderr.write(`snapshot: playwright import failed, trying playwright-core (${playwrightError.message})\n`);
    playwrightPackage = await import(`playwright-core`);
  }
  const browser = await playwrightPackage.chromium.launch({
    headless: true,
    args: [
      `--disable-background-timer-throttling`,
      `--disable-backgrounding-occluded-windows`,
      `--disable-renderer-backgrounding`,
    ],
  });
  const browserContext = await browser.newContext({ viewport: { width: VIEW_WIDTH, height: VIEW_HEIGHT } });
  await browserContext.addInitScript(initScriptText);
  const page = await browserContext.newPage();
  page.on(`crash`, () => {
    process.stderr.write(`snapshot: page crashed\n`);
  });
  page.on(`close`, () => {
    process.stderr.write(`snapshot: page closed\n`);
  });
  await page.bringToFront();
  await page.route(`**/*`, async (route) => {
    const requestUrl = route.request().url();
    if (shouldAllowUrl(requestUrl)) {
      await route.continue();
      return;
    }
    if (isSearchStubUrl(requestUrl)) {
      await route.fulfill({ status: 200, contentType: `application/json`, body: `{"results":[]}` });
      return;
    }
    await route.abort(`blockedbyclient`);
  });
  await page.goto(`${serverOrigin}/`, { waitUntil: `domcontentloaded`, timeout: 30000 });
  const terminalLocator = page.locator(`#terminal-container`);
  return {
    driverName: `playwright`,
    async snapshotLength() {
      return Number(await page.evaluate(() => window.__snapshotChunks.length));
    },
    async snapshotSlice(sliceStart) {
      return String(
        await page.evaluate((sliceOffset) => window.__snapshotChunks.slice(sliceOffset).join(``), sliceStart),
      );
    },
    async typeLine(lineText) {
      await terminalLocator.click();
      await page.keyboard.type(lineText);
      await page.keyboard.press(`Enter`);
    },
    async close() {
      await browser.close();
    },
  };
}

async function createFallbackDriver(initScriptText, serverOrigin) {
  const candidateBinaries = [
    process.env.SNAPSHOT_CHROMIUM || ``,
    `/usr/bin/chromium`,
    `/usr/bin/chromium-browser`,
    `/usr/bin/google-chrome`,
  ];
  let browserBinary = ``;
  for (const candidateBinary of candidateBinaries) {
    if (candidateBinary !== `` && existsSync(candidateBinary)) {
      browserBinary = candidateBinary;
      break;
    }
  }
  if (browserBinary === ``) {
    throw new Error(`snapshot: no system chromium binary found; set SNAPSHOT_CHROMIUM`);
  }
  const profileRoot = await mkdtemp(join(tmpdir(), `snapshot-chromium-`));
  const debugOrigin = `http://127.0.0.1:${DEBUG_PORT}`;
  const browserArgs = [
    `--headless`,
    `--disable-gpu`,
    `--no-sandbox`,
    `--disable-dev-shm-usage`,
    `--disable-background-timer-throttling`,
    `--disable-backgrounding-occluded-windows`,
    `--disable-renderer-backgrounding`,
    `--window-size=${VIEW_WIDTH},${VIEW_HEIGHT}`,
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileRoot}`,
    `about:blank`,
  ];
  const browserProcess = spawn(browserBinary, browserArgs, { stdio: `ignore` });
  browserProcess.on(`error`, (browserError) => {
    process.stderr.write(`snapshot: chromium spawn failed: ${browserError.message}\n`);
  });

  let pageTarget = null;
  const debugDeadline = Date.now() + 20000;
  let warnedWaiting = false;
  while (pageTarget === null) {
    await sleepMillis(200);
    try {
      const listResponse = await fetch(`${debugOrigin}/json/list`);
      const targetList = await listResponse.json();
      for (const targetEntry of targetList) {
        if (targetEntry.type === `page`) {
          pageTarget = targetEntry;
          break;
        }
      }
    } catch (debugPollError) {
      if (warnedWaiting === false) {
        warnedWaiting = true;
        process.stderr.write(`snapshot: waiting for chromium debug port (${debugPollError.message})\n`);
      }
    }
    if (pageTarget === null && Date.now() > debugDeadline) {
      throw new Error(`snapshot: chromium debug port did not appear`);
    }
  }

  const debugSocket = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolveSocket, rejectSocket) => {
    debugSocket.addEventListener(`open`, () => resolveSocket(undefined), { once: true });
    debugSocket.addEventListener(`error`, (socketError) => rejectSocket(socketError), { once: true });
  });

  let nextCommandId = 0;
  const pendingCommands = new Map();

  function sendCommand(methodName, methodParams) {
    return new Promise((resolveCommand, rejectCommand) => {
      nextCommandId += 1;
      const commandId = nextCommandId;
      pendingCommands.set(commandId, { resolve: resolveCommand, reject: rejectCommand });
      debugSocket.send(JSON.stringify({ id: commandId, method: methodName, params: methodParams || {} }));
    });
  }

  async function handlePausedRequest(pausedParams) {
    const pausedId = pausedParams.requestId;
    const pausedUrl = pausedParams.request.url;
    try {
      if (shouldAllowUrl(pausedUrl)) {
        await sendCommand(`Fetch.continueRequest`, { requestId: pausedId });
        return;
      }
      if (isSearchStubUrl(pausedUrl)) {
        const stubBody = Buffer.from(`{"results":[]}`, `utf8`).toString(`base64`);
        await sendCommand(`Fetch.fulfillRequest`, {
          requestId: pausedId,
          responseCode: 200,
          responseHeaders: [{ name: `Content-Type`, value: `application/json` }],
          body: stubBody,
        });
        return;
      }
      await sendCommand(`Fetch.failRequest`, { requestId: pausedId, errorReason: `BlockedByClient` });
    } catch (pausedError) {
      process.stderr.write(`snapshot: paused-request handling failed for ${pausedUrl}: ${pausedError.message}\n`);
    }
  }

  debugSocket.addEventListener(`message`, (socketEvent) => {
    let incoming = null;
    try {
      incoming = JSON.parse(String(socketEvent.data));
    } catch (parseError) {
      process.stderr.write(`snapshot: CDP message parse failed: ${parseError.message}\n`);
      return;
    }
    if (typeof incoming.id === `number`) {
      const waiter = pendingCommands.get(incoming.id);
      if (waiter !== undefined) {
        pendingCommands.delete(incoming.id);
        if (incoming.error) {
          waiter.reject(new Error(`snapshot: CDP error: ${JSON.stringify(incoming.error)}`));
        } else {
          waiter.resolve(incoming.result);
        }
      }
      return;
    }
    if (incoming.method === `Fetch.requestPaused`) {
      handlePausedRequest(incoming.params).catch((pauseError) => {
        process.stderr.write(`snapshot: pause handler failed: ${pauseError.message}\n`);
      });
    }
  });

  async function evaluateValue(expressionText) {
    const commandResult = await sendCommand(`Runtime.evaluate`, {
      expression: expressionText,
      awaitPromise: true,
      returnByValue: true,
    });
    if (commandResult.exceptionDetails) {
      throw new Error(`snapshot: page evaluate failed: ${JSON.stringify(commandResult.exceptionDetails)}`);
    }
    return commandResult.result.value;
  }

  await sendCommand(`Fetch.enable`, { patterns: [{ urlPattern: `*` }] });
  await sendCommand(`Page.addScriptToEvaluateOnNewDocument`, { source: initScriptText });
  await sendCommand(`Page.navigate`, { url: `${serverOrigin}/` });

  async function focusTerminal() {
    const boxJson = await evaluateValue(
      `JSON.stringify(document.getElementById('terminal-container').getBoundingClientRect())`,
    );
    const boundingBox = JSON.parse(boxJson);
    const clickX = boundingBox.x + boundingBox.width / 2;
    const clickY = boundingBox.y + boundingBox.height / 2;
    await sendCommand(`Input.dispatchMouseEvent`, {
      type: `mousePressed`,
      x: clickX,
      y: clickY,
      button: `left`,
      clickCount: 1,
    });
    await sendCommand(`Input.dispatchMouseEvent`, {
      type: `mouseReleased`,
      x: clickX,
      y: clickY,
      button: `left`,
      clickCount: 1,
    });
  }

  return {
    driverName: `system-chromium-cdp`,
    async snapshotLength() {
      return Number(await evaluateValue(`window.__snapshotChunks.length`));
    },
    async snapshotSlice(sliceStart) {
      return String(await evaluateValue(`window.__snapshotChunks.slice(${sliceStart}).join('')`));
    },
    async typeLine(lineText) {
      await focusTerminal();
      await sendCommand(`Input.insertText`, { text: lineText });
      await sendCommand(`Input.dispatchKeyEvent`, {
        type: `rawKeyDown`,
        key: `Enter`,
        code: `Enter`,
        windowsVirtualKeyCode: 13,
        text: `\r`,
      });
      await sendCommand(`Input.dispatchKeyEvent`, { type: `keyUp`, key: `Enter`, code: `Enter`, windowsVirtualKeyCode: 13 });
    },
    async close() {
      try {
        debugSocket.close();
      } catch (socketCloseError) {
        process.stderr.write(`snapshot: debug socket close failed: ${socketCloseError.message}\n`);
      }
      browserProcess.kill();
      await sleepMillis(300);
      try {
        await removePath(profileRoot, { recursive: true, force: true });
      } catch (profileCleanupError) {
        process.stderr.write(`snapshot: profile cleanup failed: ${profileCleanupError.message}\n`);
      }
    },
  };
}

async function createDriver(initScriptText, serverOrigin) {
  const forceFallback = process.env.SNAPSHOT_FORCE_CDP === `1`;
  if (forceFallback === false && playwrightPresent()) {
    return createPlaywrightDriver(initScriptText, serverOrigin);
  }
  return createFallbackDriver(initScriptText, serverOrigin);
}

async function main() {
  mkdirSync(GOLDEN_ROOT, { recursive: true });
  const serverProcess = await startStaticServer();
  let driver = null;
  try {
    const initScriptText = buildInitScript();
    driver = await createDriver(initScriptText, SNAPSHOT_ORIGIN);
    process.stdout.write(`snapshot: driver=${driver.driverName} origin=${SNAPSHOT_ORIGIN}/\n`);

    const bootSlice = await waitForSegment(driver, 0, BOOT_TIMEOUT_MILLIS);
    const bootMasked = maskTiming(bootSlice);
    writeGolden(`boot.ans`, bootMasked);
    const manifestSessions = [
      {
        command: `(boot)`,
        file: `boot.ans`,
        sha256: sha256Hex(bootMasked),
        bytes: Buffer.byteLength(bootMasked, `utf8`),
        prompts: countPrompts(bootMasked),
      },
    ];

    let sliceCursor = await driver.snapshotLength();
    for (const session of SESSION_LIST) {
      await driver.typeLine(session.commandText);
      const rawSlice = await waitForSegment(driver, sliceCursor, COMMAND_TIMEOUT_MILLIS);
      const maskedSlice = maskTiming(rawSlice);
      writeGolden(session.goldenFile, maskedSlice);
      manifestSessions.push({
        command: session.commandText,
        file: session.goldenFile,
        sha256: sha256Hex(maskedSlice),
        bytes: Buffer.byteLength(maskedSlice, `utf8`),
        prompts: countPrompts(maskedSlice),
      });
      sliceCursor = await driver.snapshotLength();
      process.stdout.write(`snapshot: ${session.commandText} -> ${session.goldenFile}\n`);
    }

    writeGolden(`manifest.json`, buildManifest(manifestSessions));
    process.stdout.write(`snapshot: wrote ${manifestSessions.length} goldens to ${GOLDEN_ROOT}\n`);
  } finally {
    if (driver !== null) {
      await driver.close();
    }
    serverProcess.kill();
  }
}

main().then(
  () => {
    process.exitCode = 0;
  },
  (fatalError) => {
    process.stderr.write(`snapshot: fatal: ${fatalError.stack || fatalError.message}\n`);
    process.exitCode = 1;
  },
);
