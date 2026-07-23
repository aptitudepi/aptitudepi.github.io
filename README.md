# [dvxb.io](https://dvxb.io) — Devkumar Banerjee

Personal portfolio featuring a browser-based x86 virtual machine, retro terminal UI, and interactive shell with 25+ commands.

## Features

- **Interactive terminal** — Built with [xterm.js](https://xtermjs.org/). Supports 25+ commands (whoami, neofetch, cat, ls, vm, echo, clear, history, crt, noise, weather, hn, md, about, fortune, cowsay, matrix, ai, etc.) with ANSI truecolor output, tab completion, command auto-correction, and a virtual filesystem.
- **x86 VM in browser** — Uses the [v86](https://github.com/copy/v86) WebAssembly emulator to boot a Buildroot Linux image. Runs in the terminal with full serial console. Type `vm` to start.
- **Neofetch-style dashboard** — Displays ASCII art (pixel portrait), system info, resume highlights (education, research, work, skills, certs), and a 16-color block palette on boot and via `neofetch` / `cv`.
- **Local AI assistant** — Type `ai <prompt>` to run Transformers.js (WASM/WebGPU) models directly in-browser. No server round-trip. `ai-models` lists available models.
- **Hacker News reader** — `hn` fetches and displays the top 30 HN stories with scores and comment counts in a formatted ANSI table.
- **Weather forecast** — `weather` fetches your location (browser geolocation or IP fallback) and displays current conditions from Open-Meteo. `-f` for Fahrenheit.
- **Markdown viewer** — `md <url>` opens any markdown URL in a fullscreen rendered viewer (marked + DOMPurify, dark theme, GFM).
- **CRT / noise overlays** — `crt` toggles scanline overlay, `noise` toggles SVG turbulence grain texture for a retro CRT feel.
- **Buildroot Linux VM** — Boots a real Linux kernel inside the terminal. Networking via HTTP fetch backend (no raw TCP). 9p virtio filesystem mounts `/mnt` from a static rootfs.
- **3D particle background** — Three.js GPU-accelerated particle system with connection lines, mouse interaction, and shader-based rendering.
- **Scroll animations** — Anime.js powers section reveals on scroll, social link hover effects, skill bar fill animations, and magnetic text.
- **Aura orbs** — Floating blurred radial gradients that drift behind content sections via CSS animations.
- **Projects section** — 4 spotlight cards (TheAggieMap, PCPG Analyzer, Doctor-Robot/TIDALHack, Neural-Networks-From-Scratch) with 3D tilt hover, shimmer sweep, and "View More on GitHub" links.
- **Contact section** — GitHub, LinkedIn, Keybase, CV (PDF), and GPG public key download.
- **Responsive design** — CSS token-based design system with mobile breakpoints.

## Architecture

### Project Structure

```
├── index.html              Main page
├── css/
│   ├── tokens.css          Design tokens (colors, spacing, typography)
│   ├── base.css            Reset, global styles
│   ├── components.css      Section styles (hero, projects, contact, etc.)
│   ├── layout.css          Grid, sidebar, footer
│   ├── terminal.css        Terminal container, xterm overrides
│   └── responsive.css      Media queries
├── js/
│   ├── main.js             Entry point — initializes all modules
│   ├── terminal.js         xterm.js setup, mode switching (local/v86)
│   ├── shell.js            Virtual filesystem, command handler, neofetch, ASCII art
│   ├── v86-launcher.js     v86 config, boot/stop VM, serial I/O
│   ├── three-particles.js  Three.js particle system
│   ├── animations.js       Anime.js scroll reveals, hover effects, skill bars
│   └── nav.js              Section navigation, scroll spy, mobile menu
├── assets/
│   ├── resume.pdf          CV download
│   ├── gpg.asc             GPG public key
│   └── v86/
│       ├── v86_all.js      v86 emulator library
│       ├── v86.wasm        v86 WebAssembly binary
│       ├── seabios.bin     BIOS firmware
│       ├── vgabios.bin     VGA BIOS firmware
│       ├── buildroot-bzimage.bin  Buildroot Linux kernel + initrd
│       ├── 9p-rootfs/      9p virtio shared filesystem
│       │   ├── src/        Source files for rootfs
│       │   ├── out/        Generated fs.json + .bin blobs
│       │   └── rebuild.sh  Regenerate out/ from src/
│       └── cors-proxy-worker.js  Cloudflare Worker for VM HTTP networking
```

### Terminal Shell (`js/shell.js`)

- **Virtual filesystem** — A `Map` of paths to content strings (e.g., `/home/devkumar/about.txt`). Supports `cat` and `ls`.
- **Commands (25+)**: whoami, hostname, date, uptime, pwd, uname, cat, ls, echo, clear, neofetch, resfetch, about, fortune, cowsay, help, history, crt, noise, weather, hn, md, cv, matrix, vm, ai, ai-models
- **Neofetch** — Renders ASCII art alongside system and resume info lines. The art is a 52-row pixel portrait with per-pixel ANSI true color.
- **Boot sequence** — On page load, prints simulated kernel messages, then runs neofetch and shows the prompt.
- **Auto-correction** — Mistyped commands are caught with Levenshtein distance ≤ 2 and suggest the closest match.
- **Tab completion** — Tab cycles through command names, VFS paths, and `./`-prefixed files. Bell on no match.
- **Command history** — Up/down arrows cycle through previous commands. `history` prints the full list.

### x86 VM (`js/v86-launcher.js`)

- Uses the V86 constructor with WASM, a 64MB heap, NE2000 network via `fetch` backend, 9p filesystem from a static JSON manifest, and BIOS/VGA BIOS/kernel images.
- Serial I/O: `serial0-output-byte` callback writes to xterm, `serial0-input` sends keystrokes (including control characters) from the terminal.
- Ctrl+C, Ctrl+D, and other control codes pass through to the VM's serial port.
- The 9p `host9p on /mnt` boot message is cosmetic — the mount succeeds despite the duplicate-attempt warning.

### Networking

- The VM uses the v86 `fetch` network backend, which proxies HTTP/HTTPS through the browser's `fetch()` API.
- A Cloudflare Worker (`cors-proxy-worker.js`) deployed at `0.supernovadkb.workers.dev` acts as a CORS proxy, restricted by origin allowlist (`dvxb.io`, `*.dvxb.io`, `localhost:*`).
- Only HTTP/HTTPS is supported — raw TCP (telnet, SSH) is not available due to browser `fetch()` limitations.

### 3D Particles (`js/three-particles.js`)

- Renders 600 particles with velocity, age, and seed attributes per vertex in a custom BufferGeometry.
- Two shader programs: update (position/velocity integration) and render (smooth circles with fading).
- Mouse hover creates a repulsion/attraction force. Connection lines drawn between nearby particles.
- Uses a GPU `transformFeedback` pattern for all computation on the GPU — no CPU physics loop.

### Animations (`js/animations.js`)

- `reveal` elements fade up in a staggered cascade via `IntersectionObserver`.
- Skill bars animate from 0 to target width with Anime.js `scale` transforms.
- Social links spring-scale on hover.
- **Magnetic text** — Section headings subtly shift toward cursor with lerped spring physics via `requestAnimationFrame`.
- **Aura orbs** — Per-section `::before`/`::after` radial gradients with `filter: blur(60px)` and slow CSS drift animation.
- **Galaxy button circle-morph** — Contact buttons morph from circle to full-width on click with Anime.js.
- **MagicCard 3D tilt** — Project cards rotate toward cursor with spring physics, sibling dimming, and shimmer sweep.

### CSS Architecture

Token-based design: `tokens.css` defines color palette (slate-gray, blue, violet, green), spacing scale (4px base), font stack, and breakpoints. Component styles import these tokens via CSS custom properties.

## Running Locally

```sh
python3 -m http.server 8000
# Open http://localhost:8000
```

No build step required — the site uses ES module `<script type="module">` natively.

## VM Filesystem

The 9p rootfs is compiled from `assets/v86/9p-rootfs/src/`. After modifying source files:

```sh
cd assets/v86/9p-rootfs
./rebuild.sh
```

This regenerates `out/fs.json` and `out/*.bin` (content-addressed blobs).

## Deployment

Deployed via GitHub Pages from the `main` branch with a custom domain (`dvxb.io`) and CNAME record.

---

Built with [v86](https://github.com/copy/v86), [xterm.js](https://xtermjs.org/), [Three.js](https://threejs.org/), [Anime.js](https://animejs.com/), and [Cloudflare Workers](https://workers.cloudflare.com/).
