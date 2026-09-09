import { startThinkingOrb, setThinkingOrbState, stopThinkingOrb } from './orb.js';
import { retrieveRankedContext, RAG_COSINE_THRESHOLD, RAG_KEYWORD_FLOOR, effectiveCosineThreshold, setThresholdOverride, clearThresholdOverride, readThresholdOverride } from './rag.js';
import { isAbortError } from './foreground.js';
import { combinedTimeoutSignal, AI_STREAM_TIMEOUT_MILLIS, SEARCH_TIMEOUT_MILLIS } from './fetch-timeout.js';
import { TOOL_ALLOWLIST_NAMES, TOOL_ALLOWLIST_BARE_ONLY, tokenizeCommandLine } from './commands.js';
import { buildMemoryPromptContext, appendHistoryTurn, isMemoryEnabled, getStoredMemory, getStoredHistory } from './memory.js';

const MODELS = [
  { id: 'qwen/qwen3.8-27b', name: 'qwen3.8-27b', size: '0MB (Cloud)', dtype: 'api', desc: 'qwen3.8-27b + bge-small-en (default)' },
  { id: 'onnx-community/SmolLM2-135M-ONNX', name: 'SmolLM2-135M', size: '135MB', dtype: 'q4', desc: 'lightweight local' },
  { id: 'onnx-community/SmolLM2-360M-ONNX', name: 'SmolLM2-360M', size: '360MB', dtype: 'q4', desc: 'balanced local' },
  { id: 'onnx-community/Qwen2.5-0.5B-Instruct', name: 'Qwen2.5-0.5B', size: '350MB', dtype: 'q4', desc: 'smart local' },
  { id: 'onnx-community/Llama-3.2-1B-Instruct-ONNX', name: 'Llama-3.2-1B', size: '1.1GB', dtype: 'q4', desc: 'high quality local' },
  { id: 'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX', name: 'DeepSeek-R1-1.5B', size: '1.1GB', dtype: 'q4', desc: 'reasoning local' },
];

let activeModel = 0;
let pipeline = null;
let pipelineLoading = false;

// WAVE 10 trustworthy AI: three explicit modes behind a first-run picker.
// (a) Quick answer = Cloud Qwen default; (b) On this device = private local
// opt-in; (c) Terminal controls = tool-allowlist explainer (cloud backend).
// The choice persists in localStorage; the first `ai` call with no saved
// mode opens the picker instead of generating (nothing is sent).
const AI_MODE_KEY = `dvxb_ai_mode_v1`;
const AI_LOCAL_MODEL_KEY = `dvxb_ai_local_model_v1`;
const AI_PENDING_PROMPT_KEY = `dvxb_ai_pending_prompt_v1`;
const DEFAULT_LOCAL_MODEL = 2;
const CLOUD_DISCLOSURE_LINE = `Cloud default sends prompt + portfolio context to Groq via Worker proxy; local runs on-device after download`;
const NO_MATCH_FALLFORWARD = `I don't have that in the portfolio — try \`projects\` / \`timeline\` / \`ai web <q>\` for live search.`;
const CITATION_INSTRUCTION = `When you use the Retrieved Context below, cite the chunks Perplexity-style with [1], [2] markers matching their numbers. Answer ONLY from the context when it matches; never invent portfolio facts.`;

function getSavedAiMode() {
  try {
    const storedMode = localStorage.getItem(AI_MODE_KEY);
    if (storedMode === `quick` || storedMode === `local` || storedMode === `controls`) return storedMode;
    return null;
  } catch (storageError) {
    console.warn(`ai mode read skipped: ${storageError.message}`);
    return null;
  }
}

function readSavedLocalModel() {
  try {
    const storedIndex = Number(localStorage.getItem(AI_LOCAL_MODEL_KEY));
    if (Number.isInteger(storedIndex) && storedIndex >= 1 && storedIndex < MODELS.length) return storedIndex;
    return DEFAULT_LOCAL_MODEL;
  } catch (storageError) {
    console.warn(`ai local model read skipped: ${storageError.message}`);
    return DEFAULT_LOCAL_MODEL;
  }
}

function persistAiMode(modeName, modelIndex) {
  try {
    localStorage.setItem(AI_MODE_KEY, modeName);
    if (Number.isInteger(modelIndex)) localStorage.setItem(AI_LOCAL_MODEL_KEY, String(modelIndex));
  } catch (storageError) {
    console.warn(`ai mode persist skipped: ${storageError.message}`);
  }
}

// Restore the persisted backend before the first call: local mode revives
// its model index, everything else boots to the Cloud Qwen default.
const savedModeAtBoot = getSavedAiMode();
activeModel = savedModeAtBoot === `local` ? readSavedLocalModel() : 0;

// Pending first-run prompt, held while the picker is open. Mirrored to
// localStorage so a chip click (outside the terminal's foreground run) can
// resume it after the choice is persisted.
let pendingAiPrompt = null;
try {
  pendingAiPrompt = localStorage.getItem(AI_PENDING_PROMPT_KEY);
} catch (storageError) {
  console.warn(`ai pending prompt read skipped: ${storageError.message}`);
  pendingAiPrompt = null;
}

function hasPendingAiChoice() {
  return pendingAiPrompt !== null && getSavedAiMode() === null;
}

function stashPendingAiPrompt(promptText) {
  pendingAiPrompt = String(promptText);
  try {
    localStorage.setItem(AI_PENDING_PROMPT_KEY, pendingAiPrompt);
  } catch (storageError) {
    console.warn(`ai pending prompt stash skipped: ${storageError.message}`);
  }
}

function takePendingAiPrompt() {
  const stashedPrompt = pendingAiPrompt;
  pendingAiPrompt = null;
  try {
    localStorage.removeItem(AI_PENDING_PROMPT_KEY);
  } catch (storageError) {
    console.warn(`ai pending prompt clear skipped: ${storageError.message}`);
  }
  return stashedPrompt;
}

function printCloudDisclosure(term) {
  term.writeln(`\x1b[2m${CLOUD_DISCLOSURE_LINE}\x1b[0m`);
}

