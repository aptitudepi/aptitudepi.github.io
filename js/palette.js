// js/palette.js — native <dialog> command palette (WAVE 7).
//
// Every row derives from COMMAND_REGISTRY (js/commands.js): grouped
// CORE/ADDITIONAL sections like the gh CLI, each row a plain-language title
// plus the raw-command subtitle (Raycast pattern), footer EXAMPLES for the
// highlighted entry. Execution always goes through the shell dispatcher
// (window.executeTerminalCommand) so the palette can never bypass the
// registry. Ctrl+K/Cmd+K opens it from anywhere on the page.

import { COMMAND_REGISTRY, resolveCommand, tokenizeCommandLine } from './commands.js';
import { getMode, getTerm } from './terminal.js';

let paletteDialog = null;
let paletteInput = null;
let paletteList = null;
let paletteHint = null;
let paletteExamples = null;
let openerNode = null;
let filteredEntries = [];
let highlightedEntryName = null;

// Subsequence fuzzy match: every query char must appear in order in the
// haystack. Returns a score (lower is better) or null for no match. An
// empty query matches everything with a neutral score.
function fuzzyScore(queryText, haystackText) {
  const query = String(queryText).toLowerCase();
  const haystack = String(haystackText).toLowerCase();
  if (!query) return 0;
  let haystackCursor = 0;
  let matchScore = 0;
  let lastMatchAt = -1;
  for (const queryChar of query) {
    const foundAt = haystack.indexOf(queryChar, haystackCursor);
    if (foundAt === -1) return null;
    if (lastMatchAt !== -1) matchScore += foundAt - lastMatchAt - 1;
    if (foundAt === 0 || haystack[foundAt - 1] === ' ') matchScore -= 2;
    lastMatchAt = foundAt;
    haystackCursor = foundAt + 1;
  }
  matchScore += haystack.length * 0.01;
  return matchScore;
}

function entryHaystack(entry) {
  return `${entry.name} ${entry.aliases.join(' ')} ${entry.plain} ${entry.examples.join(' ')}`;
}

// Registry-driven filter used by the dialog and the test harness.
function filterPaletteEntries(queryText) {
  const scoredEntries = [];
  for (const entry of COMMAND_REGISTRY) {
    const entryScore = fuzzyScore(queryText, entryHaystack(entry));
    if (entryScore !== null) scoredEntries.push({ entry, score: entryScore });
  }
  scoredEntries.sort((firstMatch, secondMatch) => {
    if (firstMatch.score !== secondMatch.score) return firstMatch.score - secondMatch.score;
    const firstPos = firstMatch.entry.helpPos ?? 999;
    const secondPos = secondMatch.entry.helpPos ?? 999;
    return firstPos - secondPos;
  });
  return scoredEntries.map((scoredEntry) => scoredEntry.entry);
}

// Build the exact shell line Enter executes. A verbatim input whose head
// resolves to the highlighted entry runs untouched so `man <topic>`,
// `search <query>` and `ai <prompt>` keep their full argument string.
// Picking a different row carries the typed trailing args onto that row;
// with no args the row's first example runs.
function buildPaletteLine(selectedEntry, inputText) {
  const rawLine = String(inputText ?? '').trim();
  const lineTokens = tokenizeCommandLine(rawLine);
  if (lineTokens.length === 0) return selectedEntry.examples[0];
  const headEntry = resolveCommand(lineTokens[0]);
  if (headEntry && selectedEntry && headEntry.name === selectedEntry.name) return rawLine;
  if (selectedEntry) {
    const trailingArgs = headEntry ? lineTokens.slice(1).join(' ') : rawLine;
    if (trailingArgs) return `${selectedEntry.name} ${trailingArgs}`;
    return selectedEntry.examples[0];
  }
  return rawLine;
}

// Flat render order: CORE group first, then ADDITIONAL (gh-CLI style),
// score order preserved inside each group.
function groupedEntries() {
  return [
    ...filteredEntries.filter((entry) => entry.category === 'CORE'),
    ...filteredEntries.filter((entry) => entry.category !== 'CORE'),
  ];
}

