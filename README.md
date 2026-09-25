# I'M DOG?

*A Day in the Life of Moke.* A cozy, funny third-person browser game about an ordinary day as Moke,
a small white Maltipoo. No combat, no death: just socks, smells, naps and a very big living room.

**Status:** Phase 1 complete: the technical prototype (tag `phase-1-complete`). Phase 2 complete: the Moke character foundation
(tag `phase-2-complete`, [docs/PHASE_2.md](docs/PHASE_2.md)). The game is ready for a final rigged, animated `moke.glb`, which still has
to be made. Until then, a soft, stylized stand-in Moke modelled on the real dog (curly white
coat, dark eyes, black button nose, blue collar) trots, runs and sneaks around a cozy, true-scale living room: linen couch, rug, coffee table he can
duck under, TV console, lamp, plant, and his bed in the window's sun, plus a short hallway. He can jump up onto the couch and coffee table, bark, growl, do tricks, sniff,
carry his sock and toys, and nap in his bed. A low dog-height camera follows him and avoids walls and furniture.

**Phase 3 (built, awaiting review and a real-phone test, [docs/PHASE_3.md](docs/PHASE_3.md)):** **Sock Heist**, the
first complete loop. Steal the sock, get noticed ("Hey! That's my sock!"), dodge a very un-scary chase round the
furniture, hide, then trade the sock for a treat and discover SOCK = TREAT. Plus **touch controls** for phones and
tablets in the same web game (portrait or landscape), phone quality presets, and Add to Home Screen.
See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).

**Play it:** https://christopher-013.github.io/im-dog/ (desktop Chrome or Edge; keyboard + mouse or a standard controller). Every push to `main`
rebuilds and republishes it through GitHub Actions (`.github/workflows/deploy-pages.yml`). Since Phase 3 it
also runs in phone and tablet browsers (touch controls, portrait or landscape).

## Requirements
- Node.js **22.12+** (tested with Node 24) and npm
- A desktop browser with WebGL 2: Chrome or Edge first; Firefox and Safari should work. Phones and tablets: iPhone
  Safari and Android Chrome are the targets, not yet tested on a physical device ([docs/MOBILE.md](docs/MOBILE.md)).

## Install & run
```bash
npm install
npm run dev          # http://localhost:5173
npm run dev:lan      # the same, reachable from a phone on your Wi-Fi (trusted networks only)
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
WASD move · Mouse look · Wheel zoom · Shift run · C walk · Space jump · E interact · F bark or growl · Q trick · R sniff · Esc pause · ` debug panel.
Touch: left thumb joystick (push past the ring to run) · drag the right side to look · tap the paw to interact, hold
it for jump, bark or growl, trick and run · pause. All listed controls are implemented. See [docs/CONTROLS.md](docs/CONTROLS.md).

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
[Phase 2 scope](docs/PHASE_2.md) · [Phase 3 scope](docs/PHASE_3.md) · [Sock Heist](docs/SOCK_HEIST.md) ·
[Mobile](docs/MOBILE.md) · [Architecture](docs/ARCHITECTURE.md) · [Decisions](docs/DECISIONS.md) ·
[Moke reference](docs/MOKE_CHARACTER_REFERENCE.md) · [Moke 3D spec](docs/MOKE_3D_SPEC.md) ·
[Moke integration](docs/MOKE_INTEGRATION.md) · [Assets & licenses](docs/ASSETS.md) · [Controls](docs/CONTROLS.md)

**Coding agents** (Codex, Claude Code): start with [AGENTS.md](AGENTS.md). Claude Code also reads [CLAUDE.md](CLAUDE.md).
