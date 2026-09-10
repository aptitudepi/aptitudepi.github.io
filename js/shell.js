import { runForeground, setPromptRenderer, isForegroundBusy } from './foreground.js';
import { combinedTimeoutSignal } from './fetch-timeout.js';
import {
  neofetch, SITE_GREEN, SITE_WHITE, SITE_CYAN, SITE_BLUE, SITE_MUTED, SITE_OK,
  SITE_ERR, SITE_FAINT, ANSI_RESET, resolveCommand, suggestCommand,
  tokenizeCommandLine, setPrefetchedLocation, recordCommandOutput, BOOT_SCRIPT,
  TERMINAL_HOST_FALLBACK, getTerminalHost, setTerminalHost,
} from './commands.js';

let asyncCPU = null;

(async () => {
  try {
    if (navigator.userAgentData?.getHighEntropyValues) {
      const hints = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'model']);
      if (hints.architecture) {
        let s = hints.architecture;
        if (hints.bitness) s += ` (${hints.bitness}-bit)`;
        if (hints.model) s += ` · ${hints.model}`;
        if (navigator.hardwareConcurrency) s += ` ${navigator.hardwareConcurrency}-core`;
        asyncCPU = s;
      }
    }
  } catch (_) {}
  fetch('https://ipapi.co/json/', { signal: combinedTimeoutSignal(null, 8000) })
    .then((locationResp) => {
      if (!locationResp.ok) throw new Error(`HTTP ${locationResp.status}`);
      return locationResp.json();
    })
    .then((locationData) => { setPrefetchedLocation({ lat: locationData.latitude, lon: locationData.longitude, city: locationData.city, region: locationData.region, region_code: locationData.region_code, country: locationData.country_code }); })
    .catch((prefetchError) => { console.warn(`location prefetch skipped: ${prefetchError.message}`); });
})();

function getCPU() {
  try {
    const parts = [];
    const p = navigator.platform || '';
    const ua = navigator.userAgent || '';
    if (ua.includes('ARM64') || ua.includes('aarch64')) parts.push('ARM');
    else if (ua.includes('x64') || ua.includes('Win64') || ua.includes('x86_64')) parts.push('x86_64');
    else if (p.includes('Intel') || p.includes('Win') || p.includes('Mac')) parts.push('x86_64');
    else if (p.includes('ARM')) parts.push('ARM');
    else if (p) parts.push(p.replace(/[_\d].*$/, ''));
    if (navigator.hardwareConcurrency) parts.push(`${navigator.hardwareConcurrency}-core`);
    return parts.join(' ') || 'db';
  } catch { return 'db'; }
}

function getGPU() {
  // Boot probe only: the throwaway context is released immediately after the
  // read (mirror the topo isSupported idiom) so boot never holds a spare GL
  // context, and local refs are nulled for collection.
  let probeCanvas = null;
  let probeGl = null;
  try {
    probeCanvas = document.createElement('canvas');
    probeGl = probeCanvas.getContext('webgl') || probeCanvas.getContext('experimental-webgl');
    if (probeGl) {
      // Prefer the spec'd plain RENDERER string — real GPU name on modern
      // engines, so no UA sniff and no deprecated debug-info extension probe
      // (Firefox logs a warning for it). Fall back to the extension only when
      // RENDERER is a useless generic placeholder (older engines).
      let rendererText = '';
      try { rendererText = String(probeGl.getParameter(probeGl.RENDERER) || '').trim(); } catch {
        rendererText = '';
      }
      if (/^(webkit webgl|mozilla|generic|unknown)/i.test(rendererText)) rendererText = '';
      if (!rendererText) {
        try {
          const debugExtension = probeGl.getExtension('WEBGL_debug_renderer_info');
          if (debugExtension) rendererText = String(probeGl.getParameter(debugExtension.UNMASKED_RENDERER_WEBGL) || '').trim();
        } catch {
          rendererText = '';
        }
      }
      return rendererText.replace(/^ANGLE\s*\(/i, '').replace(/\)$/, '') || 'Unknown';
    }
  } catch (probeError) {
    console.warn(`gpu probe skipped: ${probeError.message}`);
  } finally {
    try {
      const loseExtension = probeGl ? probeGl.getExtension('WEBGL_lose_context') : null;
      if (loseExtension && typeof loseExtension.loseContext === 'function') loseExtension.loseContext();
    } catch (releaseError) {
      probeGl = null;
    }
    probeGl = null;
    probeCanvas = null;
  }
  return 'Unknown';
}