// Last cloud-failure prompt, stored as an immutable snapshot (a fresh String
// copy that is never mutated) so `ai retry` replays the exact prompt.
// Guarded by aiGenerationInflight so a replay never runs parallel to an
// in-flight generation (no double-bill); the foreground runner serializes ai
// runs, and this flag is the second line of defence for any direct call.
let lastFailedPromptSnapshot = null;
let aiGenerationInflight = false;

function getLastFailedPrompt() {
  return lastFailedPromptSnapshot;
}

function clearLastFailedPrompt() {
  lastFailedPromptSnapshot = null;
}

function isAiGenerationInflight() {
  return aiGenerationInflight;
}

function storeFailedPromptSnapshot(failedPrompt) {
  const snapshotCopy = String(failedPrompt);
  lastFailedPromptSnapshot = snapshotCopy;
}

function showAiRetryAffordance(term) {
  term.writeln(`\x1b[2mRetry available — type \`ai retry\` to replay the exact prompt\x1b[0m`);
}

// Set while a local model downloads; the chip-bar Cancel button (and the
// progress view) goes through requestLocalDownloadCancel so mode + size +
// progress + cancel stay one interaction with no second confirm prompt.
let localDownloadCanceller = null;

function requestLocalDownloadCancel() {
  if (typeof localDownloadCanceller === `function`) {
    const canceller = localDownloadCanceller;
    localDownloadCanceller = null;
    canceller();
  }
}

