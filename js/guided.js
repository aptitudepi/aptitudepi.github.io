// js/guided.js — Guided/Shell toggle plus plain-language action buttons.
//
// First-time visitors land in Guided mode (persisted in localStorage);
// every button narrates its intent, shows the raw registry command it is
// about to run, then executes that exact line through the shell dispatcher
// (window.executeTerminalCommand). The GUI never calls a registry run
// function directly, so a guided button and the typed command are the same
// code path by construction.

import { resolveCommand, SITE_MUTED, SITE_GREEN, SITE_WHITE, ANSI_RESET } from './commands.js';
import { executeCommand } from './shell.js';
import { getMode, getTerm, isBootDone } from './terminal.js';

const GUIDED_MODE_KEY = 'dvxb.terminalMode';

const GUIDED_ACTIONS = [
  { label: 'Show projects', intent: 'Listing portfolio projects and links', command: 'ls links' },
  { label: 'Check weather', intent: 'Fetching local weather', command: 'weather' },
  { label: 'Read HN', intent: 'Reading Hacker News top stories', command: 'hn' },
  { label: 'Ask AI', intent: 'Asking the portfolio AI assistant', command: null },
  { label: 'Run Linux', intent: 'Booting Linux in the browser (5–15s)', command: 'vm' },
];

let guidedPanel = null;
let guidedToggle = null;
let guidedAiInput = null;

function readStoredMode() {
  try {
    const storedMode = window.localStorage.getItem(GUIDED_MODE_KEY);
    return storedMode === 'shell' ? 'shell' : 'guided';
  } catch (storageError) {
    console.warn(`guided mode storage unreadable: ${storageError.message}`);
    return 'guided';
  }
}

function storeMode(nextMode) {
  try {
    window.localStorage.setItem(GUIDED_MODE_KEY, nextMode);
  } catch (storageError) {
    console.warn(`guided mode storage unwritable: ${storageError.message}`);
  }
}

function applyMode(nextMode) {
  storeMode(nextMode);
  if (guidedPanel) guidedPanel.hidden = nextMode !== 'guided';
  if (guidedToggle) {
    guidedToggle.querySelectorAll('[data-terminal-mode]').forEach((modeButton) => {
      const isActive = modeButton.dataset.terminalMode === nextMode;
      modeButton.classList.toggle('active', isActive);
      modeButton.setAttribute('aria-pressed', String(isActive));
    });
  }
}

// Narrated echo: intent line, then the raw command line, then the real
// output. A guided run of `ls links` differs from typing it only by these
// two narration lines. Gated states never fail silently: a pre-boot or
// Linux-mode click narrates why it did not run (first-time visitors land
// in Guided mode and click fast, so a dead button reads as "AI is broken").
function runGuidedCommand(commandLine, intentText) {
  const activeTerm = getTerm();
  if (!activeTerm) return false;
  if (!isBootDone()) {
    activeTerm.writeln(`${SITE_MUTED}Terminal is still booting — your pick did not run. Retry in a moment.${ANSI_RESET}`);
    return false;
  }
  if (getMode() !== 'local') {
    activeTerm.writeln(`${SITE_MUTED}Exit Linux first (Exit Linux button), then retry your pick.${ANSI_RESET}`);
    return false;
  }
  const lineTokens = String(commandLine).trim().split(/\s+/);
  if (!resolveCommand(lineTokens[0] ?? '')) return false;
  activeTerm.writeln(`${SITE_MUTED}◈ ${intentText}${ANSI_RESET}`);
  activeTerm.writeln(`${SITE_GREEN}❯${ANSI_RESET} ${SITE_WHITE}${commandLine}${ANSI_RESET}`);
  executeCommand(commandLine, activeTerm);
  return true;
}

function buildGuidedPanel() {
  guidedPanel = document.getElementById('guided-panel');
  if (!guidedPanel) return;
  guidedPanel.textContent = '';
  const introLine = document.createElement('p');
  introLine.className = 'guided-intro';
  introLine.textContent = 'Guided mode — pick what to do; the exact command is shown before it runs.';
  guidedPanel.appendChild(introLine);
  const buttonRow = document.createElement('div');
  buttonRow.className = 'guided-buttons';
  for (const guidedAction of GUIDED_ACTIONS) {
    if (guidedAction.command === null) continue;
    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'guided-button';
    actionButton.textContent = guidedAction.label;
    actionButton.addEventListener('click', () => {
      runGuidedCommand(guidedAction.command, guidedAction.intent);
    });
    buttonRow.appendChild(actionButton);
  }
  guidedPanel.appendChild(buttonRow);
  const aiRow = document.createElement('form');
  aiRow.className = 'guided-ai-row';
  guidedAiInput = document.createElement('input');
  guidedAiInput.type = 'text';
  guidedAiInput.className = 'guided-ai-input';
  guidedAiInput.placeholder = 'Ask AI anything…';
  guidedAiInput.setAttribute('aria-label', 'Ask the portfolio AI assistant');
  const aiButton = document.createElement('button');
  aiButton.type = 'submit';
  aiButton.className = 'guided-button guided-ai-button';
  aiButton.textContent = 'Ask AI';
  aiRow.appendChild(guidedAiInput);
  aiRow.appendChild(aiButton);
  aiRow.addEventListener('submit', (submitEvent) => {
    submitEvent.preventDefault();
    const promptText = guidedAiInput.value.trim();
    if (!promptText) return;
    guidedAiInput.value = '';
    runGuidedCommand(`ai ${promptText}`, 'Asking the portfolio AI assistant');
  });
  guidedPanel.appendChild(aiRow);
}

function buildModeToggle() {
  guidedToggle = document.getElementById('terminal-mode-toggle');
  if (!guidedToggle) return;
  guidedToggle.querySelectorAll('[data-terminal-mode]').forEach((modeButton) => {
    modeButton.addEventListener('click', () => {
      applyMode(modeButton.dataset.terminalMode);
    });
  });
}

function initGuided() {
  buildGuidedPanel();
  buildModeToggle();
  applyMode(readStoredMode());
}

export { initGuided, runGuidedCommand, GUIDED_ACTIONS, GUIDED_MODE_KEY };
