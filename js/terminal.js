import { executeCommand, bootSequence, writePrompt, vfs, CMD_HISTORY, stripAnsi } from './shell.js';
import { COMMAND_COMPLETION_NAMES } from './commands.js';
import { isForegroundBusy, requestForegroundCancel } from './foreground.js';

let term = null;
let fitAddon = null;
let mode = 'local';
let inputBuffer = '';
let bootDone = false;
let v86InputHandler = null;
let v86ExitBuffer = '';

// WAVE 7 inline suggestions: a DOM dropdown plus fish-style ghost text.
// Both are pure DOM overlays so the deterministic xterm golden snapshots
// stay byte-exact. Sources are the command registry, VFS paths and history.
let suggestionBox = null;
let suggestionBoxOpen = false;
let suggestionItems = [];
let suggestionIndex = -1;
let suggestionMode = 'complete';
let suppressAutoBox = false;
let ghostNode = null;
let ghostRemainder = '';
let ghostKind = 'token';
let ghostFullLine = '';
let lastCompleteBase = '';
let cachedCellSize = null;

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
      for (const c of COMMAND_COMPLETION_NAMES) {
        if (c.startsWith(lastWord)) candidates.push(c);
      }
    }
  } else {
    for (const c of COMMAND_COMPLETION_NAMES) {
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
  for (const completionChar of `${rest}${suffix}`) { inputBuffer = `${inputBuffer}${completionChar}`; activeTerm.write(completionChar); }
}

// Recent-first full-line history entries that extend the current buffer.
function collectHistoryCandidates(partialLine) {
  const historyMatches = [];
  const seenHistoryLines = new Set();
  for (let historyCursor = CMD_HISTORY.length - 1; historyCursor >= 0; historyCursor--) {
    const historyEntry = stripAnsi(String(CMD_HISTORY[historyCursor] ?? ''));
    if (historyEntry.length === 0 || seenHistoryLines.has(historyEntry)) continue;
    seenHistoryLines.add(historyEntry);
    const matchesQuery = partialLine === null || (historyEntry.toLowerCase().startsWith(partialLine) && historyEntry !== inputBuffer);
    if (matchesQuery) {
      historyMatches.push({ label: historyEntry, kind: 'history' });
    }
    if (historyMatches.length >= 8) break;
  }
  return historyMatches;
}

// Merged candidate list: history full lines first, then the registry/VFS
// token completions from the Tab engine. In history-search mode only the
// history source is shown.
function collectAllCandidates() {
  const partialLine = inputBuffer.trim().toLowerCase();
  if (!partialLine) {
    if (suggestionMode === 'history') return collectHistoryCandidates(null);
    return [];
  }
  const mergedCandidates = [...collectHistoryCandidates(partialLine)];
  if (suggestionMode === 'history') return mergedCandidates;
  const pathFlag = partialLine.startsWith('./') || partialLine.startsWith('/') || partialLine.startsWith('~');
  const tabResult = collectTabCandidates(partialLine, pathFlag);
  lastCompleteBase = tabResult.completeBase;
  const seenLabels = new Set(mergedCandidates.map((candidate) => candidate.label));
  for (const tokenCandidate of tabResult.candidates) {
    if (!seenLabels.has(tokenCandidate)) {
      seenLabels.add(tokenCandidate);
      mergedCandidates.push({ label: tokenCandidate, kind: 'token' });
    }
  }
  return mergedCandidates.slice(0, 12);
}

function candidateSourceTag(candidate) {
  if (candidate.kind === 'history') return 'history';
  if (COMMAND_COMPLETION_NAMES.includes(candidate.label.trim())) return 'cmd';
  return 'file';
}

function ensureSuggestionBox() {
  if (suggestionBox) return suggestionBox;
  const hostNode = document.getElementById('terminal-container');
  if (!hostNode) return null;
  suggestionBox = document.createElement('div');
  suggestionBox.id = 'terminal-suggestions';
  suggestionBox.setAttribute('role', 'listbox');
  suggestionBox.setAttribute('aria-label', 'Command suggestions');
  suggestionBox.hidden = true;
  hostNode.appendChild(suggestionBox);
  return suggestionBox;
}

function openSuggestionBox() {
  const boxNode = ensureSuggestionBox();
  if (!boxNode) return;
  suggestionBoxOpen = true;
  boxNode.hidden = false;
}

function hideSuggestionBox() {
  suggestionBoxOpen = false;
  suggestionIndex = -1;
  if (suggestionBox) suggestionBox.hidden = true;
}

function hideSuggestions() {
  hideSuggestionBox();
  suggestionMode = 'complete';
  ghostRemainder = '';
  ghostFullLine = '';
  renderGhostText();
}

function closeSuggestions() {
  const wasOpen = suggestionBoxOpen || suggestionMode === 'history';
  hideSuggestions();
  return wasOpen;
}

function renderSuggestionBox(candidates) {
  const boxNode = ensureSuggestionBox();
  if (!boxNode) return;
  boxNode.textContent = '';
  suggestionItems = candidates;
  if (suggestionIndex >= candidates.length) suggestionIndex = candidates.length - 1;
  const modeHeader = document.createElement('div');
  modeHeader.className = 'suggest-header';
  modeHeader.textContent = suggestionMode === 'history' ? '(reverse-i-search) history' : 'suggestions';
  boxNode.appendChild(modeHeader);
  candidates.forEach((candidate, candidateIndex) => {
    const itemButton = document.createElement('button');
    itemButton.type = 'button';
    itemButton.className = 'suggest-item';
    itemButton.setAttribute('role', 'option');
    if (candidateIndex === suggestionIndex) {
      itemButton.classList.add('active');
      itemButton.setAttribute('aria-selected', 'true');
    }
    const labelSpan = document.createElement('span');
    labelSpan.className = 'suggest-label';
    labelSpan.textContent = candidate.label;
    const tagSpan = document.createElement('span');
    tagSpan.className = 'suggest-tag';
    tagSpan.textContent = candidateSourceTag(candidate);
    itemButton.appendChild(labelSpan);
    itemButton.appendChild(tagSpan);
    itemButton.addEventListener('mousedown', (pressEvent) => {
      pressEvent.preventDefault();
      acceptCandidate(candidate);
      if (term) term.focus();
      refreshSuggestions();
    });
    itemButton.addEventListener('mousemove', () => {
      if (suggestionIndex !== candidateIndex) {
        suggestionIndex = candidateIndex;
        renderSuggestionBox(suggestionItems);
      }
    });
    boxNode.appendChild(itemButton);
  });
  const footerHint = document.createElement('div');
  footerHint.className = 'suggest-footer';
  footerHint.textContent = 'Tab accept · ↑↓ navigate · Enter run · Esc close';
  boxNode.appendChild(footerHint);
}

function measureCellSize() {
  if (cachedCellSize) return cachedCellSize;
  const probeNode = document.createElement('div');
  probeNode.textContent = 'M';
  probeNode.style.cssText = 'position:absolute;visibility:hidden;font:13px "JetBrains Mono", monospace;line-height:1.5;';
  document.body.appendChild(probeNode);
  cachedCellSize = { width: probeNode.offsetWidth || 8, height: probeNode.offsetHeight || 20 };
  probeNode.remove();
  return cachedCellSize;
}

function ensureGhostNode() {
  if (ghostNode) return ghostNode;
  const hostNode = document.getElementById('terminal-container');
  if (!hostNode) return null;
  ghostNode = document.createElement('span');
  ghostNode.id = 'terminal-ghost';
  ghostNode.setAttribute('aria-hidden', 'true');
  hostNode.appendChild(ghostNode);
  return ghostNode;
}

function renderGhostText() {
  const ghostElement = ensureGhostNode();
  if (!ghostElement) return;
  if (!ghostRemainder || mode !== 'local' || bootDone === false) {
    ghostElement.style.display = 'none';
    return;
  }
  const cellSize = measureCellSize();
  const activeBuffer = term.buffer.active;
  ghostElement.textContent = ghostRemainder;
  ghostElement.style.display = 'block';
  ghostElement.style.left = `${8 + activeBuffer.cursorX * cellSize.width}px`;
  ghostElement.style.top = `${8 + activeBuffer.cursorY * cellSize.height}px`;
}

function refreshSuggestions() {
  if (!term || bootDone === false || mode !== 'local' || isForegroundBusy()) {
    hideSuggestions();
    return;
  }
  const candidates = collectAllCandidates();
  if (candidates.length > 0) {
    const topCandidate = candidates[suggestionIndex >= 0 && suggestionIndex < candidates.length ? suggestionIndex : 0];
    if (topCandidate.kind === 'history') {
      ghostKind = 'history';
      ghostFullLine = topCandidate.label;
      ghostRemainder = topCandidate.label.slice(inputBuffer.length);
    } else {
      ghostKind = 'token';
      ghostFullLine = '';
      ghostRemainder = topCandidate.label.slice(lastCompleteBase.length);
    }
  } else {
    ghostRemainder = '';
    ghostFullLine = '';
  }
  renderGhostText();
  if (suggestionBoxOpen) {
    if (candidates.length === 0) {
      hideSuggestionBox();
    } else {
      renderSuggestionBox(candidates);
    }
  } else if (!suppressAutoBox && candidates.length > 0 && candidates.length <= 8 && inputBuffer.trim()) {
    openSuggestionBox();
    renderSuggestionBox(candidates);
  }
}

function acceptGhostText() {
  if (!ghostRemainder || mode !== 'local' || bootDone === false || isForegroundBusy()) return false;
  if (ghostKind === 'history' && ghostFullLine) {
    inputBuffer = ghostFullLine;
    redrawInputLine();
  } else {
    for (const ghostChar of ghostRemainder) {
      inputBuffer = `${inputBuffer}${ghostChar}`;
      term.write(ghostChar);
    }
  }
  ghostRemainder = '';
  ghostFullLine = '';
  renderGhostText();
  refreshSuggestions();
  return true;
}

function acceptCandidate(candidate) {
  if (candidate.kind === 'history') {
    inputBuffer = candidate.label;
    redrawInputLine();
    return;
  }
  applySingleCompletion(term, candidate.label, lastCompleteBase);
}

function redrawInputLine() {
  term.write('\r\x1b[K');
  writePrompt(term);
  term.write(inputBuffer);
}

function submitBufferLine() {
  term.write('\r\n');
  const commandLine = inputBuffer;
  if (commandLine.trim()) {
    CMD_HISTORY.push(commandLine);
    CMD_HISTORY.idx = -1;
  }
  inputBuffer = '';
  suppressAutoBox = false;
  hideSuggestions();
  if (bootDone) executeCommand(commandLine, term);
}

// Strip leading shell prompts ($, ❯, user@host) from pasted text so a
// docs-site copy-paste runs instead of failing with "command not found".
function cleanPastedLine(rawLine) {
  const trimmedLine = String(rawLine).replace(/^\s+/, '').replace(/\s+$/, '');
  const promptPatterns = [
    /^db@dvxb\.io.*❯\s*/,
    /^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+:[^#$]*[#$]\s*/,
    /^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+\s+[#$]\s*/,
    /^\$[ \t]+/,
    /^[❯>#][ \t]+/,
  ];
  for (const promptPattern of promptPatterns) {
    if (promptPattern.test(trimmedLine)) return trimmedLine.replace(promptPattern, '');
  }
  return trimmedLine;
}

function looksLikePaste(chunk) {
  return chunk.includes('\n') || chunk.length > 12;
}

function handlePaste(pastedText) {
  const endsWithNewline = /(\r\n|\r|\n)$/.test(pastedText);
  const rawLines = String(pastedText).split(/\r\n|\r|\n/);
  const cleanedLines = rawLines.map(cleanPastedLine).filter((cleanedLine) => cleanedLine.length > 0);
  cleanedLines.forEach((cleanedLine, lineIndex) => {
    const isLastLine = lineIndex === cleanedLines.length - 1;
    if (isLastLine && !endsWithNewline) {
      inputBuffer = `${inputBuffer}${cleanedLine}`;
      term.write(cleanedLine);
      return;
    }
    inputBuffer = `${inputBuffer}${cleanedLine}`;
    term.write(cleanedLine);
    submitBufferLine();
  });
}

function openHistorySearch() {
  if (!bootDone || isForegroundBusy() || mode !== 'local') return;
  suggestionMode = 'history';
  suggestionIndex = -1;
  openSuggestionBox();
  refreshSuggestions();
}

function handleTabCompletion(activeTerm) {
  if (!bootDone || isForegroundBusy() || mode !== 'local') return;
  if (suggestionBoxOpen && suggestionItems.length > 0) {
    const pickIndex = suggestionIndex < 0 ? 0 : suggestionIndex;
    acceptCandidate(suggestionItems[pickIndex]);
    refreshSuggestions();
    return;
  }
  if (!inputBuffer.trim()) return;
  const candidates = collectAllCandidates();
  if (candidates.length === 0) {
    activeTerm.write('\x07');
    return;
  }
  if (candidates.length === 1) {
    acceptCandidate(candidates[0]);
    refreshSuggestions();
    return;
  }
  const tokenLabels = candidates.filter((candidate) => candidate.kind === 'token').map((candidate) => candidate.label);
  if (tokenLabels.length > 1) {
    let sharedLength = tokenLabels[0].length;
    for (const tokenLabel of tokenLabels.slice(1)) {
      let cursor = 0;
      while (cursor < sharedLength && cursor < tokenLabel.length && tokenLabel[cursor] === tokenLabels[0][cursor]) cursor++;
      sharedLength = cursor;
    }
    if (sharedLength > lastCompleteBase.length) {
      const sharedPrefix = tokenLabels[0].slice(0, sharedLength);
      const missingPrefix = sharedPrefix.slice(lastCompleteBase.length);
      for (const prefixChar of missingPrefix) {
        inputBuffer = `${inputBuffer}${prefixChar}`;
        activeTerm.write(prefixChar);
      }
    }
  }
  openSuggestionBox();
  refreshSuggestions();
}

function moveSuggestionHighlight(step) {
  const candidates = suggestionItems.length > 0 ? suggestionItems : collectAllCandidates();
  if (candidates.length === 0) return;
  if (!suggestionBoxOpen) openSuggestionBox();
  suggestionIndex = suggestionIndex < 0 ? 0 : (suggestionIndex + step + candidates.length) % candidates.length;
  renderSuggestionBox(candidates);
  const highlighted = candidates[suggestionIndex];
  if (highlighted.kind === 'history') {
    ghostKind = 'history';
    ghostFullLine = highlighted.label;
    ghostRemainder = highlighted.label.slice(inputBuffer.length);
  } else {
    ghostKind = 'token';
    ghostFullLine = '';
    ghostRemainder = highlighted.label.slice(lastCompleteBase.length);
  }
  renderGhostText();
}

function handleInput(data) {
  if (mode === 'v86') {
    v86ExitBuffer = `${v86ExitBuffer}${data.toLowerCase()}`.slice(-30);
    if (data === '\x1a' || v86ExitBuffer.includes('exit\r') || v86ExitBuffer.includes('exit\n')) {
      v86ExitBuffer = '';
      if (typeof window.exitVM === 'function') window.exitVM();
      return;
    }
    if (v86InputHandler) v86InputHandler(data);
    return;
  }

  if (data === '\x12') { openHistorySearch(); return; }
  if (data === '\x06') {
    if (acceptGhostText()) return;
  }
  if (data === '\x1b') {
    if (closeSuggestions()) {
      suppressAutoBox = true;
      return;
    }
  }
  if (data === '\x1b[C') {
    if (acceptGhostText()) return;
    return;
  }
  if (data === '\x1b[D') return;

  if (data === '\x1b[A') {
    if (!bootDone || isForegroundBusy()) return;
    if (suggestionBoxOpen) { moveSuggestionHighlight(-1); return; }
    if (CMD_HISTORY.idx < CMD_HISTORY.length - 1) {
      CMD_HISTORY.idx++;
      const entry = CMD_HISTORY[CMD_HISTORY.length - 1 - CMD_HISTORY.idx];
      inputBuffer = entry;
      term.write('\r\x1b[K');
      writePrompt(term);
      term.write(entry);
      refreshSuggestions();
    }
    return;
  }

  if (data === '\x1b[B') {
    if (!bootDone || isForegroundBusy()) return;
    if (suggestionBoxOpen) { moveSuggestionHighlight(1); return; }
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
      refreshSuggestions();
    }
    return;
  }

  if (data === '\t') { handleTabCompletion(term); return; }

  if (looksLikePaste(data)) {
    if (!bootDone || isForegroundBusy()) return;
    suppressAutoBox = false;
    handlePaste(data);
    refreshSuggestions();
    return;
  }

  for (const char of data) {
    if (char === '\r') {
      submitBufferLine();
    } else if (char === '\x7f') {
      if (inputBuffer.length > 0) {
        inputBuffer = inputBuffer.slice(0, -1);
        term.write('\b \b');
        suppressAutoBox = false;
      }
    } else if (char === '\x03') {
      if (isForegroundBusy()) {
        inputBuffer = '';
        hideSuggestions();
        requestForegroundCancel();
      } else {
        inputBuffer = '';
        hideSuggestions();
        term.write('^C\r\n');
        writePrompt(term);
      }
    } else if (char >= ' ') {
      inputBuffer = `${inputBuffer}${char}`;
      term.write(char);
      suppressAutoBox = false;
    }
  }
  refreshSuggestions();
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

  // Refit once webfonts arrive: measuring with the fallback font
  // under-reports cell width and permanently narrows the terminal.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => { if (fitAddon) try { fitAddon.fit(); } catch (_) { /* best-effort refit; ignore errors */ } });
  }

  const ro = new ResizeObserver(() => {
    cachedCellSize = null;
    if (fitAddon) try { fitAddon.fit(); } catch (_) {}
  });
  ro.observe(container);

  // Ghost text is cursor-anchored: hide it while the buffer scrolls under
  // it so a stale overlay never floats over old output.
  container.addEventListener('scroll', () => {
    if (ghostNode) ghostNode.style.display = 'none';
  }, true);

  // Touch-scroll fallback for the terminal buffer: xterm 6.0.0 broke native
  // touch scrolling upstream, and its canvas absorbs touches before any
  // viewport handler sees them — so translate single-finger drags here.
  // Multi-touch bails (native pinch preserved); sub-8px taps pass through
  // untouched so focus/click still work. Remove if upgrading past the fix.
  {
    let touchY = null;
    const rowH = () => (container.clientHeight || 1) / Math.max(1, term.rows);
    container.addEventListener('touchstart', e => {
      touchY = e.touches.length === 1 ? e.touches[0].clientY : null;
    }, { passive: true });
    container.addEventListener('touchmove', e => {
      if (touchY === null || e.touches.length !== 1) { touchY = null; return; }
      const deltaY = touchY - e.touches[0].clientY;
      if (Math.abs(deltaY) >= rowH()) {
        term.scrollLines(-Math.round(deltaY / rowH()));
        touchY = e.touches[0].clientY;
      }
    }, { passive: true });
    container.addEventListener('touchend', () => { touchY = null; });
    container.addEventListener('touchcancel', () => { touchY = null; });
  }

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

function setMode(nextMode) {
  mode = nextMode;
  if (typeof document === 'undefined') return;
  const modePill = document.getElementById('mode-pill');
  if (modePill) {
    const pillLabel = nextMode === 'v86' ? 'linux' : 'shell';
    modePill.textContent = pillLabel;
    modePill.dataset.mode = pillLabel;
  }
  const exitButton = document.getElementById('exit-vm-button');
  if (exitButton) exitButton.hidden = nextMode !== 'v86';
}
function getMode() { return mode; }
function getTerm() { return term; }
function isBootDone() { return bootDone; }

export { createTerminal, startBoot, setMode, getMode, setV86InputHandler, getTerm, isBootDone };
