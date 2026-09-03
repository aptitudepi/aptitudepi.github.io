import { startThinkingOrb, setThinkingOrbState, stopThinkingOrb } from './orb.js';
import { retrieveContext } from './rag.js';

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

async function loadPipeline(term) {
  if (activeModel === 0) return 'groq'; // Cloud mode
  if (pipeline) return pipeline;
  if (pipelineLoading) return null;
  pipelineLoading = true;

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
    }

    await new Promise(r => setTimeout(r, 0));

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timed out after 60s')), 60000)
    );
    pipeline = await Promise.race([
      p('text-generation', model.id, {
        dtype: model.dtype,
        device,
        session_options: { numThreads },
      }),
      timeout,
    ]);

    if (term) term.writeln(`\r\x1b[32mModel loaded\x1b[0m`);
    return pipeline;
  } catch (e) {
    if (term) term.writeln(`\r\x1b[91mFailed to load local model: ${e.message}\x1b[0m`);
    pipelineLoading = false;
    return null;
  }
}

import { buildMemoryPromptContext, appendHistoryTurn } from './memory.js';

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
// (read the guestbook, don't post).
const TOOL_ALLOWLIST = new Set([
  'whoami', 'hostname', 'date', 'uptime', 'uname', 'pwd', 'cat', 'ls', 'echo',
  'neofetch', 'resfetch', 'about', 'fortune', 'cowsay', 'help', 'matrix',
  'weather', 'hn', 'cv', 'search', 'google', 'ddg', 'myip', 'ping', 'history',
  'ai-models', 'ai-memory', 'crt', 'noise',
]);

function toolAllowed(raw) {
  const parts = String(raw).trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  if (!parts.length) return false;
  const name = parts[0].toLowerCase();
  if (name === 'wall') return parts.length === 1;
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

async function streamGroq(prompt, context, term) {
  const workerUrl = 'https://0.supernovadkb.workers.dev/ai';
  
  term.write(`\x1b[1mAI:\x1b[0m `);

  const memoryContext = buildMemoryPromptContext();
  const fullSystemContent = `${BASELINE_SYSTEM_PROMPT}\n\n${memoryContext}Retrieved Context:\n${context}`;

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
      })
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
  } catch (e) {
    term.writeln(`\r\x1b[91mGroq cloud stream error: ${e.message}\x1b[0m`);
    term.writeln(`\x1b[2mTip: Switch to local in-browser model using \`ai-model 1\`\x1b[0m`);
  }
}

async function streamLocal(p, prompt, context, term) {
  const { TextStreamer } = await import('@huggingface/transformers');
  
  term.write(`\x1b[1mAI:\x1b[0m `);

  let fullResponse = '';
  const streamer = new TextStreamer(p.tokenizer, {
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

export async function fetchWebSearch(query) {
  try {
    const res = await fetch(`https://0.supernovadkb.workers.dev/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.warn('Web search request error:', e);
    return [];
  }
}

async function generateOutput(prompt, term) {
  if (!prompt) {
    term.writeln(`\x1b[2mUsage: ai <prompt>\x1b[0m`);
    term.writeln(`\x1b[2m       ai web <query>   (live web search + LLM generation)\x1b[0m`);
    term.writeln(`\x1b[2m       ai-models        (list models)\x1b[0m`);
    term.writeln(`\x1b[2m       ai-model <id>    (switch model, 0-5)\x1b[0m`);
    return;
  }

  const isWebSearch = prompt.startsWith('web ') || prompt.startsWith('search ') || prompt.includes('--web');
  const cleanQuery = prompt.replace(/^(web|search)\s+/, '').replace(/\s+--web/, '').trim();

  startThinkingOrb(term, isWebSearch ? 'searching web' : 'searching');
  try {
    let context = await retrieveContext(cleanQuery, term);

    if (isWebSearch) {
      if (term) term.writeln(`\x1b[2mFetching live web results via Cloudflare Worker...\x1b[0m`);
      const webResults = await fetchWebSearch(cleanQuery);
      if (webResults.length) {
        const webStr = webResults.map((r, i) => `[Web Result ${i + 1}: ${r.title}]\nURL: ${r.url}\n${r.snippet}`).join('\n\n');
        context = `[Live Web Search Context]\n${webStr}\n\n${context}`;
      } else {
        if (term) term.writeln(`\x1b[2mNo live web results returned, relying on RAG portfolio context...\x1b[0m`);
      }
    }

    // 2. Load model pipeline (Cloud Groq or Local ONNX)
    const p = await loadPipeline(term);
    if (!p) return;

    setThinkingOrbState('composing');
    term.writeln(`\x1b[2m\xf0\x9f\x94\x84 Generating (real-time stream)...\x1b[0m`);

    if (activeModel === 0 || p === 'groq') {
      await streamGroq(cleanQuery, context, term);
    } else {
      await streamLocal(p, cleanQuery, context, term);
    }
  } catch (e) {
    term.writeln(`\x1b[91mGeneration failed: ${e.message}\x1b[0m`);
  } finally {
    stopThinkingOrb();
  }
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
  term.writeln(`\x1b[32mSwitched to ${MODELS[idx].name}\x1b[0m`);
  term.writeln(`\x1b[2mNext \`ai\` call will load this model\x1b[0m`);
}

export { generateOutput, showModelSelector, switchModel, MODELS };
