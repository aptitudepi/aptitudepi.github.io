// tex2html.mjs — custom TeX→HTML parser for the Jake Gutierrez resume template.
//
// Renders the shared macro set used by Full-CV/resume.tex and Full-CV/cv.tex
// into semantic HTML. It is intentionally fail-fast: any unknown command or
// environment in the document body throws a TexParseError so the CI build can
// fall back to a full-TeX HTML pipeline (make4ht) instead of emitting garbage.

export class TexParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TexParseError';
  }
}

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Inline formatting / control commands that carry no visible content and may
// take a braced argument (spacing, size, margin tweaks). Skipped entirely.
const INLINE_IGNORED = new Set([
  'small', 'footnotesize', 'scriptsize', 'tiny', 'normalsize', 'large',
  'Large', 'LARGE', 'huge', 'Huge', 'scshape', 'itshape', 'bfseries',
  'upshape', 'slshape', 'rmfamily', 'sffamily', 'ttfamily', 'normalfont',
  'raggedright', 'raggedleft', 'raggedbottom', 'centering', 'noindent',
  'sloppy', 'fussy', 'bf', 'it', 'sc',
]);

const INLINE_IGNORED_WITH_ARG = new Set([
  'vspace', 'hspace', 'vfill', 'hfill', 'vskip', 'newpage', 'pagebreak',
  'nopagebreak', 'medskip', 'bigskip', 'smallskip', 'strut', 'phantom',
  'hphantom', 'vphantom', 'kern', 'hbox', 'mbox',
]);

const MATH_SYMBOLS = {
  times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', cdotp: '·',
  bullet: '•', sim: '~', approx: '≈', approxeq: '≈', simeq: '≃',
  cong: '≅', equiv: '≡', propto: '∝', neq: '≠', ne: '≠', le: '≤',
  leq: '≤', ge: '≥', geq: '≥', ll: '≪', gg: '≫', in: '∈',
  notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃',
  supseteq: '⊇', cup: '∪', cap: '∩', wedge: '∧', vee: '∨',
  oplus: '⊕', otimes: '⊗', ominus: '⊖', oslash: '⊘',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
  varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι',
  kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ',
  varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
  Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  infty: '∞', partial: '∂', nabla: '∇', sum: '∑', prod: '∏',
  int: '∫', sqrt: '√', emptyset: '∅',
  rightarrow: '→', to: '→', leftarrow: '←', rightleftharpoons: '⇌',
  uparrow: '↑', downarrow: '↓', implies: '⇒', Leftarrow: '⇐',
  iff: '⇔', langle: '⟨', rangle: '⟩', mid: '|', vert: '|', Vert: '‖',
  colon: ':', percent: '%', lbrace: '{', rbrace: '}',
  lbrack: '[', rbrack: ']', lparen: '(', rparen: ')',
  slash: '/', backslash: '\\', underscore: '_',
};

class Parser {
  constructor(src) {
    this.s = src;
    this.i = 0;
    this.n = src.length;
    this.listStack = [];
    this.openPlain = false;
    this.openEntry = false;
  }

  peek() {
    return this.s[this.i];
  }

  eof() {
    return this.i >= this.n;
  }

  skipWs() {
    while (this.i < this.n && /\s/.test(this.s[this.i])) this.i++;
  }

  readCommand() {
    if (this.s[this.i] !== '\\') return null;
    this.i++;
    if (this.i >= this.n) return { name: '', isSpecial: true };
    const c = this.s[this.i];
    if (/[A-Za-z@]/.test(c)) {
      let j = this.i;
      while (j < this.n && /[A-Za-z@]/.test(this.s[j])) j++;
      const name = this.s.slice(this.i, j);
      this.i = j;
      return { name, isSpecial: false };
    }
    this.i++;
    return { name: c, isSpecial: true };
  }

  readGroup() {
    this.skipWs();
    if (this.s[this.i] !== '{') return null;
    let depth = 0;
    let j = this.i;
    while (j < this.n) {
      const ch = this.s[j];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    if (depth !== 0) throw new TexParseError('unbalanced braces');
    const inner = this.s.slice(this.i + 1, j);
    this.i = j + 1;
    return inner;
  }

  readOptional() {
    this.skipWs();
    if (this.s[this.i] !== '[') return null;
    let depth = 0;
    let j = this.i;
    while (j < this.n) {
      const ch = this.s[j];
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') {
        depth--;
        if (depth === 0 && ch === ']') break;
      }
      j++;
    }
    const inner = this.s.slice(this.i + 1, j);
    this.i = j + 1;
    return inner;
  }

