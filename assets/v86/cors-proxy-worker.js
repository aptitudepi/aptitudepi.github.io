// Cloudflare Worker — CORS proxy + Groq AI Gateway
// Deploy: wrangler deploy cors-proxy-worker.js --name 0

const ALLOWED_ORIGINS = [
  /^https:\/\/([a-z0-9-]+\.)*dvxb\.io$/,
  /^https:\/\/aptitudepi\.github\.io$/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '86400',
};

async function handleRequest(request, env) {
  // Block unauthorized origins
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.some(r => r.test(origin))) {
    return new Response('Forbidden', { status: 403 });
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);

  // ── 1. Groq AI Gateway Handler (/ai or POST to worker) ──
  if (url.pathname === '/ai' || (request.method === 'POST' && !url.searchParams.get('url'))) {
    try {
      const body = await request.json();
      const apiKey = (env && env.GROQ_API_KEY) || (typeof GROQ_API_KEY !== 'undefined' ? GROQ_API_KEY : '');
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'GROQ_API_KEY secret missing in Cloudflare worker configuration' }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: body.model || 'qwen/qwen3.6-27b',
          messages: body.messages,
          stream: true,
          max_tokens: body.max_tokens || 1024,
          temperature: body.temperature || 0.2,
        }),
      });

      return new Response(groqResp.body, {
        status: groqResp.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // ── 2. Web Search API Endpoint (/search?q=query) ──
  if (url.pathname === '/search') {
    const query = url.searchParams.get('q');
    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing ?q= search query' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const ddgRes = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const html = await ddgRes.text();

      const results = [];
      const resultRegex = /<a class="result__url" href="([^"]+)[\s\S]*?<a class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
        const rawUrl = match[1].trim();
        const title = match[2].replace(/<[^>]+>/g, '').trim();
        const snippet = match[3].replace(/<[^>]+>/g, '').trim();
        
        let cleanUrl = rawUrl;
        if (rawUrl.includes('uddg=')) {
          try {
            const uParam = new URLSearchParams(rawUrl.split('?')[1]).get('uddg');
            if (uParam) cleanUrl = decodeURIComponent(uParam);
          } catch (_e) {}
        }

        if (title && snippet) {
          results.push({ title, snippet, url: cleanUrl });
        }
      }

      return new Response(JSON.stringify({ query, count: results.length, results }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: `Search failed: ${err.message}` }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  }

  // ── 3. Weather API Endpoint (/weather?city=city) ──
  if (url.pathname === '/weather') {
    const city = url.searchParams.get('city') || 'auto';
    try {
      const weatherRes = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      const data = await weatherRes.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: `Weather fetch failed: ${err.message}` }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  }

  // In-memory fallback array for global guestbook entries
  let WALL_POSTS = typeof globalThis._WALL_POSTS !== 'undefined' ? globalThis._WALL_POSTS : [
    { id: 1, name: 'Alex M.', message: 'Awesome terminal portfolio! Love the particle effects.', aiReply: 'Thanks Alex! Glad you enjoyed the xterm.js & Three.js setup.', timestamp: '2026-08-10' },
    { id: 2, name: 'TAMU Coder', message: 'Gig \'em Aggies! Great research work at DIVE Lab.', aiReply: 'Gig \'em! Thanks for checking out the physics-informed GNN work.', timestamp: '2026-08-12' }
  ];
  globalThis._WALL_POSTS = WALL_POSTS;

  // ── 5. Global AI Wall & Guestbook Endpoint (/wall) ──
  if (url.pathname === '/wall') {
    if (request.method === 'GET') {
      let posts = WALL_POSTS;
      if (env && env.WALL_KV) {
        try {
          const stored = await env.WALL_KV.get('posts', { type: 'json' });
          if (stored) posts = stored;
        } catch (_e) {}
      }
      return new Response(JSON.stringify({ posts }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const authorName = (body.name || 'Anonymous Visitor').slice(0, 40);
        const userMsg = (body.message || '').slice(0, 280);

        if (!userMsg) {
          return new Response(JSON.stringify({ error: 'Message cannot be empty' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }

        // Generate AI signature reply via Groq
        let aiReply = 'Thanks for leaving a message on the dvxb.io wall!';
        const apiKey = (env && env.GROQ_API_KEY) || (typeof GROQ_API_KEY !== 'undefined' ? GROQ_API_KEY : '');
        if (apiKey) {
          try {
            const aiResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: 'qwen/qwen3.6-27b',
                messages: [
                  { role: 'system', content: 'You are Devkumar Banerjee. Write a friendly, 1-2 sentence response to a guestbook entry on your personal portfolio website. Be warm and concise.' },
                  { role: 'user', content: `${authorName} wrote: "${userMsg}"` }
                ],
                max_tokens: 256,
                temperature: 0.7
              })
            });
            if (aiResp.ok) {
              const resJson = await aiResp.json();
              const rawReply = resJson.choices[0]?.message?.content || aiReply;
              aiReply = rawReply.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || aiReply;
            }
          } catch (_e) {}
        }

        const newPost = {
          id: Date.now(),
          name: authorName,
          message: userMsg,
          aiReply: aiReply.trim(),
          timestamp: new Date().toISOString().split('T')[0]
        };

        WALL_POSTS.unshift(newPost);
        if (WALL_POSTS.length > 50) WALL_POSTS.pop();

        if (env && env.WALL_KV) {
          try { await env.WALL_KV.put('posts', JSON.stringify(WALL_POSTS)); } catch (_e) {}
        }

        return new Response(JSON.stringify({ success: true, post: newPost }), {
          status: 201,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: `Wall post failed: ${err.message}` }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
    }
  }

  // ── 2. Existing v86 CORS Proxy Handler (?url=...) ──
  const target = url.searchParams.get('url');
  if (!target) {
    return new Response('Missing ?url= parameter or /ai endpoint', { status: 400 });
  }

  const headers = new Headers(request.headers);
  headers.delete('cf-connecting-ip');
  headers.delete('x-forwarded-for');
  headers.delete('x-real-ip');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');

  const proxyRequest = new Request(target, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? null : request.body,
    redirect: 'follow',
  });

  let response;
  try {
    response = await fetch(proxyRequest);
  } catch (err) {
    return new Response(`Fetch failed: ${err.message}`, { status: 502 });
  }

  const responseHeaders = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => responseHeaders.set(k, v));
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};
