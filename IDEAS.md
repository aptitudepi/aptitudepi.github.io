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

## Implementation Phases

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