  readMath() {
    const start = this.i + 1;
    let j = start;
    while (j < this.n) {
      if (this.s[j] === '$') {
        const inner = this.s.slice(start, j);
        this.i = j + 1;
        return inner;
      }
      j++;
    }
    throw new TexParseError('unterminated math');
  }

  readUntilEnd(env) {
    const start = this.i;
    let depth = 0;
    let j = this.i;
    const terminator = '\\end{' + env + '}';
    while (j < this.n) {
      const ch = this.s[j];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '\\' && depth === 0 && this.s.startsWith(terminator, j)) {
        const content = this.s.slice(start, j);
        this.i = j + terminator.length;
        return content;
      }
      j++;
    }
    throw new TexParseError(`missing \\end{${env}}`);
  }

  readTextRun() {
    const start = this.i;
    while (this.i < this.n) {
      const ch = this.s[this.i];
      if (ch === '\\' || ch === '{' || ch === '}' || ch === '$') break;
      this.i++;
    }
    return this.s.slice(start, this.i);
  }

  closePlain() {
    if (this.openPlain) {
      this.openPlain = false;
      return '</li>';
    }
    return '';
  }

  closeEntry() {
    if (this.openEntry) {
      this.openEntry = false;
      return '</li>';
    }
    return '';
  }

  flushLists() {
    let html = this.closePlain() + this.closeEntry();
    while (this.listStack.length) {
      html += '</ul>';
      this.listStack.pop();
    }
    return html;
  }
}

function cleanupInline(s) {
  return s
    .replace(/\s+/g, ' ')
    .replace(/<br>\s+/g, '<br>')
    .trim();
}

function supSub(p, tag) {
  if (p.peek() === '{') {
    const g = p.readGroup();
    return `<${tag}>${renderMath(g)}</${tag}>`;
  }
  const ch = p.peek();
  p.i++;
  return `<${tag}>${escapeHtml(ch)}</${tag}>`;
}

function handleMathCommand(p, cmd) {
  const name = cmd.name;
  if (name === 'text' || name === 'mathrm' || name === 'mathit' ||
      name === 'mathnormal' || name === 'mathrm' || name === 'operatorname' ||
      name === 'textrm' || name === 'texttt' || name === 'mathsf' ||
      name === 'mathcal' || name === 'mathbb' || name === 'mathbf' ||
      name === 'textbf' || name === 'textit' || name === 'underline') {
    const g = p.readGroup();
    if (g == null) throw new TexParseError(`\\${name} missing argument in math`);
    if (name === 'textbf' || name === 'mathbf') return `<strong>${renderMath(g)}</strong>`;
    if (name === 'textit') return `<em>${renderMath(g)}</em>`;
    if (name === 'underline') return `<u>${renderMath(g)}</u>`;
    if (name === 'text') return `<span class="math-text">${renderInline(g)}</span>`;
    return renderMath(g);
  }
  if (name === 'frac') {
    const a = p.readGroup();
    const b = p.readGroup();
    return `<span class="math-frac"><span class="math-num">${renderMath(a ?? '')}</span><span class="math-den">${renderMath(b ?? '')}</span></span>`;
  }
  if (name === 'sqrt') {
    const g = p.readGroup();
    return `√${g == null ? '' : renderMath(g)}`;
  }
  if (name === 'quad' || name === 'qquad') return '&nbsp;&nbsp;';
  if (MATH_SYMBOLS[name] != null) return MATH_SYMBOLS[name];
  if (INLINE_IGNORED.has(name) || name === 'scriptstyle' || name === 'scriptscriptsize' ||
      name === 'textstyle' || name === 'displaystyle' || name === 'vcenter' ||
      name === 'quad' || name === 'qquad') {
    if (name === 'vcenter') p.readGroup();
    return '';
  }
  throw new TexParseError(`unknown math command \\${name}`);
}

