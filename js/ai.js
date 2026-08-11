import { startThinkingOrb, setThinkingOrbState, stopThinkingOrb } from './orb.js';
import { retrieveContext } from './rag.js';

const MODELS = [
  { id: 'groq/llama-3.1-8b-instant', name: 'groq-llama-3.1', size: '0MB (Cloud)', dtype: 'api', desc: 'llama-3.1-8b + bge-small-en (default)' },
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

async function streamGroq(prompt, context, term) {
  const workerUrl = 'https://0.supernovadkb.workers.dev/ai';
  
  term.write(`\x1b[1mAI:\x1b[0m `);

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: `You are Devkumar's portfolio assistant. Give helpful, accurate responses using ONLY this context:\n${context}` },
          { role: 'user', content: prompt }
        ],
        stream: true,
        max_tokens: 384,
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
            if (token) term.write(token);
          } catch (_err) {
            // Ignore incomplete SSE chunk payload
          }
        }
      }
    }
    term.writeln('');
  } catch (e) {
    term.writeln(`\r\x1b[91mGroq cloud stream error: ${e.message}\x1b[0m`);
    term.writeln(`\x1b[2mTip: Switch to local in-browser model using \`ai-model 1\`\x1b[0m`);
  }
}

async function streamLocal(p, prompt, context, term) {
  const { TextStreamer } = await import('@huggingface/transformers');
  
  term.write(`\x1b[1mAI:\x1b[0m `);

  const streamer = new TextStreamer(p.tokenizer, {
    skip_prompt: true,
    callback_function: (text) => term.write(text)
  });

  const fullPrompt = `<|im_start|>system\nYou are Devkumar's portfolio assistant.\nContext:\n${context}<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;

  await p(fullPrompt, {
    max_new_tokens: 256,
    temperature: 0.7,
    do_sample: true,
    streamer
  });
  term.writeln('');
}

async function generateOutput(prompt, term) {
  if (!prompt) {
    term.writeln(`\x1b[2mUsage: ai <prompt>\x1b[0m`);
    term.writeln(`\x1b[2m       ai-models        (list models)\x1b[0m`);
    term.writeln(`\x1b[2m       ai-model <id>    (switch model, 0-5)\x1b[0m`);
    return;
  }

  startThinkingOrb(term, 'searching');
  try {
    // 1. Retrieve RAG vector context using BAAI/bge-small-en-v1.5
    const context = await retrieveContext(prompt, term);

    // 2. Load model pipeline (Cloud Groq or Local ONNX)
    const p = await loadPipeline(term);
    if (!p) return;

    setThinkingOrbState('composing');
    term.writeln(`\x1b[2m\xf0\x9f\x94\x84 Generating (real-time stream)...\x1b[0m`);

    if (activeModel === 0 || p === 'groq') {
      await streamGroq(prompt, context, term);
    } else {
      await streamLocal(p, prompt, context, term);
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
