# Done

Ideas that were **fully** implemented. When something in [`IDEAS.md`](./IDEAS.md) ships completely, move it here (do not leave strikethrough ghosts in IDEAS). Partial work stays in IDEAS with an optional progress note.

Format: **what** — where it lives · commit(s) / notes

---

## SEO / discovery

- **Auto-generated `sitemap.xml`** — CI via `tools/sitemap.mjs` + shared `tools/site-urls.mjs`; deploy `lastmod`; gitignored artifact · `2e78547`
- **`robots.txt` with Sitemap** — origin `Allow: /` + `Sitemap:`; CF managed robots may prepend Content Signals / AI Disallows · `e590c04` / `2e78547`
- **IndexNow on deploy** — `INDEXNOW_KEY` secret, key file in artifact, `tools/indexnow.mjs` post-deploy · `e590c04`

## Brand / visual

- **Thought orbs** — terminal AI status (searching / composing) + nav lattice mark; `js/orb.js`; reduced-motion static frame · `95b7d8f`, `641e406`, `968b57e`
- **Nav orb + wordmark color cycle** — Design B: bar `--nav-cycle` (blue↔red); orb ambient-cycles; wordmark joins on hover; reduced-motion freeze · `fee655e`

## Terminal commands

- **`weather`** — Open-Meteo + geolocation / IP fallback; `-f` Fahrenheit · (see README / `js/shell.js`)
- **`history`** — command history list + arrow-key cycling
- **`hn`** — Hacker News top stories ANSI table
- **`md`** — markdown viewer (marked + DOMPurify)
- **`crt` / `noise`** — scanline + grain overlays
- **`matrix`** — full-screen matrix rain overlay (`js/matrix-rain.js`)
- **`fortune` / `cowsay`** — basic commands (piping / `fortune -l` categories still open in IDEAS)
- **`vm`** — v86 Buildroot guest
- **`search <q>` & `ai web <q>`** — Live web-augmented search via Cloudflare Worker proxy (`/search` endpoint + DuckDuckGo parser) · `cors-proxy-worker.js`, `js/ai.js`, `js/shell.js`
- **`wall` / `guestbook`** — Global AI-assisted visitor guestbook & signature reply wall backed by Cloudflare Worker API (`/wall` endpoint) · `cors-proxy-worker.js`, `js/shell.js`
- **`myip` / `ping`** — Client network diagnostics, geolocation, ASN, and gateway ping response time · `cors-proxy-worker.js`, `js/shell.js`
- **Terminal Function-Calling Agent** — AI tool-calling execution over shell commands (`hn`, `matrix`, `weather`, `cat`, `theme`) via `[[TOOL: exec("...")]]` action dispatch · `js/ai.js`, `js/shell.js`
- **RAG Cross-Encoder Re-Ranking Pass** — Secondary relevance re-ranking pass (`rerankChunks`) filtering top candidate vector chunks · `js/rag.js`
- **Persistent AI Assistant Memory** — LocalStorage-backed conversation history & user memory context engine · `js/memory.js`, `js/ai.js`
- **`ai` / `ai-models` / `ai-model`** — Transformers.js local inference + Groq Cloud streaming + multi-model fallback (`js/ai.js`)
- **`neofetch` / `resfetch` / `cv` / `about`** — resume-oriented shell surfaces
- Core Unix toys: `whoami`, `hostname`, `date`, `uptime`, `uname`, `pwd`, `cat`, `ls`, `echo`, `clear`, `help`

## Terminal UX

- **Tab completion** — commands, VFS paths, `./` files; cycles on Tab
- **Auto-correction on typos** — Levenshtein ≤ 2 → “Did you mean …?”

## Architecture & Framework Integrations

- **Kyoto Component Primitives (`js/component.js`)** — Non-blocking async futures & component lifecycles inspired by `github.com/yznts/kyoto`
- **Kyoto Universal Reactive State (`js/state.js`)** — Unified state store (`component.Universal` pattern) synced across sessions & tabs via `localStorage`
- **Kyoto Hypermedia Partial Swapper (`js/htmx-lite.js`)** — Dynamic partial DOM swapping library inspired by `kyoto/htmx`

## Site chrome / content pipeline

- **Three.js particle background** — `js/three-particles.js`
- **Anime.js scroll / hover / skill bars** — `js/animations.js`
- **Aura orbs (CSS)** — section atmosphere
- **Projects spotlight cards** — tilt / shimmer (kokonutui-inspired)
- **CI Full-CV → HTML/PDF** — `tools/tex2html.mjs`, `roff2html.mjs`, `build.mjs`, `build-pdf.mjs`; `/resume`, `/cv`, `/man/`
- **Unified glass / terminal nav** — `templates/shell.html`, `templates/man.html`, `css/nav.css`
- **Contact + GPG** — Keybase proof file, `assets/gpg.asc`
- **v86 CORS Worker** — `assets/v86/cors-proxy-worker.js`
- **Responsive token design system** — `css/tokens.css` et al.

---

*Only move entries when the idea as written in IDEAS is fully satisfied. Related follow-ups (e.g. `fortune -l`, IndexNow for `/c`, orb state expansion) remain in IDEAS.*
