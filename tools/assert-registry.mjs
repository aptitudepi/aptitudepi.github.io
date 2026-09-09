#!/usr/bin/env node
// tools/assert-registry.mjs — set-equality guard for the single declarative
// command registry (js/commands.js, WAVE 6).
//
// Pins the intentional invariants so future edits cannot silently drift the
// parallel surfaces apart again:
//   help rows <-> COMMANDS <-> completion candidates <-> allowlist names
// plus the golden-pinned counts (36 listed commands, 34 help rows) and the
// read-only tool-allowlist security posture.
//
// Intentional, documented deltas (NOT drift):
//   - `man`, `llm`, `guestbook` plus the WAVE 8 portfolio set (`projects`,
//     `case`, `skills`, `timeline`, `export`) plus the WAVE 12 `background`
//     mode switch execute but stay unlisted:
//     COMMANDS keeps 36 so `help` output stays byte-identical to the goldens.
//   - `google`, `ddg`, `ping` are listed but have no `help` row (as before);
//     their one-line help lives in the registry and renders via `man`.
//   - the AI tool allowlist deliberately excludes clear/vm/ai(+llm)/ai-model/
//     md/devmode/guestbook/man, and allows `wall` bare only.

import {
  COMMANDS,
  COMMAND_COMPLETION_NAMES,
  COMMAND_REGISTRY,
  NEOFETCH_TRY_COMMANDS,
  TOOL_ALLOWLIST_BARE_ONLY,
  TOOL_ALLOWLIST_NAMES,
  isAiCommandName,
  renderMan,
  resolveCommand,
  suggestCommand,
  tokenizeCommandLine,
} from "../js/commands.js";

const LEGACY_ALLOWLIST = new Set([
  `whoami`, `hostname`, `date`, `uptime`, `uname`, `pwd`, `cat`, `ls`, `echo`,
  `neofetch`, `resfetch`, `about`, `fortune`, `cowsay`, `help`, `matrix`,
  `weather`, `hn`, `cv`, `search`, `google`, `ddg`, `myip`, `ping`, `history`,
  `ai-models`, `ai-memory`, `crt`, `noise`,
]);

const NEVER_ALLOWED = [`clear`, `vm`, `ai`, `llm`, `ai-model`, `md`, `devmode`, `guestbook`, `man`];

const UNLISTED_EXECUTABLE = [`llm`, `guestbook`, `man`, `projects`, `case`, `skills`, `timeline`, `export`, `background`];

let failureCount = 0;

function check(condition, label) {
  if (condition) {
    process.stdout.write(`ok: ${label}\n`);
  } else {
    failureCount += 1;
    process.stderr.write(`FAIL: ${label}\n`);
  }
}

function makeTerm() {
  const lines = [];
  return {
    lines,
    write(chunk) { lines.push(String(chunk)); },
    writeln(line) { lines.push(`${String(line ?? ``)}\n`); },
  };
}

// 1. COMMANDS derives from the registry: listed names, legacy order, count 36.
const listedNames = COMMAND_REGISTRY.filter((entry) => entry.listed).map((entry) => entry.name);
check(JSON.stringify(listedNames) === JSON.stringify(COMMANDS), `COMMANDS equals listed registry names in order`);
check(COMMANDS.length === 36, `COMMANDS holds 36 entries (golden pin), saw ${COMMANDS.length}`);

// 2. Names unique; aliases consistent both directions.
const seenNames = new Set();
let duplicateFound = false;
for (const entry of COMMAND_REGISTRY) {
  if (seenNames.has(entry.name)) duplicateFound = true;
  seenNames.add(entry.name);
}
check(!duplicateFound, `registry names are unique (${COMMAND_REGISTRY.length} entries)`);

const aliasEntriesByTarget = new Map();
for (const entry of COMMAND_REGISTRY) {
  if (entry.aliasOf !== null) {
    if (!aliasEntriesByTarget.has(entry.aliasOf)) aliasEntriesByTarget.set(entry.aliasOf, []);
    aliasEntriesByTarget.get(entry.aliasOf).push(entry.name);
  }
}
let aliasMismatch = false;
for (const entry of COMMAND_REGISTRY) {
  const fromArray = [...entry.aliases].sort();
  const fromEntries = [...(aliasEntriesByTarget.get(entry.name) ?? [])].sort();
  if (JSON.stringify(fromArray) !== JSON.stringify(fromEntries)) {
    aliasMismatch = true;
    process.stderr.write(`  alias mismatch on ${entry.name}: aliases=${fromArray} aliasOf-entries=${fromEntries}\n`);
  }
  for (const alias of entry.aliases) {
    if (!seenNames.has(alias)) {
      aliasMismatch = true;
      process.stderr.write(`  alias ${alias} of ${entry.name} has no registry entry\n`);
    }
  }
}
check(!aliasMismatch, `aliases arrays match aliasOf entries`);

