#!/usr/bin/env bun
// indexnow.mjs — notify IndexNow partners that dvxb.io URLs changed.
//
// Ownership is proven by https://dvxb.io/{INDEXNOW_KEY}.txt (written in CI).
// Submit once to the global endpoint; participating engines share the ping.
// See https://www.indexnow.org/documentation.html

import { HOST, URL_LIST } from './site-urls.mjs';

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const KEY = process.env.INDEXNOW_KEY?.trim();

if (!KEY) {
  console.error('INDEXNOW_KEY is not set; skipping IndexNow submit');
  process.exit(0);
}

const keyUrl = `https://${HOST}/${KEY}.txt`;

async function waitForKey(attempts = 30, delayMs = 10_000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(keyUrl, { redirect: 'follow' });
      const body = (await res.text()).trim();
      if (res.ok && body === KEY) {
        console.log(`key file ready at ${keyUrl} (attempt ${i})`);
        return;
      }
      console.log(`key not ready yet: HTTP ${res.status}, body=${JSON.stringify(body.slice(0, 64))} (attempt ${i}/${attempts})`);
    } catch (e) {
      console.log(`key fetch error: ${e.message} (attempt ${i}/${attempts})`);
    }
    await Bun.sleep(delayMs);
  }
  throw new Error(`IndexNow key file not reachable at ${keyUrl}`);
}

await waitForKey();

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: keyUrl,
  urlList: URL_LIST,
};

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

const text = await res.text();
console.log(`IndexNow → HTTP ${res.status}`);
if (text) console.log(text);

// 200 = accepted; 202 = accepted, key verification pending (first submit).
if (res.status !== 200 && res.status !== 202) {
  process.exit(1);
}

console.log(`submitted ${URL_LIST.length} URLs`);
