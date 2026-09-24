# Architecture

Browser game: **TypeScript + three.js + Vite**, HTML/CSS overlays for UI. No framework, no backend.

## Dependencies (kept minimal)
| Package | Why |
|---|---|
| `three` (runtime) | Rendering, scene graph, glTF loading |
| `@fontsource-variable/fredoka` (runtime) | Self-hosted OFL display font for the original UI identity; no third-party font CDN |
| `@dimforge/rapier3d-compat` (runtime) | Physics and collision (Rapier, WASM embedded). Loaded lazily into its own chunk. See "Physics". |
| `vite`, `typescript` (dev) | Dev server, bundling, type-checking |
| `vitest` (dev) | Unit tests for gameplay logic without a browser |
| `@types/three`, `@types/node` (dev) | Types |

## Source layout
```
src/
  main.ts                 entry: creates UIManager, then Game; shows a friendly error if startup fails
  config/                 ALL tunable numbers live here
    engine.ts             renderer, lens, fixed timestep
    input.ts              actions, key bindings, mouse sensitivity, control hints
    movement.ts           Moke's movement feel (speeds, acceleration, turning) + collision capsule
    animation.ts          body-language tuning (lean, idle looks, tail, ducking)
    world.ts              world scale: Moke's size, furniture heights
    assets.ts             asset manifest (preloaded behind the loading screen)
  core/
    Game.ts               state machine + frame orchestration
    GameLoop.ts           FixedStep accumulator + rAF loop
    GameRenderer.ts       WebGLRenderer, resize/DPR handling, context loss
    InputState.ts         DOM-free input logic (tested)
    InputManager.ts       DOM wiring: keyboard, mouse, pointer lock
    AssetManager.ts       runtime asset loading with graceful fallbacks (tested)
  player/
    Locomotion.ts         pure movement model: speed, heading, gaits (tested; no three/Rapier)
    MokeController.ts     gameplay body: locomotion + collision + interpolation (tested with real Rapier)
    MokeAnimationController.ts  model-independent body language: lean, idle looks/tilts, tail, ducking (tested)
    MokeVisual.ts         the visual interface + createMokeVisual() factory
    PlaceholderDogVisual.ts  TEMPORARY stand-in dog, animated procedurally
    Moke.ts               composite: controller + animation + visual
  physics/
    PhysicsWorld.ts       Rapier world (lazy WASM load), static box colliders
    CharacterBody.ts      kinematic capsule driven by Rapier's character controller
  camera/PreviewOrbitCamera.ts   TEMPORARY: orbits and follows Moke, no collision. Replaced by ThirdPersonCamera in M3
  world/
    RoomLighting.ts       hemisphere fill + window sun with soft shadows
    FoundationStage.ts    TEMPORARY: true-scale greybox + its colliders. Replaced by LivingRoom in M4
  ui/
    UIManager.ts          screens, controls dialog, toast, hints
    DebugPanel.ts         ` overlay + FrameStats
  styles/main.css
  utils/math.ts           clamp, damp, lerp, smoothstep, moveToward, angle helpers
```
Planned additions follow the brief: `interactions/`, `senses/`, `audio/`.

## Game states and the frame
`loading → menu → playing ⇄ paused` (in `Game.ts`). Each rendered frame:

1. `input.beginFrame()` latches key presses/releases and mouse delta for the frame.
2. Global keys: debug toggle, pause.
3. `FixedStep.advance(dt)` runs gameplay/physics at **60 Hz fixed** (0 steps while not playing). Each step:
   build a camera-relative move intent → `Moke.fixedUpdate` → `PhysicsWorld.step`.
4. `Moke.update(dt, alpha)`: place the visual between the last two steps (interpolation) and animate it.
5. Camera update at display rate (follows Moke's interpolated position).
6. Render, then debug panel (refreshes 5×/s, only while visible).

**Why fixed timestep:** movement feel (acceleration, turn rate) and physics must be identical at 60/144/240 Hz.
`advance()` returns an interpolation alpha so visuals can be smoothed between steps. Frame deltas are clamped to
100 ms, and the backlog is dropped after 6 steps, so a tab switch never causes a jump or a death spiral.

## Input
- Gameplay reads **actions** (`bark`, `interact`, …), never keys. Bindings use `KeyboardEvent.code`, the physical
  position, so WASD works on AZERTY too. If `code` is empty (some remote-desktop/synthetic events), it's recovered from `key`.
- Presses are latched per rendered frame: a tap shorter than a frame is never missed or double-counted.
- Pointer lock requests raw (`unadjustedMovement`) input, falling back to normal lock. If lock is unavailable
  (embedded browsers, Chrome's ~1 s cooldown after Esc), play continues with a "click to look" hint and drag-to-look.
- Keys release on window blur/tab hide (no stuck movement). Bound keys only `preventDefault` during play.
- **Gamepad later:** add a source that feeds `InputState` button ids (e.g. `Gamepad:A` in `KEY_BINDINGS`) plus an
  analog move axis. Nothing that reads actions changes.

## Moke: gameplay vs. visuals (decision D7)
The key rule: **gameplay never touches the mesh.** The data flows one way:

```
input ─► MoveIntent ─► MokeController ─► MokeAnimationController ─► MokeVisual
          (world dir)    (Locomotion +      (lean, head, tail,         (placeholder today,
                          CharacterBody)     ducking: plain numbers)    moke.glb later)
