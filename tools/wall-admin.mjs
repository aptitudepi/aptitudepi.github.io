#!/usr/bin/env node
// tools/wall-admin.mjs — local-only owner tooling for the WAVE 9b guestbook.
//
// Lists the sanitized public copy via the public endpoint, fetches opaque
// telemetry blobs via wrangler (KV fallback key telemetry:<post-id>.asc, or R2
// object telemetry/<post-id>.asc once the TELEMETRY bucket exists), and
// decrypts blobs OFFLINE with the owner private key. The private key is never
// committed: pass --key-file /path/to/owner-private.asc or set
// WALL_OWNER_PRIVATE_KEY_PATH. Blobs stay armored until decrypt runs.
//
// Key rotation: generate offline with openpgp (`generateKey`), paste the
// armored PUBLIC key into WALL_OWNER_PUBLIC_KEY_ARMOR in
// js/wall-telemetry.js, update WALL_OWNER_KEY_FINGERPRINT in
// assets/v86/cors-proxy-worker.js, redeploy worker plus site.
//
// Usage:
//   node tools/wall-admin.mjs list [--json] [--endpoint URL]
//   node tools/wall-admin.mjs get-blob <post-id> [--via kv|r2] [--out file.asc]
//   node tools/wall-admin.mjs decrypt <blob.asc> --key-file owner-private.asc [--out telemetry.json]
//   WALL_OWNER_PRIVATE_KEY_PATH=/path/owner-private.asc node tools/wall-admin.mjs decrypt <blob.asc>

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(TOOL_DIRECTORY, `..`);
const VENDOR_URL = new URL(`../vendor/openpgp.min.mjs`, import.meta.url).href;
const DEFAULT_ENDPOINT = `https://0.supernovadkb.workers.dev/wall`;

function readFlagValue(flagArgs, flagName) {
  const flagIndex = flagArgs.indexOf(flagName);
  if (flagIndex === -1 || flagIndex + 1 >= flagArgs.length) {
    return null;
  }
  return flagArgs[flagIndex + 1];
}

function printUsage() {
  const usageLines = [
    `wall-admin — owner-only guestbook telemetry tool`,
    `  list [--json] [--endpoint URL]              list public posts`,
    `  get-blob <post-id> [--via kv|r2] [--out f]  fetch one armored blob via wrangler`,
    `  decrypt <blob.asc> --key-file key.asc [--out telemetry.json]`,
    `Environment: WALL_OWNER_PRIVATE_KEY_PATH may replace --key-file.`,
  ];
  process.stderr.write(`${usageLines.join(`\n`)}\n`);
}

async function listPublicPosts(listArgs) {
  const endpointText = readFlagValue(listArgs, `--endpoint`) ?? DEFAULT_ENDPOINT;
  const listResp = await fetch(endpointText);
  if (listResp.ok === false) {
    throw new Error(`list failed: HTTP ${listResp.status}`);
  }
  const listData = await listResp.json();
  const postList = Array.isArray(listData.posts) ? listData.posts : [];
  if (listArgs.includes(`--json`)) {
    process.stdout.write(`${JSON.stringify(postList, null, 2)}\n`);
    return;
  }
  for (const listPost of postList) {
    process.stdout.write(`- ${String(listPost.id)} ${String(listPost.timestamp)} ${String(listPost.name)}: ${String(listPost.message).slice(0, 80)}\n`);
  }
  process.stderr.write(`listed ${postList.length} public posts (telemetry blobs are owner-only)\n`);
}

function fetchBlobViaWrangler(postId, viaMode) {
  const postIdText = String(postId);
  if (viaMode === `r2`) {
    const r2Result = spawnSync(
      `wrangler`,
      [`r2`, `object`, `get`, `telemetry/telemetry/${postIdText}.asc`, `--remote`, `--pipe`],
      { cwd: SITE_ROOT, encoding: `utf8`, maxBuffer: 8 * 1024 * 1024 },
    );
    if (r2Result.status !== 0) {
      throw new Error(`wrangler r2 get failed: ${String(r2Result.stderr).slice(0, 400)}`);
    }
    return r2Result.stdout;
  }
  const kvResult = spawnSync(
    `wrangler`,
    [`kv`, `key`, `get`, `telemetry:${postIdText}.asc`, `--binding`, `WALL_KV`, `--remote`, `--text`],
    { cwd: SITE_ROOT, encoding: `utf8`, maxBuffer: 8 * 1024 * 1024 },
  );
  if (kvResult.status !== 0) {
    throw new Error(`wrangler kv get failed: ${String(kvResult.stderr).slice(0, 400)}`);
  }
  return kvResult.stdout;
}

