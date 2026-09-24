# I'M DOG? — Current Development State

_Last updated: 2026-09-23. Repo: private `christopher-013/im-dog`, branch `main`, last commit `24a59bf` ("Milestone 1: project foundation")._

## Current Phase
Phase 1

## Current Milestone
Milestone 1 complete. Milestone 2 has not started.

## Last Developer
Claude Code

## Completed
- Vite + TypeScript (strict) + three.js project, with Vitest unit tests and a static production build using relative paths.
- **Loading screen** with real progress (asset preload, then shader precompile).
- **Start menu** with the original I'M DOG? identity (Fredoka lettering, Moke-face "O", tilting "?", katakana tag), PLAY and CONTROLS.
- **Controls dialog**, generated from `src/config/input.ts`. Actions not built yet are marked "soon".
- **Pause/resume** (Esc, or losing pointer lock) and an **error screen** (e.g. WebGL 2 unavailable).
- **Game state machine:** loading → menu → playing ⇄ paused.
- **Fixed 60 Hz simulation step.** `Game.fixedUpdate` is still an empty hook; there is no simulation yet.
- **Renderer:** resizes with its container and DPR (capped at 2), Neutral tone mapping, soft PCF shadows, shader precompile.
- **Input:**
  - Action-based bindings.
  - Pointer lock with a drag-to-look fallback.
  - Keys released on blur.
  - Recovers a key's code from `key` when `code` is empty.
- **AssetManager:** loads by URL and tolerates missing files. The manifest is currently empty.
- **Debug panel:** backquote key or `?debug`. Shows FPS, frame times, draw calls, triangles, state, pointer lock, input and camera.
- **Temporary Milestone 1 scene:**
  - A greybox living room at true scale (`FoundationStage`): walls, window with a sunlit patch, couch with pillows, coffee table, rug.
  - Warm lighting (`RoomLighting`).
  - A preview camera orbiting Moke's future spawn point at dog height (`PreviewOrbitCamera`).
- **Private reference guards:** `.gitignore`, a Vite plugin blocking imports from `reference/`, dev server `fs.deny`, and a post-build leak scan.
- **Docs:** README, AGENTS/CLAUDE, and the docs in `docs/` (game design, Phase 1, architecture, decisions, Moke character reference, assets, controls).

## Current Architecture
- `src/main.ts` creates the `UIManager` (DOM overlays; markup in `index.html`), then `Game`.
- `Game` owns the scene, camera, `GameRenderer`, `InputManager`, `AssetManager`, `DebugPanel` and the state machine. Each frame:
  1. `input.beginFrame`
  2. global keys
  3. `FixedStep.advance`, only while playing
  4. preview camera
  5. render
  6. debug panel
- `InputState` is DOM-free and unit-tested. `InputManager` does the DOM wiring and pointer lock.
- All tunables live in `src/config/` (`engine`, `input`, `world`, `assets`).
- `FoundationStage` and `PreviewOrbitCamera` are temporary. They'll be replaced by `LivingRoom` (Milestone 4) and `ThirdPersonCamera` (Milestone 3).
- Not built yet: the player/Moke controller and visual, interactions, scent, physics (Rapier not installed) and audio.
- Details: `docs/ARCHITECTURE.md`.

## Current Gameplay State
- The game loads successfully.
- The start menu, controls dialog, play transition, pause, resume and debug panel work.
- The stylized living room renders successfully. It's the temporary greybox `FoundationStage`, not the final Milestone 4 room.
- Camera rotation works through mouse dragging.
- Walking and gameplay movement are intentionally deferred to Milestone 2. There's no Moke character in the scene yet.
- No console warnings or runtime errors were observed during the browser playtest.

## Known Issues
Recorded from playtesting. Not fixed yet.
- During the final "Ready!" loading frame, the start menu is faintly visible behind the loading overlay, creating a doubled logo and ghosted buttons.
- Pointer lock did not engage during automated browser testing. This needs manual confirmation with a physical mouse, because automation may interfere with pointer lock.
- The debug panel reported approximately 28–35 FPS at 1920×953 during automated testing. Automation and screenshot capture may affect this result, so performance should be rechecked manually.
  - For comparison, Claude's Milestone 1 benchmark measured about 1.1 ms per frame at 1280×720 and 2.6 ms at 2560×1440 on a GTX 1660 SUPER. That's CPU+GPU with synchronous renders, not live FPS.
- Hidden screens may need improved accessibility handling using `aria-hidden` or `inert`.

## Verification Status
Run on 2026-09-23, during the shared-workflow documentation task:

| Command | Result |
|---|---|
| `npm run typecheck` | Pass (app + `vite.config.ts`) |
| `npm test` | Pass: 4 files, 27 tests |
| `npm run build` | Pass. `verify-dist`: 12 files checked against 9 private reference files, none leaked. JS bundle hash unchanged from the Milestone 1 build (no code changed). |

- **Browser:** not re-run in this task, which changed documentation only. The gameplay state above comes from the browser playtest.
- **Milestone 1 browser checks** (Claude, built-in browser, dev and preview servers) also found no console errors.
- **Not yet verified:**
  - pointer lock with a physical mouse
  - Firefox and Safari
  - a real high-DPI display

## Important Files
- `AGENTS.md`, `CLAUDE.md`: agent instructions.
- `docs/PHASE_1.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/MOKE_CHARACTER_REFERENCE.md`, `docs/ASSETS.md`, `docs/CONTROLS.md`.
- `src/core/Game.ts`: state machine and frame loop.
- `src/core/GameLoop.ts`, `src/core/GameRenderer.ts`, `src/core/InputState.ts`, `src/core/InputManager.ts`, `src/core/AssetManager.ts`.
- `src/config/*.ts`: every tunable number and binding.
- `src/ui/UIManager.ts`, `src/ui/DebugPanel.ts`, `index.html`, `src/styles/main.css`: UI and visual identity.
- `src/world/FoundationStage.ts`, `src/world/RoomLighting.ts`, `src/camera/PreviewOrbitCamera.ts`: temporary scene and camera.
- `vite.config.ts`, `scripts/verify-dist.mjs`: build and private-photo guards.

## Next Recommended Task
Prepare and implement only Milestone 2, after the shared workflow is committed and independently reviewed.