// 3. Required fields on every entry.
const REQUIRED = [`name`, `aliases`, `plain`, `category`, `argsSpec`, `examples`, `run`];
let fieldProblem = false;
for (const entry of COMMAND_REGISTRY) {
  for (const field of REQUIRED) {
    if (entry[field] === undefined || entry[field] === null) {
      fieldProblem = true;
      process.stderr.write(`  ${entry.name} missing ${field}\n`);
    }
  }
  if (typeof entry.run !== `function`) {
    fieldProblem = true;
    process.stderr.write(`  ${entry.name} run is not a function\n`);
  }
  if (!Array.isArray(entry.examples) || entry.examples.length === 0) {
    fieldProblem = true;
    process.stderr.write(`  ${entry.name} needs at least one example\n`);
  }
  if (entry.plain.trim().length === 0) {
    fieldProblem = true;
    process.stderr.write(`  ${entry.name} needs plain-language help\n`);
  }
  if (entry.category !== `CORE` && entry.category !== `ADDITIONAL`) {
    fieldProblem = true;
    process.stderr.write(`  ${entry.name} has bad category ${entry.category}\n`);
  }
  if (typeof entry.argsSpec !== `string`) {
    fieldProblem = true;
    process.stderr.write(`  ${entry.name} argsSpec must be a string\n`);
  }
}
check(!fieldProblem, `every entry carries name/aliases/plain/category/argsSpec/examples/run`);

// 4. Help rows: 33 entries with helpDisplay plus the ai-web extra row:
// 34 display rows total (golden pin), all listed, spot-checked text.
const helpEntries = COMMAND_REGISTRY.filter((entry) => entry.helpDisplay !== null);
const helpRowTotal = helpEntries.length + helpEntries.reduce((total, entry) => total + entry.extraHelpRows.length, 0);
check(helpRowTotal === 34, `help renders 34 rows (golden pin), saw ${helpRowTotal}`);
check(helpEntries.every((entry) => entry.listed), `every help row belongs to a listed command`);
const helpByName = new Map(helpEntries.map((entry) => [entry.name, entry]));
check(helpByName.get(`whoami`)?.helpDesc === `Display current user`, `help row whoami text pinned`);
check(helpByName.get(`ai`)?.helpDesc === `Portfolio AI assistant (Groq/Local); ai status for backend`, `help row ai text pinned`);
check((helpByName.get(`ai`)?.extraHelpRows ?? []).length === 1, `ai carries the ai-web extra help row`);
check(helpByName.get(`weather`)?.helpDisplay === `weather [-f] [city]`, `help row weather display pinned`);
// helpPos pins the legacy golden row order: dense 1..N, unique, help rows only.
const helpPositions = helpEntries.map((entry) => entry.helpPos);
check(
  JSON.stringify([...helpPositions].sort((first, second) => first - second)) === JSON.stringify(helpEntries.map((entry, index) => index + 1)),
  `helpPos values are dense 1..N with no gaps or duplicates`,
);
check(COMMAND_REGISTRY.every((entry) => (entry.helpDisplay === null) === (entry.helpPos === null)), `helpPos present exactly on help rows`);
const LEGACY_HELP_ORDER = [`whoami`, `hostname`, `date`, `uptime`, `uname [-a]`, `pwd`, `cat <file>`, `ls [path]`, `echo <text>`, `clear`, `neofetch`, `about`, `cv`, `resfetch`, `fortune`, `cowsay <msg>`, `matrix`, `vm`, `crt`, `noise`, `history`, `weather [-f] [city]`, `hn`, `md <url>`, `wall [msg]`, `ai <prompt>`, `search <q>`, `myip`, `ai-models`, `ai-model <id>`, `ai-memory`, `help`, `devmode`];
const renderedOrder = [...helpEntries].sort((first, second) => first.helpPos - second.helpPos).map((entry) => entry.helpDisplay);
check(JSON.stringify(renderedOrder) === JSON.stringify(LEGACY_HELP_ORDER), `help row order matches the golden sequence`);

