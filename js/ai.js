const MODELS = [
  { id: 'onnx-community/SmolLM2-135M-ONNX', name: 'SmolLM2-135M', size: '135MB', dtype: 'q4', desc: 'basic' },
  { id: 'onnx-community/SmolLM2-360M-ONNX', name: 'SmolLM2-360M', size: '360MB', dtype: 'q4', desc: 'balanced' },
  { id: 'onnx-community/Qwen2.5-0.5B-Instruct', name: 'Qwen2.5-0.5B', size: '350MB', dtype: 'fp16', desc: 'smart' },
  { id: 'Xenova/TinyLlama-1.1B-Chat-v1.0', name: 'TinyLlama-1.1B', size: '670MB', dtype: 'q4', desc: 'fun' },
  { id: 'onnx-community/Llama-3.2-1B-Instruct-ONNX', name: 'Llama-3.2-1B', size: '1.1GB', dtype: 'fp16', desc: 'best' },
];

let activeModel = 0;
let pipeline = null;
let pipelineLoading = false;

async function loadPipeline(term) {
  if (pipeline) return pipeline;
  if (pipelineLoading) return null;
  pipelineLoading = true;

  try {
    if (term) term.writeln(`\x1b[2mLoading AI module...\x1b[0m`);

    const { pipeline: p } = await import('@huggingface/transformers');

    const model = MODELS[activeModel];
    const gpu = navigator.gpu;
    const device = gpu ? 'webgpu' : 'wasm';
    if (term) {
      term.writeln(`\x1b[2mGPU backend: navigator.gpu = ${gpu ?? '\x1b[91mundefined\x1b[2m'} \u2192 using ${device}\x1b[0m`);
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
        session_options: { numThreads: 1 },
      }),
      timeout,
    ]);

    if (term) term.writeln(`\r\x1b[32mModel loaded\x1b[0m`);
    return pipeline;
  } catch (e) {
    if (term) term.writeln(`\r\x1b[91mFailed to load model: ${e.message}\x1b[0m`);
    pipelineLoading = false;
    return null;
  }
}

async function generateOutput(prompt, term) {
  if (!prompt) {
    term.writeln(`\x1b[2mUsage: ai <prompt>\x1b[0m`);
    term.writeln(`\x1b[2m       ai-models        (list models)\x1b[0m`);
    term.writeln(`\x1b[2m       ai-model <id>    (switch model, 0-4)\x1b[0m`);
    return;
  }
  const p = await loadPipeline(term);
  if (!p) return;
  try {
    term.writeln(`\x1b[2m\xf0\x9f\x94\x84 Generating...\x1b[0m`);
    const result = await p(prompt, { max_new_tokens: 100, temperature: 0.7, do_sample: true });
    term.writeln(`\x1b[1mAI:\x1b[0m ${result[0].generated_text}`);
  } catch (e) {
    term.writeln(`\x1b[91mGeneration failed: ${e.message}\x1b[0m`);
  }
}

function showModelSelector(term) {
  term.writeln(`\x1b[1mAI Models\x1b[0m`);
  term.writeln(`\x1b[2m─────────\x1b[0m`);
  MODELS.forEach((m, i) => {
    const mark = i === activeModel ? `\x1b[32m●\x1b[0m` : `\x1b[2m○\x1b[0m`;
    const nameStr = `\x1b[36m${m.name.padEnd(16)}\x1b[0m`;
    const sizeStr = `\x1b[37m${m.size.padEnd(7)}\x1b[0m`;
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
