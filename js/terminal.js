import { executeCommand, bootSequence, writePrompt } from './shell.js';

let term = null;
let fitAddon = null;
let mode = 'local';
let inputBuffer = '';
let bootDone = false;
let v86InputHandler = null;
let v86ExitBuffer = '';

function detectOS() {
  const ua = navigator.userAgent;
  if (/mac/i.test(ua)) return 'macos';
  if (/win/i.test(ua)) return 'windows';
  if (/linux/i.test(ua)) return 'linux';
  return 'macos';
}

function applyOSTheme(os) {
  document.body.setAttribute('data-os', os);
  const win = document.querySelector('.terminal-window');
  if (!win) return;
  win.classList.remove('macos', 'windows', 'linux');
  win.classList.add(os);
  const titleEl = win.querySelector('.terminal-title');
  if (os === 'macos') titleEl.textContent = 'devkumar@dvxb.io — bash — 80×24';
  else if (os === 'windows') titleEl.textContent = 'dvxb.io — Command Prompt';
  else titleEl.textContent = 'devkumar@dvxb.io — bash';
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
  for (const char of data) {
    if (char === '\r') {
      term.write('\r\n');
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
  applyOSTheme(detectOS());

  term = new window.Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    cols: 300,
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
