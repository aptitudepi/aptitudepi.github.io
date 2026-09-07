// js/foreground.js — single-flight foreground runner for the shell.
//
// Exactly one foreground command owns the terminal at a time: every shell
// execution (sync fast path plus async ai/weather/hn/md/vm/search/myip/wall/
// ai-memory/devmode) runs inside runForeground, which owns the single
// post-completion prompt. A second submit while busy prints a busy line
// naming the running command and is refused (no queueing). Ctrl+C aborts the
// run's AbortController; an AbortError surfaces as a neutral `^C cancelled`
// line, never an error stack. A visible role=status node announces active
// runs to screen readers; it lives in the DOM (not the xterm stream) so the
// deterministic golden snapshots stay byte-exact.

let currentRun = null;
let promptRenderer = null;

const FG_MUTED = '\x1b[38;2;140;140;155m';
const FG_RESET = '\x1b[0m';

function setPromptRenderer(renderer) {
  promptRenderer = renderer;
}

function isForegroundBusy() {
  return currentRun !== null;
}

function currentForegroundName() {
  return currentRun ? currentRun.commandName : null;
}

function requestForegroundCancel() {
  if (!currentRun) return false;
  currentRun.abortController.abort();
  return true;
}

function isAbortError(workError) {
  return Boolean(workError) && workError.name === 'AbortError';
}

function ensureForegroundStatusNode() {
  if (typeof document === 'undefined') return null;
  const existingNode = document.getElementById('foreground-status');
  if (existingNode) return existingNode;
  const termContainer = document.getElementById('terminal-container');
  if (!termContainer || !termContainer.parentNode) return null;
  const statusNode = document.createElement('div');
  statusNode.id = 'foreground-status';
  statusNode.setAttribute('role', 'status');
  statusNode.setAttribute('aria-live', 'polite');
  statusNode.style.cssText = 'display:none;font:12px monospace;opacity:0.85;padding:2px 8px;';
  termContainer.parentNode.insertBefore(statusNode, termContainer.nextSibling);
  return statusNode;
}

function showForegroundStatus(commandName) {
  const statusNode = ensureForegroundStatusNode();
  if (!statusNode) return;
  statusNode.textContent = `${commandName} running — Ctrl+C to cancel…`;
  statusNode.style.display = 'block';
}

function hideForegroundStatus() {
  if (typeof document === 'undefined') return;
  const statusNode = document.getElementById('foreground-status');
  if (!statusNode) return;
  statusNode.style.display = 'none';
  statusNode.textContent = '';
}

// Run workFunction(runSignal) as the single foreground command. Refuses with
// a busy line when another command is active. Resolves true when the work ran
// (exactly one prompt is rendered here), false when refused. A work result of
// exactly false skips the trailing prompt (v86 takes over the terminal).
async function runForeground(commandName, term, workFunction) {
  if (currentRun) {
    const runningName = currentRun.commandName;
    term.writeln(`${FG_MUTED}${commandName} is blocked — ${runningName} is still running (Ctrl+C to cancel)${FG_RESET}`);
    return false;
  }
  const abortController = new AbortController();
  currentRun = { commandName, abortController };
  showForegroundStatus(commandName);
  let workResult;
  let wasCancelled = false;
  try {
    workResult = await workFunction(abortController.signal);
    wasCancelled = abortController.signal.aborted;
  } catch (workError) {
    wasCancelled = abortController.signal.aborted || isAbortError(workError);
    if (!wasCancelled) throw workError;
  } finally {
    currentRun = null;
    hideForegroundStatus();
    if (wasCancelled) term.writeln(`${FG_MUTED}^C cancelled${FG_RESET}`);
    if (promptRenderer && (wasCancelled || workResult !== false)) promptRenderer(term);
  }
  return true;
}

export { runForeground, setPromptRenderer, isForegroundBusy, currentForegroundName, requestForegroundCancel, isAbortError };
