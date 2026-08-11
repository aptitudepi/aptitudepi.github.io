let embedderPipeline = null;
let embedderLoading = false;
let contextCache = null;

async function loadContextData() {
  if (contextCache) return contextCache;
  try {
    const res = await fetch('assets/context-embeddings.json');
    contextCache = await res.json();
    return contextCache;
  } catch (e) {
    console.error('Failed to load context-embeddings.json:', e);
    return [];
  }
}

async function getEmbedder(term) {
  if (embedderPipeline) return embedderPipeline;
  if (embedderLoading) return null;
  embedderLoading = true;

  try {
    if (term) term.writeln(`\x1b[2mLoading RAG embedder (BAAI/bge-small-en-v1.5)...\x1b[0m`);
    const { pipeline } = await import('@huggingface/transformers');
    embedderPipeline = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', {
      dtype: 'fp32',
    });
    if (term) term.writeln(`\x1b[32mRAG embedder loaded\x1b[0m`);
    return embedderPipeline;
  } catch (e) {
    console.warn('Vector embedder load notice:', e.message);
    embedderLoading = false;
    return null;
  }
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator ? dot / denominator : 0;
}

export async function retrieveContext(userQuery, term) {
  const contextData = await loadContextData();
  if (!contextData.length) return '';

  try {
    const embedder = await getEmbedder(term);
    if (embedder) {
      const output = await embedder(userQuery, { pooling: 'mean', normalize: true });
      const queryVector = Array.from(output.data);

      const scored = contextData.map(chunk => ({
        text: chunk.text,
        title: chunk.title,
        score: cosineSimilarity(queryVector, chunk.vector)
      }));

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 3).map(c => `[${c.title}]\n${c.text}`).join('\n\n');
    }
  } catch (e) {
    console.warn('Vector embedding search fallback to keyword:', e);
  }

  // Fast keyword fallback search if embedder is loading
  const keywords = userQuery.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const scored = contextData.map(item => {
    let matches = 0;
    const textLower = `${item.title} ${item.text}`.toLowerCase();
    for (const kw of keywords) {
      if (textLower.includes(kw)) matches++;
    }
    return { text: item.text, title: item.title, score: matches };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(c => `[${c.title}]\n${c.text}`).join('\n\n');
}
