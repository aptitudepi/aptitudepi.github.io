// js/wall-telemetry.js — WAVE 9b guestbook private telemetry (owner-eyes-only).
//
// Dual-copy design: the public guestbook copy ({id,name,message,timestamp})
// stays readable by everyone; this module builds the private copy — device
// signals encrypted in the browser to the owner's PGP public key before the
// POST leaves the device. The worker (assets/v86/cors-proxy-worker.js) stores
// the armored blob without ever parsing or decrypting it.
//
// SCHEMA v1 — explicit allowlist collector, not a blocklist. The canonical
// record carries exactly these keys, in this order:
//   v, nonce, ip, canvasHash, canvasStable, userAgent, hardwareConcurrency,
//   deviceMemory, gpuVendor, gpuRenderer, timezone, devicePixelRatio,
//   webrtcCandidates, geo
// - v: schema version, always 1.
// - nonce: per-post 128-bit random hex (16 bytes via getRandomValues).
// - ip: client-fetched full public IP text (IPv4 or IPv6) placed in this
//   designated field pre-encrypt, fail-closed to null on any fetch, parse,
//   or validation failure (the post still submits). The server NEVER injects
//   an IP into the blob — it cannot decrypt it — and any top-level
//   client-supplied `ip` outside this canonical telemetry field is forced to
//   null by canonicalizeWallTelemetry (invalid shapes never survive).
//   City stays server-derived from the Cloudflare IP lookup; the client
//   MUST NOT fetch or send a city.
// - canvasHash: SHA-256 hex of a small fixed render (hash-of-render only).
// - canvasStable: draw-twice compare bit. The raw bitmap NEVER leaves the
//   device — only the digest plus the stability bit enter the blob.
// - userAgent: navigator.userAgent string when available, else null.
// - hardwareConcurrency / deviceMemory: navigator values when available.
// - gpuVendor / gpuRenderer: WEBGL_debug_renderer_info strings when
//   available, else null.
// - timezone: Intl resolved time-zone string when available, else null.
// - devicePixelRatio: window.devicePixelRatio when available, else null.
// - webrtcCandidates: STUN-derived (stun.l.google.com:19302) srflx candidate
//   strings, best-effort with a short timeout, truncated to at most 8 entries
//   of at most 256 chars each; empty array on any failure.
// - geo: precise {latitude, longitude, accuracy} ONLY via the browser
//   permission prompt at POST time. Callers MUST print an inline rationale
//   immediately before calling collectWallTelemetry (see runWallCommand in
//   js/commands.js). Denial or timeout resolves to null silently and never
//   blocks the post — the server falls back to IP-city for the moniker.
//
// EXCLUDED always: font enumeration, passwords or credentials, microphone or
// camera capture, wallet or financial data, covert precise GPS, and message
// PII beyond the moderated public post.
//
// Transport: POST {name, message, gpg} where gpg is the armored blob (or null
// when collection or encryption failed — fail-closed: the public post still
// submits). Canonical JSON is capped at 65536 bytes pre-encrypt (Free-plan
// CPU bound); oversize payloads throw so the caller drops telemetry.
//
// Crypto: openpgp is self-hosted and pinned (vendor/openpgp.min.mjs, v6.2.1),
// loaded via dynamic import() inside the submit path only — never preloaded,
// never in the initial bundle. readKey result cached per page load. No
// signingKeys: the sender is unauthenticated by design.
//
// Owner key rotation: replace WALL_OWNER_PUBLIC_KEY_ARMOR below with the new
// armored public key, update WALL_OWNER_KEY_FINGERPRINT in the worker, and
// redeploy. The private key is never committed.

