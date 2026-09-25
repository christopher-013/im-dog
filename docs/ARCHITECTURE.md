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
    input.ts              actions, keyboard/gamepad/touch bindings, stick + mouse + touch tuning, control hints
    movement.ts           Moke's movement feel (speeds, acceleration, turning) + collision capsule
    camera.ts             third-person camera feel (distance, zoom, smoothing, collision, whiskers, auto-follow)
    animation.ts          body-language tuning (lean, idle looks, tail, ducking, sit/stretch, looking at things, tricks)
    mokeCharacter.ts      Moke's ONE authoritative size, plus the moke.glb conventions (path, bones, sockets, morphs, clip speeds)
    attention.ts          what catches his eye and for how long (range, field of view, glance/look-away timing, interest by kind)
    world.ts              world scale: furniture heights
    interaction.ts        interaction reach/facing tuning
    props.ts              prop definitions (shape, mass, damping, carry pose) + pickup/drop tuning
    senses.ts             sniff timing, wisp look, scent colours per category
    audio.ts              sound levels
    mokeLook.ts           Moke's look: palette, key light, crease shading, silhouette line, collar, blink timing
    assets.ts             asset manifest (preloaded behind the loading screen)
    quality.ts            graphics presets (HIGH desktop, MEDIUM/LOW phones) + dynamic-resolution tuning
    human.ts              the Sock Heist human: body, speeds, sight, chase, treat timings
    heist.ts              Sock Heist lines of dialogue and timings
  core/
    Game.ts               state machine + frame orchestration
    GameLoop.ts           FixedStep accumulator + rAF loop
    GameRenderer.ts       WebGLRenderer, resize/DPR handling, context loss
    InputState.ts         DOM-free input logic (tested)
    GamepadInput.ts       Gamepad API polling, standard-layout mapping and stick deadzones (tested)
    InputManager.ts       DOM wiring: keyboard, mouse, wheel, pointer lock; gamepad polling; touch; input mode
    InputMode.ts          which controls are in use (keyboard/touch/gamepad), from capabilities + last use (tested)
    TouchInput.ts         touch controls → InputState: joystick, camera drag, virtual Touch:* buttons (tested with a fake DOM)
    VirtualJoystick.ts    floating joystick maths: deadzone, rim, sprint ring, follow (tested)
    Quality.ts            picks the graphics preset; AdaptiveResolution (dynamic pixel ratio on phones) (tested)
    GameEvents.ts         tiny typed publish/subscribe for gameplay events (tested)
    MenuInput.ts          controller-only menu commands (pause, resume, play, play again) (tested)
    AssetManager.ts       runtime asset loading with graceful fallbacks (tested)
    PlayerSettings.ts     mouse sensitivity / invert-Y, saved in localStorage with safe fallbacks (tested)
  player/
    Locomotion.ts         pure movement model: speed, heading, gaits (tested; no three/Rapier)
    MokeController.ts     gameplay body: locomotion + collision + interpolation (tested with real Rapier)
    MokeAnimationController.ts  model-independent body language: lean, idle looks/tilts, tail, ducking, sit/stretch, look-at, tricks (tested)
    MokeVisual.ts         the visual interface (object, attachments, update, dispose) + createMokeVisual(): model or stand-in (tested)
    ToonMokeVisual.ts     the procedural stand-in: Moke built in code after the real dog (curly fur, soft shading, silhouette line, face, collar), animated procedurally (tested)
    toon/                 furGeometry.ts (fur clumps with curls and creases, tested), toonMaterials.ts (soft toon + outline), faceTextures.ts (eye), tagTexture.ts (name tag)
    gltf/                 the final-model path: GltfMokeVisual.ts (moke.glb: mixer, crossfades, sockets, procedural layer; tested),
                          clips.ts (MOKE_CLIPS names + selectClips: state → clip weights; tested), testing/syntheticMoke.ts (test-only model)
    AttentionSystem.ts    what he glances at: targets, interest, glance/look-away pacing, sniff focus (tested; DOM/three-free)
    Moke.ts               composite: controller + animation + visual (+ carrying/sniffing/lookAt from gameplay)
    Bark.ts               bark cooldown (tested)
    Tricks.ts             the tricks and how one is picked (random, no repeats, context rules) (tested)
  human/                  the Sock Heist human (Phase 3)
    HumanBrain.ts         behaviour: explicit state machine, one handler per state (tested; pure logic)
    HumanAwareness.ts     sight cone + line of sight + feel + hearing (tested; pure)
    NavGrid.ts            walkability grid from the room colliders, A*, path smoothing (tested)
    HumanController.ts    body: follows paths through a Rapier character capsule (tested with Rapier)
    ToonHumanVisual.ts    stylized placeholder human built in code; blended poses; see-through when in the way
    Human.ts              composite: perceive → decide → move; draw
  heist/                  Sock Heist (Phase 3)
    SockHeistController.ts  orchestration: phases, trade, eating, discovery, completion, reset (tested)
    SockHeistRuntime.ts   wires the heist into the game: builds the human, feeds senses, events → UI/audio
    Treat.ts              a reusable treat: state, smell, eye appeal, "Eat Treat"
    DogLogic.ts           remembers discoveries (SOCK = TREAT) in localStorage
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
    furniture.ts          couch, coffee table, rug, TV console, lamp, plant, dog bed, curtains, art, door, laundry basket, treat jar
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
    synth.ts              original synthesized sounds: bark, growl, sniff, pickup, drop; surprise, whoosh, treat bag, crunch, discovery
  ui/
    UIManager.ts          screens (incl. Sock Heist complete), controls dialog, toast, hints, input-aware prompt, touch UI state,
                          onboarding, speech bubble, objective chip, SOCK = TREAT card, fullscreen, bark bubble, sniff haze
    ControlGlyphs.ts      the one place actions become "E" / "A" / a touch button, and the controls reminders (tested)
    DebugPanel.ts         ` overlay + FrameStats
  styles/main.css
  utils/math.ts           clamp, damp, lerp, smoothstep, moveToward, angle helpers
  env.d.ts                build-time constants from vite.config.ts (__MOKE_MODEL_AVAILABLE__)
public/manifest.webmanifest, public/icons/  home-screen web app (icons from scripts/make-icons.mjs)
scripts/sw-template.js    the service worker; vite.config.ts fills in the precache list and cache name at build time
```


