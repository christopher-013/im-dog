# I'M DOG?

*A Day in the Life of Moke.* A cozy, funny third-person browser game about an ordinary day as Moke,
a small white Maltipoo. No combat, no death: just socks, smells, naps and a very big living room.

**Status:** Phase 1, Milestone 2 (basic Moke character). A placeholder Moke trots, runs and sneaks around a
true-scale greybox room, with Rapier collision (he fits under the coffee table). The camera is still a simple
temporary one. See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).

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
WASD move · Mouse look · Shift run · C walk · E interact · F bark · Q sniff · Esc pause · ` debug panel.
Interact, bark and sniff arrive in later milestones. See [docs/CONTROLS.md](docs/CONTROLS.md).

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
