# Architecture

Browser game: **TypeScript + three.js + Vite**, HTML/CSS overlays for UI. No framework, no backend.

## Dependencies (kept minimal)
| Package | Why |
|---|---|
| `three` (runtime) | Rendering, scene graph, glTF loading |
| `@fontsource-variable/fredoka` (runtime) | Self-hosted OFL display font for the original UI identity; no third-party font CDN |
| `vite`, `typescript` (dev) | Dev server, bundling, type-checking |
| `vitest` (dev) | Unit tests for gameplay logic without a browser |
| `@types/three`, `@types/node` (dev) | Types |

Rapier is **not** installed yet. See "Physics" below.

## Source layout
```
src/
  main.ts                 entry: creates UIManager, then Game; shows a friendly error if startup fails
  config/                 ALL tunable numbers live here
    engine.ts             renderer, lens, fixed timestep
    input.ts              actions, key bindings, mouse sensitivity, control hints
    world.ts              world scale: Moke's size, furniture heights
    assets.ts             asset manifest (preloaded behind the loading screen)
  core/
    Game.ts               state machine + frame orchestration
    GameLoop.ts           FixedStep accumulator + rAF loop
    GameRenderer.ts       WebGLRenderer, resize/DPR handling, context loss
    InputState.ts         DOM-free input logic (tested)
    InputManager.ts       DOM wiring: keyboard, mouse, pointer lock
    AssetManager.ts       runtime asset loading with graceful fallbacks (tested)
  camera/PreviewOrbitCamera.ts   TEMPORARY (M1): orbit at dog height. Replaced by ThirdPersonCamera in M3
  world/
    RoomLighting.ts       hemisphere fill + window sun with soft shadows
    FoundationStage.ts    TEMPORARY (M1): true-scale greybox. Replaced by LivingRoom in M4
  ui/
    UIManager.ts          screens, controls dialog, toast, hints
    DebugPanel.ts         ` overlay + FrameStats
  styles/main.css
  utils/math.ts           clamp, frame-rate-independent damp
```
Planned additions follow the brief: `player/`, `interactions/`, `senses/`, `physics/`, `audio/`.

## Game states and the frame
`loading → menu → playing ⇄ paused` (in `Game.ts`). Each rendered frame:

1. `input.beginFrame()` latches key presses/releases and mouse delta for the frame.
2. Global keys: debug toggle, pause.
3. `FixedStep.advance(dt)` runs gameplay/physics at **60 Hz fixed** (0 steps while not playing).
4. Camera update at display rate.
5. Render, then debug panel (refreshes 5×/s, only while visible).

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

## Character visuals vs. gameplay (from Milestone 2)
The key rule: **gameplay never touches the mesh.**
- `MokeController` owns position, velocity, heading, locomotion state (idle/walk/trot/run/rest), the carried item, and collision.
- `MokeVisual` is an interface: `object`, a `mouthSocket` for carried items, and `update(dt, visualState)`.
  - `PlaceholderDogVisual`: simple original geometry.
  - `GltfMokeVisual`: loads `assets/models/moke/moke.glb` and maps states to animation clips.
- Camera, interactions, pickup, scent and physics talk to the controller (and the mouth socket), never to the visual.
  Swapping the placeholder for `moke.glb` is then a one-line factory change, and the placeholder stays as the
  fallback if the GLB is missing (the asset entry is `optional`).

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

## Physics (decision needed before Milestone 2)
Proposal: add **Rapier** (`@dimforge/rapier3d-compat`, Apache-2.0) in Milestone 2 and use it for the character
(kinematic character controller) and later for the ball/toys/sock drops. Then there's one collision world for
everything. Cost: roughly 1 MB gzipped of WASM. The alternative is custom circle-vs-box collision for Moke now,
with Rapier only for toys in M7, which means two collision systems to keep in sync.

## Private reference photos: four layers
1. `.gitignore`: `reference/moke/*` (the README stays tracked).
2. Vite plugin `im-dog:block-private-reference` fails the build if anything imports from `reference/`.
3. Dev server `server.fs.deny` includes `**/reference/**` (403 on direct URLs).
4. `scripts/verify-dist.mjs` runs after every build and fails if any file in `dist/` is byte-identical to a reference photo.

## Testing
Vitest (node environment) covers pure logic: input state, fixed timestep, asset fallbacks, math. Rendering is
verified in the browser. From M2, movement/interaction/scent/rest logic gets tests the same way, and is kept
DOM- and three-free where practical.