```
- `Locomotion` is the feel model. Moke always travels the way he faces:
  - He turns at a limited rate: quick pivots when slow, wider arcs at a run.
  - The further he still has to turn, the less speed he aims for, so a reversal is "brake, pivot, go".
    There are no instant 180s and no backwards sliding.
  - Separate rates for accelerating, coasting to a stop and braking; `groundFriction` scales them (per-surface later).
- `MokeController` runs in the fixed step. It feeds the locomotion result to `CharacterBody` and keeps the
  previous step for interpolation. If he's blocked head-on for 2+ steps, his stored speed drops, so he doesn't
  burst off a wall at full speed. Glancing contacts slide along the wall.
- `MokeAnimationController` turns motion into model-independent body language. It's the same for any visual.
- `MokeVisual` is the only interface a visual implements: `object`, a `mouthSocket` for carried items (Milestone 6),
  `update(dt, animationState)` and `dispose()`. `createMokeVisual()` is the single place that picks one.
  - Today it returns `PlaceholderDogVisual`, which is procedural.
  - When `moke.glb` exists: load it as an `optional` asset and return a glTF-based visual from the factory
    (not built yet), keeping the placeholder as the fallback.
- Camera, interactions, pickup, scent and physics must talk to `Moke.controller` (and later the mouth socket),
  never to the visual.

## Assets
- Runtime assets live in `public/assets/{models,textures,audio}` and are loaded **by URL from a manifest**
  (`src/config/assets.ts`). Dropping `moke.glb` into `public/assets/models/moke/` needs no import changes.
- A missing or broken asset never crashes loading. It's logged and reported so the game can fall back.
- Vite's hashed JS/CSS/fonts go to `dist/app/`; runtime assets stay in `dist/assets/`.
- `base: './'` means the build works from any static host path (GitHub Pages project sites, etc.).

## Rendering
WebGL 2 (`WebGLRenderer`), sRGB output, **Neutral** tone mapping (keeps chosen colours honest; ACES shifts warm
hues), PCF shadows (`PCFSoftShadowMap` was removed in three r186) with `shadow.radius` for softness.
Pixel ratio capped at 2. The buffer is resized via `ResizeObserver` plus a per-frame DPR check (monitor changes).
Shaders are precompiled during loading (`compileAsync`). Static scenery uses `matrixAutoUpdate = false`.

## Physics (decision D11: Rapier)
- **Rapier 0.20** (`@dimforge/rapier3d-compat`, Apache-2.0). `PhysicsWorld.create()` dynamically imports it, so the
  ~1.1 MB gzipped WASM chunk loads behind the loading screen and never blocks the first paint. It's stepped once
  per fixed step (60 Hz).
- **Static geometry:** world code describes colliders as plain `StaticBox` data (no Rapier import).
  `FoundationStage` derives them from its own meshes (`solid: true`), so visuals and collision can't drift apart.
  Call `commitStaticGeometry()` after adding them: Rapier's scene queries only see colliders after a step.
- **Moke's body:** `CharacterBody` is an upright kinematic capsule (radius 0.17 m, 0.36 m tall; `MOKE_BODY` in
  `config/movement.ts`) moved by Rapier's kinematic character controller: slide on, snap-to-ground, 45° slope limit.
  - It's short enough to fit under the 0.40 m coffee-table clearance. An upward ray measures headroom so the visual ducks.
  - The capsule is round, so the visual's nose and tail can poke a few centimetres past it into walls.
  - Impulses to dynamic bodies are already enabled for the toys in Milestone 7.
- **Gravity** applies only while airborne. On the ground, snap-to-ground keeps him planted. Also pushing down into
  the floor made Rapier's controller occasionally drop a whole step of horizontal movement, which read as a
  stutter; this was measured and fixed.

## Private reference photos: four layers
1. `.gitignore`: `reference/moke/*` (the README stays tracked).
2. Vite plugin `im-dog:block-private-reference` fails the build if anything imports from `reference/`.
3. Dev server `server.fs.deny` includes `**/reference/**` (403 on direct URLs).
4. `scripts/verify-dist.mjs` runs after every build and fails if any file in `dist/` is byte-identical to a reference photo.

## Testing
Vitest (node environment) covers:
- **Pure logic:** input state, fixed timestep, asset fallbacks, math, the locomotion model and animation state.
- **Integration with the real Rapier WASM,** in a tiny test room (`MokeController.test.ts`): floor contact, a steady
  trot with no stutter steps, walls, sliding, walking under a table and not climbing a couch seat.

Rendering is verified in the browser. New gameplay logic (interactions, scent, rest) should follow the same pattern.
