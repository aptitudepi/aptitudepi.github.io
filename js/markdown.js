// js/markdown.js — zero-dependency markdown → ANSI renderer (WAVE 8).
//
// Minimal marked-lexer-style parser for xterm SGR: headings, bold, italic,
// inline code, links, images, lists, tables, hr, fenced code, blockquotes.
// Shared by `cat resume.md`, `case` and the `md` inline fallback. Every
// emitted line ends with a reset, long lines wrap at the terminal width,
// and input is sanitized so untrusted markdown cannot inject escapes.

const MD_RESET = "\x1b[0m";
const MD_BOLD = "\x1b[1m";
const MD_ITALIC = "\x1b[3m";
const MD_UNDERLINE = "\x1b[4m";

function mdColor(red, green, blue) {
  return `\x1b[38;2;${red};${green};${blue}m`;
}

const MD_BLUE = mdColor(80, 140, 250);
const MD_CYAN = mdColor(60, 190, 220);
const MD_WHITE = mdColor(220, 220, 230);
const MD_MUTED = mdColor(140, 140, 155);
const MD_FAINT = mdColor(100, 100, 115);
const MD_GREEN = mdColor(60, 200, 120);

// Built without a regex literal so no control-char escape lands in source.
const MD_SGR_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

// Drop C0 controls (except newline/tab), DEL and bidi overrides. Range
// checks keep the rescuer free of control-char regex escapes.
function sanitizeTerminalText(rawText) {
  const sourceText = String(rawText ?? "");
  let cleanText = "";
  for (const symbolText of sourceText) {
    const codePoint = symbolText.codePointAt(0);
    const forbiddenCell = codePoint < 0x20
      ? codePoint !== 0x0A && codePoint !== 0x09
      : codePoint === 0x7F || codePoint === 0x2028 || codePoint === 0x2029 || (codePoint >= 0x202A && codePoint <= 0x202E) || (codePoint >= 0x2066 && codePoint <= 0x2069) || codePoint === 0xFEFF;
    if (forbiddenCell === false) {
      cleanText = `${cleanText}${symbolText}`;
    }
  }
  return cleanText;
}

function visibleWidth(styledText) {
  return String(styledText).replace(MD_SGR_PATTERN, "").length;
}

// Word-wrap on visible width; ANSI codes ride along, every physical line
// is reset, and still-open styles reopen after each break.
function wrapStyledLine(styledLine, columnWidth) {
  const maxWidth = Math.max(20, Math.floor(Number(columnWidth) || 80));
  const wordList = String(styledLine).split(" ");
  const physicalLines = [];
  let currentLine = "";
  let currentVisible = 0;
  function closeLine(openLine) {
    if (openLine === "" || openLine.endsWith(MD_RESET)) {
      return openLine;
    }
    return `${openLine}${MD_RESET}`;
  }
  function reopenedStyles(brokenLine) {
    const foundCodes = String(brokenLine).match(MD_SGR_PATTERN) || [];
    return foundCodes.filter((codeText) => codeText !== MD_RESET).join("");
  }
  for (const wordText of wordList) {
    const wordVisible = visibleWidth(wordText);
    const spacedVisible = currentVisible === 0 ? wordVisible : wordVisible + 1;
    if (currentVisible > 0 && currentVisible + spacedVisible > maxWidth) {
      physicalLines.push(closeLine(currentLine));
      currentLine = `${reopenedStyles(currentLine)}${wordText}`;
      currentVisible = wordVisible;
    } else if (currentVisible === 0) {
      currentLine = wordText;
      currentVisible = wordVisible;
    } else {
      currentLine = `${currentLine} ${wordText}`;
      currentVisible = currentVisible + spacedVisible;
    }
  }
  physicalLines.push(closeLine(currentLine));
  return physicalLines;
}

function pushWrapped(lineList, styledLine, maxWidth, hangingIndent) {
  const physicalLines = wrapStyledLine(styledLine, maxWidth);
  for (let lineIndex = 0; lineIndex < physicalLines.length; lineIndex++) {
    if (lineIndex === 0 || hangingIndent <= 0) {
      lineList.push(physicalLines[lineIndex]);
    } else {
      lineList.push(`${" ".repeat(hangingIndent)}${physicalLines[lineIndex]}`);
    }
  }
}

// Inline spans except code (code is split out first so `*` inside code is
// never treated as emphasis). Order: images, links, bold, then italic.
function formatTextSegment(textSegment) {
  let stagedText = String(textSegment);
  stagedText = stagedText.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (fullMatch, altText, imageUrl) => `${MD_CYAN}${altText}${MD_RESET} (${MD_MUTED}${imageUrl}${MD_RESET})`);
  stagedText = stagedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (fullMatch, linkText, linkUrl) => `${MD_CYAN}${MD_UNDERLINE}${linkText}${MD_RESET} (${MD_MUTED}${linkUrl}${MD_RESET})`);
  stagedText = stagedText.replace(/\*\*([^*]+)\*\*/g, (fullMatch, boldText) => `${MD_BOLD}${MD_WHITE}${boldText}${MD_RESET}`);
  stagedText = stagedText.replace(/(^|[^*])\*([^*\n]+)\*/g, (fullMatch, prefixText, italicText) => `${prefixText}${MD_ITALIC}${italicText}${MD_RESET}`);
  return stagedText;
}

function formatInlineSegment(rawSegment) {
  const codeParts = String(rawSegment).split("`");
  let mergedText = "";
  for (let partIndex = 0; partIndex < codeParts.length; partIndex++) {
    const partText = codeParts[partIndex];
    if (partIndex % 2 === 1) {
      mergedText = `${mergedText}${MD_GREEN}${partText}${MD_RESET}`;
    } else {
      mergedText = `${mergedText}${formatTextSegment(partText)}`;
    }
  }
  return mergedText;
}