export const WALL_TELEMETRY_VERSION = 1;
export const WALL_TELEMETRY_MAX_BYTES = 65536;
export const WALL_TELEMETRY_GEO_TIMEOUT_MILLIS = 4000;
export const WALL_TELEMETRY_STUN_TIMEOUT_MILLIS = 1500;
export const WALL_TELEMETRY_IP_TIMEOUT_MILLIS = 4000;
export const WALL_TELEMETRY_MAX_CANDIDATES = 8;
export const WALL_TELEMETRY_MAX_CANDIDATE_CHARS = 256;
export const WALL_PUBLIC_IP_PRIMARY_URL = `https://api.ipify.org?format=json`;
export const WALL_PUBLIC_IP_FALLBACK_URL = `https://ident.me/.json`;

// Placeholder owner key (fingerprint 157414f82954c9726f9068fc742ae9990a8b5952,
// generated 2026-09-08 for the encrypt round-trip proof; private part kept
// out of the repo). The site owner MUST generate a dedicated keypair offline,
// replace this block with the real armored public key, and keep the private
// key local-only (see tools/wall-admin.mjs).
export const WALL_OWNER_PUBLIC_KEY_ARMOR = `-----BEGIN PGP PUBLIC KEY BLOCK-----

xjMEaqBsLxYJKwYBBAHaRw8BAQdAFkRutMXYE0Q5rJ+XxX6zLK7PhJBJW2fQ
QtesBjebV4nNK2R2eGIuaW8gZ3Vlc3Rib29rIHRlbGVtZXRyeSA8b3duZXJA
ZHZ4Yi5pbz7CwBMEExYKAIUFgmqgbC8DCwkHCRB0KumZCotZUkUUAAAAAAAc
ACBzYWx0QG5vdGF0aW9ucy5vcGVucGdwanMub3JnvLoSI4DObn2wgPxyRWw2
5M74dP8J3G+DYy/ll4UiqjcFFQoIDgwEFgACAQIZAQKbAwIeARYhBBV0FPgp
VMlyb5Bo/HQq6ZkKi1lSAADFOwEAxdmGzPN+FCsWBstSAKhNi+Har4wnRGRE
wxOfiOFqlwQA/iLAXgqqa+wNXwzrAGWh5Ml2DR0mzHYL6K2A6bMNQLkBzjgE
aqBsLxIKKwYBBAGXVQEFAQEHQGlnzKwiNukufREEe7gOF/+CoGRTQ5LhDI6S
LlclZ8UjAwEIB8K+BBgWCgBwBYJqoGwvCRB0KumZCotZUkUUAAAAAAAcACBz
YWx0QG5vdGF0aW9ucy5vcGVucGdwanMub3JnG4ukL2J2RaX4xtsuF34qgcE0
h794ecmTF+DmD50Dre0CmwwWIQQVdBT4KVTJcm+QaPx0KumZCotZUgAAy4cA
/icdcXOZvVKyaJSRRwDDaUi6C6gHOvxC1qwdoF7zIsC1AQDwgQKhzAArEwem
bQRtL50Jb0+hoBeIr9OEKd0fNc8XAw==
=qZ+X
-----END PGP PUBLIC KEY BLOCK-----`;

const WALL_TELEMETRY_FIELD_ORDER = [
  `v`,
  `nonce`,
  `ip`,
  `canvasHash`,
  `canvasStable`,
  `userAgent`,
  `hardwareConcurrency`,
  `deviceMemory`,
  `gpuVendor`,
  `gpuRenderer`,
  `timezone`,
  `devicePixelRatio`,
  `webrtcCandidates`,
  `geo`,
];

let cachedOwnerKey = null;

export function wallTelemetryVendorUrl() {
  return new URL(`../vendor/openpgp.min.mjs`, import.meta.url).href;
}

export function newWallNonce() {
  return telemetryRandomHex(16);
}

function telemetryRandomHex(byteCount) {
  const randomBytes = new Uint8Array(byteCount);
  crypto.getRandomValues(randomBytes);
  const hexParts = [];
  for (const byteValue of randomBytes) {
    hexParts.push(byteValue.toString(16).padStart(2, `0`));
  }
  return hexParts.join(``);
}