// ── Dynamic host identity (visitor public IP) ─────────────────────
// v4/v6-aware resolution for the terminal prompt and host-named output:
// ipify legs first, ident.me 4./6. legs next, tnedi.me fallback. Each leg
// races a short timeout; every failure resolves null and the prompt keeps
// the dvxb.io fallback (fail-closed). Resolved once per page session and
// cached on the module promise, so later prompts and commands read the
// same host without refetching. Full IP in the prompt by design; only the
// guestbook moniker is masked (see formatWallMoniker in commands.js).
const HOST_FETCH_TIMEOUT_MILLIS = 4000;
const HOST_IP_JSON_ENDPOINTS = [
  'https://api.ipify.org?format=json',
  'https://api64.ipify.org?format=json',
  'https://api6.ipify.org?format=json',
];
const HOST_IP_TEXT_ENDPOINTS = [
  'https://4.ident.me/',
  'https://6.ident.me/',
  'https://tnedi.me/',
];

function readIPv4Candidate(rawValue) {
  const candidateText = String(rawValue ?? '').trim();
  const quadMatch = candidateText.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u);
  if (quadMatch === null) return null;
  const octetList = quadMatch.slice(1).map((octetText) => Number(octetText));
  const octetsValid = octetList.every((octetValue) => Number.isInteger(octetValue) && octetValue >= 0 && octetValue <= 255);
  return octetsValid ? candidateText : null;
}

function readIPv6Candidate(rawValue) {
  const candidateText = String(rawValue ?? '').trim();
  if (candidateText.includes(':') === false) return null;
  const colonTotal = (candidateText.match(/:/gu) ?? []).length;
  if (colonTotal < 2) return null;
  if (/^[0-9a-fA-F:.]+$/u.test(candidateText) === false) return null;
  return candidateText;
}

async function fetchHostCandidate(endpointUrl, expectJson) {
  try {
    const hostResp = await fetch(endpointUrl, { signal: combinedTimeoutSignal(null, HOST_FETCH_TIMEOUT_MILLIS) });
    if (hostResp.ok === false) return null;
    if (expectJson) {
      const hostPayload = await hostResp.json();
      return typeof hostPayload.ip === 'string' ? hostPayload.ip.trim() : null;
    }
    return (await hostResp.text()).trim();
  } catch (hostError) {
    console.warn(`host identity leg skipped (${endpointUrl}): ${hostError.message}`);
    return null;
  }
}

let hostFetchPromise = null;
function fetchTerminalHost() {
  if (hostFetchPromise !== null) return hostFetchPromise;
  hostFetchPromise = (async () => {
    try {
      const jsonLegs = HOST_IP_JSON_ENDPOINTS.map((endpointUrl) => fetchHostCandidate(endpointUrl, true));
      const textLegs = HOST_IP_TEXT_ENDPOINTS.map((endpointUrl) => fetchHostCandidate(endpointUrl, false));
      const legResults = await Promise.all([...jsonLegs, ...textLegs]);
      const ipv4Hits = [];
      const ipv6Hits = [];
      for (const legResult of legResults) {
        const ipv4Text = readIPv4Candidate(legResult);
        if (ipv4Text !== null) {
          ipv4Hits.push(ipv4Text);
          continue;
        }
        const ipv6Text = readIPv6Candidate(legResult);
        if (ipv6Text !== null) ipv6Hits.push(ipv6Text);
      }
      if (ipv4Hits.length > 0) return ipv4Hits[0];
      if (ipv6Hits.length > 0) return ipv6Hits[0];
      return null;
    } catch (resolveError) {
      console.warn(`host identity unavailable: ${resolveError.message}`);
      return null;
    }
  })();
  return hostFetchPromise;
}

