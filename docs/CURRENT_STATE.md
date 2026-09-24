# I'M DOG? — Current Development State

_Last updated: 2026-09-24. Repo: private `christopher-013/im-dog`, overnight branch `claude/milestones-5-9-qagq4b` (draft PR against `main`). See `git log` for the latest commit, and `git status` for anything uncommitted._

## Current Phase
Phase 1

## Current Milestone
Overnight run (owner decision 2026-09-24): Milestones 5 → 9 in order on the branch above; M10 is not started.
Milestones 5 (interaction framework) and 6 (sock) are complete and awaiting owner review. The owner's hands-on playtest of
Milestones 2–4 (movement, camera and room) is still pending.

## Last Developer
Claude Code

## Completed
**Milestone 1: foundation.**
- Vite + strict TypeScript + three.js, Vitest, static build.
- Original I'M DOG? screens; state machine; fixed 60 Hz step; resize/DPR-aware renderer; action-based input.
- Asset fallbacks, debug panel, private-photo guards.

**Milestone 2: basic Moke character.**
- Rapier physics; placeholder Moke with procedural animation and idle personality.
- Trot / run (Shift) / walk (C); smooth acceleration, braking and turning; collision; ducking under furniture.

**Milestone 3: third-person camera.**
- Low dog-height orbit with smoothed follow and wheel zoom.
- Swept-sphere collision (walls always win); side-stepping and lifting away from walls; flattening under low furniture.
- Auto-follow; WASD direction lock while keys are held (`MoveBasis`); sensitivity/invert settings.

**Milestone 4: living room** (`LivingRoom`, which replaces the temporary greybox).
- **The room:** a furnished 7 × 6 m living room at true human scale, echoing Moke's real home.
  - An oatmeal linen couch with leaf-print, grey-lattice and mustard pillows.
  - A patterned round rug, and a walnut coffee table (with books, a mug and a remote) that Moke can duck under.
  - A walnut TV console with a TV; a brass floor lamp with a glowing shade and warm light; an oak side table.
  - A potted plant, framed wall art, curtains, and a garden view through the window.
  - **Moke's bed** sits in the window's sun, open at the front.
- **The hallway:** a short hallway through a doorway, with a runner, a closed door at the end and a ceiling light.
  It's there for movement and camera testing in tight spaces.
- **Textures:** original procedural canvas textures (floorboards, rug, pillows, art, garden), deterministic and with no image files.
- **Cheap to draw:** `StaticSceneBuilder` merges static parts by material, so the room is 44 meshes. It also derives
  colliders (33 in total) from parts or simple boxes.
- **Lighting:** hemisphere fill + window sun (shadows now cover the hallway too), soft image-based reflections
  (`RoomEnvironment`), a lamp point light and a hallway point light. The balance is in `config/engine.ts`.
- `LivingRoom.landmarks` names key spots (bed, bed front, under the table, hallway) for tests and later milestones.

**Milestone 5: interaction framework.**
- `Interactable` (id, type, label, distance, enabled, position, facing/priority, callback) and `InteractionSystem`
  (registry; picks the target Moke is near and facing; priority; no flicker between close rivals).
- Contextual prompt overlay ("E — Pick Up Sock" style), hidden outside play. E triggers the current target.
- Debug panel section "Interaction" (registered count, current target and distance).
- No interactable is registered yet in M5 itself; the sock (M6) is the first.

**Milestone 6: sock.**
- A coral sock with mustard stripes lies on the rug (`landmarks.sock`). "E — Pick Up Sock" → it rides crosswise in
  his mouth (`mouthSocket`); he can walk, turn and run with it (head up, happier tail, tongue hidden).
- "E — Drop Sock" drops it just ahead of his mouth with some of his momentum; Rapier makes it fall and settle.
- Generic `PickupSystem` / `Carryable` and `Prop` / `PropBody`: the ball and toy (M7) reuse them unchanged.
- The sock doesn't collide with Moke (he walks over it); nothing collides with the camera.
- Debug panel: "carrying" in the Interaction section; Physics shows the extra bodies.

## Current Architecture
- `Game` owns the scene, renderer, input, physics, UI and state machine. Frame order:
  1. input
  2. global keys
  3. fixed steps: `MoveBasis` → `MoveIntent` → `Moke.fixedUpdate` → `PhysicsWorld.step`
  4. `Moke.update`
  5. `ThirdPersonCamera.update`
  6. render
  7. debug