async function sha256HexDigest(sourceText) {
  const textBytes = new TextEncoder().encode(sourceText);
  const digestBytes = await crypto.subtle.digest(`SHA-256`, textBytes);
  const digestView = new Uint8Array(digestBytes);
  const hexParts = [];
  for (const digestByte of digestView) {
    hexParts.push(digestByte.toString(16).padStart(2, `0`));
  }
  return hexParts.join(``);
}

function paintTelemetryCanvas(paintContext) {
  paintContext.fillStyle = `#1a1d24`;
  paintContext.fillRect(0, 0, 64, 32);
  paintContext.fillStyle = `#50c878`;
  paintContext.font = `10px monospace`;
  paintContext.fillText(`dvxb-wall-v1`, 4, 14);
  paintContext.fillStyle = `#508cfa`;
  paintContext.fillRect(4, 20, 56, 6);
}

async function readCanvasDigest() {
  try {
    if (typeof document === `undefined` || typeof crypto.subtle === `undefined`) {
      return { hash: null, stable: null };
    }
    const paintCanvas = document.createElement(`canvas`);
    paintCanvas.width = 64;
    paintCanvas.height = 32;
    const paintContext = paintCanvas.getContext(`2d`);
    if (paintContext === null) {
      return { hash: null, stable: null };
    }
    paintTelemetryCanvas(paintContext);
    const firstRender = paintCanvas.toDataURL();
    paintTelemetryCanvas(paintContext);
    const secondRender = paintCanvas.toDataURL();
    const stableRender = firstRender === secondRender;
    const renderHash = await sha256HexDigest(firstRender);
    return { hash: renderHash, stable: stableRender };
  } catch (canvasError) {
    console.warn(`wall telemetry: canvas digest unavailable`, canvasError);
    return { hash: null, stable: null };
  }
}

function readGpuStrings() {
  try {
    if (typeof document === `undefined`) {
      return { vendor: null, renderer: null };
    }
    const probeCanvas = document.createElement(`canvas`);
    const glContext = probeCanvas.getContext(`webgl`);
    if (glContext === null || glContext === undefined) {
      return { vendor: null, renderer: null };
    }
    const debugInfo = glContext.getExtension(`WEBGL_debug_renderer_info`);
    if (debugInfo === null || debugInfo === undefined) {
      return { vendor: null, renderer: null };
    }
    const vendorText = glContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const rendererText = glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return {
      vendor: typeof vendorText === `string` ? vendorText.slice(0, 256) : null,
      renderer: typeof rendererText === `string` ? rendererText.slice(0, 256) : null,
    };
  } catch (gpuError) {
    console.warn(`wall telemetry: gpu strings unavailable`, gpuError);
    return { vendor: null, renderer: null };
  }
}

function readPreciseGeo() {
  return new Promise((resolveGeo) => {
    try {
      const geoAgent = navigator.geolocation;
      if (geoAgent === undefined || typeof geoAgent.getCurrentPosition !== `function`) {
        resolveGeo(null);
        return;
      }
      let settledGeo = false;
      const geoTimer = setTimeout(() => {
        if (settledGeo === false) {
          settledGeo = true;
          resolveGeo(null);
        }
      }, WALL_TELEMETRY_GEO_TIMEOUT_MILLIS);
      geoAgent.getCurrentPosition(
        (geoPosition) => {
          if (settledGeo) {
            return;
          }
          settledGeo = true;
          clearTimeout(geoTimer);
          const geoCoords = geoPosition.coords;
          resolveGeo({
            latitude: Number(geoCoords.latitude),
            longitude: Number(geoCoords.longitude),
            accuracy: Number(geoCoords.accuracy),
          });
        },
        (geoDenial) => {
          if (settledGeo) {
            return;
          }
          settledGeo = true;
          clearTimeout(geoTimer);
          console.warn(`wall telemetry: precise geo unavailable`, geoDenial);
          resolveGeo(null);
        },
        { timeout: WALL_TELEMETRY_GEO_TIMEOUT_MILLIS, maximumAge: 60000 },
      );
    } catch (geoFatal) {
      console.warn(`wall telemetry: geo probe failed`, geoFatal);
      resolveGeo(null);
    }
  });
}

