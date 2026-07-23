# Ideas

## Terminal Commands

### Command Wishlist

| Command | Description | Effort | Impact |
|---------|-------------|--------|--------|
| `figlet <text>` | ASCII art text (bundle 1 font ~2KB) | Low | Medium |
| `weather [city]` | Live weather via wttr.in or Worker proxy | Low | High |
| `gh [activity/repos]` | GitHub recent activity via public API + Worker cache | Medium | High |
| `calc <expr>` | Safe math evaluator | Low | Medium |
| `man <cmd>` | Man page for each command (already have help text) | Low | Medium |
| `todo [add/list/done]` | Simple todo list in localStorage | Low | Medium |
| `note [add/show/search]` | Quick notes in localStorage | Low | Medium |
| `timer <seconds>` | Countdown timer in terminal | Low | Medium |
| `hollywood` | Fake hacking frenzy — scrolling hex dump + random syslog lines | Low | High |
| `sl` | Steam locomotive when you type `sl` instead of `ls` | Low | Medium |
| `sudo <cmd>` | Comedic "permission denied" messages | Very Low | Low |
| `history` | Show command history | Very Low | Medium |
| `ping [host]` | Fake ping with animated TTL display | Low | Medium |
| `ssh [user@host]` | Fake SSH connection animation then return to shell | Low | Medium |
| `password` | Generate random secure password | Very Low | Low |
| `base64 [encode/decode]` | Base64 encode/decode | Low | Medium |
| `qr <text>` | Terminal QR code (client-side qrcode.js) | Low | High |
| `colors` | Display all 16 ANSI color blocks | Very Low | Low |
| `font [name]` | Switch terminal font (preview mode) | Medium | Medium |
| `theme [name]` | Switch color theme from palette | Medium | Medium |
| `snake` | Playable Snake game in terminal (80x24 grid) | Medium | Medium |
| `type` | Typing speed test using FORTUNES quotes | Medium | Medium |
| `achievements` | Show unlocked easter egg badges | Medium | Medium |
| `tree` | Display VFS directory structure recursively (├── format) | Low | Medium |
| `head [-n] <file>` | Read first N lines of a VFS file | Low | Low |
| `tail [-n] <file>` | Read last N lines of a VFS file | Low | Low |
| `wc [file]` | Word / line / character count on output or file | Low | Low |
| `sort` | Sort output lines alphabetically | Low | Low |
| `uniq` | Remove adjacent duplicate lines from output | Low | Low |
| `tee <file>` | Split output: display to terminal and write to VFS file | Medium | Low |
| `ip` | Public IP + geolocation (city, ISP) via Worker proxy | Low | Medium |
| `uuid [v4]` | Generate UUID v4 via Web Crypto API (no server) | Very Low | Medium |
| `joke` | Random programming joke from JokeAPI | Low | Medium |
| `quote` | Random advice from Advice Slip API | Low | Medium |
| `rps <choice>` | Rock-paper-scissors against the terminal | Low | Low |
| `quiz` | 40-question frontend quiz with XP system and 4 rank tiers | Medium | Medium |
| `zip` / `unzip` | Simulated file compression (tar-style ASCII progress with VFS) | Medium | Low |
| `snippet [add/show/rm]` | Code snippet vault with syntax highlighting in terminal | Low | Medium |
| `color <value>` | Convert colors between HEX, RGB, HSL, OKLCH (Web Crypto) | Low | Medium |

### UX Enhancements

- **Tab completion** — autocomplete commands on Tab with cycling through matches. Override xterm.js default Tab behavior. Medium effort, high impact.
- **`Ctrl+R` reverse search** — incremental search through CMD_HISTORY. Standard bash behavior. Medium effort, high impact.
- **Command auto-suggest** — ghost text showing most likely completion (like fish shell). Right arrow or Ctrl+F accepts. Medium effort.
- **`stats` command** — commands run, uptime, keys pressed, fortune count. localStorage-persisted counters. Low effort.
- **Keyboard shortcut cheat sheet** — `Ctrl+H` overlay listing all shortcuts (Tab, Ctrl+R, Ctrl+C, Ctrl+L, Ctrl+D, arrow keys, etc.). Low effort.
- **Command palette** — `⌘K` / `Ctrl+K` opens a fuzzy-search overlay listing every command with live filtering. Execute any command directly from the palette. Medium effort, very high impact (sourced from khriztianmoreno).
- **Auto-correction on typos** — Mistype `pojects` → "Did you mean `projects`?" Uses Levenshtein distance against command list. Low effort (sourced from RajdeepKushwaha5).
- **Suggestion panel** — Live dropdown of matching commands + arguments as you type. Navigate with Tab/arrows, Esc to dismiss. Already listed as Tab completion but upgraded to a persistent panel. (sourced from terminal-portfolio-website).
- **Paste auto-clean** — Automatically strips leading `$ `, `❯ `, `root@host:~# ` from pasted commands. Low effort, reduces friction for copy-paste visitors (sourced from RajdeepKushwaha5).
- **Copy button on output** — Hovering any command output block shows a copy icon. Click to copy that output to clipboard. Low effort.
- **Multiple terminal sessions** — tmux-style split panes: `Ctrl+B %` splits vertically, `Ctrl+B "` splits horizontally. Each pane has independent state. High effort, very high impact.
- **Loading spinner variants** — 5 styles: braille dots, ASCII progress bar, typewriter cursor, dots accumulator, rotating line. Cycling `theme` or `spinner` command. Low effort (sourced from terminal-portfolio-website).

### Shell Environment

Transform the terminal from a command-dispatch facade into a real-feeling shell environment.