// Window-title sync: the chrome title and the tab title track the resolved
// host once known. Static markup keeps the dvxb.io fallback so first paint
// and blocked-network snapshots stay byte-identical.
function syncHostChrome(resolvedHost) {
  try {
    if (typeof document === 'undefined') return;
    const chromeTitle = document.querySelector('.terminal-title');
    const titleText = `db@${resolvedHost} — fish 3.7`;
    if (chromeTitle) {
      chromeTitle.textContent = titleText;
      chromeTitle.setAttribute('data-text', titleText);
    }
    document.title = titleText;
  } catch (chromeError) {
    console.warn(`host chrome sync skipped: ${chromeError.message}`);
  }
}

fetchTerminalHost()
  .then((resolvedHost) => {
    if (resolvedHost === null || resolvedHost === TERMINAL_HOST_FALLBACK) return;
    setTerminalHost(resolvedHost);
    syncHostChrome(resolvedHost);
  })
  .catch((applyError) => { console.warn(`host identity apply skipped: ${applyError.message}`); });

let BOOT_MSGS = null;

function writePrompt(term) {
  term.write(`\r\n${SITE_GREEN}db${ANSI_RESET}${SITE_WHITE}@${ANSI_RESET}${SITE_CYAN}${getTerminalHost()}${ANSI_RESET}${SITE_MUTED} ${ANSI_RESET}${SITE_BLUE}~${ANSI_RESET}${SITE_MUTED}❯ ${ANSI_RESET}`);
}

// The foreground runner owns every post-completion prompt: shell registers
// its renderer once, then no command path calls writePrompt directly.
setPromptRenderer(writePrompt);

function bootSequence(term, onDone) {
  if (!BOOT_MSGS) {
    const cpu = asyncCPU || getCPU();
    const memGB = navigator.deviceMemory || 2;
    // Dynamic probe lines stay local; the static service lines come from the
    // shared BOOT_SCRIPT constant so the transcript and the 3D intro texture
    // painter read the same source. Order and colors are unchanged.
    const dynamicLines = [
      { text: `[    0.000000] Booting ${getTerminalHost()}...`, color: SITE_FAINT },
      { text: `[    0.004201] CPU: ${cpu} Genuine`, color: SITE_FAINT },
      { text: `[    0.008503] GPU: ${getGPU()}`, color: SITE_FAINT },
      { text: `[  OK  ] System clock: ${new Date().toLocaleTimeString()}`, color: SITE_OK },
      { text: `[    0.012755] Memory: 8MB stack / ${memGB}GB heap`, color: SITE_FAINT },
    ];
    const sharedLines = BOOT_SCRIPT.map((scriptEntry) => {
      return { text: scriptEntry.text, color: scriptEntry.fill };
    });
    BOOT_MSGS = [...dynamicLines, ...sharedLines];
  }
  let i = 0;
  function writeNext() {
    if (i >= BOOT_MSGS.length) {
      neofetch(term);
      setTimeout(() => { writePrompt(term); if (onDone) onDone(); }, 80);
      return;
    }
    const msg = BOOT_MSGS[i];
    const str = `${msg.color}${msg.text}${ANSI_RESET}`;
    let ci = 0;
    function typeChar() {
      const end = Math.min(ci + 10, str.length);
      for (; ci < end; ci++) term.write(str[ci]);
      if (ci >= str.length) {
        term.write('\r\n');
        i++;
        setTimeout(writeNext, 10);
        return;
      }
      setTimeout(typeChar, 2 + Math.random() * 4);
    }
    typeChar();
  }
  writeNext();
}

