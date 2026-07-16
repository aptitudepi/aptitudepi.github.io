# Ideas

## Now Playing (Spotify / Last.fm)

- **Last.fm** — free API key, `user.getrecenttracks` returns current track. Proxy through Cloudflare Worker so key stays server-side. Display in MOTD or `np` command.
- **Spotify** — OAuth + refresh token flow on a Worker. More complex but gives album art and precise playback state.
- **YouTube Music** — no public API for now-playing, not practical.

## Retro Terminal Polish

- **CRT scanline overlay** — subtle CSS pseudo-element with repeating gradient + rgb split on text.
- **Typewriter effect** — character-by-character output for certain commands.
- **CRT power-on animation** — quick screen-wipe on page load.
- **Terminal cursor glow** — CSS box-shadow on the xterm block cursor.

## New Commands

- **`figlet`** — bundle a small ASCII font, render text client-side.
- **`weather`** — fetch from wttr.in or proxy OpenWeatherMap.
- **`man <cmd>`** — man pages for each command (content already exists in help text).
- **`gh`** — recent GitHub activity via public API, cached via Worker.
- **`calc`** — safe expression evaluator.
- **`hollywood`** — fake hacking terminal frenzy (endless scrolling gibberish).
- **`sl`** — steam locomotive when you mistype `ls`.

## Gamification / Easter Eggs

- Typeracer, hidden achievements, secret commands.
- Sound effects via Web Audio API (terminal beep on boot, key clicks).

## Infrastructure

- **Visitor counter** — Worker + KV for daily unique visits.
- **GitHub stars widget** — aggregate stars across repos.
