#!/usr/bin/env node
// Guards the main terminal accessibility contract.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const fail = (message) => { console.error(`assert-accessibility: ${message}`); process.exit(1); };
const assert = (condition, message) => { if (!condition) fail(message); };

const html = read('index.html');
const terminal = read('js/terminal.js');
const commands = read('js/commands.js');

assert(/href="#main-content"[^>]*class="skip-link"/.test(html), 'skip link must target main content');
assert(/<main id="main-content" tabindex="-1">/.test(html), 'main content landmark must be focusable');
assert(/id="terminal-container"[^>]*role="region"[^>]*aria-label="Interactive terminal"[^>]*aria-describedby="terminal-help"/.test(html), 'terminal region must have a name and description');
assert(/id="terminal-help"[^>]*class="sr-only"/.test(html), 'terminal instructions must be available to assistive technology');
assert(/screenReaderMode:\s*true/.test(terminal), 'xterm screen-reader mode must stay enabled');
assert(/navigator\.geolocation/.test(commands) && /ipapi\.co\/json/.test(commands), 'explicit weather command must retain its location lookup behavior');
assert(/rel="canonical" href="https:\/\/dvxb\.io\/"/.test(html), 'homepage must publish a canonical URL');
assert(/data-stats-grid/.test(html) && /number-flow@0\.6\.2/.test(html), 'homepage stat counters stay on the about section');
assert(!/modulepreload" href="https:\/\/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers/.test(html), 'homepage must not preload the on-device model');
assert(/href="assets\/resume\.pdf"[^>]*aria-label="Download CV"/.test(html), 'resume PDF link keeps its Download CV label');

process.stdout.write('assert-accessibility: all checks passed\n');