function renderMath(m) {
  const p = new Parser(m);
  let out = '';
  while (!p.eof()) {
    const c = p.peek();
    if (c === '\\') {
      const cmd = p.readCommand();
      out += handleMathCommand(p, cmd);
    } else if (c === '^') {
      p.i++;
      out += supSub(p, 'sup');
    } else if (c === '_') {
      p.i++;
      out += supSub(p, 'sub');
    } else if (c === '{' || c === '}') {
      p.i++;
    } else if (/\s/.test(c)) {
      p.i++;
    } else if (c === '&') {
      out += '&amp;';
      p.i++;
    } else if (c === '<') {
      out += '&lt;';
      p.i++;
    } else if (c === '>') {
      out += '&gt;';
      p.i++;
    } else if (c === '-' && p.s[p.i + 1] === '-' && p.s[p.i + 2] === '-') {
      out += '—';
      p.i += 3;
    } else if (c === '-' && p.s[p.i + 1] === '-') {
      out += '–';
      p.i += 2;
    } else {
      out += c;
      p.i++;
    }
  }
  return out;
}

function handleInlineCommand(p, cmd) {
  const name = cmd.name;
  if (cmd.isSpecial) {
    switch (name) {
      case '\\': return '<br>';
      case '&': return '&amp;';
      case '%': return '%';
      case '#': return '#';
      case '$': return '$';
      case '_': return '_';
      case ' ': return ' ';
      case ',': return '\u2009';
      case '.': return '';
      case '-': return '';
      case '~': return ' ';
      case '{': return '{';
      case '}': return '}';
      case '^': return '^';
      default:
        throw new TexParseError(`unknown special command \\${name}`);
    }
  }
  switch (name) {
    case 'textbf': {
      const g = p.readGroup();
      if (g == null) throw new TexParseError('\\textbf missing argument');
      return `<strong>${renderInline(g)}</strong>`;
    }
    case 'textit':
    case 'emph': {
      const g = p.readGroup();
      if (g == null) throw new TexParseError(`\\${name} missing argument`);
      return `<em>${renderInline(g)}</em>`;
    }
    case 'underline': {
      const g = p.readGroup();
      if (g == null) throw new TexParseError('\\underline missing argument');
      return `<u>${renderInline(g)}</u>`;
    }
    case 'textsuperscript': {
      const g = p.readGroup();
      if (g == null) throw new TexParseError('\\textsuperscript missing argument');
      return `<sup>${renderInline(g)}</sup>`;
    }
    case 'textsubscript': {
      const g = p.readGroup();
      if (g == null) throw new TexParseError('\\textsubscript missing argument');
      return `<sub>${renderInline(g)}</sub>`;
    }
    case 'textsc': {
      const g = p.readGroup();
      if (g == null) throw new TexParseError('\\textsc missing argument');
      return `<span class="small-caps">${renderInline(g)}</span>`;
    }
    case 'texttt': {
      const g = p.readGroup();
      if (g == null) throw new TexParseError('\\texttt missing argument');
      return `<code>${renderInline(g)}</code>`;
    }
    case 'textrm': {
      const g = p.readGroup();
      if (g == null) throw new TexParseError('\\textrm missing argument');
      return `<span>${renderInline(g)}</span>`;
    }
    case 'href': {
      const url = p.readGroup();
      const disp = p.readGroup();
      if (url == null || disp == null) throw new TexParseError('\\href missing arguments');
      return `<a href="${escapeHtml(url.trim())}" target="_blank" rel="noopener noreferrer">${renderInline(disp)}</a>`;
    }
    case 'url': {
      const url = p.readGroup();
      if (url == null) throw new TexParseError('\\url missing argument');
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    }
    case 'textless': return '&lt;';
    case 'textgreater': return '&gt;';
    case 'textbar': return '|';
    case 'textasciitilde': return '~';
    case 'textasciicircum': return '^';
    case 'textbackslash': return '\\';
    case 'textquotesingle': return "'";
    case 'textendash': return '–';
    case 'textemdash': return '—';
    case 'textunderscore': return '_';
    case 'newline':
    case 'linebreak':
    case 'par':
      return '<br>';
    default:
      break;
  }
  if (INLINE_IGNORED.has(name)) return '';
  if (INLINE_IGNORED_WITH_ARG.has(name)) {
    p.readGroup();
    return '';
  }
  throw new TexParseError(`unknown command \\${name}`);
}