function splitTableRow(rowText) {
  const trimmedRow = String(rowText).trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmedRow.split("|").map((cellText) => cellText.trim());
}

// GFM-subset tables: header row first, one `---` separator row, then body.
// Cells stay plain text (no inline spans) so padding math stays visible.
function renderTableBlock(bufferedRows, maxWidth) {
  const parsedRows = bufferedRows.map(splitTableRow);
  const bodyRows = parsedRows.filter((rowCells) => rowCells.some((cellText) => /[^-:\s]/.test(cellText)));
  if (bodyRows.length === 0) {
    return [];
  }
  const columnCount = Math.max(...bodyRows.map((rowCells) => rowCells.length));
  const columnWidths = [];
  for (let colIndex = 0; colIndex < columnCount; colIndex++) {
    let widestCell = 3;
    for (const rowCells of bodyRows) {
      const cellText = String(rowCells[colIndex] ?? "");
      widestCell = Math.max(widestCell, visibleWidth(cellText));
    }
    columnWidths.push(Math.min(widestCell, 40));
  }
  const renderedLines = [];
  for (let rowIndex = 0; rowIndex < bodyRows.length; rowIndex++) {
    const rowCells = bodyRows[rowIndex];
    let lineText = "|";
    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
      const cellText = String(rowCells[colIndex] ?? "").slice(0, columnWidths[colIndex]);
      lineText = `${lineText} ${cellText.padEnd(columnWidths[colIndex])} |`;
    }
    if (rowIndex === 0) {
      renderedLines.push(`${MD_BOLD}${MD_WHITE}${lineText}${MD_RESET}`);
      let ruleText = "|";
      for (let colIndex = 0; colIndex < columnCount; colIndex++) {
        ruleText = `${ruleText}${"─".repeat(columnWidths[colIndex] + 2)}|`;
      }
      renderedLines.push(`${MD_FAINT}${ruleText}${MD_RESET}`);
    } else {
      renderedLines.push(`${MD_MUTED}${lineText}${MD_RESET}`);
    }
  }
  return renderedLines;
}

function renderMarkdown(sourceText, columnWidth) {
  const maxWidth = Math.max(20, Math.floor(Number(columnWidth) || 80));
  const sourceLines = sanitizeTerminalText(sourceText).split("\n");
  const outputLines = [];
  let inCodeBlock = false;
  let tableBuffer = [];
  function flushTable() {
    if (tableBuffer.length === 0) {
      return;
    }
    for (const tableLine of renderTableBlock(tableBuffer, maxWidth)) {
      outputLines.push(tableLine);
    }
    tableBuffer = [];
  }
  for (const sourceLine of sourceLines) {
    const trimmedLine = sourceLine.trim();
    if (trimmedLine.startsWith("```")) {
      flushTable();
      inCodeBlock = inCodeBlock === false;
      continue;
    }
    if (inCodeBlock) {
      pushWrapped(outputLines, `${MD_GREEN}${sourceLine}${MD_RESET}`, maxWidth, 0);
      continue;
    }
    if (trimmedLine.startsWith("|") && trimmedLine.endsWith("|")) {
      tableBuffer.push(sourceLine);
      continue;
    }
    flushTable();
    if (trimmedLine === "") {
      outputLines.push("");
      continue;
    }
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const levelDepth = headingMatch[1].length;
      let headingColor = MD_WHITE;
      if (levelDepth === 1) {
        headingColor = MD_BLUE;
      } else if (levelDepth === 2) {
        headingColor = MD_CYAN;
      }
      if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== "") {
        outputLines.push("");
      }
      pushWrapped(outputLines, `${MD_BOLD}${headingColor}${formatInlineSegment(headingMatch[2])}${MD_RESET}`, maxWidth, 0);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmedLine)) {
      outputLines.push(`${MD_FAINT}${"─".repeat(Math.min(maxWidth, 64))}${MD_RESET}`);
      continue;
    }
    const quoteMatch = trimmedLine.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      const quotePrefix = `${MD_FAINT}│${MD_RESET} `;
      pushWrapped(outputLines, `${quotePrefix}${formatInlineSegment(quoteMatch[1])}`, maxWidth, 2);
      continue;
    }
    const bulletMatch = sourceLine.match(/^(\s*)[-*+]\s+(.*)$/);
    if (bulletMatch) {
      const nestLevel = Math.floor(bulletMatch[1].length / 2);
      const bulletPrefix = `${"  ".repeat(nestLevel)}${MD_GREEN}•${MD_RESET} `;
      pushWrapped(outputLines, `${bulletPrefix}${formatInlineSegment(bulletMatch[2])}`, maxWidth, visibleWidth(bulletPrefix));
      continue;
    }
    const orderMatch = sourceLine.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (orderMatch) {
      const orderLevel = Math.floor(orderMatch[1].length / 2);
      const orderPrefix = `${"  ".repeat(orderLevel)}${MD_GREEN}${orderMatch[2]}.${MD_RESET} `;
      pushWrapped(outputLines, `${orderPrefix}${formatInlineSegment(orderMatch[3])}`, maxWidth, visibleWidth(orderPrefix));
      continue;
    }
    pushWrapped(outputLines, formatInlineSegment(trimmedLine), maxWidth, 0);
  }
  flushTable();
  return outputLines;
}

export { sanitizeTerminalText, renderMarkdown };
