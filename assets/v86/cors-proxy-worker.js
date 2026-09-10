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

// WAVE 9a guestbook foundation: server-side name sanitize plus slug helpers.
// WAVE 9b: the moniker is assembled server-side at POST as
// visitor-<maskedip>@<city> (IPv4 first two octets e.g. 203.0.xx.xx, IPv6
// first hextet e.g. 2001:xx, never a full IP; city from the Cloudflare IP
// lookup slug plus sanitize server-side, visitor-<maskedip>@<random-handle>
// or visitor@<random-handle> fallback when the city is unknown, never
// trusting a client-sent moniker/name/ip field).
// WAVE 9b guestbook private telemetry: owner-eyes-only encrypted blob plus
// sanitized public copy. Transport is POST {name, message, gpg} where gpg is
// the browser-encrypted armored blob (or null when client collection failed).
// The worker NEVER parses or decrypts the blob: it validates the public copy,
// persists the public post in WALL_KV, and stores the opaque blob in the
// TELEMETRY R2 bucket when bound (httpMetadata contentType
// application/pgp-encrypted plus private no-store; customMetadata postId,
// createdAt, fpHash) or in WALL_KV under telemetry:<post-id>.asc otherwise.
// Blob writes run via ctx.waitUntil so the visitor response is never gated.
// NOTE (2026-09-08): R2 is not enabled on this Cloudflare account (API 10042
// "Please enable R2 through the Cloudflare Dashboard"), so `wrangler r2
// bucket create` is BLOCKED until the owner enables R2 in the dashboard. The
// KV fallback below is the active path; add an r2_buckets TELEMETRY binding
// to wrangler.jsonc once R2 is enabled — no worker code change needed.
// Raw visitor IPs are never persisted outside the encrypted blob: rate
// limiting keeps transient HMAC daily-salt keyed counters only, and the
// moniker keeps an IP-derived city slug (random-handle fallback).
// Post shape stays {id, name, message, timestamp}: post-moderation stance (no
// queue), keep-forever (no TTL on the posts put), no archival job, no email
// anywhere. Delete tokens are random 128-bit values returned once at submit;
// the server stores ONLY a salted SHA-256 hash beside the public record and
// verifies deletes without decrypting the blob.
const WALL_OWNER_KEY_FINGERPRINT = `7301fa8f5d533ef7940695fcdfc72721be0bdde2`;
const WALL_POSTS_MAX = 50;
const WALL_MESSAGE_MAX = 280;
const WALL_LINK_MAX = 2;
const WALL_RATE_LIMIT_MAX = 10;
const WALL_RATE_LIMIT_TTL_SECONDS = 3600;

const WALL_HANDLE_ADJECTIVES = [
  `amber`, `brisk`, `calm`, `dapple`, `eager`, `fable`, `glint`, `harbor`,
  `ivory`, `juniper`, `kindred`, `lumen`, `mossy`, `nimble`, `opal`, `prism`,
];
const WALL_HANDLE_NOUNS = [
  `fox`, `heron`, `ibis`, `jay`, `koala`, `lark`, `moth`, `newt`,
  `otter`, `pipit`, `quail`, `raven`, `stoat`, `tern`, `urchin`, `wren`,
];

function wallRandomHex(byteCount) {
  const randomBytes = new Uint8Array(byteCount);
  crypto.getRandomValues(randomBytes);
  const hexParts = [];
  for (const randomByte of randomBytes) {
    hexParts.push(randomByte.toString(16).padStart(2, `0`));
  }
  return hexParts.join(``);
}

async function wallSha256Hex(sourceText) {
  const textBytes = new TextEncoder().encode(sourceText);
  const digestBytes = await crypto.subtle.digest(`SHA-256`, textBytes);
  const digestView = new Uint8Array(digestBytes);
  const hexParts = [];
  for (const digestByte of digestView) {
    hexParts.push(digestByte.toString(16).padStart(2, `0`));
  }
  return hexParts.join(``);
}

async function wallHmacHex(secretText, valueText) {
  const textEncoder = new TextEncoder();
  const hmacKey = await crypto.subtle.importKey(
    `raw`,
    textEncoder.encode(secretText),
    { name: `HMAC`, hash: `SHA-256` },
    false,
    [`sign`],
  );
  const signatureBytes = await crypto.subtle.sign(`HMAC`, hmacKey, textEncoder.encode(valueText));
  const signatureView = new Uint8Array(signatureBytes);
  const hexParts = [];
  for (const signatureByte of signatureView) {
    hexParts.push(signatureByte.toString(16).padStart(2, `0`));
  }
  return hexParts.join(``);
}