function readStunCandidates() {
  return new Promise((resolveCandidates) => {
    try {
      const peerFactory = window.RTCPeerConnection;
      if (typeof peerFactory !== `function`) {
        resolveCandidates([]);
        return;
      }
      const peerConnection = new peerFactory({
        iceServers: [{ urls: `stun:stun.l.google.com:19302` }],
      });
      const gatheredCandidates = [];
      let finishedCandidates = false;
      const finishCandidates = () => {
        if (finishedCandidates) {
          return;
        }
        finishedCandidates = true;
        try {
          peerConnection.close();
        } catch (closeError) {
          console.warn(`wall telemetry: peer connection close failed`, closeError);
        }
        resolveCandidates(gatheredCandidates.slice(0, WALL_TELEMETRY_MAX_CANDIDATES));
      };
      const candidateTimer = setTimeout(() => {
        finishCandidates();
      }, WALL_TELEMETRY_STUN_TIMEOUT_MILLIS);
      peerConnection.onicecandidate = (candidateEvent) => {
        try {
          const iceCandidate = candidateEvent.candidate;
          if (iceCandidate === null || iceCandidate === undefined) {
            clearTimeout(candidateTimer);
            finishCandidates();
            return;
          }
          const candidateText = String(iceCandidate.candidate || ``);
          if (candidateText.length > 0) {
            gatheredCandidates.push(candidateText.slice(0, WALL_TELEMETRY_MAX_CANDIDATE_CHARS));
          }
        } catch (candidateError) {
          console.warn(`wall telemetry: candidate read failed`, candidateError);
        }
      };
      peerConnection.onicegatheringstatechange = () => {
        if (peerConnection.iceGatheringState === `complete`) {
          clearTimeout(candidateTimer);
          finishCandidates();
        }
      };
      peerConnection.createDataChannel(`wall-probe`);
      peerConnection
        .createOffer()
        .then((offerDescription) => {
          return peerConnection.setLocalDescription(offerDescription);
        })
        .catch((offerError) => {
          console.warn(`wall telemetry: stun offer failed`, offerError);
          clearTimeout(candidateTimer);
          finishCandidates();
        });
    } catch (stunFatal) {
      console.warn(`wall telemetry: stun probe failed`, stunFatal);
      resolveCandidates([]);
    }
  });
}

function readNullableNumber(sourceValue) {
  if (typeof sourceValue === `number` && Number.isFinite(sourceValue)) {
    return sourceValue;
  }
  return null;
}

function readNullableString(sourceValue, maxChars) {
  if (typeof sourceValue === `string` && sourceValue.length > 0) {
    return sourceValue.slice(0, maxChars);
  }
  return null;
}

// Designated-field IP validation: only a full IPv4 or IPv6 text survives,
// anything else (objects, empty strings, hostnames, confused extra fields)
// forces null. Never throws — fail-closed to null.
export function readNullableWallIp(sourceValue) {
  if (typeof sourceValue !== `string`) {
    return null;
  }
  const candidateText = sourceValue.trim().slice(0, 64);
  if (candidateText.length === 0 || candidateText.length > 45) {
    return null;
  }
  const octetParts = candidateText.split(`.`);
  if (octetParts.length === 4 && candidateText.includes(`:`) === false) {
    let validOctets = true;
    for (const octetText of octetParts) {
      if (/^\d{1,3}$/.test(octetText) === false) {
        validOctets = false;
        break;
      }
      const octetNumber = Number(octetText);
      if (Number.isInteger(octetNumber) === false || octetNumber < 0 || octetNumber > 255) {
        validOctets = false;
        break;
      }
    }
    return validOctets ? candidateText : null;
  }
  if (candidateText.includes(`:`)) {
    const validChars = /^[0-9a-fA-F:.]+$/.test(candidateText);
    const colonCount = candidateText.split(`:`).length - 1;
    if (validChars && colonCount >= 2 && colonCount <= 7) {
      return candidateText.toLowerCase();
    }
    return null;
  }
  return null;
}