## Game states and the frame
`loading → menu → playing ⇄ paused`, and `playing → complete` when a Sock Heist ends (PLAY AGAIN / KEEP EXPLORING
return to `playing`). Hiding the page (phone locked, app or tab switched) pauses. Each rendered frame:

1. `input.beginFrame(dt)` polls gamepads, then latches button/key presses, analog movement and look delta for the frame.
2. Global keys: debug toggle, pause.
3. `FixedStep.advance(dt)` runs gameplay/physics at **60 Hz fixed** (0 steps while not playing). Each step:
   build a camera-relative move intent (via `MoveBasis`) → `Moke.fixedUpdate` → `RestSystem` → Sock Heist (the
   human perceives, decides and moves; the heist's timers) → `PhysicsWorld.step`.
4. `Moke.update(dt, alpha)`: place the visual between the last two steps (interpolation) and animate it.
5. `ThirdPersonCamera.update` at display rate (follows Moke's interpolated position; hides him if walls
   force the camera inside him).
6. Render, then debug panel (refreshes 5×/s, only while visible).

**Why fixed timestep:** movement feel (acceleration, turn rate) and physics must be identical at 60/144/240 Hz.
`advance()` returns an interpolation alpha so visuals can be smoothed between steps. Frame deltas are clamped to
100 ms for simulation, and the backlog is dropped after 6 steps, so a tab switch never causes a jump or a death
spiral. The debug `FrameStats` receives the separate, raw elapsed time (ignoring the loop's initial zero sample),
so stalls are visible instead of being hidden by the simulation clamp.

## Input
- Gameplay reads **actions** (`bark`, `interact`, …), never keys. Bindings use `KeyboardEvent.code`, the physical
  position, so WASD works on AZERTY too. If `code` is empty (some remote-desktop/synthetic events), it's recovered from `key`.
- Presses are latched per rendered frame: a tap shorter than a frame is never missed or double-counted.
- Pointer lock requests raw (`unadjustedMovement`) input, falling back to normal lock. If lock is unavailable
  (embedded browsers, Chrome's ~1 s cooldown after Esc), play continues with a "click to look" hint and drag-to-look.
- Keys release on window blur/tab hide (no stuck movement). Bound keys only `preventDefault` during play.
- `GamepadInput` polls `navigator.getGamepads()` every frame. The first connected pad stays active until it
  disconnects; disconnect releases held actions and clears analog movement. Standard-layout mappings use the left
  stick/D-pad for movement, right stick for camera, face/shoulder buttons for actions, and Menu/Start for pause.
- A radial 0.18 stick deadzone is removed and the remaining range is rescaled, so drift is suppressed without losing
  the full analog range. Gamepad look is converted to time-based mouse-equivalent deltas before entering the same
  camera path. Keyboard and mouse remain usable at the same time.
- **Touch (Phase 3, `TouchInput`):**
  - a floating joystick on the left part of the screen feeds a separate analog source (InputState adds the
    controller and touch axes);
  - pushing past its ring holds `run`;
  - dragging elsewhere adds a look delta (× `TOUCH.lookScale`);
  - buttons are virtual `Touch:*` keys in `KEY_BINDINGS`.

  Pointers are tracked by id. `reset()` on lift, cancel, lost capture, blur, pause and rotation. `update()` each
  frame re-holds keys that a `releaseAll()` dropped under a still-held finger.
- **Input mode (`InputMode`):**
  - It starts from capabilities (`(pointer: coarse)` + touch points, not the user-agent), then follows the device
    last used.
  - It drives `html[data-input]` (CSS shows the touch controls) and every prompt, via `ControlGlyphs`.
  - `?input=` forces it. Touch mode never requests pointer lock.

## Moke: gameplay vs. visuals (decision D7)
The key rule: **gameplay never touches the mesh.** The data flows one way:

```
input ─► MoveIntent ─► MokeController ─► MokeAnimationController ─► MokeVisual
          (world dir)    (Locomotion +      (lean, head, tail, sit,    (GltfMokeVisual for moke.glb,
                          CharacterBody)     ducking: plain numbers)    else the ToonMokeVisual stand-in)
                                                   ▲
                               AttentionSystem ─ Moke.lookAt (what he glances at)
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
- **One authoritative scale:** `MOKE_CHARACTER.size` (`config/mokeCharacter.ts`: shoulder 0.28 m, eyes 0.33 m, head
  top 0.43 m). The camera pivot (`eyeHeight + 0.03`) and the ducking threshold (`headTop + 0.02`) derive from it,
  and a `moke.glb` is checked against it. The collision capsule (`MOKE_BODY`) is deliberately separate, sized for
  the coffee table.
- `MokeVisual` is the only interface a visual implements:
  - `object`;
  - `attachments`: `mouth` for carried items, and `collar` and `back` for future cosmetics;
  - `update(dt, animationState)` and `dispose()`.

  `createMokeVisual(gltf, modelExpected)` is the single place that picks one (Phase 2):
  - the final **`GltfMokeVisual`** when `moke.glb` loaded and is usable (below, and `docs/MOKE_INTEGRATION.md`);
  - otherwise **`ToonMokeVisual`**, the procedural stand-in, with a console warning that says why. Moke is never invisible.
  - `Game.visualChoice` and the debug panel's `visual` row record which one was picked, and any notes.
- **`GltfMokeVisual`** (Phase 2, `player/gltf/`) wraps the loaded scene in a pivot turned and scaled only by
  `MOKE_CHARACTER.model`; nothing else compensates. It checks the model against the spec (height, bones, sockets,
  the `blink` morph, clip names) and lists problems in `issues`. Each frame:
  1. `selectClips()` maps the state to per-clip target weights and playback speeds:
     - actions take their share first (lie down/rest/stand up, tricks, sit, stretch, sniff, growl, bark, pickup and
       drop moments);
     - locomotion gets the rest, as a 1D speed blend between the two nearest gaits (playback = real ÷ authored speed,
       0.3–2.5×);
     - `duck` is additive on top (weight = `crouch`).
  2. Weights are damped toward their targets for smooth crossfades. One-shot clips restart on a rising edge.
  3. Driven bones go back to their rest pose, then the `AnimationMixer` runs.
  4. A procedural layer turns bones in the model's own frame, so bone axes don't matter and nothing accumulates:
     - neck and head glances and tilts, and a head lift while carrying;
     - tail wag;
     - ear bounce;
     - jaw open for barks, growls and panting;
     - the blink morph;
     - without a `duck` clip, a head dip and lowered tail.

  Missing clips, bones, sockets or morphs are skipped, never a crash. **No model file exists yet**, so this is tested
  with a synthetic model built to the spec (`gltf/testing/syntheticMoke.ts`).
- **`ToonMokeVisual`** (Milestone 10; the stand-in since Phase 2): Moke modelled on the real dog, generated in code, no image files.
    - **Poses** are composed `BodyPose` layers added to his normal pose:
      - sit, and the play-bow stretch;
      - a staged lie-down (rump first, then front, like a real dog);
      - tricks.

      A pose pitches about his hind hips or rolls about his middle. Any pose that swings fur below his feet is
      lifted clear of the floor.
    - **Attachments:** `socket_mouth` on the head, `socket_collar` at the tag ring, `socket_back` on his back.
    - **Fur:** `furClump` grows soft tufts (rounded, or pointed with `sharpness`; tips swept along a flow direction)
      from dense ellipsoids, plus an optional finer layer of rounded `curls`. Static parts are merged, so Moke has 9
      fur meshes (each with a silhouette line). Each clump also stores the smooth ellipsoid's normal (`smoothNormal`),
      which the shader lights by (mixed with a little of the real normal, `tuftDetail`), and a `furCavity` value
      (deep in a crease between curls) that darkens the creases slightly. The tail is one clump bent along a curve
      (`bendAlongCurve`), rooted inside his rump so it can't come apart from his body.
    - **Soft toon shading** (`createToonMaterial`, a patched `MeshToonMaterial`): a lit/shade palette split by a
      wide, soft transition from a character-only key light fixed in view space, plus a warm rim. The room's real lights (and shadow maps) only
      scale overall brightness, so he stays white under the warm room light but still dims in shade. The
      materials skip tone mapping so the palette in `config/mokeLook.ts` is what reaches the screen.
    - **Silhouette line:** inverted hulls (back faces pushed out in screen space, one shared `ShaderMaterial`), so
      line width is even in pixels and thins a little with distance. Thin and soft grey; can be switched off.
    - **Collar:** a blue strap round his neck (on the neck, so it moves with his head) and a navy bone-shaped tag on
      a silver ring with his name drawn on a canvas (`toon/tagTexture.ts`). The nearly level loop is measured from
      the head fur at build time, inset into the coat, and shortened at the front so it stops under the chin before
      the muzzle. Fur naturally hides its sides and back. The ring is anchored to the strap's front face, and the
      tag counter-rotates to hang straight down.
    - **Face:** a canvas-drawn dark, glossy eye texture on domed discs placed on the face; eyes blink and close to a
      lash line while resting; the nose, open mouth and tongue are small meshes (no drawn mouth when closed).
- Camera, interactions, pickup, scent and physics must talk to `Moke.controller` (carrying uses
  `visual.attachments.mouth`), never to the visual itself.

## Attention and personality (Phase 2)
- **`AttentionSystem`** (`player/AttentionSystem.ts`, tuning in `config/attention.ts`) is pure logic: no DOM, no
  three.js.
  - `Game.registerAttention()` registers targets: each prop (switched off while carried) and his bed. Each has a
    kind and an interest; positions are getters.
  - Each frame, *before* `Moke.update`, `Game.updateAttention()` picks what he looks at. The choice goes to
    `Moke.lookAt`, which `Moke` converts to a head yaw and pitch relative to his heading for the animation.
  - How he chooses: the most interesting thing within range and in front of him, weighed by distance and angle. He
    glances for a moment, looks away, and gets bored of staring at the same thing.
  - While sniffing, the focus is the strongest scent. He's quiet while busy (resting in his bed, a trick) or running.
- **Personality in `MokeAnimationController`:**
  - `updateLook` turns the head toward the attention target within natural limits (`maxHeadYaw`, `lookMaxPitch`),
    sometimes with a curious tilt (`noticeTiltChance`).
  - `updateSitting` sits him down after `idleSitAfter` seconds standing still, sometimes with a play-bow stretch
    first (`idleStretchChance`). Moving makes him hop straight up (`standUpRate`).
  - These are plain numbers in `MokeAnimationState` (`headPitch`, `attention`, `sit`, `stretch`), so every visual
    shows them: the stand-in with poses, a `moke.glb` with `sit` and `stretch` clips plus the procedural head turn.

## Interactions (`interactions/`, Milestone 5)
- An `Interactable` is plain data plus a callback: `id`, `type` (PICKUP, DROP, REST, SNIFF, PLAY, EAT, DRINK,
  INVESTIGATE), `label` ("Pick Up Sock"), `interactionDistance`, `enabled`, `position`, optional `requiresFacing`
  (default true), `requiresClearPath` (default true) and `priority` (default 0), and `interact()`. Fields are read
  every frame, so getters work. Self-actions such as DROP and GET UP opt out of the clear-path check.
- `InteractionSystem` holds the registry. Once per rendered frame `Game` calls `update(moke.controller)`, which picks
  the current target: within horizontal and vertical reach, visible through a physics ray that includes solid and
  thin world geometry, and inside the facing cone unless it's right under his nose; then highest priority and best
  distance/angle score win. The current target keeps a small bonus, so the prompt doesn't flicker between close rivals.
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
    `MokeController`'s position and heading (never the mesh), pulled back from solid and thin geometry with a
    conservative swept-sphere probe sized for that prop, and gives it half his velocity, so it falls and tumbles
    naturally without spawning through a wall.
  - Presentation listens through `onPickUp`/`onDrop`: `Game` parents the prop's view to
    `MokeVisual.attachments.mouth` with the prop's `carry` pose (retuned in Phase 2 so each toy sits in his mouth),
    and sets `Moke.carrying` so body language reacts (head up, tail wag; a `moke.glb` also plays `pickup`/`drop`).
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
- `ScentSystem.start()` (R, or the right stick press) runs sniff mode for `SNIFF.duration` with a fade in/out and a short cooldown. Each frame,
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
- G / controller Y → `MokeAnimationController.growl()` → a brief mock-tough pose (lowered body, forward chest,
  pinned ears, squint, head tremble and visible teeth) + `AudioManager.play('growl')` + a small “grrr” bubble.
  The growl is presentation-only and has no combat effect.
- `AudioManager` creates/resumes its `AudioContext` inside the PLAY/RESUME clicks (browsers require a gesture). If
  Web Audio is missing or still locked, `play()` does nothing. All sounds are synthesized at play time (`synth.ts`), with
  a little random pitch variation; there are no audio files.

## Tricks (Milestone 10, owner request)
- Q / controller X → `Game.startTrick()` → `pickTrick()` (`player/Tricks.ts`): a random trick he can do right now
  (`bellyUp`, `beg`, `paw`, `spin`), never the same as the last one. No belly-up while carrying, no begging when
  the headroom is below `MOKE_ANIMATION.tricks.begHeadroom`. Not while resting in his bed, sniffing, or mid-trick.
- `MokeAnimationController.trick(name)` puts it in `MokeAnimationState` (`trick`, `trickTime`, `trickBlend`, eased
  in and out; lengths in `MOKE_ANIMATION.tricks`). Model-independent, so a `moke.glb` could play a clip per trick.
- While `holdsStillForTrick`, `Game` feeds Moke a still intent. Movement input calls `cancelTrick()`: he's free
  to move at once and eases out of the pose in `cancelOut` seconds. E also cancels it before interacting.
- `GltfMokeVisual` plays a `trick_*` clip per trick. `ToonMokeVisual` turns the state into a `BodyPose` layer added on top of his normal pose: rig pitch about his hind hips
  (beg, sit), roll about his middle (belly up), a spin, leg/neck/head/tail offsets, mouth and eyes. During a trick a
  sparse sample of fur vertices lifts him just clear of the floor if a pose swings anything below his feet.

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
  (`src/config/assets.ts`). Dropping `moke.glb` into `public/assets/models/moke/` needs no code changes. At startup
  `vite.config.ts` checks whether that file exists and defines `__MOKE_MODEL_AVAILABLE__`. The manifest only lists
  the model when it's there, so its absence costs no 404. **Restart the dev server after adding or removing it.**
- A missing or broken asset never crashes loading. It's logged and reported so the game can fall back.
- Vite's hashed JS/CSS/fonts go to `dist/app/`; runtime assets stay in `dist/assets/`.
- Production builds emit `dist/THIRD_PARTY_NOTICES.txt` with the distributed font and runtime-library licenses.
- `base: './'` means the build works from any static host path (GitHub Pages project sites, etc.).
- **Hosting (D13):** `.github/workflows/deploy-pages.yml` runs `npm ci`, `npm test` and `npm run build` on every push
  to `main` and publishes `dist/` to GitHub Pages at https://christopher-013.github.io/im-dog/.

## Rendering
WebGL 2 (`WebGLRenderer`), sRGB output, **Neutral** tone mapping (keeps chosen colours honest; ACES shifts warm
hues), PCF shadows (`PCFSoftShadowMap` was removed in three r186) with `shadow.radius` for softness.
Pixel ratio capped by the quality preset (2 on desktop, 1.5 or 1 on phones, lowered further by dynamic resolution). The buffer is resized via `ResizeObserver` plus a per-frame DPR check (monitor changes).
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

## Mobile: quality, lifecycle, PWA (Phase 3; details in `docs/MOBILE.md`)
- **Quality presets** (`config/quality.ts`, chosen by `pickQuality` before the renderer exists):
  - HIGH (desktop): pixel ratio up to 2, MSAA, 2048 shadows; exactly the Phase 2 look;
  - MEDIUM (phones and tablets): up to 1.5, 1024 shadows;
  - LOW (modest phones): up to 1, no MSAA, 512 shadows.

  `GameRenderer` takes the antialias and pixel-ratio cap; `RoomLighting` takes the shadow size and softness.
  `?quality=` forces a preset.
- **Dynamic resolution** (`AdaptiveResolution`, MEDIUM/LOW only): sustained slow frames lower
  `GameRenderer.pixelRatioCap` a step; sustained headroom raises it, within the preset's range.
- **Lifecycle:** when `visibilitychange` hides the page, Game pauses, suspends audio and releases input. When
  it's shown again, `GameLoop.resetClock()` stops the first frame from counting the whole time away. Audio
  resumes on the next RESUME tap.
- **Layout:** `viewport-fit=cover` + `env(safe-area-inset-*)`. The canvas and touch layer use
  `touch-action: none`, with `overscroll-behavior: none`. Portrait widens the vertical field of view
  (`fitVerticalFov`, `CAMERA.minHorizontalFov/maxVerticalFov`).
- **PWA:** `public/manifest.webmanifest` + icons. `dist/sw.js` is generated after each build (plugin
  `im-dog:service-worker`) from the full file list:
  - it precaches everything, under a cache name hashed from the files' contents, and deletes old caches on
    activate;
  - navigations are network-first, other requests cache-first.

  `main.ts` registers it in production builds only, not on localhost unless `?sw=on`; `?sw=off` removes it.

## Sock Heist (Phase 3; details in `docs/SOCK_HEIST.md`)
```
GameEvents ◄──────────── publish ─────────────┐
   │ listen                                   │
   ▼                                          │
SockHeistController (phases, trade, eat,  ◄── HumanBrain (state machine) ── intent ──► HumanController ──► CharacterBody
 discovery, completion, reset;               ▲ senses (built from Moke's       (NavGrid paths)            (Rapier)
 implements HumanHands)                      │  controller, the sock, physics lineOfSight)
   │ owns Treat, "Give Sock"                 │
   ▼                                  SockHeistRuntime (wiring, per-step senses, UI/audio listeners)
UIManager (speech, objective, SOCK = TREAT, complete screen) · AudioManager (surprise, whoosh, treat bag, crunch, chime)
```
- **Behaviour, body and look are separate**, like Moke's (D7): the brain never touches meshes, and the visual reads
  only plain state (speed, crouch, pose, head yaw). The human can be replaced by a modelled character.
- **The brain** is pure and tested. Each state is one handler returning the next state:
  - Transitions have side effects in `go()` (lines, events).
  - "Arrived" only counts once the body has walked the current goal, since the body's flag is a step behind after
    a state change.
  - Awareness uses the physics `lineOfSight` (solid scenery only) through an injected function.
- **Navigation:** `NavGrid` is built once from `LivingRoom.colliders`:
  - obstacles in the 0.08–1.7 m height band, widened by the human's radius (0.24 m), in 0.1 m cells;
  - A* with no corner-cutting, then string-pulled into a few straight legs.

  The body re-plans when the goal moves more than 0.3 m, or every 0.45 s, and skips ahead when stuck. No
  navigation library.
- **Items:** the sock is still a `Prop` handled by `PickupSystem`. Moke can't pick it up while the human holds it
  (`Carryable.carried`). The trade uses `PickupSystem.handOver()`: out of his mouth, into their hand, never
  through the physics world. `Prop.reset()` puts it back for a replay.
- **Moke:** a new `eat` animation action (holds him still; `eat` clip for a `moke.glb`). The treat and the human
  are attention targets, and the treat is a scent source.
- **Camera:** it still ignores characters (no jitter). `SockHeistRuntime` fades the human to see-through while
  they're between the camera and Moke.

## Testing
Vitest (node environment) covers:
- **Pure logic:** input state, fixed timestep, asset fallbacks, math, the locomotion model and animation state.
- **Integration with the real Rapier WASM,** in a tiny test room (`MokeController.test.ts`): floor contact, a steady
  trot with no stutter steps, walls, sliding, walking under a table and not climbing a couch seat.
- **Gameplay regressions:** interaction height and wall occlusion, conservative prop-drop clearance (including thin
  geometry), repeated pickup/drop and rest transitions, rescue of escaped props, and raw-vs-clamped frame timing.
- **Phase 3:**
  - input: analog sources, touch buttons, joystick maths, touch-state cleanup with a fake DOM, input modes and
    glyphs;
  - camera: the portrait field of view;
  - quality presets and dynamic resolution; events;
  - Sock Heist: the human brain's states (a simulated room: noticing, chasing, fumbling, standoff, losing him,
    treat, trade, fetch, no soft-lock, replay), awareness, NavGrid (including the real living room), the human
    body with real Rapier, and the heist controller (phases, trade, eating, discovery, reset).
- **The final-model path without a model file:**
  - `syntheticMoke()` builds a tiny spec-shaped model in code;
  - tests cover clip selection and blending, crossfades, missing clips, bones and sockets, the head turn in model
    space (and that turns don't accumulate), ducking, the pickup moment, and the model-or-stand-in choice with its
    warnings.

Rendering, responsive UI and accessibility state are also verified in the browser.
