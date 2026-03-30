# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ripple Games** is a static website serving as a game studio portfolio and WebGL game platform. It showcases socially conscious indie games, currently featuring **CHOMPO-CALYPSE** — an e-waste education game built with Unity for UNDP Georgia Accelerator Lab.

There is no build system, no package manager, and no backend. The site is deployed as a static site (Netlify, based on `_headers`).

## Running Locally

Serve the root directory with any static file server:

```bash
python -m http.server 8080
# or
npx http-server . -p 8080
```

Open `http://localhost:8080` — do not open `index.html` directly in a browser as Unity WebGL requires HTTP headers set in `_headers`.

## Architecture

### Pages
- `index.html` — Homepage: hero, featured game card, Swiper carousel, team, contact
- `game-chompo-calypse.html` — Game wrapper with fullscreen + canvas resize logic
- `search.html` — Tag-based search (reads `?q=` URL param, currently template only)

### Game Integration (`game-chompo-calypse.html`)
The Unity WebGL game lives at `/webgl/chompocalypse/` (Unity 6000.0.47f1 build). It is embedded via `<iframe>`. Key JS logic in the wrapper:
- **Canvas resizer/patcher**: syncs Unity's backing canvas to the current viewport, handling mobile URL bar changes and orientation switches
- **DPR cap** (`DPR_CAP: 1.5`): prevents extreme resolution scaling on HiDPI displays
- **Fullscreen API**: cross-browser fullscreen toggle on the iframe container

### Static Assets
- `css/styles.css` — Single stylesheet; uses CSS variables (`--accent: #DC4A26`), `clamp()` for fluid type, breakpoints at 900px/768px/300px
- `fonts/` — Self-hosted FiraGO (body/heavy) and Barberchop (display)
- `img/` — All images; game card thumbnails in `img/game-cards/`

### Hosting Config (`_headers`)
Sets correct MIME types and Brotli compression headers for Unity WebGL assets (`.wasm`, `.data`, `.js` served as `unityweb`). These headers are critical — the game won't load without them on a production host.

### External Dependencies
- **Swiper.js v12** via CDN — carousel on the homepage only

## Updating the Game Build

Replace files in `/webgl/chompocalypse/Build/` with new Unity WebGL export output. The loader filename is referenced in `/webgl/chompocalypse/index.html` — update it if Unity regenerates it with a new hash. The backup of the current build is in `/webgl/chompocalypse - current/`.
