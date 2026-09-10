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

function revealAiPicker() {
  // The first-run mode picker renders as a chip bar below the terminal,
  // which can sit below the fold on short viewports: bring it into view
  // (nearest-only, instant) so a guided click visibly continues somewhere.
  // Focusing is already handled by the picker itself (first chip takes
  // focus); this only covers the scroll position.
  window.setTimeout(() => {
    const chipbarNode = document.getElementById('ai-mode-chipbar');
    if (chipbarNode && typeof chipbarNode.scrollIntoView === 'function') {
      chipbarNode.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }, 150);
}

function submitGuidedAsk() {
  const promptText = guidedAiInput.value.trim();
  if (!promptText) {
    // An empty Ask-AI click used to be a silent no-op (dead-button feel):
    // focus the question box and narrate what to do next, matching the
    // gated-pick narration style. The hint line only prints when the shell
    // is live so it can never interleave with the boot transcript.
    guidedAiInput.focus();
    const activeTerm = getTerm();
    if (activeTerm && isBootDone() && getMode() === 'local') {
      activeTerm.writeln(`${SITE_MUTED}Type your question in the Ask box first, then Ask AI.${ANSI_RESET}`);
    }
    return;
  }
  // The AI mode (quick/local/controls) is picked once via ai.js; a dynamic
  // import keeps guided.js out of the static ai.js graph (commands.js loads
  // ai.js dynamically too, so no new static edge or cycle either way).
  import('./ai.js').then((aiModule) => {
    const modeChosen = typeof aiModule.getSavedAiMode === 'function'
      && aiModule.getSavedAiMode() !== null;
    // First-run submissions open the mode picker, which stashes the prompt
    // and clears nothing: keep the question text in the box so Esc (which
    // removes the chip bar) leaves a one-click resume instead of forcing a
    // retype. Once a mode exists the prompt streams immediately, so clear.
    if (modeChosen) guidedAiInput.value = '';
    runGuidedCommand(`ai ${promptText}`, 'Asking the portfolio AI assistant');
    if (!modeChosen) revealAiPicker();
  }).catch((importError) => {
    console.warn(`guided ask-ai skipped: ${importError.message}`);
  });
}

function buildGuidedPanel() {
  guidedPanel = document.getElementById('guided-panel');
  if (!guidedPanel) return;
  guidedPanel.textContent = '';
  const introLine = document.createElement('p');
  introLine.className = 'guided-intro';
  introLine.textContent = 'Guided mode — pick what to do; the exact command is shown before it runs.';
  guidedPanel.appendChild(introLine);
  // Single consistent group: the Ask-AI submit button sits in the same row
  // as Run Linux and the other actions (previously a detached second row),
  // sharing one form so Enter in the question box submits identically.
  const askForm = document.createElement('form');
  askForm.className = 'guided-form';
  askForm.setAttribute('aria-label', 'Guided actions');
  const buttonRow = document.createElement('div');
  buttonRow.className = 'guided-buttons';
  for (const guidedAction of GUIDED_ACTIONS) {
    const isAskAction = guidedAction.command === null;
    const actionButton = document.createElement('button');
    actionButton.type = isAskAction ? 'submit' : 'button';
    actionButton.className = 'guided-button';
    actionButton.textContent = guidedAction.label;
    if (!isAskAction) {
      actionButton.addEventListener('click', () => {
        runGuidedCommand(guidedAction.command, guidedAction.intent);
      });
    }
    buttonRow.appendChild(actionButton);
  }
  askForm.appendChild(buttonRow);
  const aiRow = document.createElement('div');
  aiRow.className = 'guided-ai-row';
  guidedAiInput = document.createElement('input');
  guidedAiInput.type = 'text';
  guidedAiInput.className = 'guided-ai-input';
  guidedAiInput.placeholder = 'Ask AI anything…';
  guidedAiInput.setAttribute('aria-label', 'Ask the portfolio AI assistant');
  aiRow.appendChild(guidedAiInput);
  askForm.appendChild(aiRow);
  askForm.addEventListener('submit', (submitEvent) => {
    submitEvent.preventDefault();
    submitGuidedAsk();
  });
  guidedPanel.appendChild(askForm);
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