// Every command body runs inside the foreground runner, which renders the
// single post-completion prompt: no path below may call writePrompt.
function executeCommand(input, term) {
  const trimmed = input.trim();
  if (!trimmed) {
    if (isForegroundBusy()) return Promise.resolve(false);
    writePrompt(term);
    return Promise.resolve(true);
  }

  const headToken = (trimmed.split(/\s+/, 1)[0] || 'unknown').toLowerCase();
  // WAVE 10 picker fallback: bare 1/2/3 resolves a pending AI mode choice
  // (the chip bar's Esc path). Anything else falls through to the registry.
  if (/^[123]$/u.test(trimmed)) {
    return runForeground(headToken, term, (runSignal) => executeChoiceOrUnknown(trimmed, term, runSignal));
  }
  return runForeground(headToken, term, (runSignal) => executeCommandBody(trimmed, term, runSignal));
}

async function executeChoiceOrUnknown(choiceText, term, runSignal) {
  const aiModule = await import('./ai.js');
  if (aiModule.hasPendingAiChoice()) {
    await aiModule.resolveAiModeChoice(choiceText, term, runSignal);
    return undefined;
  }
  return executeSingleCommand(choiceText, term, runSignal);
}

async function executeCommandBody(trimmed, term, runSignal) {
  // Pipe support: cmd1 | cmd2
  if (trimmed.includes('|')) {
    const segments = trimmed.split('|').map((segment) => segment.trim());
    let captured = '';
    const capTerm = {
      write(chunk) { captured = `${captured}${chunk}`; },
      writeln(line) { captured = `${captured}${line}\n`; },
    };
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      if (segmentIndex < segments.length - 1) {
        await executeSingleCommand(segments[segmentIndex], capTerm, runSignal);
      } else {
        await executeSingleCommand(`${segments[segmentIndex]} "${captured.trimEnd()}"`, term, runSignal);
      }
    }
    return;
  }

  return executeSingleCommand(trimmed, term, runSignal);
}

async function executeSingleCommand(trimmed, term, runSignal) {
  const parts = tokenizeCommandLine(trimmed);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).map((argText) => argText.replace(/^"(.*)"$/, '$1'));
  const entry = resolveCommand(cmd);
  if (entry) {
    // Capture a copy of the command stream for the `export` story. The
    // wrapper forwards every call untouched, so golden bytes never change.
    const capturedChunks = [];
    const captureTerm = {
      write(chunkText) {
        capturedChunks.push(String(chunkText));
        term.write(chunkText);
      },
      writeln(lineText) {
        capturedChunks.push(`${String(lineText ?? '')}\n`);
        term.writeln(lineText);
      },
      clear() {
        capturedChunks.length = 0;
        if (typeof term.clear === 'function') {
          term.clear();
        }
      },
    };
    try {
      const runResult = await entry.run(captureTerm, args, runSignal);
      recordCommandOutput(capturedChunks.join(''));
      return runResult;
    } catch (runError) {
      recordCommandOutput(capturedChunks.join(''));
      throw runError;
    }
  }
  const suggestion = suggestCommand(cmd);
  if (suggestion) {
    term.writeln(`${SITE_ERR}${cmd}: command not found${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Did you mean \`${SITE_WHITE}${suggestion}${SITE_MUTED}\`?${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: type \`help\` for the full command list${ANSI_RESET}`);
  } else {
    term.writeln(`${SITE_ERR}${cmd}: command not found${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: type \`help\` for the full command list${ANSI_RESET}`);
  }
  return;
}

window.executeTerminalCommand = executeCommand;

const resfetch = neofetch;

export {
  executeCommand, bootSequence, neofetch, resfetch, writePrompt, SITE_GREEN,
  SITE_CYAN, SITE_WHITE, SITE_BLUE, SITE_MUTED, SITE_OK, SITE_ERR, SITE_FAINT,
  ANSI_RESET,
};

export {
  ASCII_ART, vfs, RESUME, CMD_HISTORY, SHOW_TERMINAL_ART, uptimeStr, ansiRGB,
  stripAnsi, ANSI_BOLD, SITE_LABEL, COMMANDS,
} from './commands.js';