async function loadPipeline(term, loadOptions) {
  if (activeModel === 0) return 'groq'; // Cloud mode
  if (pipeline) return pipeline;
  if (pipelineLoading) return null;
  pipelineLoading = true;

  const progressHandler = typeof loadOptions?.onProgress === `function` ? loadOptions.onProgress : null;
  const abortSignal = loadOptions?.runSignal ?? null;

  try {
    if (term) term.writeln(`\x1b[2mLoading AI module...\x1b[0m`);

    const { pipeline: p } = await import('@huggingface/transformers');

    const model = MODELS[activeModel];
    const gpu = navigator.gpu;
    const device = gpu ? 'webgpu' : 'wasm';
    const numThreads = Math.min(navigator.hardwareConcurrency || 4, 8);

    if (term) {
      term.writeln(`\x1b[2mGPU backend: navigator.gpu = ${gpu ? '\x1b[32mactive\x1b[2m' : '\x1b[91mundefined\x1b[2m'} \u2192 using ${device} (${numThreads} threads)\x1b[0m`);
      term.writeln(`\r\x1b[2mLoading ${model.name} (${model.size}, ${device})...\x1b[0m`);
      term.writeln(`\x1b[2mOne-time download, cached in this browser after the first fetch — Ctrl+C (or chip Cancel) aborts\x1b[0m`);
    }

    await new Promise(r => setTimeout(r, 0));

    const progressCallback = (progressEvent) => {
      if (!progressHandler) return;
      try {
        progressHandler(progressEvent);
      } catch (progressError) {
        console.warn(`ai progress update skipped: ${progressError.message}`);
      }
    };
    const cancelPromise = new Promise((resolveCancel, rejectCancel) => {
      localDownloadCanceller = () => {
        rejectCancel(new Error('Local download cancelled'));
      };
    });
    const abortPromise = new Promise((resolveAbort, rejectAbort) => {
      if (!abortSignal) return;
      if (abortSignal.aborted) {
        rejectAbort(new DOMException('Aborted', 'AbortError'));
        return;
      }
      abortSignal.addEventListener('abort', () => {
        rejectAbort(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timed out after 60s')), 60000)
    );
    pipeline = await Promise.race([
      p('text-generation', model.id, {
        dtype: model.dtype,
        device,
        session_options: { numThreads },
        progress_callback: progressCallback,
      }),
      timeout,
      cancelPromise,
      abortPromise,
    ]);

    localDownloadCanceller = null;
    if (term) term.writeln(`\r\x1b[32mModel loaded\x1b[0m`);
    return pipeline;
  } catch (loadError) {
    localDownloadCanceller = null;
    if (isAbortError(loadError) || String(loadError?.message) === `Local download cancelled`) {
      if (term) term.writeln(`\r\x1b[2mLocal download cancelled — pick a size again or run \`ai-model 0\` for cloud\x1b[0m`);
    } else {
      if (term) term.writeln(`\r\x1b[91mFailed to load local model: ${loadError.message}\x1b[0m`);
      if (term) term.writeln(`\x1b[2mNext: retry \`ai <prompt>\`, or switch back with \`ai-model 0\` for Groq cloud\x1b[0m`);
    }
    pipelineLoading = false;
    return null;
  }
}

const BASELINE_SYSTEM_PROMPT = `You are Devkumar Banerjee's portfolio AI assistant on dvxb.io.
Current portfolio year: 2026.
Role & Summary: CS & Engineering student @ Texas A&M University (College Station, TX), AI Systems / SRE Intern @ Lockheed Martin, Data Research Intern @ UT MD Anderson Cancer Center.
Assistant & Terminal Scope: You answer questions about Devkumar's experiences, projects, research, publications, skills, and certifications.
Tool Calling & Site Actions:
If the user asks to perform an action on the site or shell (e.g. view HackerNews news, launch matrix rain, check weather, view resume, clear screen, view guestbook wall, ping server), you can execute terminal commands! Emit a tool call tag:
[[TOOL: exec("command_name")]]
Examples:
- User: "show me news" -> emit [[TOOL: exec("hn")]]
- User: "start matrix rain" -> emit [[TOOL: exec("matrix")]]
- User: "check weather" -> emit [[TOOL: exec("weather")]]
- User: "show guestbook" -> emit [[TOOL: exec("wall")]]
- User: "show resume" -> emit [[TOOL: exec("cat resume.md")]]
Real-Time / Time Queries: If asked about current time/date, state that you operate within the current portfolio timeline (2026).
Answer concisely, accurately, and naturally based on the baseline profile, memory history, and retrieved context below.`;

// Small local models (≤1.5B, e.g. Qwen2.5-0.5B) drown in the full brief above
// — long instructions + tool-call docs + history push CV details out of their
// effective working memory, so they ramble instead of answering from context.
// They get a compact brief (context only, no memory, no tool docs) instead.
const LOCAL_SYSTEM_PROMPT = "You are Devkumar Banerjee's portfolio assistant on dvxb.io. Answer briefly and ONLY from the context below. If the answer is not in the context, say you don't know. Do not emit tool tags.";

function processToolCalls(fullText, term) {
  const toolRegex = /\[\[TOOL:\s*exec\("([^"]+)"\)]\]/g;
  let match;
  let cleanText = fullText;
  while ((match = toolRegex.exec(fullText)) !== null) {
    const cmdToExec = match[1];
    cleanText = cleanText.replace(match[0], '').trim();
    if (!toolAllowed(cmdToExec)) {
      if (term) term.writeln(`\x1b[33m\x1b[1m[Tool blocked: ${stripAnsi(cmdToExec)} — not in the read-only allowlist]\x1b[0m`);
      continue;
    }
    if (term) term.writeln(`\x1b[32m\x1b[1m[Executing Tool: ${stripAnsi(cmdToExec)}]\x1b[0m`);
    if (typeof window !== 'undefined' && typeof window.executeTerminalCommand === 'function') {
      setTimeout(() => window.executeTerminalCommand(cmdToExec, term), 100);
    }
  }
  return cleanText;
}

// Commands the assistant may invoke via [[TOOL: exec("…")]]. Read-only /
// display-only by design: anything that boots a VM (vm), recurses into the
// model (ai/llm), mutates settings (ai-model), opens arbitrary-URL iframes
// (md), posts publicly (wall with a message) or wipes the screen (clear) is
// refused. Model output is untrusted (prompt injection via RAG context, web
// results or memory), so this is default-deny. `wall` is allowed only bare
// (read the guestbook, don't post). Names come from the single command
// registry (js/commands.js); the bare-only exception is `wall` alone.
const TOOL_ALLOWLIST = new Set(TOOL_ALLOWLIST_NAMES);

function toolAllowed(raw) {
  const parts = tokenizeCommandLine(String(raw).trim());
  if (!parts.length) return false;
  const name = parts[0].toLowerCase();
  if (TOOL_ALLOWLIST_BARE_ONLY.includes(name)) return parts.length === 1;
  return TOOL_ALLOWLIST.has(name);
}

// Local copy of shell.js's stripAnsi (kept inline to avoid a shell↔ai import
// cycle): strips terminal control chars from model-controlled text echoed to
// xterm so the model can't inject escape sequences into the display.
// Range checks (no regex literal) avoid JS-0004 control-char escapes.
function stripAnsi(s) {
  if (s === null || s === undefined) return '';
  const str = String(s);
  let out = '';
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    const isBad = cp < 0x20
      ? cp !== 0x0A && cp !== 0x0D && cp !== 0x09
      : cp === 0x7F || (cp >= 0x202A && cp <= 0x202E) || (cp >= 0x2066 && cp <= 0x2069) || cp === 0xFEFF;
    if (!isBad) out += ch;
  }
  return out;
}

async function streamGroq(prompt, context, term, runSignal) {
  const workerUrl = 'https://0.supernovadkb.workers.dev/ai';
  
  term.write(`\x1b[1mAI:\x1b[0m `);

  const memoryContext = buildMemoryPromptContext();
  const fullSystemContent = `${BASELINE_SYSTEM_PROMPT}\n${CITATION_INSTRUCTION}\n\n${memoryContext}Retrieved Context:\n${context}`;

  let fullResponse = '';
  let inThink = false;
  let hold = '';
  const OPEN = '\n<think>\n';
  const CLOSE = '\n</think>\n';

  function emitText(text) {
    const str = hold + text;
    hold = '';
    let cursor = 0;
    while (cursor < str.length) {
      if (!inThink) {
        const start = str.indexOf(OPEN, cursor);
        if (start === -1) {
          const tail = str.slice(cursor);
          let k = Math.min(OPEN.length, tail.length);
          while (k > 0 && !tail.endsWith(OPEN.slice(0, k))) k--;
          if (k > 0) {
            const emit = tail.slice(0, tail.length - k);
            if (emit) {
              fullResponse += emit;
              term.write(stripAnsi(emit));
            }
            hold = tail.slice(tail.length - k);
            return;
          }
          if (tail) {
            fullResponse += tail;
            term.write(stripAnsi(tail));
          }
          return;
        }
        const before = str.slice(cursor, start);
        if (before) {
          fullResponse += before;
          term.write(stripAnsi(before));
        }
        inThink = true;
        cursor = start + OPEN.length;
      } else {
        const end = str.indexOf(CLOSE, cursor);
        if (end === -1) {
          const tail = str.slice(cursor);
          let k = Math.min(CLOSE.length, tail.length);
          while (k > 0 && !tail.endsWith(CLOSE.slice(0, k))) k--;
          if (k > 0) hold = tail.slice(tail.length - k);
          return;
        }
        inThink = false;
        cursor = end + CLOSE.length;
      }
    }
  }

  try {
    // Generous stream cap (not the 10s default): a live token stream runs
    // longer than any single request/response round-trip. User Ctrl+C still
    // wins via runSignal on the same combined signal.
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        messages: [
          { role: 'system', content: fullSystemContent },
          { role: 'user', content: prompt }
        ],
        stream: true,
        max_tokens: 1024,
        temperature: 0.3
      }),
      signal: combinedTimeoutSignal(runSignal, AI_STREAM_TIMEOUT_MILLIS),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Worker connection status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') break;
          try {
            const json = JSON.parse(dataStr);
            const token = json.choices[0]?.delta?.content || '';
            if (token) {
              emitText(token);
            }
          } catch (_err) {
            // Ignore incomplete SSE chunk payload
          }
        }
      }
    }
    term.writeln('');
    
    // Save to persistent memory & check for tool action execution
    appendHistoryTurn('user', prompt);
    appendHistoryTurn('assistant', fullResponse);
    processToolCalls(fullResponse, term);
    return true;
  } catch (streamError) {
    if (isAbortError(streamError)) throw streamError;
    term.writeln(`\r\x1b[91mGroq cloud stream error: ${streamError.message}\x1b[0m`);
    term.writeln(`\x1b[2mTip: Switch to local in-browser model using \`ai-model 1\`\x1b[0m`);
    return false;
  }
}

