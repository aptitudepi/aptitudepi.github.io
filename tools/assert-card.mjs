#!/usr/bin/env node
// tools/assert-card.mjs — guards the /c card invariants: unindexable page,
// no canonical, phone-free public vCard, robots disallow for its assets, and
// the per-platform save-contact behavior of the inline card script.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const fail = (msg) => { console.error(`assert-card: ${msg}`); process.exit(1); };
const assert = (ok, msg) => { if (!ok) fail(msg); };

const html = read('c/index.html');
const robots = read('robots.txt');
const vcf = read('c/contact.vcf');

if (!/name="robots"\s+content="[^"]*noindex/i.test(html)) fail('c/index.html is missing robots noindex');
if (/rel="canonical"/i.test(html)) fail('c/index.html must not advertise a canonical URL');
if (!/href="\/c\/contact\.vcf"/.test(html)) fail('c/index.html does not link the vCard');
if (!/\.card-action\[hidden\]\s*\{\s*display:\s*none;?\s*\}/.test(html)) fail('c/index.html is missing .card-action[hidden] { display: none }');
if (!/<a[^>]*id="sms"[^>]*\shidden[\s>]/.test(html)) fail('the sms action must stay hidden while CARD.phone is empty');
if (!/^Disallow:\s*\/c\/\s*$/m.test(robots)) fail('robots.txt does not disallow /c/');

const staticRules = [
  [/<a[^>]*id="save-contact"[^>]*type="text\/vcard"/, 'the save-contact link must be type="text/vcard"'],
  [/id="card-save-hint"[^>]*\shidden[\s>]/, 'the Android save hint must exist and start hidden'],
  [/setAttribute\('download',\s*'Devkumar Banerjee\.vcf'\)/, 'the card script must set a readable download filename'],
  [/\/Android\/i\.test\(ua\)/, 'the card script must detect Android'],
];
for (const [re, msg] of staticRules) if (!re.test(html)) fail(msg);

const vcfLines = vcf.replace(/\r\n/g, '\n').trim().split('\n');
if (vcfLines[0] !== 'BEGIN:VCARD') fail('vCard does not start with BEGIN:VCARD');
if (!vcfLines.includes('VERSION:3.0')) fail('vCard is not VERSION:3.0');
if (!vcfLines.some((l) => l.startsWith('N:'))) fail('vCard is missing N (Android Contacts needs it)');
if (!vcfLines.some((l) => l.startsWith('FN:'))) fail('vCard is missing FN');
if (!vcfLines.some((l) => l.startsWith('EMAIL'))) fail('vCard is missing EMAIL');
if (vcfLines[vcfLines.length - 1] !== 'END:VCARD') fail('vCard does not end with END:VCARD');
if (/^TEL/m.test(vcf)) fail('vCard unexpectedly contains a phone number');

// --- inline card script behavior -------------------------------------------
const cardSrc = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .find((s) => s.includes('const CARD'));
if (!cardSrc) fail('c/index.html is missing the inline card script');

const makeEl = (id) => ({
  id,
  hidden: id === 'card-save-hint',
  attrs: { href: '/c/contact.vcf' },
  getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; },
  setAttribute(n, v) { this.attrs[n] = v; },
});

function loadCard({ ua, maxTouchPoints = 0, store = new Map(), topLevel = true }) {
  const timers = [];
  const els = { sms: makeEl('sms'), 'save-contact': makeEl('save-contact'), 'card-save-hint': makeEl('card-save-hint') };
  const location = { href: '/c/' };
  const win = {};
  win.self = win;
  win.top = topLevel ? win : {};
  const ctx = {
    document: { getElementById: (id) => els[id] ?? null },
    navigator: { userAgent: ua, maxTouchPoints },
    window: win,
    location,
    sessionStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
  };
  vm.runInNewContext(cardSrc, ctx, { timeout: 1000 });
  return { timers, els, location };
}

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1';
const IPADOS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ios = loadCard({ ua: IPHONE_SAFARI });
assert(ios.timers.length === 1, 'iOS Safari should schedule exactly one vCard navigation');
assert(ios.timers[0].ms === 450, 'iOS Safari should defer the vCard navigation');
assert(!('download' in ios.els['save-contact'].attrs), 'iOS must not set a download attribute');
assert(ios.els['card-save-hint'].hidden === true, 'iOS should keep the Android hint hidden');
ios.timers[0].fn();
assert(ios.location.href === '/c/contact.vcf', 'the iOS timer should navigate to /c/contact.vcf');

assert(loadCard({ ua: IPHONE_CHROME }).timers.length === 1, 'iOS Chrome should auto-open the contact sheet too');
assert(loadCard({ ua: IPADOS, maxTouchPoints: 5 }).timers.length === 1, 'iPadOS desktop-mode should auto-open the contact sheet');

const android = loadCard({ ua: ANDROID });
assert(android.timers.length === 0, 'Android must not auto-navigate to the vCard');
assert(android.els['save-contact'].attrs.download === 'Devkumar Banerjee.vcf', 'Android should download with a readable filename');
assert(android.els['card-save-hint'].hidden === false, 'Android should show the save hint');

const desktop = loadCard({ ua: DESKTOP });
assert(desktop.timers.length === 0, 'desktop must not auto-navigate to the vCard');
assert(desktop.els['save-contact'].attrs.download === 'Devkumar Banerjee.vcf', 'desktop should download with a readable filename');
assert(desktop.els['card-save-hint'].hidden === true, 'desktop should keep the Android hint hidden');

const store = new Map();
loadCard({ ua: IPHONE_SAFARI, store });
assert(loadCard({ ua: IPHONE_SAFARI, store }).timers.length === 0, 'iOS must auto-open the contact sheet only once per session');

process.stdout.write(`ok: card noindex + robots disallow + phone-free vCard (${vcfLines.length} lines) + 6 save-contact cases\n`);