function highlightedEntry() {
  if (!highlightedEntryName) return null;
  return filteredEntries.find((entry) => entry.name === highlightedEntryName) ?? null;
}

function moveHighlight(step) {
  const orderedEntries = groupedEntries();
  if (orderedEntries.length === 0) return;
  const currentCursor = orderedEntries.findIndex((entry) => entry.name === highlightedEntryName);
  const nextCursor = currentCursor < 0
    ? (step > 0 ? 0 : orderedEntries.length - 1)
    : (currentCursor + step + orderedEntries.length) % orderedEntries.length;
  highlightedEntryName = orderedEntries[nextCursor].name;
  renderPaletteList();
}

function renderPaletteList() {
  paletteList.textContent = '';
  const groups = [
    { name: 'CORE', entries: filteredEntries.filter((entry) => entry.category === 'CORE') },
    { name: 'ADDITIONAL', entries: filteredEntries.filter((entry) => entry.category !== 'CORE') },
  ];
  for (const group of groups) {
    if (group.entries.length === 0) continue;
    const groupHeader = document.createElement('div');
    groupHeader.className = 'palette-group';
    groupHeader.textContent = group.name;
    paletteList.appendChild(groupHeader);
    for (const entry of group.entries) {
      const rowButton = document.createElement('button');
      rowButton.type = 'button';
      rowButton.className = 'palette-row';
      rowButton.dataset.entryName = entry.name;
      const isActive = entry.name === highlightedEntryName;
      if (isActive) {
        rowButton.classList.add('active');
        rowButton.setAttribute('aria-selected', 'true');
      }
      const titleSpan = document.createElement('span');
      titleSpan.className = 'palette-title';
      titleSpan.textContent = entry.plain;
      const commandSpan = document.createElement('span');
      commandSpan.className = 'palette-command';
      const usageSpec = entry.argsSpec ? `${entry.name} ${entry.argsSpec}` : entry.name;
      commandSpan.textContent = usageSpec;
      rowButton.appendChild(titleSpan);
      rowButton.appendChild(commandSpan);
      rowButton.addEventListener('click', () => {
        highlightedEntryName = entry.name;
        submitPalette(entry);
      });
      rowButton.addEventListener('mousemove', () => {
        if (highlightedEntryName !== entry.name) {
          highlightedEntryName = entry.name;
          renderPaletteList();
        }
      });
      paletteList.appendChild(rowButton);
    }
  }
  renderPaletteExamples();
  if (filteredEntries.length === 0) {
    showPaletteHint('No match — keep typing or press Esc to close.');
    return;
  }
  showPaletteHint('');
}

function renderPaletteExamples() {
  const highlighted = highlightedEntry();
  paletteExamples.textContent = '';
  if (!highlighted) return;
  const examplesLabel = document.createElement('span');
  examplesLabel.className = 'palette-examples-label';
  examplesLabel.textContent = 'EXAMPLES';
  paletteExamples.appendChild(examplesLabel);
  for (const exampleLine of highlighted.examples) {
    const exampleSpan = document.createElement('span');
    exampleSpan.className = 'palette-example';
    exampleSpan.textContent = `$ ${exampleLine}`;
    paletteExamples.appendChild(exampleSpan);
  }
}

function showPaletteHint(hintText) {
  paletteHint.textContent = hintText;
  paletteHint.hidden = hintText.length === 0;
}

function refreshPaletteFilter() {
  filteredEntries = filterPaletteEntries(paletteInput.value);
  highlightedEntryName = filteredEntries.length > 0 ? filteredEntries[0].name : null;
  renderPaletteList();
}

