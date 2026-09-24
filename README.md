# I'M DOG?

*A Day in the Life of Moke.* A cozy, funny third-person browser game about an ordinary day as Moke,
a small white Maltipoo. No combat, no death: just socks, smells, naps and a very big living room.

**Status:** Phase 1, Milestone 10 (polish) in progress. A soft, stylized Moke modelled on the real dog (curly white
coat, dark eyes, black button nose, blue collar) trots, runs and sneaks around a cozy, true-scale living room: linen couch, rug, coffee table he can
duck under, TV console, lamp, plant, and his bed in the window's sun, plus a short hallway. He can bark, growl, do tricks, sniff,
carry his sock and toys, and nap in his bed. A low dog-height camera follows him and avoids walls and furniture.
See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).

**Play it:** https://christopher-013.github.io/im-dog/ (desktop Chrome or Edge; keyboard + mouse or a standard controller). Every push to `main`
rebuilds and republishes it through GitHub Actions (`.github/workflows/deploy-pages.yml`).

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
WASD move · Mouse look · Wheel zoom · Shift run · C walk · E interact · F bark · G growl · Q trick · R sniff · Esc pause · ` debug panel.
All listed controls are implemented. See [docs/CONTROLS.md](docs/CONTROLS.md).

## Project layout
```
src/            game code (see docs/ARCHITECTURE.md)
  config/       every tunable number: movement feel, input, renderer, world scale, assets
public/         static files served as-is (runtime assets go in public/assets/)
docs/           design, scope, architecture, Moke reference, assets, controls
reference/moke/ PRIVATE photos of the real Moke (git-ignored, never bundled)
scripts/        build helpers
```

## Docs
[Current state](docs/CURRENT_STATE.md) · [Game design](docs/GAME_DESIGN.md) · [Phase 1 scope](docs/PHASE_1.md) ·
[Architecture](docs/ARCHITECTURE.md) · [Decisions](docs/DECISIONS.md) · [Moke reference](docs/MOKE_CHARACTER_REFERENCE.md) ·
[Assets & licenses](docs/ASSETS.md) · [Controls](docs/CONTROLS.md)

**Coding agents** (Codex, Claude Code): start with [AGENTS.md](AGENTS.md). Claude Code also reads [CLAUDE.md](CLAUDE.md).
