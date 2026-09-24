# I'M DOG?

*A Day in the Life of Moke.* A cozy, funny third-person browser game about an ordinary day as Moke,
a small white Maltipoo. No combat, no death: just socks, smells, naps and a very big living room.

**Status:** Phase 1, Milestone 1 (foundation). There's a start screen and a true-scale greybox room you can look
around at dog height. Moke himself arrives in Milestone 2.

## Requirements
- Node.js **22.12+** (tested with Node 24) and npm
- A desktop browser with WebGL 2: Chrome or Edge first; Firefox and Safari should work

## Install & run
```bash
npm install
npm run dev          # http://localhost:5173
```

## Build & check
```bash
npm run typecheck    # TypeScript, strict
npm test             # unit tests (Vitest)
npm run build        # typecheck + production build to dist/ + private-photo leak check
npm run preview      # serve dist/ at http://localhost:4173
```
`dist/` is a plain static site (relative paths) that can go on GitHub Pages, Cloudflare Pages, Netlify or Vercel.

## Controls
WASD move · Mouse look · Shift run · E interact · F bark · Q sniff · Esc pause · ` debug panel.
In Milestone 1 only mouse look, Esc and the debug panel do anything. See [docs/CONTROLS.md](docs/CONTROLS.md).

## Project layout
```
src/            game code (see docs/ARCHITECTURE.md)
  config/       every tunable number: renderer, input, world scale, assets
public/         static files served as-is (runtime assets go in public/assets/)
docs/           design, scope, architecture, Moke reference, assets, controls
reference/moke/ PRIVATE photos of the real Moke (git-ignored, never bundled)
scripts/        build helpers
```

## Docs
[Game design](docs/GAME_DESIGN.md) · [Phase 1 scope](docs/PHASE_1.md) · [Architecture](docs/ARCHITECTURE.md) ·
[Moke reference](docs/MOKE_CHARACTER_REFERENCE.md) · [Assets & licenses](docs/ASSETS.md) · [Controls](docs/CONTROLS.md)
