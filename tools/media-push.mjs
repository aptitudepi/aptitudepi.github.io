#!/usr/bin/env node
// tools/media-push.mjs — App W: optimize one image (EXIF-strip, 1920-cap) → R2 blog-media.
// Stdlib + pinned sharp 0.35.5 only. No repo writes (tmp in os.tmpdir only).
// Dry-run by default (optimize + verify, no upload); --upload actually copies.
//
// Usage:
//   node tools/media-push.mjs <file> [--slug my-post]            # dry-run: prints would-be key/URL
//   node tools/media-push.mjs <file> --slug my-post --upload     # rclone copyto → prints CDN URL to paste
//   node tools/media-push.mjs --help

import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';

const REMOTE = 'r2-blog-media:blog-media';
const BUCKET = 'blog-media';
const CDN = 'https://cdn.dvxb.io';
const ACC = '86d9ed74338d818e7fe4abe46b620c1b'; // sole account owning BUCKET; no wrangler.jsonc entry (that one binds telemetry only)
const TOKEN_FILE = join(homedir(), '.config/dvxb/cf-r2-token');
const IMMUTABLE = 'public, max-age=31536000, immutable';

const fail = (msg) => { process.stderr.write(`media-push: ${msg}\n`); process.exit(1); };

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write('usage: media-push.mjs <file> [--slug my-post] [--upload|--dry-run]\n  default is --dry-run (optimize + EXIF-verify, no upload). --upload copies via\n  curl + the R2 API (needs $CLOUDFLARE_API_TOKEN or ~/.config/dvxb/cf-r2-token)\n  with immutable cache-control, asserts the stored size matches, then prints\n  https://cdn.dvxb.io/<key> to paste into md. falls back to rclone/wrangler when\n  no token is present. images never committed (App W).\n');
  process.exit(0);
}

// Minimal --flag value / --flag=value parsing (same shape as new-post.mjs, no deps).
const opts = {};
const positionals = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--upload' || arg === '--dry-run') { opts[arg.slice(2)] = true; continue; }
  if (!arg.startsWith('--')) { positionals.push(arg); continue; }
  const eq = arg.indexOf('=');
  const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
  const value = eq === -1 ? args[++i] : arg.slice(eq + 1);
  if (value === undefined || value.startsWith('--')) fail(`--${key}: value required`);
  opts[key] = value;
}

const file = positionals[0];
if (!file) fail('usage: media-push.mjs <file> [--slug my-post] [--upload]');
if (!existsSync(file) || !statSync(file).isFile()) fail(`not found: ${file}`);
const slug = opts.slug ?? 'inbox';
if (!/^[a-z0-9-]+$/.test(slug)) fail(`bad slug ${JSON.stringify(slug)}: use lowercase letters, digits, hyphens`);

const ext = extname(file).toLowerCase();
if (!['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.avif'].includes(ext)) fail(`unsupported ${ext || '(no ext)'}: jpg/jpeg/png/heic/heif/webp/avif only`);
const isPng = ext === '.png'; // screenshots: lossless; everything else (incl. heic) → jpeg q82
const outExt = isPng ? '.png' : '.jpg';
const contentType = isPng ? 'image/png' : 'image/jpeg';

const leaf = (basename(file, ext).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'img');
const nonce = randomBytes(6).toString('hex');
const tmp = join(tmpdir(), `media-push-${nonce}${outExt}`);
const hdr = join(tmpdir(), `media-push-${nonce}.hdr`);

const has = (cmd) => { try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; } };
const put = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { stdio: 'inherit' });