function renderInline(raw) {
  const p = new Parser(raw);
  let out = '';
  while (!p.eof()) {
    const c = p.peek();
    if (c === '\\') {
      const cmd = p.readCommand();
      out += handleInlineCommand(p, cmd);
    } else if (c === '{') {
      const g = p.readGroup();
      if (g == null) {
        p.i++;
        continue;
      }
      out += renderInline(g);
    } else if (c === '}') {
      p.i++;
    } else if (c === '$') {
      const m = p.readMath();
      out += renderMath(m);
    } else if (c === '`') {
      if (p.s[p.i + 1] === '`') {
        out += '\u201c';
        p.i += 2;
      } else {
        out += '\u2018';
        p.i++;
      }
    } else if (c === "'") {
      if (p.s[p.i + 1] === "'") {
        out += '\u201d';
        p.i += 2;
      } else {
        out += "'";
        p.i++;
      }
    } else if (c === '&') {
      out += '&amp;';
      p.i++;
    } else if (c === '<') {
      out += '&lt;';
      p.i++;
    } else if (c === '>') {
      out += '&gt;';
      p.i++;
    } else if (c === '-' && p.s[p.i + 1] === '-' && p.s[p.i + 2] === '-') {
      out += '\u2014';
      p.i += 3;
    } else if (c === '-' && p.s[p.i + 1] === '-') {
      out += '\u2013';
      p.i += 2;
    } else if (/\s/.test(c)) {
      out += ' ';
      while (p.i < p.n && /\s/.test(p.s[p.i])) p.i++;
    } else {
      out += c;
      p.i++;
    }
  }
  return cleanupInline(out);
}

function renderHeader(content) {
  const inner = renderInline(content);
  const parts = inner.split('<br>').map((s) => s.trim()).filter(Boolean);
  const name = parts[0] || '';
  const contact = parts.slice(1).join('  ·  ');
  const nameHtml = name.replace(/^<strong>(.*)<\/strong>$/, '<strong>$1</strong>');
  return `<div class="resume-header">` +
    `<h1 class="resume-name">${nameHtml}</h1>` +
    (contact ? `<p class="resume-contact">${contact}</p>` : '') +
    `</div>`;
}

