// Persistent Assistant Memory Engine (localStorage)
const MEMORY_KEY = 'dvxb_ai_memory_v1';
const HISTORY_KEY = 'dvxb_ai_history_v1';
// WAVE 10: memory ON/OFF switch. ON (default) feeds saved facts + recent
// turns into the next AI prompt via buildMemoryPromptContext; OFF keeps the
// stored data on disk but injects nothing (`ai-memory off`). Shown in
// `ai-memory` and `ai details` so OFF visibly stops the injection.
const MEMORY_ENABLED_KEY = 'dvxb_ai_memory_enabled_v1';

export function getStoredMemory() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : { facts: [], preferences: {} };
  } catch (_) {
    return { facts: [], preferences: {} };
  }
}

export function saveUserFact(fact) {
  if (!fact || typeof fact !== 'string') return;
  const mem = getStoredMemory();
  if (!mem.facts.includes(fact)) {
    mem.facts.push(fact);
    if (mem.facts.length > 20) mem.facts.shift(); // Keep top 20 facts
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(mem));
    } catch (storageError) {
      console.warn(`user fact kept in memory only: ${storageError.message}`);
    }
  }
}

export function getStoredHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function appendHistoryTurn(role, content) {
  const history = getStoredHistory();
  history.push({ role, content, timestamp: new Date().toISOString() });
  if (history.length > 10) history.shift(); // Retain last 10 turns
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (storageError) {
    console.warn(`history turn kept in memory only: ${storageError.message}`);
  }
}

export function clearMemory() {
  try {
    localStorage.removeItem(MEMORY_KEY);
    localStorage.removeItem(HISTORY_KEY);
  } catch (storageError) {
    console.warn(`clearMemory skipped browser storage: ${storageError.message}`);
  }
}

// Memory injection switch (default ON). Stored separately from the facts so
// `ai-memory clear` wipes content without flipping the switch.
export function isMemoryEnabled() {
  try {
    const storedFlag = localStorage.getItem(MEMORY_ENABLED_KEY);
    if (storedFlag === null) return true;
    return storedFlag !== `0`;
  } catch (storageError) {
    console.warn(`memory flag read skipped: ${storageError.message}`);
    return true;
  }
}

export function setMemoryEnabled(enabledFlag) {
  try {
    localStorage.setItem(MEMORY_ENABLED_KEY, enabledFlag ? `1` : `0`);
  } catch (storageError) {
    console.warn(`memory flag write skipped: ${storageError.message}`);
  }
}

export function buildMemoryPromptContext() {
  if (!isMemoryEnabled()) return '';
  const mem = getStoredMemory();
  const history = getStoredHistory();

  let contextStr = '';
  if (mem.facts.length) {
    contextStr += `[Saved User Memory Facts]\n${mem.facts.map(f => `- ${f}`).join('\n')}\n\n`;
  }
  if (history.length) {
    contextStr += `[Recent Conversation History]\n${history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}\n\n`;
  }
  return contextStr;
}