// 5. Allowlist: exact legacy set, bare-only wall, dangerous names excluded.
check(JSON.stringify([...TOOL_ALLOWLIST_NAMES].sort()) === JSON.stringify([...LEGACY_ALLOWLIST].sort()), `allowlist names equal the legacy 29-name set`);
check(JSON.stringify(TOOL_ALLOWLIST_BARE_ONLY) === JSON.stringify([`wall`]), `bare-only allowlist is exactly [wall]`);
check(NEVER_ALLOWED.every((name) => !TOOL_ALLOWLIST_NAMES.includes(name)), `dangerous names stay out of the allowlist`);
for (const name of TOOL_ALLOWLIST_NAMES) {
  const entry = resolveCommand(name);
  if (!entry || typeof entry.run !== `function`) {
    check(false, `allowlisted ${name} resolves to a runnable entry`);
  }
}
check(true, `every allowlisted name resolves to a runnable entry`);

// 6. Neofetch Try row only names runnable listed commands.
check(
  NEOFETCH_TRY_COMMANDS.every((name) => COMMANDS.includes(name) && typeof resolveCommand(name)?.run === `function`),
  `neofetch Try row names all resolve (${NEOFETCH_TRY_COMMANDS.join(`, `)})`,
);

// 7. Completion covers COMMANDS plus exactly the documented unlisted extras.
check(COMMANDS.every((name) => COMMAND_COMPLETION_NAMES.includes(name)), `completion covers every COMMANDS name`);
const completionExtras = COMMAND_COMPLETION_NAMES.filter((name) => !COMMANDS.includes(name));
check(JSON.stringify([...completionExtras].sort()) === JSON.stringify([...UNLISTED_EXECUTABLE].sort()), `completion extras are exactly the unlisted set (${UNLISTED_EXECUTABLE.join(`/`)})`);

// 8. Alias resolution shares the canonical run function.
check(resolveCommand(`cv`)?.run === resolveCommand(`neofetch`)?.run, `cv shares the neofetch run`);
check(resolveCommand(`llm`)?.run === resolveCommand(`ai`)?.run, `llm shares the ai run`);
check(resolveCommand(`guestbook`)?.run === resolveCommand(`wall`)?.run, `guestbook shares the wall run`);
check(resolveCommand(`google`)?.run === resolveCommand(`search`)?.run, `google shares the search run`);
check(resolveCommand(`ping`)?.run === resolveCommand(`myip`)?.run, `ping shares the myip run`);

// 9. man renders every entry; unknown suggests; bare prints usage.
let manProblem = false;
for (const entry of COMMAND_REGISTRY) {
  const term = makeTerm();
  try {
    renderMan(term, entry.name);
  } catch (manError) {
    manProblem = true;
    process.stderr.write(`  renderMan(${entry.name}) threw: ${manError.message}\n`);
    continue;
  }
  const output = term.lines.join(``);
  if (!output.includes(entry.name) || !output.includes(`USAGE`) || !output.includes(`EXAMPLES`)) {
    manProblem = true;
    process.stderr.write(`  renderMan(${entry.name}) missing NAME/USAGE/EXAMPLES\n`);
  }
}
check(!manProblem, `man renders NAME/USAGE/EXAMPLES for all ${COMMAND_REGISTRY.length} entries`);
const unknownTerm = makeTerm();
renderMan(unknownTerm, `hep`);
check(unknownTerm.lines.join(``).includes(`help`), `man <unknown> suggests the nearest command`);
const bareTerm = makeTerm();
renderMan(bareTerm, ``);
check(bareTerm.lines.join(``).includes(`man <command>`), `bare man prints usage`);

// 10. Tokenizer, ai-queue routing, golden-relevant suggestions.
check(JSON.stringify(tokenizeCommandLine(`search "foo bar"`)) === JSON.stringify([`search`, `"foo bar"`]), `tokenizer keeps quoted args together`);
check(JSON.stringify(tokenizeCommandLine(``)) === JSON.stringify([]), `tokenizer returns [] for empty input`);
check(isAiCommandName(`ai`) && isAiCommandName(`llm`) && !isAiCommandName(`wall`), `ai-queue routing covers ai+llm only`);
check(suggestCommand(`unknown-cmd`) === null, `unknown-cmd gets no suggestion (golden pin)`);
check(suggestCommand(`hep`) === `help`, `hep suggests help`);

if (failureCount > 0) {
  process.stderr.write(`assert-registry: ${failureCount} failure(s)\n`);
  process.exit(1);
}
process.stdout.write(`assert-registry: all checks passed (${COMMAND_REGISTRY.length} entries, ${COMMANDS.length} listed)\n`);