function parseBlocks(src) {
  const p = new Parser(src);
  let out = '';

  const handleBlockCommand = (cmd) => {
    if (cmd.isSpecial) {
      throw new TexParseError(`unexpected special command \\${cmd.name} at block level`);
    }
    const name = cmd.name;
    switch (name) {
      case 'section': {
        out += p.flushLists();
        const t = p.readGroup();
        if (t == null) throw new TexParseError('\\section missing argument');
        return `<h2 class="resume-section-title">${renderInline(t)}</h2>`;
      }
      case 'subsection': {
        const t = p.readGroup();
        if (t == null) throw new TexParseError('\\subsection missing argument');
        return `<h3 class="resume-section-subtitle">${renderInline(t)}</h3>`;
      }
      case 'resumeSubheading': {
        const a = p.readGroup();
        const b = p.readGroup();
        const c = p.readGroup();
        const d = p.readGroup();
        if (a == null || b == null || c == null || d == null) {
          throw new TexParseError('\\resumeSubheading expects 4 arguments');
        }
        let html = p.closePlain() + p.closeEntry();
        html += `<li class="resume-entry">`;
        html += `<div class="entry-row"><span class="entry-title"><strong>${renderInline(a)}</strong></span><span class="entry-date">${renderInline(b)}</span></div>`;
        html += `<div class="entry-row muted"><span class="entry-org"><em>${renderInline(c)}</em></span><span class="entry-loc"><em>${renderInline(d)}</em></span></div>`;
        p.openEntry = true;
        return html;
      }
      case 'resumeSubSubheading': {
        const a = p.readGroup();
        const b = p.readGroup();
        if (a == null || b == null) throw new TexParseError('\\resumeSubSubheading expects 2 arguments');
        let html = p.closePlain() + p.closeEntry();
        html += `<li class="resume-entry">`;
        html += `<div class="entry-row muted"><span class="entry-org"><em>${renderInline(a)}</em></span><span class="entry-loc"><em>${renderInline(b)}</em></span></div>`;
        p.openEntry = true;
        return html;
      }
      case 'resumeProjectHeading': {
        const a = p.readGroup();
        const b = p.readGroup();
        if (a == null || b == null) throw new TexParseError('\\resumeProjectHeading expects 2 arguments');
        let html = p.closePlain() + p.closeEntry();
        html += `<li class="resume-entry project">`;
        html += `<div class="entry-row"><span class="entry-title">${renderInline(a)}</span><span class="entry-date">${renderInline(b)}</span></div>`;
        p.openEntry = true;
        return html;
      }
      case 'resumeItem': {
        const g = p.readGroup();
        if (g == null) throw new TexParseError('\\resumeItem missing argument');
        return `<li class="resume-bullet">${renderInline(g)}</li>`;
      }
      case 'resumeSubItem': {
        const g = p.readGroup();
        if (g == null) throw new TexParseError('\\resumeSubItem missing argument');
        return `<li class="resume-bullet sub">${renderInline(g)}</li>`;
      }
      case 'resumeSubHeadingListStart':
        p.listStack.push('subheading-list');
        return '<ul class="subheading-list">';
      case 'resumeSubHeadingListEnd': {
        let html = p.closePlain() + p.closeEntry();
        if (p.listStack.length && p.listStack[p.listStack.length - 1] === 'item-list') {
          html += '</ul>';
          p.listStack.pop();
        }
        if (p.listStack.length && p.listStack[p.listStack.length - 1] === 'subheading-list') {
          html += '</ul>';
          p.listStack.pop();
        }
        return html;
      }
      case 'resumeItemListStart':
        p.listStack.push('item-list');
        return '<ul class="item-list">';
      case 'resumeItemListEnd': {
        let html = '';
        if (p.listStack.length && p.listStack[p.listStack.length - 1] === 'item-list') {
          html += '</ul>';
          p.listStack.pop();
        }
        return html;
      }
      case 'item': {
        const save = p.i;
        p.skipWs();
        if (p.peek() === '{') {
          const g = p.readGroup();
          if (g == null) throw new TexParseError('\\item missing argument');
          return `<li class="resume-bullet">${renderInline(g)}</li>`;
        }
        p.i = save;
        if (!p.openPlain) {
          p.openPlain = true;
          return '<li class="plain-item">';
        }
        return '';
      }
      case 'begin': {
        const env = p.readGroup();
        if (env == null) throw new TexParseError('\\begin missing environment');
        if (env === 'center') {
          const content = p.readUntilEnd('center');
          return renderHeader(content);
        }
        if (env === 'itemize') {
          p.readOptional();
          p.listStack.push('plain-list');
          return '<ul class="plain-list">';
        }
        throw new TexParseError(`unknown environment ${env}`);
      }
      case 'end': {
        const env = p.readGroup();
        if (env == null) throw new TexParseError('\\end missing environment');
        if (env === 'itemize') {
          let html = p.closePlain();
          if (p.listStack.length && p.listStack[p.listStack.length - 1] === 'plain-list') {
            html += '</ul>';
            p.listStack.pop();
          }
          return html;
        }
        if (env === 'center') return '';
        throw new TexParseError(`unknown \\end{${env}}`);
      }
      default:
        break;
    }
    if (INLINE_IGNORED.has(name)) return '';
    if (INLINE_IGNORED_WITH_ARG.has(name)) {
      p.readGroup();
      return '';
    }
    throw new TexParseError(`unknown command \\${name}`);
  };

  while (!p.eof()) {
    const c = p.peek();
    if (c === '\\') {
      const cmd = p.readCommand();
      if (!cmd) break;
      out += handleBlockCommand(cmd);
    } else if (c === '{') {
      const g = p.readGroup();
      if (g != null) out += parseBlocks(g);
    } else if (c === '}') {
      p.i++;
    } else if (c === '$') {
      const m = p.readMath();
      out += renderMath(m);
    } else if (c === ' ' || c === '\n' || c === '\t') {
      p.skipWs();
    } else {
      const run = p.readTextRun();
      out += renderInline(run);
    }
  }
  out += p.flushLists();
  return out;
}

// Strip LaTeX comments: a % not escaped by a backslash starts a comment.
function stripComments(src) {
  return src
    .split('\n')
    .map((line) => line.replace(/(?<!\\)%.*$/, ''))
    .join('\n');
}

export function texToHtml(texSource) {
  const src = stripComments(String(texSource));
  const bodyStart = src.indexOf('\\begin{document}');
  const bodyEnd = src.indexOf('\\end{document}');
  if (bodyStart === -1 || bodyEnd === -1) {
    throw new TexParseError('missing \\begin{document} / \\end{document}');
  }
  const body = src.slice(bodyStart + '\\begin{document}'.length, bodyEnd);
  const html = parseBlocks(body);
  if (!html.trim()) throw new TexParseError('empty document body');
  return html;
}