async function streamLocal(pipelineHandle, prompt, context, term, runSignal) {
  if (runSignal?.aborted) return;
  const { TextStreamer } = await import('@huggingface/transformers');
  
  term.write(`\x1b[1mAI:\x1b[0m `);

  let fullResponse = '';
  const streamer = new TextStreamer(pipelineHandle.tokenizer, {
    skip_prompt: true,
    callback_function: (text) => {
      fullResponse += text;
      term.write(stripAnsi(text));
    }
  });

  // Compact brief for small local models (see LOCAL_SYSTEM_PROMPT): full
  // baseline + history + tool docs bury the retrieved CV chunks.
  const fullPrompt = `<|im_start|>system\n${LOCAL_SYSTEM_PROMPT}\n\nRetrieved Context:\n${context}<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;

  await p(fullPrompt, {
    max_new_tokens: 256,
    temperature: 0.4,
    do_sample: true,
    streamer
  });
  term.writeln('');

  appendHistoryTurn('user', prompt);
  appendHistoryTurn('assistant', fullResponse);
  processToolCalls(fullResponse, term);
}

export async function fetchWebSearch(query, runSignal) {
  try {
    const res = await fetch(`https://0.supernovadkb.workers.dev/search?q=${encodeURIComponent(query)}`, { signal: combinedTimeoutSignal(runSignal, SEARCH_TIMEOUT_MILLIS) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (searchError) {
    if (isAbortError(searchError)) throw searchError;
    console.warn('Web search request error:', searchError);
    return [];
  }
}

function showAiStatus(term) {
  const current = MODELS[activeModel];
  const backend = activeModel === 0 ? 'Groq cloud via Worker proxy' : 'local ONNX (Transformers.js, WASM/WebGPU)';
  term.writeln(`\x1b[1mAI backend status\x1b[0m`);
  term.writeln(`\x1b[2mactive: ${current.name} — ${backend}\x1b[0m`);
  term.writeln(`\x1b[2mdefault: Groq cloud model; switch with ai-model <id>\x1b[0m`);
  term.writeln(`\x1b[2m${CLOUD_DISCLOSURE_LINE}\x1b[0m`);
  term.writeln(`\x1b[2mnetwork required (cloud inference or model download)\x1b[0m`);
}

// Perplexity-style Sources footer plus the cloud disclosure line, printed
// adjacent to every AI answer (MATCH cites chunk titles, NO_MATCH skips the
// list but keeps the disclosure).
function printAiAnswerFooter(term, rankedResult) {
  if (rankedResult && rankedResult.verdict === `MATCH` && rankedResult.sourceList.length > 0) {
    term.writeln(`\x1b[2mSources:\x1b[0m`);
    for (const source of rankedResult.sourceList) {
      term.writeln(`\x1b[2m${source.marker} ${stripAnsi(source.title)}\x1b[0m`);
    }
  }
  printCloudDisclosure(term);
}

// Terminal-controls explainer shared by picker choice 3 and `ai details`:
// the model may only emit tool tags for the read-only allowlist.
function printToolAllowlist(term) {
  const allowedNames = [...TOOL_ALLOWLIST_NAMES].join(`, `);
  term.writeln(`\x1b[1mTerminal controls — what the assistant may run\x1b[0m`);
  term.writeln(`\x1b[2mThe assistant may emit [[TOOL: exec("…")]] for read-only/display commands only:\x1b[0m`);
  term.writeln(`  \x1b[32m${allowedNames}\x1b[0m`);
  term.writeln(`\x1b[2m\`wall\` bare only (reads the guestbook, never posts). Anything else prints [Tool blocked]: ai/llm, ai-model, md, clear, vm, devmode, guestbook, man.\x1b[0m`);
}

// First-run picker: printed in-terminal with an HTML chip bar beneath the
// terminal (real <button>s, Tab/Enter native, Esc falls back to typed
// 1/2/3). The prompt is stashed, never sent, until a choice persists.
function openAiPicker(term, promptText) {
  stashPendingAiPrompt(promptText);
  term.writeln(`\x1b[1mFirst run — choose how AI answers (saved on this device):\x1b[0m`);
  term.writeln(`  \x1b[2m[1]\x1b[0m \x1b[36mQuick answer\x1b[0m — Cloud Qwen (qwen/qwen3.8-27b) via Worker proxy`);
  term.writeln(`      \x1b[2mSends: prompt + RAG portfolio context + memory (when ON)\x1b[0m`);
  term.writeln(`  \x1b[2m[2]\x1b[0m \x1b[36mOn this device\x1b[0m — private local model (135MB–1.1GB, cached after download)`);
  term.writeln(`  \x1b[2m[3]\x1b[0m \x1b[36mTerminal controls\x1b[0m — what the assistant may run (tool allowlist)`);
  term.writeln(`\x1b[2mType \`ai 1\`, \`ai 2\` or \`ai 3\` (or bare 1/2/3), click a chip below, Esc keeps typed choice. Your prompt is held — nothing was sent.\x1b[0m`);
  printCloudDisclosure(term);
  renderAiModeChipbar(term, { showSizes: false });
}

