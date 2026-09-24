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
    camera.ts             third-person camera feel (distance, zoom, smoothing, collision, whiskers, auto-follow)
    animation.ts          body-language tuning (lean, idle looks, tail, ducking)
    world.ts              world scale: Moke's size, furniture heights
    interaction.ts        interaction reach/facing tuning
    props.ts              prop definitions (shape, mass, damping, carry pose) + pickup/drop tuning
    senses.ts             sniff timing, wisp look, scent colours per category
    audio.ts              sound levels
    mokeLook.ts           Moke's look: palette, key light, crease shading, silhouette line, collar, blink timing
    assets.ts             asset manifest (preloaded behind the loading screen)
  core/
    Game.ts               state machine + frame orchestration
    GameLoop.ts           FixedStep accumulator + rAF loop
    GameRenderer.ts       WebGLRenderer, resize/DPR handling, context loss
    InputState.ts         DOM-free input logic (tested)
    InputManager.ts       DOM wiring: keyboard, mouse, wheel, pointer lock
    AssetManager.ts       runtime asset loading with graceful fallbacks (tested)
    PlayerSettings.ts     mouse sensitivity / invert-Y, saved in localStorage with safe fallbacks (tested)
  player/
    Locomotion.ts         pure movement model: speed, heading, gaits (tested; no three/Rapier)
    MokeController.ts     gameplay body: locomotion + collision + interpolation (tested with real Rapier)
    MokeAnimationController.ts  model-independent body language: lean, idle looks/tilts, tail, ducking (tested)
    MokeVisual.ts         the visual interface + createMokeVisual() factory
    ToonMokeVisual.ts     Moke built in code after the real dog (curly fur, soft shading, silhouette line, face, collar), animated procedurally (tested)
    toon/                 furGeometry.ts (fur clumps with curls and creases, tested), toonMaterials.ts (soft toon + outline), faceTextures.ts (eye), tagTexture.ts (name tag)
    Moke.ts               composite: controller + animation + visual (+ carrying/sniffing flags from gameplay)
    Bark.ts               bark cooldown (tested)
  physics/
    PhysicsWorld.ts       Rapier world (lazy WASM load), static box colliders, camera sphere sweep
    CharacterBody.ts      kinematic capsule driven by Rapier's character controller
    PropBody.ts           small dynamic body for a loose prop (ball/box/capsule), speed-capped, can be switched off
    collisionGroups.ts    collision layers (world / thin world / character / toy)
  camera/
    ThirdPersonCamera.ts  orbit, follow, collision, tight-space handling, zoom, FOV (tested with a fake collider)
    MoveBasis.ts          the camera angle WASD is measured against, locked while keys are held (tested)
  world/
    LivingRoom.ts         the room + hallway: shell, layout, spawn, landmarks (navigation-tested with Rapier)
    furniture.ts          couch, coffee table, rug, TV console, lamp, plant, dog bed, curtains, art, door
    materials.ts          the room palette (shared materials)
    textures.ts           original procedural canvas textures (floorboards, rug, pillows, art, garden)
    StaticSceneBuilder.ts places parts in nested frames, derives colliders, merges by material (tested)
    RoomLighting.ts       hemisphere fill + window sun with soft shadows; soft image-based environment
  interactions/
    Interactable.ts       the Interactable contract (id, type, label, distance, enabled, position, callback) + INTERACTION_TYPES
    InteractionSystem.ts  registry + "what would E do now?" selection (tested; DOM/three-free)
    PickupSystem.ts       pick up / carry / drop for any Carryable (tested; DOM/three-free)
    RestSystem.ts         lie down / get up at a rest spot: state machine + REST interactables (tested, incl. Rapier)
  props/
    Prop.ts               a loose prop: PropBody + view, interpolated; implements Carryable; escape rescue
    propVisuals.ts        original code-built prop models (sock, tennis ball, rope toy)
    roomProps.ts          creates the living room's props at their landmarks (Rapier-tested in props.test.ts)
  senses/
    ScentSystem.ts        sniff mode + scent sources + ranked hits (tested; DOM/three-free, no per-frame allocation)
    ScentWisps.ts         the stylized look: soft wisps and pulses, one Points draw, fixed budget
    roomScents.ts         the living room's sources (props while not carried, the dog bed)
  audio/
    AudioManager.ts       Web Audio context (unlocked by PLAY/RESUME), plays named sounds, never throws
    synth.ts              original synthesized placeholder sounds: bark, sniff, pickup, drop
  ui/
    UIManager.ts          screens, controls dialog, toast, hints, contextual prompt, bark bubble, sniff haze
    DebugPanel.ts         ` overlay + FrameStats
  styles/main.css
  utils/math.ts           clamp, damp, lerp, smoothstep, moveToward, angle helpers
```