function extractWallIpCandidate(parsedBody, fallbackText) {
  const primaryIp = readNullableWallIp(parsedBody?.ip);
  if (primaryIp !== null) {
    return primaryIp;
  }
  const fallbackAddress = readNullableWallIp(parsedBody?.address);
  if (fallbackAddress !== null) {
    return fallbackAddress;
  }
  return readNullableWallIp(fallbackText);
}

async function fetchWallIpFromUrl(targetUrl, fetchImpl, timeoutMillis) {
  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMillis);
  try {
    const ipResponse = await fetchImpl(targetUrl, { signal: timeoutController.signal });
    if (ipResponse.ok === false) {
      return null;
    }
    const responseText = await ipResponse.text();
    let parsedBody = null;
    try {
      parsedBody = JSON.parse(responseText);
    } catch (parseError) {
      console.warn(`wall telemetry: public-IP parse fell back to text`, parseError);
      parsedBody = null;
    }
    if (parsedBody !== null && typeof parsedBody === `object`) {
      return extractWallIpCandidate(parsedBody, null);
    }
    return readNullableWallIp(responseText);
  } catch (fetchError) {
    console.warn(`wall telemetry: public-IP fetch failed`, fetchError);
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// Client-side public-IP fetch: ipify primary (`{"ip":"..."}`), ident.me
// fallback (`{"address":"..."}` or plain-text body). Each leg races a ~4s
// timeout; every failure resolves to null and never blocks the post.
export async function fetchWallPublicIp(fetchOverride) {
  try {
    const fetchImpl =
      fetchOverride ?? (typeof fetch === `function` ? fetch.bind(globalThis) : null);
    if (fetchImpl === null) {
      return null;
    }
    const primaryIp = await fetchWallIpFromUrl(
      WALL_PUBLIC_IP_PRIMARY_URL,
      fetchImpl,
      WALL_TELEMETRY_IP_TIMEOUT_MILLIS,
    );
    if (primaryIp !== null) {
      return primaryIp;
    }
    return await fetchWallIpFromUrl(
      WALL_PUBLIC_IP_FALLBACK_URL,
      fetchImpl,
      WALL_TELEMETRY_IP_TIMEOUT_MILLIS,
    );
  } catch (publicIpError) {
    console.warn(`wall telemetry: public-IP unavailable`, publicIpError);
    return null;
  }
}

// Explicit allowlist: unknown keys on the input are dropped, missing keys
// resolve to null (or schema defaults), output order follows the canonical
// field list so JSON.stringify is stable across browsers.
export function canonicalizeWallTelemetry(rawRecord) {
  const sourceRecord = rawRecord ?? {};
  const canvasRecord = sourceRecord.canvas ?? {};
  const geoRecord = sourceRecord.geo ?? {};
  const candidateList = Array.isArray(sourceRecord.webrtcCandidates) ? sourceRecord.webrtcCandidates : [];
  const cleanCandidates = [];
  for (const candidateEntry of candidateList) {
    if (typeof candidateEntry === `string` && candidateEntry.length > 0) {
      cleanCandidates.push(candidateEntry.slice(0, WALL_TELEMETRY_MAX_CANDIDATE_CHARS));
    }
    if (cleanCandidates.length >= WALL_TELEMETRY_MAX_CANDIDATES) {
      break;
    }
  }
  const canonicalRecord = {
    v: WALL_TELEMETRY_VERSION,
    nonce: readNullableString(sourceRecord.nonce, 64),
    ip: readNullableWallIp(sourceRecord.ip),
    canvasHash: readNullableString(canvasRecord.hash, 128),
    canvasStable: typeof canvasRecord.stable === `boolean` ? canvasRecord.stable : null,
    userAgent: readNullableString(sourceRecord.userAgent, 512),
    hardwareConcurrency: readNullableNumber(sourceRecord.hardwareConcurrency),
    deviceMemory: readNullableNumber(sourceRecord.deviceMemory),
    gpuVendor: readNullableString(sourceRecord.gpuVendor, 256),
    gpuRenderer: readNullableString(sourceRecord.gpuRenderer, 256),
    timezone: readNullableString(sourceRecord.timezone, 64),
    devicePixelRatio: readNullableNumber(sourceRecord.devicePixelRatio),
    webrtcCandidates: cleanCandidates,
    geo:
      typeof geoRecord.latitude === `number` &&
      typeof geoRecord.longitude === `number` &&
      Number.isFinite(geoRecord.latitude) &&
      Number.isFinite(geoRecord.longitude)
        ? {
            latitude: geoRecord.latitude,
            longitude: geoRecord.longitude,
            accuracy: readNullableNumber(geoRecord.accuracy),
          }
        : null,
  };
  const orderedRecord = {};
  for (const fieldName of WALL_TELEMETRY_FIELD_ORDER) {
    orderedRecord[fieldName] = canonicalRecord[fieldName];
  }
  return orderedRecord;
}

export async function collectWallTelemetry(postNonce) {
  const gpuStrings = readGpuStrings();
  const timezoneName = (() => {
    try {
      const resolvedOptions = Intl.DateTimeFormat().resolvedOptions();
      return typeof resolvedOptions.timeZone === `string` ? resolvedOptions.timeZone : null;
    } catch (timezoneError) {
      console.warn(`wall telemetry: timezone unavailable`, timezoneError);
      return null;
    }
  })();
  const candidatePromise = readStunCandidates();
  const geoPromise = readPreciseGeo();
  const canvasPromise = readCanvasDigest();
  const publicIpPromise = fetchWallPublicIp();
  const canvasDigest = await canvasPromise;
  const stunCandidates = await candidatePromise;
  const preciseGeo = await geoPromise;
  const publicIpAddress = await publicIpPromise;
  const agentText = typeof navigator !== `undefined` && typeof navigator.userAgent === `string` ? navigator.userAgent : null;
  const concurrencyText =
    typeof navigator !== `undefined` ? readNullableNumber(navigator.hardwareConcurrency) : null;
  const memoryText = typeof navigator !== `undefined` ? readNullableNumber(navigator.deviceMemory) : null;
  const pixelText =
    typeof window !== `undefined` ? readNullableNumber(window.devicePixelRatio) : null;
  const rawRecord = {
    v: WALL_TELEMETRY_VERSION,
    nonce: postNonce,
    ip: publicIpAddress,
    canvas: canvasDigest,
    userAgent: agentText,
    hardwareConcurrency: concurrencyText,
    deviceMemory: memoryText,
    gpuVendor: gpuStrings.vendor,
    gpuRenderer: gpuStrings.renderer,
    timezone: timezoneName,
    devicePixelRatio: pixelText,
    webrtcCandidates: stunCandidates,
    geo: preciseGeo,
  };
  return canonicalizeWallTelemetry(rawRecord);
}

export async function encryptWallTelemetry(canonicalText, vendorUrl) {
  const textBytes = new TextEncoder().encode(canonicalText);
  if (textBytes.length > WALL_TELEMETRY_MAX_BYTES) {
    throw new Error(`wall telemetry oversize: ${textBytes.length} bytes exceeds 65536 byte cap`);
  }
  const openpgpModule = await import(vendorUrl);
  if (cachedOwnerKey === null) {
    cachedOwnerKey = await openpgpModule.readKey({ armoredKey: WALL_OWNER_PUBLIC_KEY_ARMOR });
  }
  const telemetryMessage = await openpgpModule.createMessage({ text: canonicalText });
  const armoredOutput = await openpgpModule.encrypt({
    message: telemetryMessage,
    encryptionKeys: [cachedOwnerKey],
    format: `armored`,
  });
  return armoredOutput;
}