- **Moke:** `MokeController` → `MokeAnimationController` → `MokeVisual` (placeholder). Gameplay never touches meshes.
- **Physics:** `PhysicsWorld` (static boxes with collision layers, `sweepSphere`) and `CharacterBody` (kinematic capsule).
- **World:**
  - `LivingRoom` (shell, layout, spawn, landmarks) is built from `furniture.ts` pieces via `StaticSceneBuilder`.
  - Palette in `materials.ts`, textures in `textures.ts`.
  - `RoomLighting` plus `applySoftEnvironment`.
- **Tuning** is in `src/config/`: `movement.ts`, `camera.ts`, `animation.ts`, `input.ts`, `engine.ts` (including the lighting balance), `world.ts`.
- **Temporary:** `PlaceholderDogVisual` (until `moke.glb`).
- Details: `docs/ARCHITECTURE.md` ("The living room" section).

## Current Gameplay State
Verified in the browser (dev server and a production-build load):
- The menu shows the furnished room behind the logo.
- **In play:** the view behind Moke shows the couch, pillows, coffee table, lamp glow, art, plant, side table and rug.
- **Window:** the garden shows through the window, framed by curtains, and Moke's bed sits beside it.
- **Hallway:** Moke walks through the doorway to the hallway runner. The camera looks down the hallway at full
  distance without clipping, and the closed door is visible at the end.
- **Navigation** (Rapier tests):
  - From spawn he reaches his bed through its open side, gets under the table (ducking) and walks to the hallway end.
  - The couch and TV console block him.
- **Performance:** about 2.2 ms per frame (render, synchronous) at 1280×720 and 3.6 ms at 2560×1440; about 102 draw calls including shadows.
- **Console:** no messages on a fresh production load.
- **Not yet judged hands-on with a physical mouse and keyboard.**

## Known Issues
Carried over:
- During the final "Ready!" loading frame, the start menu is faintly visible behind the loading overlay (doubled logo, ghosted buttons).
- Pointer lock is untested with a physical mouse (the embedded test browser uses drag-to-look).
- An automated test once reported 28–35 FPS at 1920×953. Claude's measurements (above) disagree, so recheck manually.
- Hidden screens may need improved accessibility handling (`aria-hidden` / `inert`).
- Moke's nose and tail can poke a few centimetres into walls; the walk key C is unconfirmed; Moke's real size is still an estimate.
- The camera turns by itself in a few situations (intentional, tunable) and needs the owner's feel check.

New in Milestone 4:
- The potted plant looks a little sparse and spiky. It could be lusher in the polish milestone.
- The window's sun patch is fairly subtle under the brighter room lighting.
- There's no ambient occlusion (a post-processing choice), so contact areas under furniture are softer than in a film look.
- The tennis ball and dog toy arrive with Milestone 7.

## Verification Status
Run on 2026-09-24 at the end of Milestone 4:

| Command / check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass: 13 files, 98 tests (new: `StaticSceneBuilder` ×5, `LivingRoom` navigation ×6) |
| `npm run build` | Pass, no warnings. Main bundle 709 kB (186 kB gzipped); Rapier chunk unchanged. `verify-dist`: no private photos. |
| Dev server, browser | Menu, couch view, window view and hallway walk, as above. The frames were driven via `imdog.frame()` where the hidden pane paused rendering. |
| Production preview, browser | Fresh load, all files 200, no console messages, PLAY works. |
| Not verified | Hands-on feel; pointer lock; Firefox and Safari; a real high-DPI display. |

## Important Files
- `AGENTS.md`, `CLAUDE.md`, and in `docs/`: `PHASE_1.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `CONTROLS.md`.
- `src/world/LivingRoom.ts` (layout, landmarks), `furniture.ts`, `materials.ts`, `textures.ts`, `StaticSceneBuilder.ts`, `RoomLighting.ts`.
- `src/config/`: `movement.ts`, `camera.ts` and `engine.ts` (lighting balance).
- `src/camera/ThirdPersonCamera.ts`, `src/player/`, `src/physics/`, `src/core/Game.ts`.

## Next Recommended Task
1. The owner playtests Milestones 2–4 in Chrome with a physical mouse and keyboard, including pointer lock. We tune feel and look together.
2. After approval, Milestone 5: a reusable interaction framework (`Interactable`, `InteractionSystem`) with
   contextual prompts ("E — Pick Up Sock").