function submitPalette(clickedEntry) {
  const rawLine = String(paletteInput.value ?? '').trim();
  const lineTokens = tokenizeCommandLine(rawLine);
  const highlighted = highlightedEntry();
  const picked = clickedEntry ?? highlighted;
  if (lineTokens.length === 0 && !picked) {
    showPaletteHint('Type a command or pick a row — Esc closes.');
    return;
  }
  const headEntry = lineTokens.length > 0 ? resolveCommand(lineTokens[0]) : null;
  if (lineTokens.length > 0 && !headEntry && !picked) {
    showPaletteHint(`No match for “${lineTokens[0]}” — pick a row or press Esc.`);
    return;
  }
  // An explicit arg string always wins over the highlight on Enter: typing
  // `man ai` runs exactly that line even if another row is highlighted.
  // Clicking a row runs that row (carrying any typed trailing args).
  // A bare command name (or empty input) runs the highlighted row.
  const commandLine = clickedEntry
    ? buildPaletteLine(clickedEntry, rawLine)
    : (headEntry && lineTokens.length > 1 ? rawLine : (picked ? buildPaletteLine(picked, rawLine) : rawLine));
  if (getMode() !== 'local') {
    showPaletteHint('Exit Linux first (Exit Linux button), then run shell commands.');
    return;
  }
  const activeTerm = getTerm();
  if (!activeTerm) {
    showPaletteHint('Terminal is not ready yet — close and retry in a moment.');
    return;
  }
  closePalette(false);
  activeTerm.focus();
  window.executeTerminalCommand(commandLine, activeTerm);
}

function openPalette() {
  ensurePaletteDialog();
  if (paletteDialog.open) {
    paletteInput.focus();
    return;
  }
  openerNode = document.activeElement;
  paletteInput.value = '';
  showPaletteHint('');
  filteredEntries = filterPaletteEntries('');
  highlightedEntryName = filteredEntries.length > 0 ? filteredEntries[0].name : null;
  renderPaletteList();
  paletteDialog.showModal();
  paletteInput.focus();
}

function closePalette(restoreFocus) {
  if (!paletteDialog || !paletteDialog.open) return;
  paletteDialog.close();
  if (restoreFocus !== false && openerNode && typeof openerNode.focus === 'function') {
    openerNode.focus();
  }
  openerNode = null;
}

function ensurePaletteDialog() {
  if (paletteDialog) return;
  paletteDialog = document.getElementById('command-palette');
  paletteInput = document.getElementById('palette-input');
  paletteList = document.getElementById('palette-list');
  paletteHint = document.getElementById('palette-hint');
  paletteExamples = document.getElementById('palette-examples');
  paletteInput.addEventListener('input', refreshPaletteFilter);
  paletteInput.addEventListener('keydown', (keyEvent) => {
    if (keyEvent.key === 'ArrowDown') {
      keyEvent.preventDefault();
      moveHighlight(1);
      return;
    }
    if (keyEvent.key === 'ArrowUp') {
      keyEvent.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (keyEvent.key === 'Enter') {
      keyEvent.preventDefault();
      submitPalette(null);
    }
  });
  paletteDialog.addEventListener('click', (clickEvent) => {
    if (clickEvent.target === paletteDialog) closePalette(true);
  });
  paletteDialog.addEventListener('cancel', () => {
    if (openerNode && typeof openerNode.focus === 'function') {
      const openerToRestore = openerNode;
      setTimeout(() => openerToRestore.focus(), 0);
    }
    openerNode = null;
  });
  paletteDialog.addEventListener('close', () => {
    showPaletteHint('');
  });
}

function initPalette() {
  ensurePaletteDialog();
  document.querySelectorAll('[data-open-palette]').forEach((triggerButton) => {
    triggerButton.addEventListener('click', openPalette);
  });
  document.addEventListener('keydown', (keyEvent) => {
    const isPaletteChord = (keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.key.toLowerCase() === 'k';
    if (!isPaletteChord) return;
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    if (paletteDialog.open) closePalette(true);
    else openPalette();
  }, { capture: true });
}

export { initPalette, openPalette, closePalette, filterPaletteEntries, buildPaletteLine, fuzzyScore };