async function getBlobCommand(blobArgs) {
  const postId = blobArgs[0];
  if (postId === undefined || String(postId).length === 0) {
    throw new Error(`get-blob needs a <post-id> (see list)`);
  }
  const viaMode = readFlagValue(blobArgs, `--via`) ?? `kv`;
  if (viaMode !== `kv` && viaMode !== `r2`) {
    throw new Error(`--via must be kv or r2`);
  }
  const armoredBlob = fetchBlobViaWrangler(postId, viaMode);
  if (armoredBlob.startsWith(`-----BEGIN PGP MESSAGE-----`) === false) {
    throw new Error(`fetched value is not an armored blob (post may predate telemetry or lack consent signals)`);
  }
  const outPath = readFlagValue(blobArgs, `--out`);
  if (outPath !== null) {
    writeFileSync(outPath, armoredBlob, `utf8`);
    process.stderr.write(`wrote ${armoredBlob.length} armored bytes to ${outPath}\n`);
    return;
  }
  process.stdout.write(armoredBlob);
}

async function decryptBlobCommand(decryptArgs) {
  const blobPath = decryptArgs[0];
  if (blobPath === undefined || String(blobPath).length === 0) {
    throw new Error(`decrypt needs a <blob.asc> path (see get-blob --out)`);
  }
  const keyPath = readFlagValue(decryptArgs, `--key-file`) ?? process.env.WALL_OWNER_PRIVATE_KEY_PATH ?? null;
  if (keyPath === null || keyPath.length === 0) {
    throw new Error(`owner private key required: --key-file <path> or WALL_OWNER_PRIVATE_KEY_PATH (never committed)`);
  }
  const armoredBlob = readFileSync(blobPath, `utf8`);
  if (armoredBlob.startsWith(`-----BEGIN PGP MESSAGE-----`) === false) {
    throw new Error(`input is not an armored OpenPGP message`);
  }
  const armoredPrivate = readFileSync(keyPath, `utf8`);
  const openpgpModule = await import(VENDOR_URL);
  const privateKey = await openpgpModule.readPrivateKey({ armoredKey: armoredPrivate });
  const decryptedResult = await openpgpModule.decrypt({
    message: await openpgpModule.readMessage({ armoredMessage: armoredBlob }),
    decryptionKeys: [privateKey],
    format: `utf8`,
  });
  const telemetryText = decryptedResult.data;
  let prettyText = telemetryText;
  try {
    prettyText = JSON.stringify(JSON.parse(telemetryText), null, 2);
  } catch (jsonError) {
    process.stderr.write(`warning: decrypted payload is not JSON (${jsonError.message})\n`);
  }
  const outPath = readFlagValue(decryptArgs, `--out`);
  if (outPath !== null) {
    writeFileSync(outPath, `${prettyText}\n`, `utf8`);
    process.stderr.write(`decrypted ${telemetryText.length} chars to ${outPath}\n`);
    return;
  }
  process.stdout.write(`${prettyText}\n`);
}

async function mainEntry() {
  const cliArgs = process.argv.slice(2);
  const subCommand = cliArgs[0] ?? ``;
  try {
    if (subCommand === `list`) {
      await listPublicPosts(cliArgs.slice(1));
      return;
    }
    if (subCommand === `get-blob`) {
      await getBlobCommand(cliArgs.slice(1));
      return;
    }
    if (subCommand === `decrypt`) {
      await decryptBlobCommand(cliArgs.slice(1));
      return;
    }
    printUsage();
    process.exitCode = subCommand.length === 0 ? 0 : 1;
  } catch (adminError) {
    process.stderr.write(`wall-admin: ${adminError.message}\n`);
    process.exitCode = 1;
  }
}

await mainEntry();
