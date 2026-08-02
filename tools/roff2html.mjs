// roff2html.mjs — minimal man-page renderer tuned for dvxb.io.7.
//
// The source is a hand-written man page (not strictly roff), using the layout:
//   HEADER(7)   Center Title   HEADER(7)
//   (blank)
//   NAME
//        definition line
//   DESCRIPTION
//        wrapped prose paragraphs...
//   SEE ALSO
//        entry(7)   <a href="...">...</a>
//   HEADER(7)   Center Title   HEADER(7)
//
// This renderer recognizes uppercase section keywords, indented paragraph
// bodies, and passthrough of any embedded <a href="...">...</a> anchors.

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Re-enable inline HTML anchors that were escaped by escapeHtml.
// escapeHtml leaves double quotes untouched, so the href attribute survives as
// a literal " after the rest of the tag has been escaped.
function restoreAnchors(s) {
  return s.replace(
    /&lt;a href="([^"]+?)"&gt;([^&]*)&lt;\/a&gt;/g,
    (m, href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`,
  );
}

const renderText = (line) => restoreAnchors(escapeHtml(line));

// A header/footer line looks like:  DVXB.IO(7)  Personal Website Manual  DVXB.IO(7)
function renderHeaderLine(line) {
  const parts = line.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && parts[0] === parts[parts.length - 1]) {
    const center = parts.slice(1, -1).join(' ');
    return (
      `<div class="man-bar">` +
      `<span class="man-bar-side">${renderText(parts[0])}</span>` +
      `<span class="man-bar-center">${renderText(center)}</span>` +
      `<span class="man-bar-side">${renderText(parts[parts.length - 1])}</span>` +
      `</div>`
    );
  }
  return `<p class="man-para">${renderText(line)}</p>`;
}

const SECTIONS = new Set(['NAME', 'DESCRIPTION', 'FILES', 'AUTHORS', 'SEE ALSO']);

export function roffToHtml(src) {
  const lines = String(src).split('\n');
  const body = [];
  let header = null;
  let footer = null;

  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  if (nonEmpty.length) {
    const first = lines.findIndex((l) => l.trim());
    const last = lines.map((l, i) => (l.trim() ? i : -1)).filter((i) => i !== -1).pop();
    header = lines[first].trim();
    footer = lines[last].trim();
  }

  let out = header ? renderHeaderLine(header) : '';
  let current = null; // { name, kind: 'para' | 'file', paras: [] }
  let para = null;    // { text: [] }

  const flushPara = () => {
    if (!para) return;
    const text = para.text.join(' ').replace(/\s+/g, ' ').trim();
    if (current) {
      current.paras.push({ kind: 'para', text });
    } else {
      body.push(`<p class="man-para">${text}</p>`);
    }
    para = null;
  };

  const flushSection = () => {
    flushPara();
    if (!current) return;
    if (current.paras.length) {
      let inner = '';
      for (const p of current.paras) {
        if (p.kind === 'file') {
          const rowClass = current.name === 'SEE ALSO' ? 'man-file man-seealso' : 'man-file';
          inner += `<div class="${rowClass}"><code>${p.code}</code><span class="man-file-desc">${p.desc}</span></div>`;
        } else {
          inner += `<p class="man-para">${p.text}</p>`;
        }
      }
      body.push(
        `<section class="man-section">` +
        `<h2 class="man-section-title">${renderText(current.name)}</h2>` +
        `<div class="man-body">${inner}</div>` +
        `</section>`,
      );
    }
    current = null;
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      if (para && para.text.length) flushPara();
      continue;
    }
    // Ignore leading/trailing header bars already emitted.
    if (trimmed === header || trimmed === footer) {
      if (para && para.text.length) flushPara();
      continue;
    }
    // Section keyword?
    if (/^[A-Z][A-Z &-]*$/.test(trimmed) && trimmed.length <= 40 && SECTIONS.has(trimmed)) {
      flushSection();
      current = { name: trimmed, paras: [] };
      continue;
    }
    // Indented body line?
    const indent = raw.length - raw.trimStart().length;
    if (current && indent > 0) {
      if ((current.name === 'FILES' || current.name === 'SEE ALSO') && /\s{2,}/.test(trimmed)) {
        flushPara();
        const [code, ...rest] = trimmed.split(/\s{2,}/);
        current.paras.push({ kind: 'file', code: renderText(code), desc: renderText(rest.join(' ')) });
        continue;
      }
      if (!para) para = { text: [] };
      para.text.push(renderText(trimmed));
      continue;
    }
    // Everything else that isn't a recognized section keyword: stray prose.
    flushSection();
    body.push(`<p class="man-para">${renderText(trimmed)}</p>`);
  }
  flushSection();

  const content = body.join('\n');
  const footerHtml = footer ? renderHeaderLine(footer) : '';
  return {
    header,
    footer,
    html: `<header class="man-page-header">${header ? renderHeaderLine(header) : ''}</header>\n${content}\n<footer class="man-page-footer">${footerHtml}</footer>`,
  };
}