// `ai details`: full trust sheet (model id/size, backend, what is sent,
// memory ON/OFF + injection state, RAG threshold, allowlist) and the picker
// re-opened so the mode can change. Memory OFF visibly stops injection here.
function printAiDetails(term) {
  const current = MODELS[activeModel];
  const savedMode = getSavedAiMode();
  const cloudBackend = activeModel === 0;
  const backendLabel = cloudBackend ? `Groq cloud via Worker proxy` : `local ONNX (Transformers.js, WASM/WebGPU)`;
  const storedMemory = getStoredMemory();
  const storedHistory = getStoredHistory();
  const memoryOn = isMemoryEnabled();
  const factTotal = storedMemory.facts.length;
  const turnTotal = storedHistory.length;
  term.writeln(`\x1b[1mAI details\x1b[0m`);
  term.writeln(`\x1b[2mmode: ${savedMode === null ? `not chosen yet (the picker holds your next prompt)` : savedMode}\x1b[0m`);
  term.writeln(`\x1b[2mmodel: ${current.name} (${current.id}) — ${current.size}\x1b[0m`);
  term.writeln(`\x1b[2mbackend: ${backendLabel}\x1b[0m`);
  if (cloudBackend) {
    term.writeln(`\x1b[2msends: prompt + RAG portfolio context + memory (${memoryOn ? `ON` : `OFF`}) to the Worker → Groq\x1b[0m`);
  } else {
    term.writeln(`\x1b[2msends: nothing leaves this device after the one-time model download\x1b[0m`);
  }
  if (memoryOn) {
    term.writeln(`\x1b[2mmemory: ON — ${factTotal} facts, ${turnTotal} turns feed the prompt (\`ai-memory off\` stops injection)\x1b[0m`);
  } else {
    term.writeln(`\x1b[2mmemory: OFF — ${factTotal} facts, ${turnTotal} turns stored but NOT sent\x1b[0m`);
  }
  term.writeln(`\x1b[2mRAG cosine threshold: ${effectiveCosineThreshold()} (default ${RAG_COSINE_THRESHOLD}; tune with \`ai threshold <0-1>\`)\x1b[0m`);
  printToolAllowlist(term);
  term.writeln(`\x1b[2mSwitch mode any time: \`ai 1\` quick · \`ai 2\` this device · \`ai 3\` controls\x1b[0m`);
  printCloudDisclosure(term);
}

function showAiDetails(term) {
  printAiDetails(term);
  renderAiModeChipbar(term, { showSizes: false });
}

// `ai sources <q>`: deterministic RAG debug view — keyword-ranked chunks
// with scores plus the MATCH/NO_MATCH verdict, no embedder download.
async function showAiSources(rawQuery, term) {
  const trimmedQuery = String(rawQuery ?? ``).trim();
  if (!trimmedQuery) {
    term.writeln(`\x1b[2mUsage: ai sources <query> — ranked RAG chunks + MATCH/NO_MATCH verdict\x1b[0m`);
    return;
  }
  const rankedResult = await retrieveRankedContext(trimmedQuery, null, { keywordOnly: true });
  const thresholdValue = effectiveCosineThreshold();
  term.writeln(`\x1b[1mSources for "${stripAnsi(trimmedQuery)}"\x1b[0m`);
  term.writeln(`\x1b[2mkeyword rank (deterministic; live runs add bge-small-en cosine, threshold ${thresholdValue})\x1b[0m`);
  if (rankedResult.verdict === `NO_MATCH`) {
    term.writeln(`\x1b[2mNo chunk clears the keyword floor (${RAG_KEYWORD_FLOOR}) — NO_MATCH\x1b[0m`);
    term.writeln(`\x1b[33m${NO_MATCH_FALLFORWARD}\x1b[0m`);
    printCloudDisclosure(term);
    return;
  }
  for (const source of rankedResult.sourceList) {
    term.writeln(`  \x1b[32m${source.marker}\x1b[0m ${stripAnsi(source.title)} \x1b[2m(keyword ${source.score.toFixed(2)})\x1b[0m`);
  }
  const markerList = rankedResult.sourceList.map((source) => source.marker).join(`, `);
  term.writeln(`\x1b[2mVerdict: MATCH — ${rankedResult.sourceList.length} chunk(s) feed the prompt as ${markerList}\x1b[0m`);
  printCloudDisclosure(term);
}

function isThresholdArgument(tailText) {
  const normalizedTail = String(tailText).trim().toLowerCase();
  if (normalizedTail === `reset` || normalizedTail === `default` || normalizedTail === `clear`) return true;
  if (!/^\d+(\.\d+)?$/u.test(normalizedTail)) return false;
  const parsedValue = Number(normalizedTail);
  return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 1;
}

// `ai threshold` shows the floor; `ai threshold <0-1>` persists an override
// (reset restores the documented constant).
function showAiThreshold(tailText, term) {
  const normalizedTail = String(tailText ?? ``).trim().toLowerCase();
  if (!normalizedTail) {
    const overrideValue = readThresholdOverride();
    term.writeln(`\x1b[2mRAG cosine threshold: ${effectiveCosineThreshold()} (default ${RAG_COSINE_THRESHOLD}${overrideValue === null ? `` : `, override ${overrideValue}`}) — set with \`ai threshold <0-1>\`, \`ai threshold reset\`\x1b[0m`);
    return;
  }
  if (normalizedTail === `reset` || normalizedTail === `default` || normalizedTail === `clear`) {
    clearThresholdOverride();
    term.writeln(`\x1b[2mRAG cosine threshold reset to default ${RAG_COSINE_THRESHOLD}\x1b[0m`);
    return;
  }
  const parsedValue = Number(normalizedTail);
  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 1) {
    term.writeln(`\x1b[91mthreshold must be a number 0-1 (or \`reset\`)\x1b[0m`);
    return;
  }
  setThresholdOverride(parsedValue);
  term.writeln(`\x1b[32mRAG cosine threshold set to ${parsedValue}\x1b[0m`);
}

