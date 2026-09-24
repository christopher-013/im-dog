# I'M DOG? — Current Development State

_Last updated: 2026-09-23. Repo: private `christopher-013/im-dog`, branch `main`. Milestone 2 is committed; see `git log` for the latest commit._

## Current Phase
Phase 1

## Current Milestone
Milestone 2 (basic Moke character) is complete and awaiting owner review and a hands-on playtest. Milestone 3 has not started.

## Last Developer
Claude Code

## Completed
**Milestone 1: foundation.**
- Vite + strict TypeScript + three.js, Vitest, static build.
- Loading screen with progress; start menu with the original I'M DOG? identity; controls dialog; pause/resume; error screen.
- State machine (loading → menu → playing ⇄ paused) and a fixed 60 Hz step.
- Resize/DPR-aware renderer; action-based input with pointer lock and a drag-to-look fallback.
- AssetManager with missing-file fallbacks; debug panel; the private-photo guards.
- Temporary greybox room and warm lighting.

**Milestone 2: basic Moke character.**
- **Rapier physics (0.20):** loaded lazily behind the loading screen, stepped every fixed step. The greybox room's
  floor, walls, couch and coffee table are colliders derived from their meshes (18 colliders).
- **Placeholder Moke** (`PlaceholderDogVisual`): original geometry echoing the reference analysis.
  - Look: round lumpy "cotton" head, topknot, cream-tinted drop ears, dark wide-set eyes with catchlights, black button nose, pom tail carried high.
  - Procedural animation: leg swing with paw lift (trot diagonals, bounding run), body bob, lean into turns, head lead,
    ear bounce, tail wag, tongue out at a run, breathing.
- **Movement** (`Locomotion` + `MokeController`):
  - Gaits: trot by default (1.8 m/s), run with Shift (4.0 m/s), walk/sneak with C (0.8 m/s).
  - Smooth acceleration and deceleration, plus braking for sharp turns.
  - Turn-rate-limited facing: quick pivots when slow, wider arcs at a run; reversals are brake → pivot → go.
  - He never moves backwards or sideways relative to his facing.
- **Collision:** stops at walls and furniture and slides along them at glancing angles. He walks under the coffee
  table (0.40 m clearance) and ducks there. He can't climb the couch.
- **Camera-relative controls:** W is away from the camera. The temporary preview camera now orbits **and follows** Moke.
- **Interpolation:** the visual and camera are smoothed between fixed steps, for high-refresh displays.
- **Idle personality:** glances around, occasional curious head tilt, tail wag, breathing.
- **Debug panel:** new Moke section (position, actual vs. target speed, gait, heading, turn rate, grounded,
  headroom, duck) and Physics section (Rapier version, colliders, bodies).
- **Dev-only live tuning** from the browser console: `tuning.movement.runSpeed = 5`, etc.

## Current Architecture
- `Game` owns the scene, renderer, input, physics, UI and state machine. Frame order:
  1. input
  2. global keys
  3. fixed steps: camera-relative `MoveIntent` → `Moke.fixedUpdate` → `PhysicsWorld.step`
  4. `Moke.update` (interpolate + animate)
  5. camera
  6. render
  7. debug
- The Moke data flow is one-way: `MokeController` (gameplay: `Locomotion` + `CharacterBody`) → `MokeAnimationController`
  (plain numbers) → `MokeVisual`. Gameplay never touches meshes. `createMokeVisual()` is the only place that picks a visual.
