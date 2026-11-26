#!/usr/bin/env node
// tools/assert-worker.mjs — static guard for the CORS proxy worker hardening.
// No network, no wrangler: reads assets/v86/cors-proxy-worker.js and pins the
// security invariants so a future edit cannot silently reopen the relay.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workerPath = 'assets/v86/cors-proxy-worker.js';
const source = readFileSync(join(root, workerPath), 'utf8');

let failures = 0;
const check = (ok, label) => {
  process.stdout.write(`${ok ? 'ok' : 'FAIL'}: ${label}\n`);
  if (!ok) failures += 1;
};
const bodyOf = (name) => {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) return '';
  const end = source.indexOf('\n}', start);
  return source.slice(start, end === -1 ? undefined : end);
};

// Origin allowlist: unconditional on browser routes, never a wildcard echo.
check(!/access-control-allow-origin['"]?\s*:\s*['"]\*['"]/.test(source), 'CORS never emits access-control-allow-origin: *');
check(source.includes('corsHeaders[\'access-control-allow-origin\'] = origin'), 'CORS echoes the request Origin');
check(/if \(isAllowedOrigin\(origin\)\) \{/.test(source), 'CORS echo is gated on isAllowedOrigin');
check(/if \(requiresOrigin && originAllowed === false\) \{/.test(source), 'browser routes require an allowlisted Origin unconditionally');
check(!/if \(origin && /.test(source), 'no "origin header present" bypass remains');
const routeSetLine = (source.match(/BROWSER_ROUTE_PATHS = new Set\(\[(.*?)\]\)/) || [null, ''])[1];
for (const route of ['/ai', '/wall', '/api/guestbook', '/ip']) {
  check(routeSetLine.includes(`'${route}'`), `${route} is in the required-origin set`);
}

for (const origin of ['https://dvxb.io', 'https://www.dvxb.io', 'https://aptitudepi.github.io']) {
  check(source.includes(`'${origin}'`), `allowlist contains ${origin}`);
}
check(/ALLOWED_ORIGIN_LOCAL = \/\^http:\\\/\\\/\(localhost\|127\\\.0\\\.0\\\.1\):\\d\+\$\//.test(source), 'localhost/127.0.0.1 dev origins are port-scoped');

// ?url= proxy: literal private-host blocklist plus scheme/credential/port rules.
const privateHost = bodyOf('isPrivateProxyHost');
const blocklistLiterals = ['127.', '10.', '192.168.', '169.254.', '172\\.', '::1', '[::1]', '0.0.0.0', 'localhost', '.local', '.internal'];
for (const literal of blocklistLiterals) {
  check(privateHost.includes(literal), `private-host blocklist covers ${literal}`);
}
const parseTarget = bodyOf('parseProxyTarget');
check(parseTarget.includes("'http:'") && parseTarget.includes("'https:'"), 'proxy targets are limited to http/https');
check(parseTarget.includes('targetUrl.username') && parseTarget.includes('targetUrl.password'), 'proxy targets with credentials are rejected');
check(parseTarget.includes("targetUrl.port !== ''"), 'proxy targets with non-standard ports are rejected');
check(/Resolve nothing|nothing is resolved/i.test(source), 'comment states literal-host checks only');

// KV-backed minute limiter on /ai, ?url=, and wall POSTs.
check(source.includes('async function minuteRateLimit('), 'minuteRateLimit helper exists');
check(/minuteRateLimit\('ai'/.test(source), 'minuteRateLimit applies to /ai');
check(/minuteRateLimit\('proxy'/.test(source), 'minuteRateLimit applies to ?url=');
check(/minuteRateLimit\('wall'/.test(source), 'minuteRateLimit applies to /wall POST');
check(/status: 429[\s\S]{0,400}Retry-After/.test(source), 'rate-limit 429 responses carry Retry-After');
check(/status: 503/.test(source) && source.includes('Rate limit store unavailable'), 'missing KV fails closed with 503');

if (failures > 0) {
  process.stderr.write(`assert-worker: ${failures} check(s) failed\n`);
  process.exit(1);
}
process.stdout.write(`ok: worker origin allowlist + private-host blocklist + rate limits (${workerPath})\n`);
