// Persistent Assistant Memory Engine (localStorage + IndexedDB backup)
const MEMORY_KEY = 'dvxb_ai_memory_v1';
const HISTORY_KEY = 'dvxb_ai_history_v1';

export function getStoredMemory() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : { facts: [], preferences: {} };
  } catch (e) {
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
    } catch (e) {}
  }
}

export function getStoredHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function appendHistoryTurn(role, content) {
  const history = getStoredHistory();
  history.push({ role, content, timestamp: new Date().toISOString() });
  if (history.length > 10) history.shift(); // Retain last 10 turns
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {}
}

export function clearMemory() {
  try {
    localStorage.removeItem(MEMORY_KEY);
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {}
}

export function buildMemoryPromptContext() {
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