try {
  // rotate() with no args applies EXIF orientation to pixels FIRST, then drops
  // the tag; never withMetadata() (sharp default strips EXIF/XMP/GPS/ICC).
  let pipeline = sharp(file).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true });
  pipeline = isPng ? pipeline.png({ compressionLevel: 9 }) : pipeline.jpeg({ quality: 82 });
  try {
    await pipeline.toFile(tmp);
  } catch (err) {
    fail(`sharp decode failed (${ext}): ${err.message} — export JPEG from Photos first`);
  }

  const bytes = readFileSync(tmp);
  const meta = await sharp(tmp).metadata();
  if (Math.max(meta.width ?? 0, meta.height ?? 0) > 1920) fail(`${tmp}: exceeds 1920 cap (${meta.width}x${meta.height})`);
  if (meta.exif ?? meta.xmp ?? meta.iptc) fail(`${tmp}: EXIF/XMP/IPTC remain — refusing upload`);

  const sha12 = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const key = `media/${slug}/${sha12}-${leaf}${outExt}`;

  if (!opts.upload) {
    process.stdout.write(`dry-run: ${file} → ${tmp} (${bytes.length} B, ${meta.width}x${meta.height}, EXIF-free)\nwould upload: ${REMOTE}/${key}\nwould print: ${CDN}/${key}\n`);
    process.exit(0);
  }

  // Upload: curl + R2 API primary when a token exists, rclone / wrangler
  // fallback otherwise; retry ×3, URL printed only on success (never a
  // partial print of an unstored key).
  //
  // curl honours the standard proxy env (https_proxy / all_proxy, incl.
  // socks5h://) — export those on a machine whose DNS is only reachable
  // through a proxy. The token is passed via a 0600 header file, never argv,
  // so it cannot leak through `ps` or an echoed command line.
  const token = (process.env.CLOUDFLARE_API_TOKEN ?? '').trim()
    || (existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, 'utf8').trim() : '');
  let uploaded = false;
  let lastErr = '';
  if (token) {
    const objectUrl = `https://api.cloudflare.com/client/v4/accounts/${ACC}/r2/buckets/${BUCKET}/objects/${key.split('/').map(encodeURIComponent).join('/')}`;
    writeFileSync(hdr, `Authorization: Bearer ${token}\n`, { mode: 0o600 });
    // stdout captured (response headers), stderr inherited (curl diagnostics).
    const cf = (argv) => String(execFileSync('curl', ['-sS', '--fail', '--max-time', '120', ...argv], { stdio: ['ignore', 'pipe', 'inherit'] }));
    for (let attempt = 1; attempt <= 3 && !uploaded; attempt++) {
      try {
        cf(['-X', 'PUT', '-H', `@${hdr}`, '-H', `Content-Type: ${contentType}`, '-H', `Cache-Control: ${IMMUTABLE}`, '--data-binary', `@${tmp}`, '-o', '/dev/null', objectUrl]);
        uploaded = true;
      } catch { lastErr = `curl PUT attempt ${attempt}/3 failed`; }
    }
    if (!uploaded) fail(`upload failed: ${lastErr} (key ${key} — NOT published)`);
    // Gate on stored size, not on the PUT exit code: an earlier attempt
    // "succeeded" with UTF-8-mangled bytes (903,552 stored vs 600,508 local).
    // R2 has no HEAD, so re-GET and read content-length (body to /dev/null).
    const stored = Number(/^content-length:\s*(\d+)/im.exec(cf(['-H', `@${hdr}`, '-D', '-', '-o', '/dev/null', objectUrl]))?.[1] ?? -1);
    if (stored !== bytes.length) fail(`size mismatch on ${key}: R2 stored ${stored} B, local ${bytes.length} B — ${CDN}/${key} NOT published`);
    process.stdout.write(`uploaded ${bytes.length} B to ${BUCKET}, size verified\n`);
  } else if (has('rclone')) {
    for (let attempt = 1; attempt <= 3 && !uploaded; attempt++) {
      try {
        put('rclone', ['copyto', tmp, `${REMOTE}/${key}`, '--header-upload', `Content-Type: ${contentType}`, '--header-upload', `Cache-Control: ${IMMUTABLE}`]);
        uploaded = true;
      } catch { lastErr = `rclone attempt ${attempt}/3 failed`; }
    }
    if (!uploaded) fail(`upload failed: ${lastErr} (key ${key} — NOT published)`);
  } else if (has('wrangler')) {
    for (let attempt = 1; attempt <= 3 && !uploaded; attempt++) {
      try {
        put('wrangler', ['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', tmp, '--content-type', contentType, '--cache-control', IMMUTABLE, '--remote']);
        uploaded = true;
      } catch { lastErr = `wrangler attempt ${attempt}/3 failed`; }
    }
    if (!uploaded) fail(`upload failed: ${lastErr} (key ${key} — NOT published)`);
  } else {
    fail(`no Cloudflare API token (set $CLOUDFLARE_API_TOKEN or write ${TOKEN_FILE}), and neither rclone nor wrangler found — file verified EXIF-free above`);
  }
  process.stdout.write(`${CDN}/${key}\n`);
} finally {
  rmSync(tmp, { force: true });
  rmSync(hdr, { force: true });
}
