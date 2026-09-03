import { executeCommand, bootSequence, writePrompt, COMMANDS, vfs, SITE_FAINT, ANSI_RESET } from './shell.js';
import { CMD_HISTORY } from './shell.js';

let term = null;
let fitAddon = null;
let mode = 'local';
let inputBuffer = '';
let bootDone = false;
let v86InputHandler = null;
let v86ExitBuffer = '';

function collectTabCandidates(partial, isPath) {
  const candidates = [];
  const parts = partial.split(/\s+/);
  const completeBase = !isPath && parts.length > 1 ? parts[parts.length - 1] : partial;
  if (isPath) {
    for (const key of vfs.keys()) {
      const base = partial.startsWith('/') ? key : key.replace(/^\/home\/db\//, './');
      if (base.startsWith(partial)) candidates.push(base);
    }
    return { candidates, completeBase };
  }
  const lastWord = parts[parts.length - 1];
  if (parts.length > 1) {
    for (const key of vfs.keys()) {
      const base = key.replace(/^\/home\/db\//, '');
      if (base.startsWith(lastWord)) candidates.push(base);
    }
    if (!candidates.length) {
      for (const c of COMMANDS) {
        if (c.startsWith(lastWord)) candidates.push(c);
      }
    }
  } else {
    for (const c of COMMANDS) {
      if (c.startsWith(partial)) candidates.push(c);
    }
    if (!candidates.length) {
      for (const key of vfs.keys()) {
        const base = key.replace(/^\/home\/db\//, '');
        const display = base.endsWith('.txt') || base.endsWith('.md') || base.endsWith('.pdf') ? base : `${base}/`;
        if (display.startsWith(partial)) candidates.push(display);
      }
    }
  }
  return { candidates, completeBase };
}

function applySingleCompletion(activeTerm, completion, completeBase) {
  const rest = completion.slice(completeBase.length);
  const addTrailing = !completion.endsWith('/') && !completion.endsWith('.txt') && !completion.endsWith('.md');
  const suffix = addTrailing ? ' ' : '';
  for (const ch of `${rest}${suffix}`) { inputBuffer += ch; activeTerm.write(ch); }
}

function applyCompletionList(activeTerm, candidates, completeBase) {
  const prefixLen = candidates.reduce((len, c) => {
    let i = 0;
    while (i < len && i < c.length && c[i] === candidates[0][i]) i++;
    return i;
  }, Infinity);
  if (prefixLen > completeBase.length) {
    const common = candidates[0].slice(completeBase.length, prefixLen);
    for (const ch of common) { inputBuffer += ch; activeTerm.write(ch); }
    return true;
  }
  activeTerm.write('\r\n');
  candidates.forEach(c => activeTerm.writeln(`${SITE_FAINT}${c}${ANSI_RESET}`));
  writePrompt(activeTerm);
  activeTerm.write(inputBuffer);
  return true;
}

function handleTabCompletion(activeTerm) {
  if (!bootDone || !inputBuffer.trim()) return;
  const partial = inputBuffer.trim().toLowerCase();
  const isPath = partial.startsWith('./') || partial.startsWith('/') || partial.startsWith('~');
  const { candidates, completeBase } = collectTabCandidates(partial, isPath);
  if (candidates.length === 1) {
    applySingleCompletion(activeTerm, candidates[0], completeBase);
  } else if (candidates.length > 1) {
    applyCompletionList(activeTerm, candidates, completeBase);
  } else {
    activeTerm.write('\x07');
  }
}

function handleInput(data) {
  if (mode === 'v86') {
    v86ExitBuffer = (v86ExitBuffer + data.toLowerCase()).slice(-30);
    if (data === '\x1a' || v86ExitBuffer.includes('exit\r') || v86ExitBuffer.includes('exit\n')) {
      v86ExitBuffer = '';
      if (typeof window.exitVM === 'function') window.exitVM();
      return;
    }
    if (v86InputHandler) v86InputHandler(data);
    return;
  }

  if (data === '\x1b[A') {
    if (!bootDone) return;
    if (CMD_HISTORY.idx < CMD_HISTORY.length - 1) {
      CMD_HISTORY.idx++;
      const entry = CMD_HISTORY[CMD_HISTORY.length - 1 - CMD_HISTORY.idx];
      inputBuffer = entry;
      term.write('\r\x1b[K');
      writePrompt(term);
      term.write(entry);
    }
    return;
  }

  if (data === '\x1b[B') {
    if (!bootDone) return;
    if (CMD_HISTORY.idx >= 0) {
      CMD_HISTORY.idx--;
      if (CMD_HISTORY.idx >= 0) {
        inputBuffer = CMD_HISTORY[CMD_HISTORY.length - 1 - CMD_HISTORY.idx];
      } else {
        inputBuffer = '';
      }
      term.write('\r\x1b[K');
      writePrompt(term);
      term.write(inputBuffer);
    }
    return;
  }

  if (data === '\x1b[C' || data === '\x1b[D') return;

  if (data === '\t') { handleTabCompletion(term); return; }

  for (const char of data) {
    if (char === '\r') {
      term.write('\r\n');
      if (inputBuffer.trim()) {
        CMD_HISTORY.push(inputBuffer);
        CMD_HISTORY.idx = -1;
      }
      const cmd = inputBuffer;
      inputBuffer = '';
      if (bootDone) executeCommand(cmd, term);
    } else if (char === '\x7f') {
      if (inputBuffer.length > 0) {
        inputBuffer = inputBuffer.slice(0, -1);
        term.write('\b \b');
      }
    } else if (char === '\x03') {
      inputBuffer = '';
      term.write('^C\r\n');
      writePrompt(term);
    } else if (char >= ' ') {
      inputBuffer += char;
      term.write(char);
    }
  }
}

function createTerminal(container) {
  term = new window.Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    // registerDecoration (js/orb.js anchors the AI thought orb to a buffer
    // line with it) is behind xterm's proposed-API flag
    allowProposedApi: true,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Menlo', monospace",
    theme: {
      background: 'rgba(0,0,0,0)',
      foreground: '#d4d4d8',
      cursor: '#d4d4d8',
      selectionBackground: 'rgba(120, 120, 220, 0.3)',
      black: '#000000', red: '#dc5050', green: '#50c878', yellow: '#c8b050',
      blue: '#5078c8', magenta: '#c850a0', cyan: '#50b8c8', white: '#d4d4d8',
      brightBlack: '#505050', brightRed: '#f07070', brightGreen: '#70e090',
      brightYellow: '#e0d070', brightBlue: '#7090f0', brightMagenta: '#e070d0',
      brightCyan: '#70d0e0', brightWhite: '#f0f0f8',
    },
  });

  term.open(container);

  // force xterm internal elements transparent for acrylic effect
  const xtermEl = container.querySelector('.xterm');
  if (xtermEl) {
    const vp = xtermEl.querySelector('.xterm-viewport');
    const sc = xtermEl.querySelector('.xterm-screen');
    if (vp) { vp.style.background = 'transparent'; vp.style.backgroundColor = 'transparent'; }
    if (sc) { sc.style.background = 'transparent'; sc.style.backgroundColor = 'transparent'; }
    xtermEl.querySelectorAll('canvas').forEach(c => {
      c.style.background = 'transparent';
      c.style.backgroundColor = 'transparent';
    });
  }

  const FA = window.FitAddon?.FitAddon || window.FitAddon;
  if (typeof FA === 'function') {
    fitAddon = new FA();
    term.loadAddon(fitAddon);
    try { fitAddon.fit(); } catch (_) {}
  }

  const ro = new ResizeObserver(() => {
    if (fitAddon) try { fitAddon.fit(); } catch (_) {}
  });
  ro.observe(container);

  term.onData(handleInput);

  return term;
}

function startBoot() {
  bootSequence(term, () => { bootDone = true; });
}

function setV86InputHandler(handler) {
  v86InputHandler = handler;
  if (handler) v86ExitBuffer = '';
}

function setMode(m) { mode = m; }
function getMode() { return mode; }
function getTerm() { return term; }
function isBootDone() { return bootDone; }

export { createTerminal, startBoot, setMode, getMode, setV86InputHandler, getTerm, isBootDone };
