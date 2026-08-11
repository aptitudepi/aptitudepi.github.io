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
          model: body.model || 'llama-3.1-8b-instant',
          messages: body.messages,
          stream: true,
          max_tokens: body.max_tokens || 384,
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
