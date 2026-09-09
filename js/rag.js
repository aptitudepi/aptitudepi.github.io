import { combinedTimeoutSignal } from './fetch-timeout.js';

let embedderPipeline = null;
let embedderLoading = false;
let contextCache = null;

// WAVE 10 trustworthy RAG: retrieve-wide, rerank, then gate on relevance.
// RAG_COSINE_THRESHOLD is the minimum bge-small-en-v1.5 cosine similarity a
// vector-scored chunk must reach to feed the prompt. Tune the floor at
// runtime with `ai threshold <0-1>` (persisted override, shown in
// `ai details`); the constant below stays the documented default.
const RAG_COSINE_THRESHOLD = 0.30;
// Embedder-off fallback (and the deterministic `ai sources` debug path) has
// no cosine to compare, so it gates on the keyword score instead: one text
// hit scores 0.20, one title hit 0.40 (see computeKeywordScore).
const RAG_KEYWORD_FLOOR = 0.20;
const RAG_THRESHOLD_KEY = `dvxb_rag_threshold_v1`;
// Retrieve-wide (8) then rerank down to at most 4 — never top-4-regardless:
// below-threshold queries return NO_MATCH with an empty context.
const RAG_WIDE_COUNT = 8;
const RAG_TOP_COUNT = 4;

function readThresholdOverride() {
  try {
    const storedValue = localStorage.getItem(RAG_THRESHOLD_KEY);
    if (storedValue === null) return null;
    const parsedValue = Number(storedValue);
    if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 1) return null;
    return parsedValue;
  } catch (storageError) {
    console.warn(`rag threshold read skipped: ${storageError.message}`);
    return null;
  }
}

function effectiveCosineThreshold() {
  const overrideValue = readThresholdOverride();
  return overrideValue === null ? RAG_COSINE_THRESHOLD : overrideValue;
}

function setThresholdOverride(thresholdValue) {
  if (!Number.isFinite(thresholdValue) || thresholdValue < 0 || thresholdValue > 1) return false;
  try {
    localStorage.setItem(RAG_THRESHOLD_KEY, String(thresholdValue));
    return true;
  } catch (storageError) {
    console.warn(`rag threshold write skipped: ${storageError.message}`);
    return false;
  }
}

function clearThresholdOverride() {
  try {
    localStorage.removeItem(RAG_THRESHOLD_KEY);
  } catch (storageError) {
    console.warn(`rag threshold reset skipped: ${storageError.message}`);
  }
}

async function loadContextData() {
  if (contextCache) return contextCache;
  try {
    const contextResp = await fetch('assets/context-embeddings.json', { signal: combinedTimeoutSignal(null, 10000) });
    if (!contextResp.ok) throw new Error(`HTTP ${contextResp.status}`);
    contextCache = await contextResp.json();
    return contextCache;
  } catch (contextError) {
    console.error('Failed to load context-embeddings.json:', contextError);
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
  const rawWords = userQuery.toLowerCase().split(/\W+/).filter(w => w.length > 1);
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
  const rawWords = queryLower.split(/\W+/).filter(w => w.length > 1 && !STOPWORDS.has(w));

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
  const rankedResult = await retrieveRankedContext(userQuery, term);
  return rankedResult.contextText;
}

// Ranked retrieval with a MATCH/NO_MATCH verdict. Vector path (embedder
// available): wide-8 by cosine+keyword, rerank, keep cosine >= threshold.
// Keyword path (embedder failed, or keywordOnly for the deterministic
// `ai sources` debug command): wide-8 by keyword, rerank, keep
// rerankScore >= RAG_KEYWORD_FLOOR. Survivors are numbered [1..N] in
// reranked order so the model can cite them Perplexity-style.
export async function retrieveRankedContext(userQuery, term, rankOptions) {
  const keywordOnly = Boolean(rankOptions?.keywordOnly);
  const contextData = await loadContextData();
  if (!contextData.length) return { verdict: `NO_MATCH`, contextText: ``, sourceList: [] };

  if (!keywordOnly) {
    try {
      const embedder = await getEmbedder(term);
      if (embedder) {
        const bgeQuery = `Represent this sentence for searching relevant passages: ${userQuery}`;
        const output = await embedder(bgeQuery, { pooling: 'mean', normalize: true });
        const queryVector = Array.from(output.data);

        const scored = contextData.map((chunk) => {
          const vecScore = cosineSimilarity(queryVector, chunk.vector);
          const kwScore = computeKeywordScore(userQuery, chunk);
          return {
            text: chunk.text,
            title: chunk.title,
            score: vecScore + kwScore,
            cosine: vecScore,
          };
        });

        scored.sort((first, second) => second.score - first.score);
        const reranked = rerankChunks(userQuery, scored.slice(0, RAG_WIDE_COUNT));
        const thresholdValue = effectiveCosineThreshold();
        const matched = reranked.filter((chunk) => chunk.cosine >= thresholdValue).slice(0, RAG_TOP_COUNT);
        return formatRankedResult(matched, `cosine`);
      }
    } catch (embedError) {
      console.warn(`Vector embedding search fallback to keyword: ${embedError.message}`);
    }
  }

  // Smart keyword fallback search with stopword filtering & title weighting
  const scored = contextData.map((item) => {
    const score = computeKeywordScore(userQuery, item);
    return { text: item.text, title: item.title, score, cosine: null };
  });

  scored.sort((first, second) => second.score - first.score);
  const reranked = rerankChunks(userQuery, scored.slice(0, RAG_WIDE_COUNT));
  const matched = reranked.filter((chunk) => chunk.rerankScore >= RAG_KEYWORD_FLOOR).slice(0, RAG_TOP_COUNT);
  return formatRankedResult(matched, `keyword`);
}

function formatRankedResult(matchedChunks, scoreKind) {
  if (!matchedChunks.length) return { verdict: `NO_MATCH`, contextText: ``, sourceList: [] };
  const sourceList = matchedChunks.map((chunk, chunkIndex) => {
    const marker = `[${chunkIndex + 1}]`;
    const displayScore = scoreKind === `cosine` ? chunk.cosine : chunk.rerankScore;
    return { marker, title: chunk.title, text: chunk.text, score: displayScore, scoreKind };
  });
  const contextText = sourceList.map((source) => `${source.marker} ${source.title}\n${source.text}`).join(`\n\n`);
  return { verdict: `MATCH`, contextText, sourceList };
}

export { RAG_COSINE_THRESHOLD, RAG_KEYWORD_FLOOR, effectiveCosineThreshold, readThresholdOverride, setThresholdOverride, clearThresholdOverride };
