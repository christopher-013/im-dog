# I'M DOG? — Current Development State

_Last updated: 2026-09-23. Repo: private `christopher-013/im-dog`, branch `main`. Milestone 3 is committed; see `git log` for the latest commit._

## Current Phase
Phase 1

## Current Milestone
Milestone 3 (third-person camera) is complete and awaiting owner review. The owner's hands-on playtest of
Milestones 2 and 3 (movement and camera feel) is still pending. Milestone 4 has not started.

## Last Developer
Claude Code

## Completed
**Milestone 1: foundation.**
- Vite + strict TypeScript + three.js, Vitest, static build.
- Loading and start screens with the original I'M DOG? identity; controls dialog; pause; error screen.
- State machine, fixed 60 Hz step, resize/DPR-aware renderer, action-based input.
- Asset fallbacks, debug panel, the private-photo guards, and the temporary greybox room.

**Milestone 2: basic Moke character.**
- Rapier physics.
- Placeholder Moke with procedural animation and idle personality.
- Trot (default), run (Shift), walk/sneak (C), with smooth acceleration, braking and turn-limited facing.
- Collision with walls and furniture; he ducks under the coffee table.

**Milestone 3: third-person camera** (`ThirdPersonCamera`, which replaces the temporary preview camera).
- Low, dog-height orbit: about 1.35 m back and 0.63 m high by default. Mouse orbit with clamped pitch; smoothed follow (never parented).
- **Mouse-wheel zoom,** 0.7–2.6 m.
- **Collision:** a swept sphere against Rapier world geometry. It pulls in instantly and eases back out; walls always win.
  Thin table legs and Moke's own body are ignored, via collision layers.
- **Wall avoidance ("whiskers"):** when squeezed and the mouse is idle, it drifts sideways to open space.
  Otherwise it lifts up and over Moke without wobbling. If walls force the camera inside him, he's hidden for that moment.
- **Tight spaces:** under the coffee table, the pivot drops and the camera flattens into a level shot underneath.
- **Auto-follow:** drifts behind Moke while he moves and the mouse is idle. Not when he runs toward the camera.
- **Re-centres** behind Moke when PLAY is pressed.
- **Stable controls:** the WASD direction is locked while keys are held (`MoveBasis`). Automatic camera motion never bends his path; only the player's mouse turns do.
- **Settings:** pause-screen mouse-sensitivity slider (0.25–3×) and invert-Y, remembered in localStorage (safe if storage is blocked).
- **Field of view** widens slightly at a run.
- All camera tuning is in `src/config/camera.ts`, and live in dev via `tuning.camera`.

## Current Architecture
- `Game` owns the scene, renderer, input, physics, UI and state machine. Frame order:
  1. input
  2. global keys
  3. fixed steps: `MoveBasis` → camera-relative `MoveIntent` → `Moke.fixedUpdate` → `PhysicsWorld.step`
  4. `Moke.update` (interpolate + animate)
  5. `ThirdPersonCamera.update` (and hide Moke if the camera is inside him)
  6. render
  7. debug
- **Moke:** `MokeController` (gameplay) → `MokeAnimationController` (plain numbers) → `MokeVisual` (placeholder). Gameplay never touches meshes.
- **Physics:** `PhysicsWorld` (static boxes with collision layers, `sweepSphere` for the camera) and `CharacterBody` (kinematic capsule).
- **Camera:** it talks to physics only through the `CameraCollider` interface, so it's unit-tested with a fake.
- **Tuning** is in `src/config/`: `movement.ts`, `camera.ts`, `animation.ts`, `input.ts`, `engine.ts`, `world.ts`.
- **Temporary pieces:** `FoundationStage` (to be replaced by `LivingRoom` in Milestone 4) and `PlaceholderDogVisual` (until `moke.glb`).
- Details: `docs/ARCHITECTURE.md`.

## Current Gameplay State
Verified in the browser (scripted input on the dev server, plus a production-build load):
- The game loads. PLAY swings the camera behind Moke. Movement works as in Milestone 2.
- **Backed into a wall** (Moke facing the front wall, camera trapped behind him): the camera stops at the wall
  face (never inside it). Once the mouse is idle, it swings to a side view at full distance.
