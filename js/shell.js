import { runForeground, setPromptRenderer, isForegroundBusy } from './foreground.js';
import {
  neofetch, SITE_GREEN, SITE_WHITE, SITE_CYAN, SITE_BLUE, SITE_MUTED, SITE_OK,
  SITE_ERR, SITE_FAINT, ANSI_RESET, resolveCommand, suggestCommand,
  tokenizeCommandLine, setPrefetchedLocation, recordCommandOutput, BOOT_SCRIPT,
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
  fetch('https://ipapi.co/json/')
    .then(r => r.json())
    .then(d => { setPrefetchedLocation({ lat: d.latitude, lon: d.longitude, city: d.city, region: d.region, region_code: d.region_code, country: d.country_code }); })
    .catch(() => {});
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
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      // Prefer the spec'd plain RENDERER string — real GPU name on modern
      // engines, so no UA sniff and no deprecated debug-info extension probe
      // (Firefox logs a warning for it). Fall back to the extension only when
      // RENDERER is a useless generic placeholder (older engines).
      let r = '';
      try { r = String(gl.getParameter(gl.RENDERER) || '').trim(); } catch (_) { r = ''; }
      if (/^(webkit webgl|mozilla|generic|unknown)/i.test(r)) r = '';
      if (!r) {
        try {
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          if (ext) r = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').trim();
        } catch (_) { r = ''; }
      }
      return r.replace(/^ANGLE\s*\(/i, '').replace(/\)$/, '') || 'Unknown';
    }
  } catch (_) {}
  return 'Unknown';
}

let BOOT_MSGS = null;

function writePrompt(term) {
  term.write(`\r\n${SITE_GREEN}db${ANSI_RESET}${SITE_WHITE}@${ANSI_RESET}${SITE_CYAN}dvxb.io${ANSI_RESET}${SITE_MUTED} ${ANSI_RESET}${SITE_BLUE}~${ANSI_RESET}${SITE_MUTED}❯ ${ANSI_RESET}`);
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
      { text: `[    0.000000] Booting dvxb.io...`, color: SITE_FAINT },
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