function wallStripHtml(rawText) {
  return String(rawText ?? ``).replace(/<[^>]*>/g, ``);
}

function wallStripAnsi(rawText) {
  const sourceText = String(rawText ?? ``);
  let cleanText = ``;
  for (const glyph of sourceText) {
    const codePoint = glyph.codePointAt(0);
    const isBadControl =
      codePoint < 0x20 ? codePoint !== 0x0a && codePoint !== 0x0d && codePoint !== 0x09 : codePoint === 0x7f;
    if (isBadControl === false) {
      cleanText = `${cleanText}${glyph}`;
    }
  }
  return cleanText;
}

// Spam heuristics on the public fields only: empty, over-length, or
// link-stuffed posts are rejected with a plan-language message. Returns an
// error string, or null when the message is acceptable.
function wallSpamVerdict(cleanMessage) {
  if (cleanMessage.length === 0) {
    return `Message cannot be empty`;
  }
  if (Array.from(cleanMessage).length > WALL_MESSAGE_MAX) {
    return `Message is too long (kept to 280 characters)`;
  }
  const schemeLinks = cleanMessage.match(/https?:\/\//g) ?? [];
  const bareLinks = cleanMessage.match(/www\./g) ?? [];
  if (schemeLinks.length + bareLinks.length > WALL_LINK_MAX) {
    return `Message looks like link spam — keep it to two links or fewer`;
  }
  return null;
}

// HMAC daily-salt keyed counter with a short TTL. Only the digest is
// persisted — raw IPs never touch storage outside the encrypted blob.
async function wallRateLimitExceeded(observedIp, requestAgent, env) {
  if (env === null || env === undefined || env.WALL_KV === undefined) {
    return false;
  }
  const dayString = new Date().toISOString().slice(0, 10);
  const rateSecret =
    typeof env.RATE_LIMIT_SECRET === `string` && env.RATE_LIMIT_SECRET.length > 0
      ? env.RATE_LIMIT_SECRET
      : `dvxb-wall-fallback-salt`;
  const digestInput = `${dayString}|${observedIp}|${requestAgent}`;
  const digestHex = await wallHmacHex(rateSecret, digestInput);
  const counterKey = `wall:rl:${dayString}:${digestHex.slice(0, 32)}`;
  const storedCount = await env.WALL_KV.get(counterKey);
  const currentCount = Number(storedCount ?? 0);
  if (Number.isFinite(currentCount) && currentCount >= WALL_RATE_LIMIT_MAX) {
    return true;
  }
  const nextCount = Number.isFinite(currentCount) ? currentCount + 1 : 1;
  await env.WALL_KV.put(counterKey, String(nextCount), { expirationTtl: WALL_RATE_LIMIT_TTL_SECONDS });
  return false;
}

function wallRandomHandle() {
  const pickBytes = new Uint8Array(3);
  crypto.getRandomValues(pickBytes);
  const adjectivePick = WALL_HANDLE_ADJECTIVES[pickBytes[0] % WALL_HANDLE_ADJECTIVES.length];
  const nounPick = WALL_HANDLE_NOUNS[pickBytes[1] % WALL_HANDLE_NOUNS.length];
  const digitSuffix = String((pickBytes[2] % 90) + 10);
  return `${adjectivePick}-${nounPick}-${digitSuffix}`;
}

function wallTimingEqual(firstHex, secondHex) {
  if (firstHex.length !== secondHex.length) {
    return false;
  }
  let difference = 0;
  for (let compareIndex = 0; compareIndex < firstHex.length; compareIndex += 1) {
    difference |= firstHex.charCodeAt(compareIndex) ^ secondHex.charCodeAt(compareIndex);
  }
  return difference === 0;
}

// Opaque blob store: validates the armor envelope only (never the plaintext),
// then persists via ctx.waitUntil so the visitor response is never gated.
function queueWallTelemetryStore(postId, createdAt, armoredBlob, env, ctx) {
  const persistTask = (async () => {
    try {
      if (typeof armoredBlob !== `string` || armoredBlob.startsWith(`-----BEGIN PGP MESSAGE-----`) === false) {
        return;
      }
      if (armoredBlob.length > 131072) {
        console.warn(`wall telemetry: blob oversize, dropped`);
        return;
      }
      const postIdText = String(postId);
      if (env !== null && env !== undefined && env.TELEMETRY !== undefined) {
        await env.TELEMETRY.put(`telemetry/${postIdText}.asc`, armoredBlob, {
          httpMetadata: { contentType: `application/pgp-encrypted`, cacheControl: `private, no-store` },
          customMetadata: { postId: postIdText, createdAt, fpHash: WALL_OWNER_KEY_FINGERPRINT },
        });
        return;
      }
      if (env !== null && env !== undefined && env.WALL_KV !== undefined) {
        await env.WALL_KV.put(`telemetry:${postIdText}.asc`, armoredBlob, {
          metadata: { postId: postIdText, createdAt, fpHash: WALL_OWNER_KEY_FINGERPRINT },
        });
      }
    } catch (storeError) {
      console.warn(`wall telemetry: blob store failed`, storeError);
    }
  })();
  if (ctx !== null && ctx !== undefined && typeof ctx.waitUntil === `function`) {
    ctx.waitUntil(persistTask);
    return;
  }
  persistTask.catch((waitError) => {
    console.warn(`wall telemetry: blob store failed`, waitError);
  });
}

function slugWallSegment(rawSegment) {
  const lowered = String(rawSegment ?? '').trim().toLowerCase();
  const keptChars = [];
  for (const glyph of lowered) {
    const codePoint = glyph.codePointAt(0);
    const isLowerLetter = codePoint >= 0x61 && codePoint <= 0x7A;
    const isDigitChar = codePoint >= 0x30 && codePoint <= 0x39;
    if (isLowerLetter || isDigitChar) {
      keptChars.push(glyph);
    } else if (glyph === ' ' || glyph === '_' || glyph === '-' || glyph === '.') {
      keptChars.push('-');
    }
  }
  return keptChars.join('').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

function sanitizeWallName(rawName) {
  const slugText = slugWallSegment(rawName);
  if (!slugText) {
    return 'Anonymous Visitor';
  }
  return slugText.slice(0, 40);
}

// Masked-IP segment for the public moniker: IPv4 keeps the first two
// octets (203.0.xx.xx), IPv6 keeps the first hextet (2001:xx). Returns null
// when the observed IP is missing or unparsable, so the moniker falls back
// to the bare visitor@... shape. A full IP never enters the moniker.
function maskWallIp(observedIp) {
  const candidateText = String(observedIp ?? ``).trim().toLowerCase().slice(0, 64);
  if (candidateText.length === 0) {
    return null;
  }
  const octetParts = candidateText.split(`.`);
  if (octetParts.length === 4 && candidateText.includes(`:`) === false) {
    const octetNumbers = [];
    for (const octetText of octetParts) {
      if (/^\d{1,3}$/.test(octetText) === false) {
        return null;
      }
      const octetNumber = Number(octetText);
      if (Number.isInteger(octetNumber) === false || octetNumber < 0 || octetNumber > 255) {
        return null;
      }
      octetNumbers.push(String(octetNumber));
    }
    return `${octetNumbers[0]}.${octetNumbers[1]}.xx.xx`;
  }
  if (candidateText.includes(`:`)) {
    if (/^[0-9a-f:.]+$/.test(candidateText) === false) {
      return null;
    }
    const hextetParts = candidateText.split(`:`);
    const firstHextet = String(hextetParts[0] ?? ``).replace(/[^0-9a-f]/g, ``).slice(0, 4);
    if (firstHextet.length === 0) {
      return null;
    }
    return `${firstHextet}:xx`;
  }
  return null;
}

async function handleRequest(request, env, ctx) {
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
  // WAVE 9a: the bare-POST fallback is scoped to the root path so POST /wall
  // reaches the guestbook handler below (it was previously swallowed here).
  if (url.pathname === '/ai' || (url.pathname === '/' && request.method === 'POST' && !url.searchParams.get('url'))) {
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
          model: body.model || 'qwen/qwen3.8-27b',
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
          } catch (uddgError) {
            console.warn(`search: uddg unwrap failed`, uddgError);
          }
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
  let WALL_POSTS = typeof globalThis._WALL_POSTS !== 'undefined' ? globalThis._WALL_POSTS : [];
  globalThis._WALL_POSTS = WALL_POSTS;
  if (typeof globalThis._WALL_DELTOKENS === 'undefined') {
    globalThis._WALL_DELTOKENS = {};
  }

  // ── 5. Global Guestbook Endpoint (/wall) ──
  if (url.pathname === '/wall') {
    if (request.method === 'GET') {
      let posts = WALL_POSTS;
      if (env && env.WALL_KV) {
        try {
          const stored = await env.WALL_KV.get('posts', { type: 'json' });
          if (stored) posts = stored;
        } catch (readError) {
          console.warn(`wall: kv read failed`, readError);
        }
      }
      return new Response(JSON.stringify({ posts }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        // WAVE 9b guestbook: no AI replies, no approval queue
        // (post-moderation stance), keep-forever (no TTL on the KV put
        // below), no archival job, no email field anywhere. The public copy
        // is anonymous-by-design: any body.moniker or body.name sent by a
        // client is ignored on purpose (the moniker is assembled server-side
        // as visitor-<maskedip>@<city-slug> with a random-handle fallback),
        // and any top-level body.ip is likewise ignored — the client puts
        // its fetched IP only inside the encrypted telemetry blob, which
        // this worker never parses or decrypts.
        const observedIp = request.headers.get('cf-connecting-ip') || '';
        const requestAgent = request.headers.get('user-agent') || '';
        let limitedVisitor = false;
        try {
          limitedVisitor = await wallRateLimitExceeded(observedIp, requestAgent, env);
        } catch (limitError) {
          console.warn(`wall: rate-limit check failed open`, limitError);
          limitedVisitor = false;
        }
        if (limitedVisitor) {
          return new Response(JSON.stringify({ error: `The guestbook is catching its breath — please try again in a little while.` }), { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }

        const rawMessage = typeof body.message === 'string' ? body.message : '';
        const cleanMessage = wallStripAnsi(wallStripHtml(rawMessage)).trim().slice(0, 280);
        const spamError = wallSpamVerdict(cleanMessage);
        if (spamError) {
          return new Response(JSON.stringify({ error: spamError }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }

        const cloudCity = request.cf && typeof request.cf.city === 'string' ? request.cf.city : '';
        const citySlug = slugWallSegment(cloudCity);
        const maskedIp = maskWallIp(observedIp);
        const visitorPrefix = maskedIp === null ? `visitor` : `visitor-${maskedIp}`;
        const monikerName = citySlug
          ? `${visitorPrefix}@${citySlug}`.slice(0, 64)
          : `${visitorPrefix}@${wallRandomHandle()}`;

        // Post shape: { id, name, message, timestamp }. Stored legacy posts
        // keep their aiReply field until overwritten; clients no longer read
        // it. One-time migration (do NOT execute here): delete the key once
        // via `wrangler kv:key delete --binding WALL_KV posts` to drop it.
        const postId = Date.now();
        const createdAt = new Date().toISOString().split('T')[0];
        const newPost = {
          id: postId,
          name: monikerName,
          message: cleanMessage,
          timestamp: createdAt
        };

        WALL_POSTS.unshift(newPost);
        if (WALL_POSTS.length > WALL_POSTS_MAX) WALL_POSTS.pop();

        if (env && env.WALL_KV) {
          try { await env.WALL_KV.put('posts', JSON.stringify(WALL_POSTS)); } catch (persistError) { console.warn(`wall: kv put failed`, persistError); }
        }

        // Delete token: random 128-bit, returned once; the server stores
        // ONLY a salted SHA-256 hash beside the public record, so deletes
        // verify without ever decrypting the telemetry blob. Token loss
        // falls back to manual review by the site owner.
        const deleteToken = wallRandomHex(16);
        const tokenSalt = wallRandomHex(16);
        const tokenHash = await wallSha256Hex(`${tokenSalt}:${deleteToken}`);
        const tokenKey = `wall:deltoken:${String(postId)}`;
        const tokenRecord = JSON.stringify({ salt: tokenSalt, hash: tokenHash });
        if (env && env.WALL_KV) {
          try { await env.WALL_KV.put(tokenKey, tokenRecord); } catch (tokenError) { console.warn(`wall: delete-token put failed`, tokenError); }
        } else {
          globalThis._WALL_DELTOKENS[tokenKey] = tokenRecord;
        }

        // Private telemetry blob: opaque to this worker (never parsed or
        // decrypted). Stored via ctx.waitUntil so the visitor response below
        // is never gated on the blob write.
        const armoredBlob = typeof body.gpg === 'string' ? body.gpg : '';
        queueWallTelemetryStore(postId, createdAt, armoredBlob, env, ctx);

        return new Response(JSON.stringify({ success: true, post: newPost, deleteToken }), {
          status: 201,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: `Wall post failed: ${err.message}` }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
    }
  }

  // ── 5b. Guestbook API alias (/api/guestbook) ──
  // GET lists the same sanitized public copy as /wall (used by the owner
  // decrypt CLI). DELETE /api/guestbook/:id removes a post when the
  // one-time delete token verifies against the stored salted hash.
  if (url.pathname === '/api/guestbook' && request.method === 'GET') {
    let apiPosts = WALL_POSTS;
    if (env && env.WALL_KV) {
      try {
        const storedPosts = await env.WALL_KV.get('posts', { type: 'json' });
        if (storedPosts) apiPosts = storedPosts;
      } catch (apiReadError) {
        console.warn(`wall: api kv read failed`, apiReadError);
      }
    }
    return new Response(JSON.stringify({ posts: apiPosts }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  const guestbookDeleteMatch = url.pathname.match(/^\/api\/guestbook\/([A-Za-z0-9_-]+)$/);
  if (guestbookDeleteMatch && request.method === 'DELETE') {
    try {
      const targetId = guestbookDeleteMatch[1];
      let suppliedToken = url.searchParams.get('token') || '';
      try {
        const deleteBody = await request.json();
        if (deleteBody && typeof deleteBody.token === 'string') {
          suppliedToken = deleteBody.token;
        }
      } catch (bodyError) {
        console.warn(`wall: delete body unreadable, trying query token`, bodyError);
      }
      if (!suppliedToken) {
        return new Response(JSON.stringify({ error: `Delete token required — contact the site owner for manual review if it was lost.` }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
      const tokenKey = `wall:deltoken:${targetId}`;
      let storedRecord = null;
      if (env && env.WALL_KV) {
        try {
          storedRecord = await env.WALL_KV.get(tokenKey, { type: 'json' });
        } catch (tokenReadError) {
          console.warn(`wall: delete-token read failed`, tokenReadError);
        }
      } else if (globalThis._WALL_DELTOKENS[tokenKey]) {
        try {
          storedRecord = JSON.parse(globalThis._WALL_DELTOKENS[tokenKey]);
        } catch (parseError) {
          console.warn(`wall: in-memory token parse failed`, parseError);
        }
      }
      if (storedRecord === null || storedRecord === undefined || typeof storedRecord.salt !== 'string' || typeof storedRecord.hash !== 'string') {
        return new Response(JSON.stringify({ error: `Unknown or expired delete token — contact the site owner for manual review.` }), { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
      const candidateHash = await wallSha256Hex(`${storedRecord.salt}:${suppliedToken}`);
      if (wallTimingEqual(candidateHash, storedRecord.hash) === false) {
        return new Response(JSON.stringify({ error: `Unknown or expired delete token — contact the site owner for manual review.` }), { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
      let currentPosts = WALL_POSTS;
      if (env && env.WALL_KV) {
        try {
          const storedPosts = await env.WALL_KV.get('posts', { type: 'json' });
          if (storedPosts) currentPosts = storedPosts;
        } catch (listError) {
          console.warn(`wall: delete list read failed`, listError);
        }
      }
      const keptPosts = currentPosts.filter((keptPost) => String(keptPost.id) !== targetId);
      WALL_POSTS = keptPosts;
      globalThis._WALL_POSTS = keptPosts;
      const cleanupTask = (async () => {
        try {
          if (env && env.WALL_KV) {
            await env.WALL_KV.put('posts', JSON.stringify(keptPosts));
            await env.WALL_KV.delete(tokenKey);
            await env.WALL_KV.delete(`telemetry:${targetId}.asc`);
          } else {
            delete globalThis._WALL_DELTOKENS[tokenKey];
          }
          if (env !== null && env !== undefined && env.TELEMETRY !== undefined) {
            await env.TELEMETRY.delete(`telemetry/${targetId}.asc`);
          }
        } catch (cleanupError) {
          console.warn(`wall: delete cleanup failed`, cleanupError);
        }
      })();
      if (ctx !== null && ctx !== undefined && typeof ctx.waitUntil === `function`) {
        ctx.waitUntil(cleanupTask);
      } else {
        await cleanupTask;
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: `Wall delete failed: ${err.message}` }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
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
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};

export { slugWallSegment, sanitizeWallName, maskWallIp };