- **Under the coffee table:** Moke ducks; the camera drops to a level shot about 0.27 m high and stays underneath.
- **Next to the couch** with the camera turned so the couch is behind him: the camera stays in front of the couch,
  never inside it. When idle, it slides round to a clear side angle.
- **Zoom:** the wheel reaches the 0.7 m minimum. Zooming out stops where a wall limits it (2.40 m toward the front wall in this room).
- **Holding D with the mouse idle:** Moke runs dead straight while the camera swings smoothly behind him.
- **Pause settings:** the slider and invert-Y apply immediately and survive a reload. The test values were cleared afterward.
- No console errors on a fresh load, dev or production.
  - Stale errors from mid-edit hot-reloads can linger in an old tab's console; always check a fresh tab.
- **Not yet judged hands-on with a physical mouse and keyboard.**

## Known Issues
Carried over (not addressed in Milestone 3):
- During the final "Ready!" loading frame, the start menu is faintly visible behind the loading overlay, creating a doubled logo and ghosted buttons.
- **Pointer lock has still only been tested where it's unavailable** (the embedded test browser uses drag-to-look). It needs a physical-mouse check in Chrome.
- An automated test reported approximately 28–35 FPS at 1920×953. Claude's measurements disagree, so recheck manually:
  - about 1.5 ms per frame (render) at 1280×720 and 2.1 ms at 2560×1440;
  - 0.022 ms per fixed step;
  - 4.5–7.3 µs per camera update;
  - 138–165 FPS live in the embedded browser, on a GTX 1660 SUPER.
- Hidden screens may need improved accessibility handling using `aria-hidden` or `inert`.
- Moke's nose and tail can poke a few centimetres into walls (the collision capsule is round).
- The walk/sneak key is C (Ctrl is unsafe because Ctrl+W closes the tab), which is unconfirmed with the owner.
- Moke's real size is still an estimate (0.28 m shoulder).

New in Milestone 3:
- **The camera turns by itself in a few situations:** auto-follow while moving, whiskers near walls, recentring on PLAY.
  - This is intentional and tunable in `config/camera.ts` (`autoFollow.strength = 0` disables auto-follow).
  - Whether it feels helpful or intrusive needs the owner's playtest.
- The room is only 6 m deep, so the 2.6 m maximum zoom is often capped by walls. That's expected.

## Verification Status
Run on 2026-09-23 at the end of Milestone 3:

| Command / check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass: 11 files, 87 tests |
| `npm run build` | Pass, no warnings. Main bundle 664 kB (173 kB gzipped); Rapier chunk 2,854 kB (1,094 kB gzipped). `verify-dist`: no private photos. |
| Dev server, browser | Wall, table, couch, zoom, auto-follow and direction lock, pause settings, as described above. Some checks drove `imdog.frame()` directly, because the hidden browser pane pauses `requestAnimationFrame`. |
| Production preview, browser | Fresh load: all files 200, no console messages, PLAY enters play, settings present. |
| Not verified | Hands-on feel with a physical keyboard and mouse; pointer lock; Firefox and Safari; a real high-DPI display. |

## Important Files
- `AGENTS.md`, `CLAUDE.md`, and in `docs/`: `PHASE_1.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `CONTROLS.md`.
- `src/config/camera.ts`: **camera feel.** `src/config/movement.ts`: **movement feel.**
- `src/camera/ThirdPersonCamera.ts`, `src/camera/MoveBasis.ts`.
- `src/player/`: `Locomotion.ts`, `MokeController.ts`, `MokeAnimationController.ts`, `MokeVisual.ts`, `PlaceholderDogVisual.ts`, `Moke.ts`.
- `src/physics/`: `PhysicsWorld.ts`, `CharacterBody.ts`, `collisionGroups.ts`.
- `src/core/Game.ts` (frame order, move intent, camera target, debug sections); `src/core/PlayerSettings.ts`.
- `src/world/FoundationStage.ts`: temporary greybox room and its colliders.

## Next Recommended Task
1. The owner playtests Milestones 2 and 3 with a physical keyboard and mouse in Chrome, including a pointer-lock
   check. We tune `src/config/movement.ts` and `src/config/camera.ts` together.
2. After approval, Milestone 4: the stylized living room (replacing the greybox), with colliders and lighting.