- `physics/` wraps Rapier: `PhysicsWorld` (world, static boxes) and `CharacterBody` (kinematic capsule plus Rapier's character controller).
- All tuning is in `src/config/`: `movement.ts` (feel and capsule), `animation.ts` (body language), `input.ts` (bindings), `engine.ts`, `world.ts`.
- Temporary pieces:
  - `PreviewOrbitCamera`, to be replaced by `ThirdPersonCamera` in Milestone 3.
  - `FoundationStage`, to be replaced by `LivingRoom` in Milestone 4.
  - `PlaceholderDogVisual`, until `moke.glb` exists.
- Details: `docs/ARCHITECTURE.md`.

## Current Gameplay State
- The game loads, and the placeholder Moke idles in the room behind the start menu.
- After PLAY, Moke trots, runs and walks. Measured in the browser with scripted key holds:
  - trot 1.8 m/s, run 4.0 m/s, walk 0.8 m/s;
  - 0 → run in about 0.45 s; run → stop in about 0.36 s (about 0.7 m);
  - 180° reversal from a trot: brake to 0 in about 0.1 s, full trot the other way by about 0.35 s.
- Walls, couch and table legs block him. He slides along walls at glancing angles, and walked under the coffee
  table with headroom 0.40 m while visibly ducking.
- Mouse look works through drag-to-look in the embedded test browser. Pointer lock is still unconfirmed with a
  physical mouse (see Known Issues).
- No console errors or warnings on a fresh dev load or in the production preview.
- **Movement feel has not yet been judged hands-on with a real keyboard.** It's tuned by numbers and automated checks only.

## Known Issues
Carried over from Milestone 1 (not addressed in Milestone 2):
- During the final "Ready!" loading frame, the start menu is faintly visible behind the loading overlay, creating a doubled logo and ghosted buttons.
- Pointer lock did not engage during automated browser testing. It needs manual confirmation with a physical mouse.
- An automated test reported approximately 28–35 FPS at 1920×953. Claude's Milestone 2 measurements disagree, so recheck manually:
  - about 1.5 ms per frame (render, synchronous) at 1280×720 and 2.1 ms at 2560×1440, with Moke in the scene;
  - 0.022 ms per fixed step (Moke + Rapier);
  - 138–165 FPS live in the embedded browser, on a GTX 1660 SUPER.
- Hidden screens may need improved accessibility handling using `aria-hidden` or `inert`.

New in Milestone 2:
- **The camera has no collision yet (Milestone 3).** When Moke backs toward a wall, or runs at the camera near a
  wall, the camera passes through it and the view becomes a flat wall colour.
- Moke's nose and tail can poke a few centimetres into walls: the collision capsule is round, the dog is long.
- The walk/sneak key is **C**, a new choice. Ctrl is unsafe (Ctrl+W closes the tab) and Alt focuses the browser menu.
- Moke's real size is still an estimate (0.28 m shoulder). A measurement would let us confirm the scale and the capsule.

## Verification Status
Run on 2026-09-23 at the end of Milestone 2:

| Command / check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass: 7 files, 55 tests, including Rapier integration tests |
| `npm run build` | Pass. Main bundle 657 kB (170 kB gzipped); Rapier chunk 2,854 kB (1,094 kB gzipped), lazy-loaded. `verify-dist`: 13 files, no private photos. |
| Dev server, browser | Menu → PLAY → trot/run/walk, reversal, walls, sliding, under-table ducking, pause. No console errors on a fresh load. |
| Production preview (`npm run preview`), browser | Loads the menu; all files return 200 including the Rapier chunk; no console messages. |
| Not verified | Hands-on feel with a physical keyboard and mouse; pointer lock; Firefox and Safari; a real high-DPI display. |

## Important Files
- `AGENTS.md`, `CLAUDE.md`, and in `docs/`: `PHASE_1.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `CONTROLS.md`.
- `src/config/movement.ts`: **movement feel.** Start here when tuning.
- `src/config/animation.ts`, `src/config/input.ts`.
- `src/player/`: `Locomotion.ts`, `MokeController.ts`, `MokeAnimationController.ts`, `MokeVisual.ts`, `PlaceholderDogVisual.ts`, `Moke.ts`.
- `src/physics/`: `PhysicsWorld.ts`, `CharacterBody.ts`.
- `src/core/Game.ts`: state machine, frame order, move intent, debug sections.
- `src/camera/PreviewOrbitCamera.ts`: temporary follow/orbit camera.
- `src/world/FoundationStage.ts`: temporary greybox room and its colliders.

## Next Recommended Task
1. The owner playtests Milestone 2 with a physical keyboard and mouse, and we tune `src/config/movement.ts` together.
2. After approval, Milestone 3: a third-person camera with collision/obstacle avoidance and tuning. This also fixes the see-through-walls issue.