## Game states and the frame
`loading → menu → playing ⇄ paused` (in `Game.ts`). Each rendered frame:

1. `input.beginFrame()` latches key presses/releases and mouse delta for the frame.
2. Global keys: debug toggle, pause.
3. `FixedStep.advance(dt)` runs gameplay/physics at **60 Hz fixed** (0 steps while not playing). Each step:
   build a camera-relative move intent (via `MoveBasis`) → `Moke.fixedUpdate` → `PhysicsWorld.step`.
4. `Moke.update(dt, alpha)`: place the visual between the last two steps (interpolation) and animate it.
5. `ThirdPersonCamera.update` at display rate (follows Moke's interpolated position; hides him if walls
   force the camera inside him).
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
          (world dir)    (Locomotion +      (lean, head, tail,         (ToonMokeVisual today,
                          CharacterBody)     ducking: plain numbers)    moke.glb possible)
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
  - Today it returns `ToonMokeVisual` (Milestone 10): Moke modelled on the real dog, generated in code, no image files.
    - **Fur:** `furClump` grows soft tufts (rounded, or pointed with `sharpness`; tips swept along a flow direction)
      from dense ellipsoids, plus an optional finer layer of rounded `curls`. Static parts are merged, so Moke has 9
      fur meshes (each with a silhouette line). Each clump also stores the smooth ellipsoid's normal (`smoothNormal`),
      which the shader lights by (mixed with a little of the real normal, `tuftDetail`), and a `furCavity` value
      (deep in a crease between curls) that darkens the creases slightly.
    - **Soft toon shading** (`createToonMaterial`, a patched `MeshToonMaterial`): a lit/shade palette split by a
      wide, soft transition from a character-only key light fixed in view space, plus a warm rim. The room's real lights (and shadow maps) only
      scale overall brightness, so he stays white under the warm room light but still dims in shade. The
      materials skip tone mapping so the palette in `config/mokeLook.ts` is what reaches the screen.
    - **Silhouette line:** inverted hulls (back faces pushed out in screen space, one shared `ShaderMaterial`), so
      line width is even in pixels and thins a little with distance. Thin and soft grey; can be switched off.
    - **Collar:** a blue strap round his neck (on the neck, so it moves with his head) and a navy bone-shaped tag on
      a silver ring with his name drawn on a canvas (`toon/tagTexture.ts`). The strap's loop is measured from the fur
      at build time (the outermost fur vertices near the collar's plane) and sits a little inside it; its material
      pulls its depth ~9 mm toward the camera (`createToonMaterial` `depthPull`), so it shows through the curl tips
      like a collar pressed into the coat. The tag counter-rotates to hang straight down.
    - **Face:** a canvas-drawn dark, glossy eye texture on domed discs placed on the face; eyes blink and close to a
      lash line while resting; the nose, open mouth and tongue are small meshes (no drawn mouth when closed).
  - A future `moke.glb` would still plug in here (load it as an `optional` asset and return a glTF-based visual),
    keeping the toon visual as the fallback.
- Camera, interactions, pickup, scent and physics must talk to `Moke.controller` (and later the mouth socket),
  never to the visual.

## Interactions (`interactions/`, Milestone 5)
- An `Interactable` is plain data plus a callback: `id`, `type` (PICKUP, DROP, REST, SNIFF, PLAY, EAT, DRINK,
  INVESTIGATE), `label` ("Pick Up Sock"), `interactionDistance`, `enabled`, `position`, optional `requiresFacing`
  (default true) and `priority` (default 0), and `interact()`. Fields are read every frame, so getters work.
- `InteractionSystem` holds the registry. Once per rendered frame `Game` calls `update(moke.controller)`, which picks
  the current target: in reach (horizontal distance from Moke's feet), inside the facing cone unless it's right under
  his nose, highest priority first, then best distance/angle score. The current target keeps a small bonus, so the
  prompt doesn't flicker between two close things.
- `Game` reads `wasPressed('interact')` once per rendered frame and calls `interactions.interact()`; the UI shows
  the current target as "E — label" (`UIManager.setPrompt`, which only touches the DOM when the text changes).
- Systems register their own interactables (pickup, rest). `MokeController` knows nothing about interactions.

## Props and carrying (Milestone 6)
- `PropBody` (physics, no three.js) is a small dynamic Rapier body with CCD, damping and a hard speed cap applied
  after every step. Props sit on the `toy` layer, so the camera sweep ignores them. `pushable: false` props (the
  sock) also skip the `character` layer, so Moke walks over them instead of tripping.
- `Prop` = `PropBody` + view. The view is interpolated between fixed steps like Moke. A prop that escapes (below
  the floor, far outside) goes back to its landmark.
- `PickupSystem<T extends Carryable>` registers a PICKUP interactable per item ("Pick Up Sock", disabled while his
  mouth is full) and one DROP interactable ("Drop Sock", priority 10, no facing check) while carrying.
  - Picking up switches the body off. Dropping puts it back just ahead of his mouth, computed from
    `MokeController`'s position and heading (never the mesh), pulled back from walls with a
    `PhysicsWorld.rayDistance` probe, and gives it half his velocity, so it falls and tumbles naturally.
  - Presentation listens through `onPickUp`/`onDrop`: `Game` parents the prop's view to `MokeVisual.mouthSocket`
    with the prop's `carry` pose, and sets `Moke.carrying` so body language reacts (head up, tail wag).
- Frame order: `Moke.fixedUpdate` → `PhysicsWorld.step` → `Prop.afterStep` (fixed); `Prop.render(alpha)` per frame.
- **Pushing toys (Milestone 7):** Moke's capsule and the character controller ignore the `toy` layer. Instead
  `CharacterBody` carries a low upright **toy bumper** cylinder (`MOKE_BODY.toyBumper`, just inside the capsule)
  that only touches toys. The capsule's round bottom pressed a small ball down into the floor and rode over it at
  a run; the bumper's vertical face knocks it ahead instead (trot: the ball rolls at about his speed; run: about
  3.3 m/s, capped at `maxSpeed`). Kinematic contacts do the pushing, so no impulse tuning is needed.
- Dropped items land turned by their `carry.turn` (crosswise, the way they were held).

## Sniff mode (`senses/`, Milestone 8)
- A `ScentSource` has an id, category (FOOD, TREAT, OWNER, FAMILY, SOCK, TOY, OUTSIDE, INTERESTING), label, position,
  strength, radius and `enabled` (getters: a carried sock isn't a source).
- `ScentSystem.start()` (Q) runs sniff mode for `SNIFF.duration` with a fade in/out and a short cooldown. Each frame,
  `update(dt, nose)` ranks the enabled sources in range by `strength × √closeness × fade` into a fixed pool (the top
  `maxSources`). The pool is reused, so there's no per-frame allocation.
- `ScentWisps` draws them as **one `Points` object** with a fixed budget (6 sources × 23 particles). Each particle's
  position is a pure function of time and its index (curling up from the source, leaning toward the nose, fading),
  written into preallocated arrays. A bigger soft dot "breathes" at each source. Depth-tested, so wisps never paint over Moke;
  near-lens particles fade out.
- Body language: `Moke.sniffing` → `MokeAnimationState.sniff` (nose down, quick twitches). UI: a warm vignette.

## Bark and audio (with Milestone 8)
- F → `BarkTimer.tryBark()` (cooldown) → `MokeAnimationController.bark()` (a short envelope in
  `MokeAnimationState.bark`: little hop, head up, ears back, mouth open) + `AudioManager.play('bark')` + a comic
  "Arf!" bubble projected above his head.
- `AudioManager` creates/resumes its `AudioContext` inside the PLAY/RESUME clicks (browsers require a gesture). If
  Web Audio is missing or still locked, `play()` does nothing. All sounds are synthesized at play time (`synth.ts`), with
  a little random pitch variation; there are no audio files.

## Rest (Milestone 9)
- `RestSystem` registers "Lie Down" (REST, reach 0.62 m from the bed centre, which is only reachable through the
  bed's open front) and, while settling/resting, "Get Up" (priority 20).
- Phases: `standing → settling → resting → rising → standing`. While not standing, `Game` ignores movement input:
  - settling: `MokeController.glideTo` shuffles him to the centre (still colliding), facing where he's going, then
    turns him to face out (`glideHeading`); he lies down on arrival or after a 2 s timeout;
  - rising lasts 0.45 s so the stand-up reads before he can run off.
- E (the "Get Up" interactable) or any fresh movement key press stands him up.
- Presentation reads plain numbers: `Moke.resting` → `MokeAnimationState.rest` (slow flop, quick rise) →
  the toon visual's sphinx pose (eyes shut); `CameraTarget.rest` (from the animation state) lowers the pivot, brings the camera
  in by 15% and enforces a minimum downward pitch (`CAMERA.rest`); `UIManager.setResting` quiets the HUD.

## Third-person camera (`camera/ThirdPersonCamera.ts`, tuning in `config/camera.ts`)
It's never parented to Moke. Each frame:
1. **Orbit:** mouse yaw/pitch (× player sensitivity, optional invert), clamped pitch, and wheel zoom between the
   min and max distance. The rotation is smoothed.
2. **Follow:** the pivot (about Moke's head) is damped toward him. Under low ceilings it drops below them.
3. **Low ceilings** (the coffee table): the pitch is capped so the camera stays underneath, flattening into a low, level shot.
4. **Squeezed from behind:**
   - *Whiskers:* if the mouse is idle, it probes ±0.5/1.0/1.5 rad and drifts toward open space, giving a side view.
   - *Lift:* otherwise it lifts toward a top-down view. The lift is computed from a sweep at the natural angle,
     so it can't feed back on itself and wobble.
5. **Collision:** a 0.1 m sphere is swept (Rapier `castShape`) from the pivot. The camera pulls in instantly and
   eases back out. Walls always win. If that forces the camera inside Moke, `Game` hides his visual.
   - The sweep only hits the `world` layer: Moke's capsule and thin props (table legs, marked
     `blocksCamera: false`) are ignored, so the camera doesn't pop in and out as legs pass.
6. **Auto-follow:** while Moke moves and the mouse has been idle for 1.5 s, the camera drifts behind him, faster
   at speed. It doesn't do this when he's running roughly toward the camera.
7. **Field of view** widens by up to 6° at a run.

**Controls stay predictable:** `MoveBasis` captures the camera yaw when a movement key goes down and then follows
only the player's own mouse turns. Auto-follow, whiskers and recentring therefore never bend the path being
steered. Holding D runs Moke straight right while the camera swings behind him.

The camera talks to physics only through a `CameraCollider` interface (`sweepSphere`), which makes it unit-testable
with a fake. Cost: about 5–7 µs per frame.

## The living room (`world/`)
- **Layout:** a 7 × 6 m room at true human scale, plus a 3 m hallway through a doorway in the right wall.
  - Window with curtains and a garden view on the left; its sun falls on Moke's bed.
  - Couch, side table and floor lamp along the back wall; rug and coffee table in the middle; TV console on the
    front wall; plant in the corner.
  - `LivingRoom.landmarks` names key spots (bed, bed front, under the table, hallway) for tests and later milestones.
- **Furniture functions** build around their own origin, facing +z. The layout places them with `builder.at(position, rotationY, …)`.
- **Draw calls:** `StaticSceneBuilder` merges all static parts that share a material and shadow flags into one mesh,
  so the furnished room is 44 meshes. The whole frame, with shadows and Moke, is about 100 draw calls (about
  2.2 ms at 1280×720 on a GTX 1660 SUPER).
- **Textures** are original canvas drawings generated at startup from a seeded random generator, so they're the
  same every time. Where there's no DOM (unit tests), they're null and the materials use plain colours.
  - Floors use world-space UVs (`worldUV`), so boards line up between the room and the hallway.
- **Lighting:**
  - Hemisphere fill, plus the window sun, whose shadow map covers the room and hallway.
  - Soft image-based reflections (`RoomEnvironment`, prefiltered once).
  - A warm point light in the floor lamp and one in the hallway (no shadows, to stay cheap).
  - The balance is set in `config/engine.ts` (`hemisphereIntensity`, `sunIntensity`, `environmentIntensity`).
- **Moke's bed** is open at the front, and its bolster colliders block the other sides. This sets up lying down in Milestone 9.

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
  `StaticSceneBuilder` derives them from the parts themselves (`solid`/`thin`) or takes simple explicit boxes
  (`addCollider`, e.g. one box for the couch body), so visuals and collision stay together.
  Call `commitStaticGeometry()` after adding them: Rapier's scene queries only see colliders after a step.
- **Moke's body:** `CharacterBody` is an upright kinematic capsule (radius 0.17 m, 0.36 m tall; `MOKE_BODY` in
  `config/movement.ts`) moved by Rapier's kinematic character controller: slide on, snap-to-ground, 45° slope limit.
  - It's short enough to fit under the 0.40 m coffee-table clearance. An upward ray measures headroom so the visual ducks.
  - The capsule is round, so the visual's nose and tail can poke a few centimetres past it into walls.
  - Toys are pushed by a separate toy-bumper collider on the same body (see "Props and carrying").
- **Collision layers** (`physics/collisionGroups.ts`):
  - `world`: walls, floor, furniture.
  - `worldThin`: e.g. table legs; they block Moke but not the camera.
  - `character`: Moke.
  - `toy`: loose props (dynamic bodies). The camera and Moke's capsule ignore them; his toy bumper pushes the
    pushable ones (ball, rope toy). The sock ignores Moke entirely.
  - Queries filter by layer: the camera sweep sees `world` only.
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