| Feature | Description | Effort | Impact |
|---------|-------------|--------|--------|
| **Command piping (`\|`)** | Chain commands: `fortune \| cowsay`. Stdout of first feeds stdin of next. Right-associative. | High | Very High |
| **Shell variables** | `$USER`, `$HOSTNAME`, `$PWD`, `$SHELL`, `$EDITOR`. `echo $VAR` and `export VAR=val`. | Medium | High |
| **Output redirection** | `>`, `>>`, `2>` operators for stdout/stderr. `echo "note" > ~/notes.txt` actually writes to VFS. | Medium | High |
| **Scripting mode** | Multi-line input with `\` continuation or `for i in 1 2 3; do ... done` blocks. | High | Medium |
| **Command substitution** | `$(cmd)` or backtick expansion: `echo "Today is $(date)"`. | Medium | Medium |
| **`cowsay`/`ponysay`** | Classic ASCII art speech bubble. Pipe-friendly: `fortune \| cowsay`. | Low | Medium |
| **`fortune -l`** | Long fortunes. `fortune -c` shows category. Categories: wisdom, code, philosophy, humor. | Low | Low |
| **`cmatrix`** | Matrix rain in the terminal (already have full-screen overlay, but in-terminal version is different). | Low | Medium |
| **`yes <text>`** | Repeatedly outputs text until Ctrl+C. | Very Low | Low |
| **`banner <text>`** | Large ASCII banner text (hash-based). | Low | Medium |
| **`watch <cmd>`** | Run command repeatedly, clear screen between runs. `watch -n 2 date`. | Low | Medium |
| **`env`** | List all shell environment variables and their values. | Very Low | Medium |
| **`which <cmd>`** | Show path to a command in the VFS. | Very Low | Low |
| **`alias`** | Define and list command aliases persisted in localStorage. | Low | Medium |

---

## Now Playing Integration

### Last.fm (Recommended — best effort/impact ratio)
- Free API key from [last.fm/api](https://www.last.fm/api)
- Cloudflare Worker proxy: `GET ?user=aptitudepi&method=user.getrecenttracks&limit=1`
- If `track[0].@attr.nowplaying === "true"` → currently playing
- Returns: artist, track name, album art URL, loved status
- Display: `np` command shows album art (via ANSI blocks or sixel) + track info
- Could also show in MOTD header
- Bonus: recent scrobbles, top artists, listening stats

### Spotify (Higher fidelity, more complex)
- OAuth PKCE flow with stored refresh token in Worker
- Worker: `api.spotify.com/v1/me/player/currently-playing`
- Returns: album art (640x640), progress_ms, device, explicit flag
- Display: album art as ANSI blocks + progress bar
- Downside: token refresh requires user to re-auth periodically

### YouTube Music
- No public API for now-playing status — not feasible without a browser extension

### Ambient Audio Visualizer
- Instead of "now playing," create a Web Audio API ambient soundscape
- Terminal beeps, soft hum, key clicks — no audio files shipped
- Visualized as waveform bars in the terminal header
- Demo mode generates synthetic audio
- Could sync with particles for audio-reactive color shifts

---

## Integrations

Beyond music — hook the terminal into the services the user actually visits daily.

| Integration | Command | Data Source | Effort | Impact |
|-------------|---------|-------------|--------|--------|
| **Hacker News** | `hn [top/new/show/ask]` | Firebase API (free, no auth) | Low | High |
| **GitHub notifications** | `gh notify` | GitHub API notifications endpoint | Medium | High |
| **Dev.to articles** | `devto` | Dev.to API (free, no auth) | Low | Medium |
| **Stack Overflow rep** | `so` | Stack Exchange API | Low | Medium |
| **Goodreads reading** | `books` | Goodreads RSS → Worker parser | Low | Medium |
| **YouTube subscriber count** | `yt <channel>` | YouTube Data API via Worker | Low | Medium |
| **Strava** | `strava` | Strava API, OAuth stored in Worker | Medium | Medium |
| **Steam game library** | `steam <user>` | Steam API (free, no auth needed for public) | Low | Low |
| **Crypto prices** | `crypto [btc/eth/sol]` | CoinGecko API (free, no auth) | Very Low | Medium |
| **Stock ticker** | `stock <SYMBOL>` | Finnhub or Yahoo Finance via Worker | Low | Medium |
| **Reddit** | `reddit <subreddit>` | Reddit JSON API (.json suffix, no auth) | Low | Medium |
| **Weather maps** | `weather -m` | OpenWeatherMap tiles or wttr.in ANSI | Medium | Low |

### Weather Radar — Implementation Notes (Attempted, June 2026)

**Goal**: `weather -r` renders a RainViewer radar precipitation map composited over ESRI World_Topo_Map tiles, displayed as ANSI truecolor half-blocks in the terminal, with multi-frame animation cycling through the last hour.

**Data Sources**:
- **Radar tiles**: RainViewer public API (`api.rainviewer.com/public/weather-maps.json`). Gives a manifest of past frames (5–10 min apart) with tile paths. Tile URL: `{host}{path}/512/{zoom}/{lat}/{lon}/{colorScheme}/{opacity}.png`
- **Topo tiles**: ESRI World_Topo_Map (`server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{zoom}/{y}/{x}.png`). No auth required.
- **Zoom levels**: RainViewer supports 2–12; ESRI supports 0–18. Used zoom 7 for a good balance of coverage and detail.

**Color scheme**: RainViewer scheme `0` has transparent background (only precipitation has non-zero alpha). Schemes `2+` embed a dark base map (solid fill, no transparency) — the alpha-based `t.a > 10` check rendered every pixel as `▀` because all pixels had alpha=255. Using scheme `0` fixed this, but zoom 7 didn't look great for the test location.

**ANSI Rendering Pipeline**:
1. Fetch topo tile (512×512 PNG via `createImageBitmap`)
2. Fetch radar tile (same dimensions)
3. Composite on a `<canvas>`: topo drawn first (darkened 0.45×), radar drawn on top
4. `ctx.getImageData(0, 0, 512, 512)` samples the composited result
5. Sample to terminal grid: `cols × rows` where each terminal row = 2 canvas rows (half-block `▀`/`▄`)
6. Each grid cell picks the top and bottom canvas pixel; if both have alpha > 10, render `▀` with foreground = top pixel color and background = bottom pixel color via ANSI 24-bit truecolor (`\x1b[38;2;R;G;Bm` / `\x1b[48;2;R;G;Bm`)

**Edge detection attempt**: Replaced uniform darkening with Sobel edge detection (3×3 kernels, threshold `mag > 80 && luma > 100`) to extract only coastlines/roads/borders as white lines on transparent background. Text naturally filtered out by the luminance threshold. This was promising but not fully tuned — many text artifacts remained and the threshold needed per-tile adjustment.

**Marker**: Cyan (`#00ffff`) crosshair at the user's location (canvas center, 256,256): two concentric circles (radii 10 and 5, lineWidth 2) + crosshair + "YOU" label (9px monospace).

**Animation**:
- Filtered past frames within 3600s window, capped at 12
- Pre-composited all frames (topo + radar + marker) into `ImageData` arrays
- Rendered the latest frame as the initial display
- `setInterval` at 250ms: `\x1b[{rows+2}A` cursor-up to grid start, rewrote grid + border + timestamp
- `term._radarAnim` stored on the terminal object, cleared at start of any new command

**Known Problems** (why it was scrapped for now):
1. **Artifacting**: The cursor-up redraw sometimes corrupted the header/border lines. The exact cursor position after the initial render depended on the `\r\n` vs `\n` line endings used in `term.write()` vs `term.writeln()` — xterm.js treats LF only as "move down" without carriage return, so `\r\n` must be used consistently. renderGrid used `\r\n` per line but the last line's trailing `\r\n` was either sliced off or doubled depending on the code path, shifting the border position by one line.
2. **Boundary escape**: The animation rewrite spanned `rows + 2` lines (grid + border + timestamp) but the actual occupied lines sometimes differed by 1, causing writes to bleed into the header area or beyond the box.
3. **Zoom vs detail**: At zoom 7 the radar tile covered too large an area for local weather detail. Zoom 8 caused "zoom level not supported" errors from RainViewer for some configurations.
4. **Color scheme fragility**: Scheme `0` (transparent) worked well for alpha detection but scheme `2+` (base map embedded) filled the entire grid — there was no reliable way to distinguish precipitation pixels from base map pixels without alpha.
5. **Frame count**: 12 frames × 512×512 canvas compositing + `getImageData` was heavy. Adding the edge detection pass (full Sobel over 512×512) added ~5ms per frame.
6. **Animation lifecycle**: If the user typed a command mid-animation, the `setInterval` callback could fire during the new command's output, causing mixed output. Clearing on `executeCommand` fixed the race but left stale cursor positions.

**Future Approach**: Use `wttr.in` ANSI output directly (no composite, no canvas, no animation — just fetch `wttr.in/{city}?format=%C+%t` and display the text). For radar, a static screenshot-like render with a zoom level that renders cleanly at the terminal's native resolution. Skip animation entirely until a reliable diff-based redraw strategy is found.

### Composite Commands

- `mood` — aggregates weather + last played track + GitHub streak + today's commits into one status readout. Medium effort.
- `day` — morning dashboard: weather, calendar events (if Google Calendar linked), HN top story, random fortune. Low effort once integrations exist.
- `whereis db` — geo-IP lookup via Worker + Cloudflare Trace. Replies with approximate city and ISP. Low effort.

---

## Visual Effects

### CRT Scanline Overlay
```css
body::after {
  content: '';
  position: fixed; inset: 0;
  background: repeating-linear-gradient(0deg,
    transparent, transparent 2px,
    rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px);
  pointer-events: none; z-index: 9998;
}
```
Very Low effort. Subtle, thematic retro effect.

### Chromatic Aberration on Terminal
- CSS `text-shadow` with 1px red/blue offset on `.xterm` text
- Or SVG `feColorMatrix` filter
- Very subtle CRT feel. Low effort.

### Liquid Glass Cards (from kokonutui)
- SVG `<feTurbulence>` + `<feDisplacementMap>` for realistic glass refraction
- App backdrop blur is now on a fixed `.glass-backdrop` layer (no scroll compositing)
- Upgrade project cards and section headers with SVG displacement glass
- Mouse-following refraction shift. Medium effort, very high impact.

### Flow Field Particle Background (from kokonutui)
- Replace/supplement Three.js particles with Canvas 2D flow field
- Organic noise trails in aurora/ember/ocean color themes
- Thousands of particles flowing through simplex-noise fields
- Medium effort, high impact.

### Animated Gradient Beams (from kokonutui)
- Blurred color beams drifting upward behind glass panels
- `ctx.filter = 'blur(35px)'` for soft glow
- 3 color themes matching the portfolio palette
- Low effort, medium impact.

### Noise Texture Overlay
- Subtle grain texture on glass panels via `<feTurbulence>` SVG filter
- Hides the "too clean" look of pure glass
- Popular on Apple's Liquid Glass. Low effort.

### Border Beam
- Animated conic-gradient beam traveling along container border using CSS `@property --beam-angle` + `mask-composite: exclude`
- Applied to CTA buttons (GitHub, Resume download) — instant visual pop
- Beam cycles blue → red → dim blue through host palette
- Low effort, high impact. Verified working.

### Magnetic Button Effect
- SVG inside social-link buttons follows cursor position within link bounds with spring-physics interpolation
- JavaScript: `mousemove` → `getBoundingClientRect()` → normalized offset → `requestAnimationFrame` lerp → `--mag-x`/`--mag-y` custom properties
- CSS: `transform: translate(var(--mag-x), var(--mag-y))` with `will-change: transform`
- Social link container scales to 1.18 on `mouseenter` (spring-physics via anime.js)
- Medium effort, high impact. Makes static links feel alive.

### AI Loading Spinner
- Animated emoji sequence (🌒🌓🌔🌕🌖🌗🌘) displayed during Transformers.js model loading
- Spinner replaces "Loading..." text, updates every 150ms via `setInterval`
- Cleared when AI pipeline resolves or on error
- Very low effort, medium impact. Gives user feedback during 5-15s WASM model load.

### Theme System
- 5-8 themes accessible via `theme <name>`: Dracula, Matrix (green), Amber, Ocean, Nord, default
- CSS custom properties swapped at runtime
- Persisted in localStorage
- Medium effort, high impact.

### Halation / Glow Bleed
- Simulates CRT bloom: bright elements bleed into surrounding dark areas.
- CSS `box-shadow` with `color-mix(in srgb, currentColor 60%, transparent)` on text, borders, and glowing elements.
- Subtle on white text, pronounced on bright colored elements. Very Low effort.

### Phosphor Burn-in
- Faint ghost of the boot sequence text persists for ~30s after boot, slowly fading.
- CSS `::after` on terminal body with `mix-blend-mode: difference`, animated opacity.
- Low effort. Niche retro effect that rewards repeat visitors.

### Static Interference (VHS Noise)
- Brief full-screen static burst as transition between sections.
- Canvas 2D with random pixel noise, 120ms duration.
- `Ctrl` key press also triggers subtle static. Low effort.

### Dirty Glass Smudge
- Semi-transparent SVG overlay on glass cards with blurred grease spots.
- Randomly generated at page load so no two visits look identical.
- Very low effort once NoiseTexture SVG approach is proven.

### Lens Flare on Light Elements
- Conic-gradient pseudo-elements positioned at "light source" (cursor, glowing border corners).
- Fades in/out on hover. Pure CSS. Low effort.

### Subpixel Rendering Emulation
- Slight RGB color fringing on terminal text edges (Chromatic Aberration, already listed).
- Upgrade to CSS `text-shadow: 0.5px 0 0 rgba(0,0,255,0.3), -0.5px 0 0 rgba(255,0,0,0.3);` for LCD subpixel feel.
- Very Low effort.

### Animated SVG Blobs
- Generative SVG blobs with morphing `d` attribute behind the hero terminal.
- anime.js or CSS `@property` animates path between 4-6 predefined organic shapes.
- Semi-transparent fills in blue/red palette cycle. Layer 3 blobs at different sizes/speeds.
- Medium effort. Adds organic motion behind the rigid terminal layout (sourced from YasaminAlizadeh).

### Hero Shader Displacement (WebGL)
- Custom GLSL fragment shader as hero background: fluid displacement field that distorts toward cursor position.
- Uses raw WebGL2 (not Three.js) for minimal bundle size (~10KB).
- Colors match page palette. Falls back to static gradient if WebGL unavailable.
- High effort, very high impact. Transforms the hero from static to living canvas (sourced from delowarhossain).

### Ghost Cursor / Cursor Trails
- Multiple faint cursor "ghosts" follow the real cursor with increasing delay.
- Each ghost has `opacity: 0.15→0` and slight scale. 5-8 total.
- Canvas-based overlay, or DOM divs with CSS transitions.
- Low effort, medium impact. Makes cursor feel heavy and cinematic (sourced from delowarhossain).

### Magnetic Text
- Section headings subtly shift toward cursor within a bounding radius.
- CSS custom properties + rAF lerp (same pattern as MagicCard orb).
- Maximum offset: 8-12px. Maps to tldraw hovering effect.
- Low effort. Makes otherwise static text feel responsive (sourced from delowarhossain).

### Idle State / Wait Mode
- After 30s of inactivity, terminal enters "wait mode": bouncing DVD-logo-style dvxb.io text, slow glitch pulses, or rotating ASCII art.
- Click or keypress dismisses immediately. Low effort (sourced from jasonbergh/codrops).

### Custom 404 Terminal Page
- `bash: page_not_found: command not found` in large ASCII.
- Suggest similar URLs with Levenshtein distance: "Did you mean `/projects`?"
- Full terminal prompt available on 404 page for instant re-navigation.
- Low effort, high personality (sourced from nomadicmehul / laxitajain).

### Aura Orbs
- 3 floating blurred radial gradients that drift slowly behind content sections.
- Each orb is a `::before` with `filter: blur(60px)` and `animation: auraDrift` (randomized path over 20s).
- Colors: primary blue, red, and a mix. Opacity 0.1-0.15. Very low effort (sourced from Anandhu9255).

### Interactive 3D Keyboard
- CSS 3D-transformed keyboard renders below the hero as a decorative element.
- Keys visibly depress on actual keyboard press via `:active` styles.
- Function row glows blue/red in sync with color cycle. Low-medium effort (sourced from YasaminAlizadeh).

---

## Animations

### Typewriter Boot Sequence
- Current: messages appear synchronously at 180ms intervals
- Typewriter: each character appears with variable timing (30-100ms)
- Natural variance: occasional pauses, bursts of speed
- Cursor blinks during typing
- Low effort, high impact.

### Glitch Text on dvxb.io Title
- CSS `@keyframes` with pseudo-element layering
- Random glitch bursts every 3-8 seconds
- 3 layers: primary (white), before (red offset -3px), after (blue offset 3px)
- `clip-path` inset animation for scan-line glitch effect
- Low effort, high impact.

### Scrolling Text Reveals (from kokonutui)
- Section headers fade up from translateY(20px) with blur
- Each word staggers in sequentially (50ms delay between words)
- Uses IntersectionObserver + CSS transitions
- Low effort, medium impact.

### Character-by-Character Heading Reveal
- Each letter of section `<h2>` is wrapped in a `<span>` with `display: inline-block`
- Spans start `opacity: 0; transform: translateY(20px)` — staggered in at 25ms intervals via `setTimeout` on scroll reveal
- `IntersectionObserver` with `threshold: 0.5` ensures it triggers once per heading
- Subtle premium feel. Low effort.

### Hero Entrance Animation
- Terminal panel fades in on page load with `opacity: 0 → 1`, `transform: scale(0.97 → 1)`, `filter: blur(6px → 0)`
- CSS `@keyframes heroEntrance { to { opacity: 1; transform: scale(1); filter: blur(0); } }` with 1s `var(--ease-out-expo)` 100ms delay
- `animation-fill-mode: forwards` retains final state
- Very low effort, makes page load feel intentional.

### Smooth Spotlight Tracking (RAF)
- Spotlight card `mousemove` handler drives a `requestAnimationFrame` loop with lerp factor 0.15
- Target xy from mouse event → current xy converges with spring-like smoothness
- `mouseleave` cancels RAF, resets to center
- Upgrade from raw mousemove (jittery on low-DPI screens). Low effort.

### Blur + Fade Scroll Reveal
- `.reveal` class extended with `filter: blur(4px)` transitioning to `blur(0)` on `.visible`
- Smoother entry than raw opacity + translateY alone — masks initial jank
- Still `transition: opacity 600ms, transform 600ms, filter 600ms`
- Trivial effort (one CSS property per reveal class).

### 3D Tilt Cards (from kokonutui SpotlightCards)
- Project cards rotate in 3D space toward cursor with spring-physics
- Focus-dim siblings: un-hovered cards scale to 0.96, opacity 0.5
- Shimmer sweep: gradient moves across card on hover
- Accent bottom line expands from w-0 to full width
- Medium effort, very high impact.

### Particle Burst on Click (from kokonutui)
- 6 particles burst from click point on CTA buttons
- Web Animations API — no library needed
- Low effort, medium impact.

### Mouse-Effect Cards (from kokonutui)
- Grid of dots that repel from cursor with spring physics
- Dots have breathing opacity animation
- Edge-factor for natural sparse look at borders
- Medium effort, high impact.

### Scroll Animations
- **Lenis smooth scroll** — replace native scroll (~3KB gzipped)
- **Scroll-velocity skew** — elements skew based on scroll momentum
- **Parallax with depth layers** — multiple elements at different scroll rates
- Medium effort, medium impact.

---

## Audio

### Terminal Key Clicks
- Web Audio API `OscillatorNode` + `GainNode`
- Different sounds for: letter key, backspace, enter, bell
- No audio files shipped — generated at runtime
- Toggle with `sound` command or MOTD preference
- Medium effort, high impact (polarizing — users love or hate).

### Boot Chime
- Short synthesized chime at end of boot sequence
- Web Audio API: two-tone oscillator (ascending)
- Low effort, low-medium impact.

---

## AI Integration

### `ai <prompt>` command
- Calls Cloudflare Workers AI or OpenAI API via Worker proxy
- API key stays server-side in Worker
- Stream response to terminal character-by-character
- System prompt: "You are a Unix terminal assistant..."
- Medium effort, very high impact.

### `chat` mode
- Persistent chat session in the terminal
- Alternate between command mode and chat mode; `/exit` returns to shell
- Chat history persisted in localStorage
- Medium effort, high impact.

---

## Gamification / Easter Eggs

### Achievements System
- localStorage-persisted badges
- "First command", "Konami Master", "Pipe Wizard", "Matrix Veteran", "Terminal Addict" (100 commands)
- `achievements` command to view them
- Hidden: `sudo`, `sl`, secret Konami-enhanced things
- Medium effort, medium impact.

### Snake Game
- Playable in terminal (`snake` command)
- 80x24 character grid, WASD/arrow controls, score tracking
- Medium effort, medium impact.

### Typeracer
- `type` command starts a typing test
- Measures WPM and accuracy
- Quote from FORTUNES array as source text
- Medium effort, medium impact.

### Secret Pixel Grid (/r/place)
- `/place` command shows 40x12 pixel canvas
- Arrow keys move cursor, space to place dot
- Uses ANSI block characters as pixels
- Medium effort, medium impact.

---

## Terminal Content & Portfolio

Surface portfolio content directly through the terminal — not just links to it.

| Feature | Command | Description | Effort |
|---------|---------|-------------|--------|
| **Resume viewer** | `cat resume.md` | Renders a markdown resume with ANSI headers, bullet lists, horizontal rules. Source: `~/.resume.md` in VFS. | Low |
| **Project browser** | `projects [filter]` | Lists projects from page content. `projects web` filters by tag. `projects --json` for machine output. | Low |
| **Case studies** | `case <name>` | Full case study rendered in terminal: problem, approach, tech, outcome. Source: markdown in VFS. | Medium |
| **Skill graph** | `skills` | ASCII bar chart of skill proficiency. Bars are ANSI blocks with color gradient. | Low |
| **Timeline** | `timeline` | Chronological career/education timeline as ASCII tree. Years on left, events branching right. | Low |
| **Guestbook** | `guestbook [add/list]` | Leave a message or browse all visitor messages. Persisted via Durable Object or KV. | Medium |
| **Contact form** | `contact <message>` | Sends message via Cloudflare Email Worker. Prompt for email, validate, send. | Medium |
| **Blog reader** | `blog [list/show <id>]` | Browse and read markdown blog posts. Rendered with ANSI formatting, images as links. | High |
| **Reading stats** | `stats --reading` | Total blog words read across sessions, time spent, articles completed. | Low |
| **Changelog** | `changelog` | Recent git commits displayed as a terminal-friendly changelog. Source: git log fetch via Worker. | Low |

### Markdown Rendering in Terminal

- Basic markdown → ANSI conversion: `#` → bold magenta, `##` → bold cyan, `-` → bullet with indent, `**bold**` → ANSI bold.
- Code blocks get a green border and monospace. Links show `[text](url)` with url dimmed.
- Render engine: simple regex-based converter, 200 lines. Reusable for `cat`, `blog`, `case`.
- Low effort, very high impact. Makes the terminal feel like a real content platform.

---

| Game | Command | Description | Effort |
|------|---------|-------------|--------|
| **2048** | `2048` | Slide tiles to merge powers of 2. 4×4 grid, WASD, score tracking. | Medium |
| **Tetris** | `tetris` | Classic falling blocks. 10×20 grid, WASD/arrow rotate, score + lines. | High |
| **Minesweeper** | `mines` | 9×9 grid with 10 mines. WASD nav, space to reveal, F to flag. | Medium |
| **Hangman** | `hangman` | Word guessing from fortunes dictionary. Hard mode: coding terminology only. | Low |
| **Dungeon** | `dungeon` | Text adventure. Simple 5-room map with items, doors, and a win condition. | Medium |
| **Maze** | `maze` | Generate random maze with DFS, solve with BFS. Arrow keys to walk through. | Medium |
| **Game of Life** | `life` | Conway's Game of Life on a 40×20 grid. Random seed, step/speed controls, patterns. | Medium |
| **Pong** | `pong` | Terminal pong. Player uses Q/A keys. CPU opponent. ASCII ball + paddles. | Medium |
| **Quiz** | `quiz` | 40-question frontend/tech quiz with XP system, 4 rank tiers, localStorage persistence. Multiple choice, timed. | Medium |
| **RPS** | `rps` | Rock-paper-scissors against the terminal. Best of 5. Running score. Stats. | Low |

### Interactive Adventure

- `adventure` — command-line text adventure set in your own career story.
- Start screen: character creation with trait selection (2-3 choices).
- 5-7 "chapters" based on real career milestones.
- Multiple endings depending on choices made (2-3 endings).
- Unlockable achievements per ending.
- High effort, very high impact. Makes the portfolio emotionally memorable — visitors experience your journey instead of reading it (sourced from MeeksonJr's terminal adventure game).

### Hidden Mini-Game: Inspector Mode

- Not a terminal command — a UI mode toggleable via `inspect` command or floating button.
- Once active, clicking any element on the page shows a tooltip overlay with technical implementation details.
- Powered by a data attribute lookup: `data-inspect="This card uses ::after with radial-gradient(currentColor, transparent) + blur(40px) for the orb glow."`
- Content stored in a JS map, not DOM, to keep HTML clean.
- Medium effort, high impact. Shows depth of craftsmanship and invites curiosity (sourced from MeeksonJr).

| Trigger | Reaction |
|---------|----------|
| `42` | "The answer to life, the universe, and everything." Fade in Douglas Adams quote. |
| `coffee` | "brew: illegal option -- all\nUsage: brew install caffeine\nError: no room in mug" |
| `rm -rf /` | "rm: /.bash_profile: Permission denied\nrm: /.ssh: Permission denied\n... nice try." |
| `rm -rf .` | "Congratulations, you played yourself." (no actual deletion) |
| `:(){ :\|:& };:` | The fork bomb ASCII art with a comedic "whoa there, cowboy" response |
| `make me a sandwich` | "What? Make it yourself." / "sudo make me a sandwich" → "Okay." |
| `apt-get install <anything>` | Simulated apt output ending in "0 upgraded, 0 newly installed, 0 to remove." |
| `telnet <anything>` | Star Wars ASCII animation (like the real `telnet towel.blinkenlights.nl`) |
| `kubectl` | "kubectl: command not found. Did you mean `docker`?" → "docker: command not found." |
| `vim` | ":q to exit — wait, no, :q! — ESC : q ! ENTER — okay, :wq — actually just Ctrl+Alt+Del" |
| `emacs` | "Emacs launched. Please come back in 3-5 business days while it initializes." |
| `nano` | Nano actually opens with a real simple text editor in the terminal. |
| `curl <url>` | Simulated wget-style progress bar followed by "Saved to /dev/null" (or actually fetches via fetch API). |
| `meow` / `nyan` | Cat animation with ASCII art. Multiple language variants: `cat language`, `woof`, `bark`. |
| `party` / `disco` / `rave` | Everything turns rainbow. Text cycles through hues. Re-type to disable. |
| `glitch` / `hack` | Temporary screen-wide glitch artifact burst, then return to normal. |
| `flip` / `spin` / `barrel roll` | Terminal content flips upside down, spins 360°, or barrel-rolls. CSS transform. |
| `rickroll` / `rick` | Never gonna give you up — ASCII art + lyrics in terminal. |
| `xyzzy` | "Nothing happens." / "A cold feeling passes over you." (Colossal Cave reference) |
| `iddqd` | "God mode activated. You feel invincible." Next command always succeeds with extra flair. |
| `sus` / `among us` / `amogus` | Red SUS character made of ASCII block chars. |
| `simone` | Explodes typed letters off-screen with physics animation (sourced from simoneraffaelli). |
| `dig [hint]` | Treasure hunt: search for hidden `.secrets` file in VFS. First person to find it gets a custom message. Progress saved in localStorage (sourced from laxitajain). |

### Collectibles System (Acorn Hunt)

- 5-10 hidden collectibles scattered across VFS (dotfiles, nested directories, command outputs).
- `collectibles` command shows found/total count with cryptic hints for the rest.
- Found items saved in localStorage with timestamp.
- Rewards: special ASCII art, secret commands, custom MOTD line, "completionist" badge.
- Medium effort (sourced from laxitajain's acorn hunt concept).

### Visual Mode Effects

- `party` — rainbow color cycle on all terminal text + output. Re-type `party` to toggle.
- `glitch` — brief screen corruption (CSS animation), self-clears after 2s.
- `hack` — fake "breach" sequence: hex dump → loading bars → "Access Granted."
- `ghost` — all text has `opacity: 0.6` with slight blur. Immersion mode.
- `focus` — dims all output except the last command result. Reading mode.
- All modes toggle with the same command. Persisted in localStorage. Low effort (sourced from simoneraffaelli).

---

## Infrastructure

- **Visitor counter** — Cloudflare Worker + KV for daily unique visits (IP-hashed). `visitors` command.
- **GitHub stars widget** — Worker aggregates stars across repos with 1h cache. Display in MOTD or `gh` command.
- **Lenis smooth scroll** — replace native scroll for scroll-triggered animation coherence.

---

## Developer Infrastructure

### CI / Automated Quality

| Tool | What It Does | Effort |
|------|--------------|--------|
| **Lighthouse CI** | GitHub Action running Lighthouse on every PR. Reports performance, a11y, SEO scores. | Low |
| **Bundle size tracking** | GitHub Action + status check for JS/CSS bundle deltas. Alerts on regressions. | Low |
| **Visual regression** | Playwright snapshots of hero, terminal, cards. Catches unintended CSS changes. | Medium |
| **A11y audit** | `axe-playwright` integration in CI. Scans each page section for WCAG violations. | Low |
| **HTML validator** | `html-validate` or W3C validator in CI. Catches unclosed tags, duplicate IDs. | Very Low |

### Performance Budgets

| Metric | Target | Enforcement |
|--------|--------|-------------|
| Total JS (gzip) | < 150 KB | Bundle analyzer in CI |
| Total CSS (gzip) | < 30 KB | CSS stats in CI |
| FCP | < 1.5s | Lighthouse CI |
| LCP | < 2.0s | Lighthouse CI |
| CLS | < 0.1 | Lighthouse CI |
| TBT | < 200ms | Lighthouse CI |

### Security Headers

- Add `Content-Security-Policy` header via Cloudflare Worker or Pages `_headers`.
- Strict CSP: no `unsafe-inline` for scripts (anime.js needs hashes or nonces).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Medium effort (CSP especially tricky with anime.js + inline event handlers).

### Resource Hints & Preloading

| Hint | Target | Why |
|------|--------|-----|
| `preconnect` | Google Fonts, Cloudflare CDN | Warm DNS + TLS before fetch |
| `preload` | hero-terminal CSS, fonts, anime.js | Critical render path assets |
| `prefetch` | Three.js, Transformers.js | Idle-time fetch for below-fold deps |
| `modulepreload` | `js/main.js` | ES module graph preload |

### Sitemap & Robots

- Auto-generated `sitemap.xml` from section IDs + terminal commands list. Very Low effort.
- `robots.txt` allowing all crawlers but pointing to sitemap. Very Low effort.
- `humans.txt` — standard "built by" file. Trivial.

### RSS Feed

- Generate `feed.xml` listing portfolio projects, blog posts, and changelog entries.
- If no blog yet, RSS of recent git commits + portfolio projects.
- Low effort. Increases IndieWeb credibility.

### PWA / Offline Support

- Service Worker caching strategy: Cache-first for static assets, network-first for HTML.
- `manifest.json` with theme color, display mode `standalone`, icon set.
- Offline fallback page: cached version of the terminal shell (no API-dependent features).
- Medium effort. Makes the portfolio installable on mobile home screens (sourced from anisul-islam-prog / RajdeepKushwaha5).

### Data Saver Mode

- Check `navigator.connection.saveData` and `navigator.connection.effectiveType`.
- If Data Saver ON or connection is "slow-2g"/"2g": disable Three.js particles, skip heavy anime.js scroll effects, remove noise texture overlay.
- Show subtle badge: "⚡ Data Saver — reduced animations."
- Key commands (`help`, `whoami`, `projects`) still work fully. Low effort (sourced from jasonbergh/codrops).

### DOMPurify Sanitization

- Sanitize all user-generated output (guestbook entries, contact messages, AI responses) with DOMPurify before rendering in the terminal.
- Prevents XSS via command output. Critical if accepting user input. Low effort (sourced from terminal-portfolio-website).

### SSRF Protection

- Any `curl`-like command or external fetch from the terminal needs URL validation.
- Block private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x.x.x, ::1).
- Block internal metadata endpoints (169.254.x.x, 100.x.x.x).
- Medium effort. Security-critical for Worker proxy endpoints (sourced from terminal-portfolio-website).

### `/now` Live Activity Page

- "What I'm doing right now" — fetches live GitHub events via API, shows recent commits, PRs, issues.
- Auto-refreshes every 30s. Styled as a terminal status board.
- Low-medium effort once GitHub integration exists (sourced from delowarhossain).

### `/uses` Page

- Lists hardware (laptop, monitor, keyboard), software (editor, terminal, tools), and dev environment.
- Terminal-compatible: `uses` command renders it formatted in the shell.
- Low effort. Popular personal site convention.

---

## Top 10 by Impact/Effort

| # | Idea | Effort | Impact |
|---|------|--------|--------|
| 1 | Glitch text on title | Very Low | High |
| 2 | CRT scanline overlay | Very Low | Medium |
| 3 | Typewriter boot sequence | Low | High |
| 4 | 3D tilt cards on projects | Medium | Very High |
| 5 | `weather` command | Low | High |
| 6 | Last.fm now playing | Medium | High |
| 7 | Tab completion | Medium | High |
| 8 | `figlet` command | Low | Medium |
| 9 | `hollywood` command | Low | High |
| 10 | Multiple color themes | Medium | High |
| 11 | Shell variables + piping | High | Very High |
| 12 | `hn` — Hacker News reader | Low | High |
| 13 | Guestbook + live visitor counter | Medium | High |
| 14 | Resume `cat resume.md` | Low | Medium |
| 15 | Markdown rendering engine | Low | Very High |
| 16 | CRT static transition (VHS noise) | Low | Medium |
| 17 | Performance budget + CI | Low | Medium |
| 18 | Accessibility pass (a11y) | Medium | High |
| 19 | Secret 2048 game | Medium | Medium |
| 20 | Easter egg commands | Low | Medium |
| 21 | Command palette (`⌘K`) | Medium | Very High |
| 22 | PWA + service worker | Medium | High |
| 23 | Particle text playground | Medium | High |
| 24 | Auto-correction on typos | Low | Medium |
| 25 | Data saver mode | Low | Medium |
| 26 | Hero WebGL displacement shader | High | Very High |
| 27 | Interactive adventure game | High | Very High |
| 28 | Animated SVG blobs | Medium | High |
| 29 | Ghost cursor trails | Low | Medium |
| 30 | `/now` live activity page | Medium | Medium |

---

## Accessibility

### Quick Wins (Low Effort)

| Fix | Description |
|-----|-------------|
| **Skip to content** | First focusable element after `<body>`. Skips terminal, nav, goes to about section. |
| **Focus indicator** | Visible `outline` or `box-shadow` ring on `:focus-visible` for all interactive elements. Current: removed. |
| **Terminal role** | `role="terminal"` or `role="log"` on xterm container. `aria-live="polite"` for output area. |
| **Reduced motion audit** | Verify every anime.js animation respects `prefers-reduced-motion`. Current: partial. |
| **Touch target sizes** | Ensure all buttons/links are min 44×44px interactive area. Cert badges at mobile. |
| **Color contrast** | Verify all theme combinations pass WCAG AA for text (4.5:1) and non-text (3:1). |
| **Alt text** | Cert badge icons and project card images need meaningful `alt` attributes. |
| **Focus trap** | Terminal input captures focus; need Escape to leave terminal focus trap. |

### Structural (Medium Effort)

| Feature | Description |
|---------|-------------|
| **Heading hierarchy** | Verify single `<h1>`, correct nesting (h1 → h2 → h3). Current nav + title may conflict. |
| **Landmarks** | `<header>`, `<main>`, `<nav>`, `<section>` with `aria-label` where ambiguous. |
| **Keyboard navigation map** | Document all keyboard interactions: Tab through sections, arrows in terminal, Enter to activate. |
| **Screen reader announcements** | Terminal output changes need `aria-live="polite"` updates. Boot sequence should announce completion. |
| **Focus management on command output** | After command runs, focus stays in terminal input. After closing modals/overlays, return focus to trigger. |
| **Link purpose** | "View on GitHub" links need `aria-label` with repo name. Social links need `aria-label="GitHub"` etc. |

### Terminal-Specific A11y

| Challenge | Mitigation |
|-----------|------------|
| xterm.js captures all keyboard input | Provide Escape hatch: `Ctrl+Alt` exits terminal focus. Announce to screen reader. |
| ANSI colors may not map to theme | Ensure all text output has a visible foreground color (no `default` that blends into background). |
| Matrix rain overlay obstructs content | Matrix rain should pause or dismiss on focus move or `prefers-reduced-motion`. |
| AI response streaming | Use `aria-live="assertive"` during AI stream, `aria-live="polite"` when complete. |
| Particle burst is decorative | `aria-hidden="true"` on burst canvas. |

---

- [kokonutui](https://github.com/kokonut-labs/kokonutui) — FlowField, LiquidGlassCard, SpotlightCards, MouseEffectCard, BeamsBackground, GlitchText, TypeWriter, ParticleButton, and 30+ other React components (portable to vanilla JS)
- [terminal-portfolio-website](https://github.com/SouleymaneSy7/terminal-portfolio-website) — 46 commands, 31 OKLCH themes, Web Audio key clicks, accessibility
- [TerminalWebsite](https://github.com/TomasPalsson/TerminalWebsite) — Git/vim simulation, AI chat via Bedrock, 3D elements
- [blackgolyb.github.io](https://github.com/blackgolyb/blackgolyb.github.io) — 3D WebGL CRT monitor with xterm.js inside a Three.js scene
- [tim.waldin.net](https://github.com/twaldin) — Real Docker-backed terminal via Socket.IO

---

## Magic UI Components (83 components)

### Canvas / WebGL / Shader

| Component | Description | Port Effort |
|-----------|-------------|-------------|
| **RetroGrid** | 3D perspective grid with WebGL GLSL shader, LOD, scroll animation, CSS fallback | High (866 lines, standalone WebGL) |
| **Particles** | Canvas particle system with mouse interaction, inertia, fade at edges | Low |
| **FlickeringGrid** | Canvas grid with random opacity flickering cells (glitching display) | Low |
| **GlyphMatrix** | Animated grid of randomly mutating glyphs/characters (Matrix-like) | Low |
| **IconCloud** | Interactive 3D tag cloud on canvas with Fibonacci sphere distribution | Medium |
| **Confetti** | Canvas confetti cannon via `canvas-confetti` | Low |
| **CoolMode** | DOM particle burst on click (circles, emojis, physics) | Low |
| **Globe** | Interactive 3D globe via `cobe` with city markers | Medium |

### Text Effects

| Component | Description | Port Effort |
|-----------|-------------|-------------|
| **HyperText** | Scramble/unscramble text on hover (glitch character randomizer) | Low |
| **MorphingText** | Seamless text morph/blur transition between words (SVG threshold filter) | Low |
| **AuroraText** | Animated aurora/nebula gradient text via CSS `@keyframes` | Very Low |
| **TextReveal** | Scroll-driven word-by-word fade-in via Motion `useScroll` + `useTransform` | Medium |
| **TextAnimate** | Universal text animation with 10 presets (blurIn, slideUp, scaleUp) by word/char/line | Low |
| **SparklesText** | Floating sparkle stars around text, continuously regenerating | Low |
| **WordRotate** | Vertical word rotation (slide up/down swap) | Low |
| **KineticText** | Letter weight/thickness animation on hover via CSS transitions | Low |
| **FlipText** | Character flipping animation | Low |

### Background / Patterns

| Component | Description | Port Effort |
|-----------|-------------|-------------|
| **WarpBackground** | 3D perspective grid box with animated light beams (CSS 3D transforms) | Low |
| **AnimatedGridPattern** | SVG grid with randomly pulsing square highlights | Low |
| **InteractiveGridPattern** | SVG grid where individual cells highlight on mouse hover | Low |
| **DotPattern** | SVG dot pattern background | Trivial |
| **HexagonPattern** | SVG honeycomb/hexagon grid pattern | Trivial |
| **NoiseTexture** | SVG `feTurbulence` fractal noise overlay for grain texture | Trivial |
| **Meteors** | CSS-animated meteor shower (randomized positions and speeds) | Low |
| **Ripple** | Expanding concentric circle ripple effect as background | Low |
| **LightRays** | Animated volumetric light rays emanating from top with swing effect | Low |
| **ProgressiveBlur** | Multi-layer progressively intensifying backdrop blur gradient | Low |

### Interactive Components

| Component | Description | Port Effort |
|-----------|-------------|-------------|
| **MagicCard** | Card with mouse-following spotlight/orb glow (Motion spring) | Medium |
| **Lens** | Interactive magnifying glass over content (mask-based zoom) | Low |
| **Dock** | macOS-style dock with icon magnification on hover | Medium |
| **Pointer** | Custom mouse cursor follower with scale animation | Low |
| **SmoothCursor** | Physics-based smooth cursor with velocity rotation and spring | Medium |
| **BorderBeam** | Animated beam traveling along container border (CSS `offset-path`) | Low |
| **ShineBorder** | Animated gradient sweep across borders | Low |
| **NeonGradientCard** | Card with animated neon border gradient colors | Low |
| **GlareHover** | CSS glare sweep on hover via pseudo-element gradient transition | Very Low |
| **BlurFade** | Blur + fade in on scroll with configurable direction | Low |

### Buttons (Animated)

| Component | Description | Port Effort |
|-----------|-------------|-------------|
| **ShimmerButton** | Button with rotating shimmer light | Low |
| **ShinyButton** | Button with shiny reflection effect | Low |
| **RainbowButton** | Button with animated rainbow gradient | Low |
| **PulsatingButton** | Button with expanding ring pulse | Low |
| **RippleButton** | Button with click ripple effect | Low |
| **InteractiveHoverButton** | Button with interactive hover animation | Low |
| **AnimatedSubscribeButton** | Subscribe button with icon transition animation | Low |

### Other

| Component | Description | Port Effort |
|-----------|-------------|-------------|
| **Terminal** | Terminal mockup with macOS dots and sequenced typing animation | Medium |
| **AnimatedBeam** | Animated connecting beam between two elements | Medium |
| **Marquee** | Infinite horizontal/vertical scrolling | Low |
| **ScrollProgress** | Scroll progress indicator bar | Low |
| **ScrollBasedVelocity** | Scrolling marquee that speeds up/slows down with scroll velocity | Medium |
| **AnimatedCircularProgressBar** | SVG circular progress gauge | Low |
| **PixelImage** | Pixelated image reveal (retro game style) | Medium |
| **BentoGrid** | Bento-style feature showcase grid | Low |
| **DottedMap** | SVG world dotted map with pulsing markers | Low |

---

## Galaxy UI Components (3,831 files)

All pure CSS/HTML — zero JavaScript. Sourced from [Uiverse.io](https://uiverse.io/).

| Category | Count | Best For |
|----------|-------|----------|
| Buttons | 1,231 | Hover fills, 3D extrude, shimmer, ripple, liquid bubble, glow, border draw |
| Cards | 726 | Glassmorphism, 3D tilt (25-zone CSS grid hover tracker, no JS), shimmer skeleton |
| Loaders | 718 | 3D isometric block assembly, compass/radar, book flip, delivery truck, typing scanner |
| Toggle-switches | 260 | Skeuomorphic 3D toggle, hamburger-to-X morph, sun/moon theme toggle, neumorphic |
| Inputs | 226 | Border highlight, floating label, search bar, blur glow background |
| Forms | 180 | Login forms, glassmorphism containers, floating labels |
| Checkboxes | 171 | Animated wipe/translate, scale+rotate, SVG checkmarks, border morph |
| Patterns | 103 | Conic/radial/linear gradient backgrounds, dot grids, 3D sphere illusions |
| Radio-buttons | 102 | Traffic light flicker, glassmorphism slide, animated fill |
| Tooltips | 62 | Hover reveal, animated gradient, pixel art (Super Mario), 3D border |
| Notifications | 23 | Level-up shield+wings, toast slide, success/error with progress rings |

### Top Galaxy Picks for Portfolio

| Component | File | Effect |
|-----------|------|--------|
| 3D isometric box loader | `loaders/Admin12121_black-sheep-17.html` | 8 animated isometric boxes assembling into structure |
| Piggy bank coin drop | `loaders/JkHuger_light-lion-86.html` | Full CSS-illustrated piggy bank with blinking eye and coin slot |
| Skeuomorphic toggle | `Toggle-switches/njesenberger_brave-firefox-90.html` | Realistic 3D toggle with metallic knob, green/red states |
| Level-up notification | `Notifications/StealthWorm_weak-rattlesnake-4.html` | Shield, wings, crystal, progress rings — all CSS |
| 3D box card button | `Buttons/adamgiebl_big-ape-36.html` | 5 stacked layers fan out in 3D on hover |
| Circle morph button | `Buttons/Cornerstone-04_rude-snake-92.html` | Expanding circle morphs to full background fill |
| Gold shimmer button | `Buttons/vinodjangid07_brave-treefrog-18.html` | Metallic gold gradient with shimmer animation |
| Liquid bubble button | `Buttons/cssbuttons-io_calm-tiger-42.html` | Liquid bubble rises from bottom on hover |
| 25-zone 3D tilt card | `Cards/kennyotsu_witty-deer-12.html` | Pure CSS 3D perspective tilt via 5x5 hover grid |
| Colorful price card | `Cards/Javierrocadev_brave-emu-25.html` | Multi-colored box-shadow cascade on hover |
| Rainbow dot pattern | `Patterns/BadlyWrittenStylesheet_bad-baboon-47.html` | Radial gradient mask over linear rainbow |
| Traffic light radios | `Radio-buttons/Praashoo7_mean-dodo-99.html` | Realistic recessed housing with flickering bulbs |
| Glassmorphism radios | `Radio-buttons/LilaRest_giant-jellyfish-3.html` | Glass panel with elastic slide animation |

---

## Playground System

Interactive canvas demos accessible from the terminal (inspired by simoneraffaelli's portfolio).

| Playground | Command | Description | Tech | Effort |
|------------|---------|-------------|------|--------|
| **Particle Text** | `pg particletext` | Text rendered as ~2000 individual character particles. Hover scatters them with mouse repulsion physics. Spring back on leave. Cycles through phrases. | Canvas 2D + spring physics | Medium |
| **Text Chaos** | `pg chaos` | Bouncing emoji orbs with real-time text reflow. Text flows around circular obstacles. Click to spawn orbs, drag to move, right-click to pop. | `pretext` text layout engine | Medium |
| **Neural Network Viz** | `pg nn` | Live, animated neural network with firing nodes and pulsing connections. 3-4-3 architecture. Toggle input nodes to see forward propagation. | Canvas 2D or Three.js | Medium |
| **Fluid Simulation** | `pg fluid` | WebGL2 fluid dynamics — dye and velocity fields. Move mouse to push "ink" through water. Beautiful chaotic patterns. | WebGL2 (Nvidia GPU Gems) | High |
| **Game of Life** | `pg life` | Conway's Game of Life on a 60x30 grid. Click to toggle cells. Speed controls, preset patterns (glider, pulsar, spaceship). | Canvas 2D | Low |
| **Audio Visualizer** | `pg viz` | Web Audio API generates tones → waveform + frequency bars rendered on canvas. Select waveform: sine, sawtooth, square. Adjustable frequency. | Web Audio API + Canvas | Medium |
| **Procedural City** | `pg city` | 3D cityscape generated from random seed. Buildings of varying heights, lit windows. Orbit controls. Regenerate with new seed. | Three.js | High |
| **Web Synthesizer** | `pg synth` | Playable keyboard synth. Keys map to piano notes. Select waveform, ADSR envelope. Record + playback short loops. | Web Audio API | Medium |

### Playground Infrastructure

- `pg [name]` command opens a playground in a canvas overlay over the terminal.
- `Esc` or `exit` closes playground and returns to shell.
- Each playground is a standalone ES module, lazy-loaded on first use.
- Canvas resolves CSS custom properties (OKLCH → sRGB) via a 1×1 canvas readback technique for theme awareness.
- Playgrounds are auto-registered: adding a `.js` file to `/js/playgrounds/` makes it available as `pg <filename>`.

---

### Phase 1: Foundation — Smooth Scroll + Scroll-Driven Animations

| Component | Source | Effort |
|-----------|--------|--------|
| Lenis smooth scroll | External lib (~3KB) | Drop-in |
| ProgressiveBlur — scroll-edge fade | Magic UI | Low |
| BlurFade — section entry animations | Magic UI | Low |
| TextReveal — word-by-word scroll fade | Magic UI | Medium |
| ScrollProgress — progress bar (upgrade current) | Magic UI | Low |

**Result**: Scrolling feels silky smooth, sections melt in with blur, text reveals word-by-word.

### Phase 2: Background Upgrade — Replace/Supplement Three.js Particles

| Component | Source | Effort | Vibe |
|-----------|--------|--------|------|
| FlowField — organic noise trails (aurora/ember/ocean) | kokonutui | Medium | Colorful, organic |
| Particles — mouse-interactive floating dots | Magic UI | Low | Clean, techy |
| FlickeringGrid — glitching display grid | Magic UI | Low | Hacker aesthetic |
| NoiseTexture — SVG grain overlay on glass | Magic UI | Trivial | CRT texture |
| GlyphMatrix — falling katakana (supplement matrix rain) | Magic UI | Low | Matrix vibe |

**Best combo**: Keep current Three.js particles as primary. Add NoiseTexture SVG overlay on `#app` for grain. Add FlickeringGrid as interstitial background between sections.

### Phase 3: Hero / Title — First Impression Animations

| Component | Source | Effort |
|-----------|--------|--------|
| Typewriter boot sequence | DIY/kokonutui | Low |
| GlitchText on "dvxb.io" title | Magic UI/kokonutui | Very Low |
| MorphingText — tagline cycles through words | Magic UI | Low |
| CRT scanline overlay | DIY CSS | Very Low |
| CRT power-on animation — screen flash on load | DIY | Low |

**Result**: Page loads → CRT flash → typewriter boot → title glitches intermittently → tagline morphs.

### Phase 4: Project Cards — 3D Tilt + Interactive Glass

| Component | Source | Effort |
|-----------|--------|--------|
| 3D tilt cards with spring-physics | kokonutui SpotlightCards | Medium |
| MagicCard — orb glow following mouse | Magic UI | Medium |
| BorderBeam — animated light on card border | Magic UI | Low |
| ShineBorder — gradient sweep on hover | Magic UI | Low |
| GlareHover — glare sweep on hover | Magic UI | Low |
| LiquidGlassCard — SVG displacement glass | kokonutui | Medium |

**Best combo**: Card = frosted glass + NoiseTexture. On hover: BorderBeam animates edges, GlareHover sweeps, card tilts 3D toward cursor with spring. Focus-dim siblings scale to 0.96.

### Phase 5: Navigation + Cursor

| Component | Source | Effort |
|-----------|--------|--------|
| Dock — macOS-style animated dock nav | Magic UI | Medium |
| Pointer / SmoothCursor — custom mouse cursor | Magic UI | Medium |
| MorphicNavbar — glass nav bar | kokonutui | Medium |
| Magnetic buttons — buttons attract toward cursor | DIY | Medium |

### Phase 6: CTA Button Effects

| Component | Source | Effort |
|-----------|--------|--------|
| ShimmerButton / RainbowButton / RippleButton | Magic UI | Low |
| Galaxy button effects (3D fan-out, circle morph, shimmer, liquid) | Galaxy | Very Low (CSS) |
| ParticleButton — burst on click | kokonutui | Low |

### Phase 7: Shader / WebGL Effects (shaders.se / hape.io level)

| Component | Source | Effort |
|-----------|--------|--------|
| RetroGrid — WebGL 3D perspective scrolling grid | Magic UI | High |
| Custom GLSL shader background (fluid, plasma, displacement) | Custom | High |

**RetroGrid** is 866 lines of standalone WebGL with GLSL fragment shader, LOD, and CSS fallback. Port it as a hero background. The 3D perspective grid scrolling as you scroll the page gives a similar scroll-driven feel to hape.io.

### Phase 8: Audio Layer

| Feature | Source | Effort |
|---------|--------|--------|
| Terminal key clicks (Web Audio API) | Magic UI reference | Medium |
| Boot chime (synthesized two-tone) | DIY | Low |
| Background ambient hum | DIY | Low |

### Phase 9: Mobile Optimization

See dedicated Mobile Optimization section below.

### Phase 10: Terminal Commands (from wishlist above)

Prioritize: `history`, `figlet`, `weather`, `man`, `calc`, `todo`, `hollywood`, `sl`, `gh`, `snake`, `np`.

### Phase 11: Terminal Content & Portfolio

| Feature | Based On | Effort |
|---------|----------|--------|
| Markdown → ANSI renderer | Custom (regex-based) | Low |
| `cat resume.md` | Markdown renderer | Low |
| `projects`, `case` | Markdown renderer + section content | Medium |
| `skills` — ASCII bar chart | Canvas or string builder | Low |
| `timeline` — ASCII tree | String builder | Low |
| `changelog` | GitHub API or local commit log | Low |

**Result**: Terminal becomes an actual content platform — users can browse the portfolio without ever leaving the command line.

### Phase 12: Shell Environment

| Feature | Based On | Effort |
|---------|----------|--------|
| Shell variables (`$USER`, `$PWD`, etc.) | Custom parser | Medium |
| `export VAR=val` | Variable store | Medium |
| `echo` expansion | Template parser | Medium |
| `alias` | localStorage key-value | Low |
| `which`, `env` | VFS traversal | Low |
| `cowsay`, `banner`, `yes` | Static string generators | Low |
| `watch` | setInterval loop | Low |
| Output redirect (`> file`) | VFS write | Medium |
| Piping (`command1 \| command2`) | Intermediate buffer | High |

**Result**: The terminal stops feeling like a button panel and starts feeling like a real shell.

### Phase 13: Playground System

| Feature | Based On | Effort |
|---------|----------|--------|
| Particle text playground | Canvas + physics | Medium |
| Text chaos playground | Canvas + pretext library | Medium |
| Fluid simulation playground | WebGL2 Nvidia GPU Gems | High |
| Game of Life playground | Canvas 2D | Low |
| Audio visualizer playground | Web Audio API + Canvas | Medium |
| Playground framework (lazy-load, Esc to exit, theme sync) | Custom | Medium |

**Result**: Terminal becomes a gateway to interactive demos — visitors can play with physics, audio, and WebGL without leaving the command line.

### Phase 14: Infrastructure & Polish

| Feature | Effort |
|---------|--------|
| PWA manifest + service worker | Medium |
| Data saver mode | Low |
| DOMPurify + SSRF protection | Medium |
| `/now` live activity | Medium |
| `/uses` page | Low |
| Custom terminal 404 page | Low |
| Inspector mode | Medium |
| Auto-correction + suggestion panel | Medium |
| Command palette (`⌘K`) | Medium |

**Result**: Production-grade resilience, offline capability, and discoverability. Site works on a 2G connection in data saver mode, is installable on mobile, and has no XSS surface.

---

## Real-time / WebSocket Features

Add live, collaborative, and dynamic elements via Cloudflare WebSocket or Durable Objects.

| Feature | Description | Tech | Effort |
|---------|-------------|------|--------|
| **Live visitor counter** | See how many people are on the site right now. `visitors -l` shows live count in terminal MOTD. | Durable Object + WebSocket | Medium |
| **Terminal cursor heatmap** | Anonymous aggregate of where users click/type. Displayed as overlay heatmap. | WebSocket + Canvas | Medium |
| **Collaborative terminal** | Share terminal session URL. Both users see each other's commands and output in real time. | Durable Object + WebSocket | High |
| **Live coding demo** | Broadcast keystrokes to visitors watching a "live coding" mode. Like twitch for terminal. | Durable Object + WebSocket | High |
| **Guestbook** | `guestbook add <msg>` persists to Durable Object. `guestbook` lists recent entries, visible to all. | DO + KV | Medium |
| **Anonymous polling** | `poll "best editor?" "vim" "emacs" "nano"` — live vote counts visible in terminal. | Durable Object | Medium |
| **Beat / metronome** | `beat 120` — server-synced metronome all visitors can sync to. Party trick. | Durable Object | Low |

---

## Performance

### Bundle Optimization

| Module | Current Est. | Target | Strategy |
|--------|-------------|--------|----------|
| xterm.js + addons | ~80 KB gzip | — | Essential, keep bundled. |
| Three.js | ~50 KB gzip | — | Essential for particles, keep. |
| anime.js | ~15 KB gzip | — | Already loaded. |
| Transformers.js | ~8 MB WASM | — | Dynamic import only when `ai` command is first used. |
| Motion (scroll progress) | ~5 KB gzip | — | Already loaded. |
| **Total main bundle** | ~150 KB gzip | < 120 KB | Review unused xterm addons, tree-shake anime.js. |

### Code Splitting Plan

```
main bundle (critical, loaded synchronously):
  - main.js, terminal.js, shell.js, nav.js, animations.js
  - tokens.css, base.css, layout.css, components.css, terminal.css, responsive.css

deferred (dynamic import on first interaction):
  - three-particles.js (defer until after first paint)
  - matrix-rain.js (load on Konami code only)
  - v86-launcher.js (load on v86 command only)
  - ai.js (load on ai command only) — includes full Transformers.js WASM
  - burst-canvas logic (load on first click)
```

### Caching Strategy

| Asset | Cache Strategy | Detail |
|-------|---------------|--------|
| HTML (`index.html`) | `no-cache` | Revalidate always, ETag for 304 |
| CSS/JS (versioned) | `immutable` / 1 year | `main.a1b2c3.js` — content hash in filename |
| Fonts (Google Fonts) | 1 year | Already CDN-cached |
| Images (badge icons) | 1 week | Resized + optimized via Cloudflare Image Resizing |
| Three.js (CDN) | 1 year | ES module from CDN |
| anime.js (CDN) | 1 year | ES module from CDN |

### Loading Sequence (Critical Path)

1. `preconnect` to Google Fonts, Cloudflare CDN, anime.js CDN
2. `preload` fonts, hero-terminal CSS, anime.js
3. First paint: terminal shell (visible within 1s)
4. `defer` Three.js, matrix-rain, v86, Transformers.js
5. Idle: prefetch v86 WASM binary, Transformers.js models
6. First interaction: eagerly load deferred modules

---

## Mobile Optimization

### Root-Cause Analysis

| # | Problem | Cause | Fix |
|---|---------|-------|-----|
| 1 | **Words wrap wrong / text breaks layout** | No `overflow-wrap: break-word` or `word-break` on `.about-text`, `.spotlight-card p`, and other text containers. Long URLs or technical terms overflow. | `overflow-wrap: break-word; word-break: break-word;` on all text content containers. |
| 2 | **Touch targets focused on buttons, no scroll points** | `#hero-target` has `height: 100vh` with terminal filling entire viewport. Terminal captures touch events. | `touch-action: pan-y` on terminal container. Add visual scroll indicator (down arrow) below terminal on mobile. |
| 3 | **Sections have `min-height: 100vh`** creating massive gaps | Every section forced to full viewport. Contact and Resume look empty on mobile. | `section:not(#hero-target):not(#about) { min-height: auto; }` on mobile. |
| 4 | **Terminal doesn't re-fit on orientation change** | xterm FitAddon only fires on load. | Add orientationchange handler to re-fit terminal. |
| 5 | **Terminal font too small on cramped screens** | 12px at 768px breakpoint, no smaller breakpoint. | Decrease to 10px at < 480px. Reduce xterm line-height proportionally. |
| 6 | **Touch targets below minimum size** | Cert badges are 60x60px at 480px breakpoint (below 44x44px minimum). | Ensure all interactive elements are min 44x44px touch target. Increase padding on mobile. |
| 7 | **Terminal input hidden by mobile keyboard** | No visualViewport resize handling. Terminal doesn't scroll into view when keyboard opens. | Listen for `visualViewport` resize events. Scroll terminal into view. |

### Priority Mobile Fixes (Quick Wins)

1. `overflow-wrap: break-word` on all text containers
2. `min-height: auto` on mobile for Resume/Contact sections
3. `touch-action: pan-y` on terminal container
4. Decrease terminal font to 10px on < 480px screens
5. Re-fit terminal on orientation change

### Mobile Media Queries to Add

```css
/* Add to responsive.css */

/* General overflow fix */
html, body {
  overflow-x: hidden;
  width: 100%;
}

/* Text wrapping on all text containers */
.about-text, .spotlight-card p, .bento-card p, .cert-name {
  overflow-wrap: break-word;
  word-break: break-word;
}

/* Reduce section heights on mobile */
@media (max-width: 768px) {
  section:not(#hero-target):not(#about) {
    min-height: auto;
  }
  .terminal-body {
    touch-action: pan-y;
  }
}

@media (max-width: 480px) {
  .terminal-body {
    font-size: 10px;
  }
}
```

---

## Current Design System Reference

### Color Tokens (tokens.css)

```css
--color-glass: oklch(0.09 0.008 260 / 0.20);
--color-glass-hover: oklch(0.14 0.012 260 / 0.32);
--color-glass-border: oklch(0.2 0.02 260 / 0.35);
--color-terminal-bg: oklch(0.06 0.005 260 / 0.12);
--color-terminal-border: oklch(0.18 0.015 260 / 0.5);
--font-display: 'Space Grotesk', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', 'Menlo', monospace;
```

### Key CSS Files

| File | Purpose |
|------|---------|
| `css/tokens.css` | Design tokens, CSS custom properties, font stacks |
| `css/base.css` | Reset, gradient utilities, section-header, progress-bar, matrix-rain |
| `css/layout.css` | #app, sections, grid layouts, hero-shell, about-grid, section-header |
| `css/components.css` | Spotlight cards, cert badges, social grid, bento grid, scrollbar |
| `css/terminal.css` | Terminal window frame, header, dots, title, clock, body, xterm overrides |
| `css/responsive.css` | Media queries for 1024px, 768px, 480px, prefers-reduced-motion |

### Key JS Files

| File | Purpose |
|------|---------|
| `js/main.js` | Entry point, Konami code, matrix rain trigger, clock update |
| `js/shell.js` | VFS, commands, neofetch, boot sequence, fortunes, history |
| `js/terminal.js` | xterm.js setup, handleInput, arrow key history, v86 mode |
| `js/matrix-rain.js` | Full-screen katakana rain canvas overlay |
| `js/three-particles.js` | WebGL2 particle system with GPU tier detection, rainbow mode |
| `js/nav.js` | Nav dots, active tracking via Motion scroll |
| `js/animations.js` | Anime.js scroll reveals, card effects |
| `js/v86-launcher.js` | Buildroot Linux VM booter |
| `js/matrix-rain.js` | Matrix rain overlay |

---

## Sources / Additional References

- [Magic UI](https://github.com/magicuidesign/magicui) — 83 React components: Particles, RetroGrid (WebGL), HyperText, MorphingText, BorderBeam, MagicCard, Dock, ShimmerButton, NoiseTexture, ProgressiveBlur, and 73 more
- [Galaxy UI](https://github.com/nicepkg/galaxy) — 3,831 pure CSS components: 1,231 buttons, 726 cards, 718 loaders, 103 patterns, and more. All zero-JS drop-in HTML+CSS.
- [hape.io](https://www.awwwards.com/sites/hape) — OGL WebGL micro-framework with custom PBR rendering, scroll-driven 3D camera control, custom cursor, music-synced animations, high-fashion aesthetic
- [shader.se](https://shader.se) — Three.js + React Three Fiber + TSL on WebGPU pipeline. Scroll-driven scene transitions dissolve seamlessly. Everything rendered in-canvas including UI via `@pmndrs/uikit`. 80s corporate tape aesthetic.
- [Lenis](https://github.com/darkroomengineering/lenis) — Smooth scroll library (~3KB), 2026 standard for premium scroll experiences
- [OGL](https://github.com/oframe/ogl) — Minimal WebGL library (used by hape.io). Custom PBR rendering, skinning, post-process.
- [tmux](https://github.com/tmux/tmux) — Terminal multiplexer. Inspiration for split-pane terminal UX in browser.
- [wttr.in](https://github.com/chubin/wttr.in) — Console-oriented weather service. The gold standard for terminal weather UX.
- [towel.blinkenlights.nl](https://github.com/martinhansen/towel) — Star Wars ASCII animation over telnet. Easter egg inspiration.
- [tldr-pages](https://github.com/tldr-pages/tldr) — Simplified man pages. Inspiration for `man` command content format.
- [khriztianmoreno.com](https://github.com/khriztianmoreno/khriztianmoreno.com) — Terminal portfolio with `⌘K` command palette, virtual filesystem, dark/light themes, `top`-style project view.
- [simoneraffaelli portfolio](https://github.com/simoneraffaelli/portfolio) — Playground system with particle text + text chaos, command-driven UX, 30+ easter eggs. Terminal with canvas demos.
- [laxitajain/.dev](https://github.com/laxitajain/.dev) — Linux terminal portfolio with acorn collectibles, VFS navigation (`ls`/`cd`/`cat`/`tree`), fastfetch boot, hidden dotfiles.
- [MeeksonJr/mo-portfolio-2025](https://github.com/MeeksonJr/mo-portfolio-2025) — Terminal adventure game with character creation + multiple endings, AI chatbots (Gemini/Groq), inspector mode.
- [nomadicmehul](https://github.com/nomadicmehul/nomadicmehul.github.io) — Terminal portfolio theme with Matrix rain, CRT scanlines, zero dependencies, `config.json` personalization.
- [blackgolyb](https://github.com/blackgolyb/blackgolyb.github.io) — 3D WebGL CRT monitor with barrel distortion, xterm.js inside a Three.js scene. Source for CRT immersion ideas.
- [Anandhu9255](https://github.com/Anandhu9255/Portfolio-website-personal) — Anime-VFX-inspired React portfolio with particle backgrounds, typewriter hero, rotating skill rings, aura orbs.
- [YasaminAlizadeh](https://github.com/YasaminAlizadeh/my-portfolio) — Generative anime.js SVG blobs + interactive 3D CSS keyboard. Source for organic background ideas.
- [delowarhossain.dev](https://github.com/mdhossain-2437/Creative-Folio) — Awwwards-grade portfolio with custom GLSL hero shader, magnetic text, ghost cursors, smooth WebGL.
- [jasonbergh.com](https://tympanus.net/codrops/2026/02/20/cinematic-presence-the-directors-cut-of-the-jason-bergh-experience/) — Cinematic Codrops feature: wait mode, viewfinder mask, audio-synced text reveal, data saver mode.
- [Anshuman-Tripathi](https://github.com/Anshuman-Tripathi-minato/Portfolio) — Agentic AI portfolio with dual-element cursor trails + canvas generative backgrounds. Source for cursor effects.
- [Th3-C0der playground](https://github.com/Th3-C0der/th3-c0der.github.io) — 40+ interactive experiments: neural network viz, fluid sim, procedural city, web synth, retro games.
