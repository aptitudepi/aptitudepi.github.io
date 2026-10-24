#!/usr/bin/env node
// tools/assert-card.mjs — guards the /c card invariants: unindexable page,
// no canonical, phone-free public vCard, robots disallow for its assets.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const fail = (msg) => { console.error(`assert-card: ${msg}`); process.exit(1); };

const html = read('c/index.html');
const robots = read('robots.txt');
const vcf = read('c/contact.vcf');

if (!/name="robots"\s+content="[^"]*noindex/i.test(html)) fail('c/index.html is missing robots noindex');
if (/rel="canonical"/i.test(html)) fail('c/index.html must not advertise a canonical URL');
if (!/href="\/c\/contact\.vcf"/.test(html)) fail('c/index.html does not link the vCard');
if (!/\.card-action\[hidden\]\s*\{\s*display:\s*none;?\s*\}/.test(html)) fail('c/index.html is missing .card-action[hidden] { display: none }');
if (!/<a[^>]*id="sms"[^>]*\shidden[\s>]/.test(html)) fail('the sms action must stay hidden while CARD.phone is empty');
if (!/^Disallow:\s*\/c\/\s*$/m.test(robots)) fail('robots.txt does not disallow /c/');

const vcfLines = vcf.replace(/\r\n/g, '\n').trim().split('\n');
if (vcfLines[0] !== 'BEGIN:VCARD') fail('vCard does not start with BEGIN:VCARD');
if (!vcfLines.includes('VERSION:3.0')) fail('vCard is not VERSION:3.0');
if (!vcfLines.some((l) => l.startsWith('FN:'))) fail('vCard is missing FN');
if (!vcfLines.some((l) => l.startsWith('EMAIL'))) fail('vCard is missing EMAIL');
if (vcfLines[vcfLines.length - 1] !== 'END:VCARD') fail('vCard does not end with END:VCARD');
if (/^TEL/m.test(vcf)) fail('vCard unexpectedly contains a phone number');

console.log(`ok: card noindex + robots disallow + phone-free vCard (${vcfLines.length} lines)`);