// Typed choice resolution for `ai 1|2|3` (and bare 1/2/3 via the shell while
// the picker is pending). Persists the mode, closes the chip bar, then runs
// any held prompt so the first run completes in one flow.
async function resolveAiModeChoice(choiceDigit, term, runSignal) {
  const normalizedChoice = String(choiceDigit).trim();
  if (normalizedChoice !== `1` && normalizedChoice !== `2` && normalizedChoice !== `3`) {
    term.writeln(`\x1b[2mUsage: ai 1 (quick) · ai 2 (this device) · ai 3 (controls)\x1b[0m`);
    return;
  }
  closeAiChipbar();
  if (normalizedChoice === `1`) {
    activeModel = 0;
    pipeline = null;
    pipelineLoading = false;
    persistAiMode(`quick`, null);
    term.writeln(`\x1b[32mAI mode: Quick answer — Cloud Qwen (qwen/qwen3.8-27b) via Worker proxy\x1b[0m`);
    term.writeln(`\x1b[2mSends: prompt + RAG portfolio context + memory (when ON) to the Worker\x1b[0m`);
    printCloudDisclosure(term);
  } else if (normalizedChoice === `2`) {
    const localIndex = readSavedLocalModel();
    activeModel = localIndex;
    pipeline = null;
    pipelineLoading = false;
    persistAiMode(`local`, localIndex);
    const modelEntry = MODELS[localIndex];
    term.writeln(`\x1b[32mAI mode: Private on this device — ${modelEntry.name} (${modelEntry.size}, ${modelEntry.dtype})\x1b[0m`);
    term.writeln(`\x1b[2mOne-time download, cached in this browser; progress shows here, Ctrl+C cancels; change size with \`ai-model <id>\`\x1b[0m`);
    printCloudDisclosure(term);
  } else {
    activeModel = 0;
    pipeline = null;
    pipelineLoading = false;
    persistAiMode(`controls`, null);
    term.writeln(`\x1b[32mAI mode: Terminal controls — backend stays Cloud Qwen; choice saved\x1b[0m`);
    printToolAllowlist(term);
    printCloudDisclosure(term);
  }
  const stashedPrompt = takePendingAiPrompt();
  if (stashedPrompt) {
    await runAiGeneration(stashedPrompt, term, runSignal);
  }
}

// HTML chip bar beneath the terminal — terminal-chrome styling (monospace,
// glass/border tokens), real <button>s so Tab/Enter work natively. Created
// only in the pending-choice state (plus `ai details` re-opens); shell
// purists never see chrome otherwise because the node is removed on choice.
const AI_CHIPBAR_ID = `ai-mode-chipbar`;

function findTerminalHost() {
  if (typeof document === `undefined`) return null;
  const hostNode = document.getElementById(`terminal-container`);
  if (!hostNode || !hostNode.parentNode) return null;
  return hostNode;
}

function closeAiChipbar() {
  if (typeof document === `undefined`) return;
  const chipbarNode = document.getElementById(AI_CHIPBAR_ID);
  if (chipbarNode) chipbarNode.remove();
}

function focusTerminalInput(term) {
  try {
    if (typeof term?.focus === `function`) term.focus();
  } catch (focusError) {
    console.warn(`terminal refocus skipped: ${focusError.message}`);
  }
}

function makeAiChip(chipLabel, chipTitle, chipHandler) {
  const chipButton = document.createElement(`button`);
  chipButton.type = `button`;
  chipButton.className = `ai-chip`;
  chipButton.textContent = chipLabel;
  chipButton.title = chipTitle;
  chipButton.addEventListener(`click`, (clickEvent) => {
    clickEvent.preventDefault();
    chipHandler();
  });
  return chipButton;
}

// Chip clicks route back through the terminal dispatcher so the choice (and
// any held prompt) runs inside the foreground runner like typed input.
function handleAiChipChoice(choiceDigit, term) {
  if (typeof window !== `undefined` && typeof window.executeTerminalCommand === `function` && term) {
    window.executeTerminalCommand(`ai ${choiceDigit}`, term);
    return;
  }
  resolveAiModeChoice(choiceDigit, term, null).catch((choiceError) => {
    console.warn(`ai chip choice failed: ${choiceError.message}`);
  });
}

// Single-consent local panel: size buttons ARE the consent (mode + size in
// one tap, no second prompt). Tapping a size persists, swaps the bar to a
// progress + cancel view, and resumes the held prompt.
function renderAiLocalSizePanel(barNode, term) {
  barNode.textContent = ``;
  const noteNode = document.createElement(`span`);
  noteNode.className = `ai-chip-note`;
  noteNode.textContent = `Private on this device — one tap consents to model + size. Download once, cached in this browser.`;
  barNode.appendChild(noteNode);
  MODELS.forEach((modelEntry, modelIndex) => {
    if (modelIndex === 0) return;
    const sizeButton = makeAiChip(`${modelEntry.name} · ${modelEntry.size}`, `${modelEntry.desc} (${modelEntry.dtype})`, () => {
      applyLocalModelChoice(modelIndex, term);
    });
    barNode.appendChild(sizeButton);
  });
  const backButton = makeAiChip(`[Back]`, `Back to the three modes`, () => {
    renderAiModeChipbar(term, { showSizes: false });
  });
  barNode.appendChild(backButton);
}

function applyLocalModelChoice(modelIndex, term) {
  activeModel = modelIndex;
  pipeline = null;
  pipelineLoading = false;
  persistAiMode(`local`, modelIndex);
  const modelEntry = MODELS[modelIndex];
  term.writeln(`\x1b[32mAI mode: Private on this device — ${modelEntry.name} (${modelEntry.size}, cached after first download)\x1b[0m`);
  printCloudDisclosure(term);
  renderAiDownloadProgress(term, modelEntry);
  resumePendingAiPrompt(term);
}

function renderAiDownloadProgress(term, modelEntry) {
  const hostNode = findTerminalHost();
  if (!hostNode || !hostNode.parentNode || typeof document === `undefined`) return;
  closeAiChipbar();
  const barNode = document.createElement(`div`);
  barNode.id = AI_CHIPBAR_ID;
  barNode.setAttribute(`role`, `group`);
  barNode.setAttribute(`aria-label`, `AI model download`);
  const progressNode = document.createElement(`span`);
  progressNode.className = `ai-chip-note ai-chip-progress`;
  progressNode.textContent = `Downloading ${modelEntry.name} (${modelEntry.size})…`;
  barNode.appendChild(progressNode);
  const cancelButton = makeAiChip(`[Cancel download]`, `Abort the model download`, () => {
    requestLocalDownloadCancel();
  });
  barNode.appendChild(cancelButton);
  hostNode.parentNode.insertBefore(barNode, hostNode.nextSibling);
}

function resumePendingAiPrompt(term) {
  const stashedPrompt = takePendingAiPrompt();
  if (!stashedPrompt) return;
  if (typeof window !== `undefined` && typeof window.executeTerminalCommand === `function`) {
    window.executeTerminalCommand(`ai ${stashedPrompt}`, term);
  }
}

