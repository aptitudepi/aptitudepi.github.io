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

const STOPWORDS = new Set([
  'devkumar', 'banerjee', 'what', 'how', 'did', 'can', 'use', 'is', 'you', 'me',
  'tell', 'about', 'with', 'for', 'and', 'or', 'in', 'on', 'at', 'to', 'a', 'an',
  'the', 'does', 'he', 'his', 'which', 'who', 'where', 'when', 'why', 'work', 'site'
]);

function computeKeywordScore(userQuery, item) {
  const rawWords = userQuery.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const keywords = rawWords.filter(w => !STOPWORDS.has(w));
  const activeKeywords = keywords.length > 0 ? keywords : rawWords;

  let score = 0;
  const titleLower = item.title.toLowerCase();
  const textLower = item.text.toLowerCase();

  for (const kw of activeKeywords) {
    if (titleLower.includes(kw)) score += 0.4;
    if (textLower.includes(kw)) score += 0.2;
  }
  return score;
}

function rerankChunks(userQuery, candidates) {
  const queryLower = userQuery.toLowerCase().trim();
  const rawWords = queryLower.split(/\W+/).filter(w => w.length > 2 && !STOPWORDS.has(w));

  return candidates.map(chunk => {
    let rerankScore = chunk.score || 0;
    const titleLower = chunk.title.toLowerCase();
    const textLower = chunk.text.toLowerCase();

    // Exact phrase match bonus
    if (queryLower.length > 4 && (titleLower.includes(queryLower) || textLower.includes(queryLower))) {
      rerankScore += 1.5;
    }

    // Keyword density bonus
    for (const word of rawWords) {
      if (titleLower.includes(word)) rerankScore += 0.5;
      if (textLower.includes(word)) rerankScore += 0.25;
    }

    return { ...chunk, rerankScore };
  }).sort((a, b) => b.rerankScore - a.rerankScore);
}

export async function retrieveContext(userQuery, term) {
  const contextData = await loadContextData();
  if (!contextData.length) return '';

  try {
    const embedder = await getEmbedder(term);
    if (embedder) {
      const bgeQuery = `Represent this sentence for searching relevant passages: ${userQuery}`;
      const output = await embedder(bgeQuery, { pooling: 'mean', normalize: true });
      const queryVector = Array.from(output.data);

      const scored = contextData.map(chunk => {
        const vecScore = cosineSimilarity(queryVector, chunk.vector);
        const kwScore = computeKeywordScore(userQuery, chunk);
        return {
          text: chunk.text,
          title: chunk.title,
          score: vecScore + kwScore
        };
      });

      scored.sort((a, b) => b.score - a.score);
      const candidates = scored.slice(0, 8);
      const reranked = rerankChunks(userQuery, candidates);
      return reranked.slice(0, 4).map(c => `[${c.title}]\n${c.text}`).join('\n\n');
    }
  } catch (e) {
    console.warn('Vector embedding search fallback to keyword:', e);
  }

  // Smart keyword fallback search with stopword filtering & title weighting
  const scored = contextData.map(item => {
    const score = computeKeywordScore(userQuery, item);
    return { text: item.text, title: item.title, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const reranked = rerankChunks(userQuery, scored.slice(0, 8));
  return reranked.slice(0, 4).map(c => `[${c.title}]\n${c.text}`).join('\n\n');
}
