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

### UX Enhancements

- **Tab completion** — autocomplete commands on Tab with cycling through matches. Override xterm.js default Tab behavior. Medium effort, high impact.
- **`Ctrl+R` reverse search** — incremental search through CMD_HISTORY. Standard bash behavior. Medium effort, high impact.
- **Command auto-suggest** — ghost text showing most likely completion (like fish shell). Right arrow or Ctrl+F accepts. Medium effort.
- **`stats` command** — commands run, uptime, keys pressed, fortune count. localStorage-persisted counters. Low effort.

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
- Currently sections use basic `backdrop-filter: blur(16px)`
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

### Theme System
- 5-8 themes accessible via `theme <name>`: Dracula, Matrix (green), Amber, Ocean, Nord, default
- CSS custom properties swapped at runtime
- Persisted in localStorage
- Medium effort, high impact.

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

## Infrastructure

- **Visitor counter** — Cloudflare Worker + KV for daily unique visits (IP-hashed). `visitors` command.
- **GitHub stars widget** — Worker aggregates stars across repos with 1h cache. Display in MOTD or `gh` command.
- **Lenis smooth scroll** — replace native scroll for scroll-triggered animation coherence.

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

---

## Sources / References

- [kokonutui](https://github.com/kokonut-labs/kokonutui) — FlowField, LiquidGlassCard, SpotlightCards, MouseEffectCard, BeamsBackground, GlitchText, TypeWriter, ParticleButton, and 30+ other React components (portable to vanilla JS)
- [terminal-portfolio-website](https://github.com/SouleymaneSy7/terminal-portfolio-website) — 46 commands, 31 OKLCH themes, Web Audio key clicks, accessibility
- [TerminalWebsite](https://github.com/TomasPalsson/TerminalWebsite) — Git/vim simulation, AI chat via Bedrock, 3D elements
- [blackgolyb.github.io](https://github.com/blackgolyb/blackgolyb.github.io) — 3D WebGL CRT monitor with xterm.js inside a Three.js scene
- [tim.waldin.net](https://github.com/twaldin) — Real Docker-backed terminal via Socket.IO