// Progress ticks from loadPipeline land here (chip-bar DOM only, never the
// xterm stream, so deterministic snapshots stay byte-exact).
function chipbarProgressHandler() {
  if (typeof document === `undefined`) return null;
  const progressNode = document.querySelector(`#${AI_CHIPBAR_ID} .ai-chip-progress`);
  if (!progressNode) return null;
  return (progressEvent) => {
    const fileLabel = progressEvent?.file ? String(progressEvent.file) : `model`;
    const rawProgress = Number(progressEvent?.progress);
    const percentText = Number.isFinite(rawProgress) ? ` ${Math.round(rawProgress)}%` : ``;
    progressNode.textContent = `Downloading ${fileLabel}${percentText} — cached after first fetch`;
  };
}

function markAiChipbarDone(loadSucceeded) {
  if (typeof document === `undefined`) return;
  const progressNode = document.querySelector(`#${AI_CHIPBAR_ID} .ai-chip-progress`);
  if (!progressNode) return;
  if (loadSucceeded) {
    progressNode.textContent = `Model ready — generating…`;
    return;
  }
  closeAiChipbar();
}

function renderAiModeChipbar(term, chipOptions) {
  const hostNode = findTerminalHost();
  if (!hostNode || !hostNode.parentNode || typeof document === `undefined`) return;
  closeAiChipbar();
  const showSizes = Boolean(chipOptions?.showSizes);
  const barNode = document.createElement(`div`);
  barNode.id = AI_CHIPBAR_ID;
  barNode.setAttribute(`role`, `group`);
  barNode.setAttribute(`aria-label`, `AI mode picker`);
  if (showSizes) {
    renderAiLocalSizePanel(barNode, term);
  } else {
    const quickButton = makeAiChip(`[Quick answer]`, `Cloud Qwen — sends prompt+RAG+memory`, () => {
      handleAiChipChoice(`1`, term);
    });
    const localButton = makeAiChip(`[On this device]`, `Private local — pick a size`, () => {
      renderAiModeChipbar(term, { showSizes: true });
    });
    const detailsButton = makeAiChip(`[Details]`, `Model, backend, what is sent`, () => {
      printAiDetails(term);
    });
    const hintNode = document.createElement(`span`);
    hintNode.className = `ai-chip-note`;
    hintNode.textContent = `Tab/Enter to pick · Esc for typed 1/2/3`;
    barNode.appendChild(quickButton);
    barNode.appendChild(localButton);
    barNode.appendChild(detailsButton);
    barNode.appendChild(hintNode);
  }
  hostNode.parentNode.insertBefore(barNode, hostNode.nextSibling);
  barNode.addEventListener(`keydown`, (keyEvent) => {
    if (keyEvent.key === `Escape`) {
      keyEvent.stopPropagation();
      closeAiChipbar();
      term.writeln(`\x1b[2mPicker dismissed — type \`ai 1\`, \`ai 2\` or \`ai 3\` (or bare 1/2/3), \`ai details\` to review\x1b[0m`);
      focusTerminalInput(term);
    }
  });
  const firstButton = barNode.querySelector(`button`);
  if (firstButton) firstButton.focus();
}

// Container busy-state for the AI run: the thinking orb (role=status) and
// its adjacent Downloading/Generating terminal lines carry the state text;
// aria-busy on the terminal container tells assistive tech the region is
// being updated. DOM-only — terminal transcript strings are untouched.
function setTerminalBusy(busyOn) {
  try {
    if (typeof document === `undefined`) return;
    const containerNode = document.getElementById(`terminal-container`);
    if (containerNode) containerNode.setAttribute(`aria-busy`, busyOn ? `true` : `false`);
  } catch (busyError) {
    console.warn(`ai busy state skipped: ${busyError.message}`);
  }
}

async function runAiGeneration(targetPrompt, term, runSignal) {
  if (aiGenerationInflight) {
    term.writeln(`\x1b[2mai retry blocked — ai generation already in flight (no parallel cloud request)\x1b[0m`);
    return;
  }
  aiGenerationInflight = true;
  const promptSnapshot = String(targetPrompt);
  setTerminalBusy(true);
  // A generation starting means any held picker prompt was superseded (the
  // choice paths take it before calling here), so sweep leftovers: a later
  // `ai 1|2|3` mode switch must never replay a stale prompt.
  takePendingAiPrompt();
  try {
    const webSearchFlag = promptSnapshot.startsWith(`web `) || promptSnapshot.startsWith(`search `) || promptSnapshot.includes(`--web`);
    const cleanQuery = promptSnapshot.replace(/^(web|search)\s+/, ``).replace(/\s+--web/, ``).trim();

    // Orb searching state is always paired with adjacent Downloading text;
    // composing below is always paired with adjacent Generating text.
    startThinkingOrb(term, `searching`);
    term.writeln(`\x1b[2mDownloading… Searching portfolio context...\x1b[0m`);
    try {
      const rankedResult = await retrieveRankedContext(cleanQuery, term);
      let context = rankedResult.contextText;
      if (rankedResult.verdict === `NO_MATCH`) {
        if (term) term.writeln(`\x1b[33m${NO_MATCH_FALLFORWARD}\x1b[0m`);
        context = ``;
      }

      if (webSearchFlag) {
        if (term) term.writeln(`\x1b[2mFetching live web results via Cloudflare Worker...\x1b[0m`);
        const webResults = await fetchWebSearch(cleanQuery, runSignal);
        if (webResults.length) {
          const webStr = webResults.map((webEntry, entryIndex) => `[Web Result ${entryIndex + 1}: ${webEntry.title}]\nURL: ${webEntry.url}\n${webEntry.snippet}`).join(`\n\n`);
          context = `[Live Web Search Context]\n${webStr}\n\n${context}`;
        } else {
          if (term) term.writeln(`\x1b[2mNo live web results returned, relying on RAG portfolio context...\x1b[0m`);
        }
      }

      // 2. Load model pipeline (Cloud Groq or Local ONNX)
      const pipelineHandle = await loadPipeline(term, { onProgress: chipbarProgressHandler(), runSignal });
      markAiChipbarDone(pipelineHandle !== null);
      if (!pipelineHandle) return;

      setThinkingOrbState(`composing`);
      term.writeln(`\x1b[2m\xf0\x9f\x94\x84 Generating (real-time stream)...\x1b[0m`);

      if (activeModel === 0 || pipelineHandle === `groq`) {
        const cloudOk = await streamGroq(cleanQuery, context, term, runSignal);
        if (cloudOk) {
          lastFailedPromptSnapshot = null;
          printAiAnswerFooter(term, rankedResult);
        } else {
          storeFailedPromptSnapshot(promptSnapshot);
          showAiRetryAffordance(term);
        }
      } else {
        await streamLocal(pipelineHandle, cleanQuery, context, term, runSignal);
        lastFailedPromptSnapshot = null;
        printAiAnswerFooter(term, rankedResult);
      }
    } catch (generateError) {
      if (isAbortError(generateError)) throw generateError;
      term.writeln(`\x1b[91mGeneration failed: ${generateError.message}\x1b[0m`);
      storeFailedPromptSnapshot(promptSnapshot);
      showAiRetryAffordance(term);
    } finally {
      stopThinkingOrb();
    }
  } finally {
    aiGenerationInflight = false;
    setTerminalBusy(false);
  }
}

async function generateOutput(prompt, term, runSignal) {
  if (!prompt) {
    term.writeln(`\x1b[2mUsage: ai <prompt>\x1b[0m`);
    term.writeln(`\x1b[2m       ai status        (show Groq-cloud vs local backend)\x1b[0m`);
    term.writeln(`\x1b[2m       ai details       (modes, model, backend, what is sent)\x1b[0m`);
    term.writeln(`\x1b[2m       ai retry         (replay the exact failed prompt)\x1b[0m`);
    term.writeln(`\x1b[2m       ai web <query>   (live web search + LLM generation)\x1b[0m`);
    term.writeln(`\x1b[2m       ai sources <q>   (ranked RAG chunks + verdict)\x1b[0m`);
    term.writeln(`\x1b[2m       ai threshold <v> (tune the RAG cosine threshold)\x1b[0m`);
    term.writeln(`\x1b[2m       ai 1|2|3         (pick quick / this device / controls)\x1b[0m`);
    term.writeln(`\x1b[2m       ai-models        (list models)\x1b[0m`);
    term.writeln(`\x1b[2m       ai-model <id>    (switch model, 0-5)\x1b[0m`);
    term.writeln(`\x1b[2m${CLOUD_DISCLOSURE_LINE}\x1b[0m`);
    return;
  }

  if (prompt === `status`) {
    showAiStatus(term);
    return;
  }

  if (prompt === `details`) {
    showAiDetails(term);
    return;
  }

  if (prompt === `1` || prompt === `2` || prompt === `3`) {
    await resolveAiModeChoice(prompt, term, runSignal);
    return;
  }

  const promptText = String(prompt);
  const firstSpace = promptText.indexOf(` `);
  const headWord = (firstSpace === -1 ? promptText : promptText.slice(0, firstSpace)).toLowerCase();
  const tailText = firstSpace === -1 ? `` : promptText.slice(firstSpace + 1).trim();

  if (headWord === `sources`) {
    await showAiSources(tailText, term);
    return;
  }

  if (headWord === `threshold` && (tailText === `` || isThresholdArgument(tailText))) {
    showAiThreshold(tailText, term);
    return;
  }

  if (prompt === `retry`) {
    const storedSnapshot = lastFailedPromptSnapshot;
    if (!storedSnapshot) {
      term.writeln(`\x1b[2mNo failed ai prompt to retry.\x1b[0m`);
      term.writeln(`\x1b[2mNext: run \`ai <prompt>\` to start a request\x1b[0m`);
      return;
    }
    if (aiGenerationInflight) {
      term.writeln(`\x1b[2mai retry blocked — ai generation already in flight (no parallel cloud request)\x1b[0m`);
      return;
    }
    if (getSavedAiMode() === null) {
      openAiPicker(term, String(storedSnapshot));
      return;
    }
    // Replay the immutable snapshot, never the literal retry token.
    const replayPrompt = String(storedSnapshot);
    await runAiGeneration(replayPrompt, term, runSignal);
    return;
  }

  if (getSavedAiMode() === null) {
    openAiPicker(term, promptText);
    return;
  }

  await runAiGeneration(prompt, term, runSignal);
}

function showModelSelector(term) {
  term.writeln(`\x1b[1mAI Models\x1b[0m`);
  term.writeln(`\x1b[2m─────────\x1b[0m`);
  MODELS.forEach((m, i) => {
    const mark = i === activeModel ? `\x1b[32m●\x1b[0m` : `\x1b[2m○\x1b[0m`;
    const nameStr = `\x1b[36m${m.name.padEnd(20)}\x1b[0m`;
    const sizeStr = `\x1b[37m${m.size.padEnd(12)}\x1b[0m`;
    term.writeln(`  \x1b[2m[${i}]\x1b[0m ${mark} ${nameStr} ${sizeStr}\x1b[2m${m.desc}\x1b[0m`);
  });
  term.writeln('');
  term.writeln(`\x1b[2mUsage: ai <prompt>  —  ai-models to list, ai-model <id> to switch\x1b[0m`);
}

async function switchModel(id, term) {
  const idx = parseInt(id);
  if (isNaN(idx) || idx < 0 || idx >= MODELS.length) {
    term.writeln(`\x1b[91mInvalid model id. Use 0-${MODELS.length - 1}\x1b[0m`);
    showModelSelector(term);
    return;
  }
  if (idx === activeModel) {
    term.writeln(`\x1b[2m${MODELS[idx].name} already active\x1b[0m`);
    return;
  }
  activeModel = idx;
  pipeline = null;
  pipelineLoading = false;
  persistAiMode(idx === 0 ? `quick` : `local`, idx === 0 ? null : idx);
  term.writeln(`\x1b[32mSwitched to ${MODELS[idx].name}\x1b[0m`);
  term.writeln(`\x1b[2mNext \`ai\` call will load this model\x1b[0m`);
}

export { generateOutput, showModelSelector, switchModel, MODELS, getLastFailedPrompt, clearLastFailedPrompt, isAiGenerationInflight, getSavedAiMode, hasPendingAiChoice, resolveAiModeChoice, requestLocalDownloadCancel };
