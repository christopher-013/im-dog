# I'M DOG? — Current Development State

_Last updated: 2026-09-24. Repo: private `christopher-013/im-dog`, branch `main`. Milestone 10 work (Moke's anime look) is on the local branch `claude/m10-anime-moke`, not yet merged into `main`. See `git log` and `git status`._

## Current Phase
Phase 1

## Current Milestone
**Milestone 10 (polish) is in progress**, started 2026-09-24 at the owner's request. The owner played Milestones 5–9
("the overall gameplay is incredible… I like it") and asked to start M10 with Moke's look: anime style instead of
polygon shapes, following a reference picture they shared (see `docs/MOKE_CHARACTER_REFERENCE.md` → "Owner style
target"). That first item is done and awaits the owner's look. The rest of M10 (Known Issues below) is not started.

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

**Milestone 7: physics toys.**
- A tennis ball (`landmarks.ball`, open floor right of spawn) and a teal/cream knotted rope toy (`landmarks.toy`,
  near the TV console). Both roll or slide when Moke bumps them, and both can be picked up, carried and dropped
  ("Pick Up Tennis Ball", "Pick Up Rope Toy") through the same `PickupSystem`, with no one-off logic.
- A toy-only bumper collider on Moke knocks the ball ahead (Rapier tests: he never climbs a toy; the ball stays in
  the room and settles). Speeds are capped per prop; props that escape return to their spot.
- Debug panel → Physics → `props`: each prop's state (carried / asleep / speed).

**Milestone 8: sniff mode (+ bark).**
- Q: about 4 s of sniff mode. The nearest/strongest scents (sock = lilac, toys = mint, bed = gold) send up soft
  curling wisps that lean toward his nose, with a gentle glow pulsing at each source. Moke puts his nose down and
  twitches; the screen edges get a warm haze. Reusable `ScentSystem` / `ScentSource` with all eight categories.
- F: bark. A little hop and head jolt, the mouth opens, a comic "Arf!"/"Woof!" pops above his head, and a
  synthesized bark plays. The sniff, pickup and drop sounds are synthesized too (`AudioManager`, unlocked by PLAY).
- Debug panel: "Scent" (sniff state, sources, the ranked nearby list); "Game" shows audio state and bark count.
- No treat placeholder was added (optional in the spec); the four sources are the sock, rope toy, ball and bed.

**Milestone 10 (in progress): Moke's anime look.**
- `ToonMokeVisual` replaces `PlaceholderDogVisual` (deleted). Still generated entirely in code, no image files.
- **Fur:** soft, slightly pointed tufts swept along the fur's flow (`toon/furGeometry.ts`) on a big round head with a
  fluffy crown, long ear curtains to the jaw, a fluffy chest bib, fluffy legs with round paws, and a plume tail.
  The face stays smooth. Static parts are merged: 9 fur meshes, each with an outline.
- **Cel shading** (`toon/toonMaterials.ts`): white fur with lavender-grey shade, split by a soft character key
  light (from the camera's upper left), a warm rim, lit as smooth forms (the anime-hair trick). The room's lights
  and shadows still scale his brightness. **Ink outlines** by inverted hulls, even width in pixels.
- **Face:** big glossy brown eyes (dark rim, two catch-lights) that blink every few seconds, pink blush, a black
  button nose with a highlight, a "w" smile; open mouth + tongue when barking or panting at a run; closed ‿ eyes
  while resting; a squint while sniffing or barking.
- The tail tucks lower while he ducks, so the fluffier plume still clears the coffee table.
- All look numbers are in `src/config/mokeLook.ts` (palette, key light, room-light influence, outline, blinks).
- Gameplay untouched (D7): same `MokeVisual` interface, same `mouthSocket`, same animation state.

**Milestone 9: rest.**
- In or at the open front of his bed, "E — Lie Down". He shuffles to the centre, turns round to face out and flops
  into a sphinx pose (tummy down, front paws forward, head resting, sleepy half-closed eyes, lazy tail).
- The camera drops and settles a little closer, and looks down into the bed so the bolster never blocks the view.
- The HUD goes quiet: a soft breathing "Resting…" note, the toast hidden, the "E — Get Up" prompt dimmed.
- E or any fresh movement key stands him up (0.45 s), then he's free. No nap mini-game.
- `RestSystem` (state machine: standing → settling → resting → rising), `MokeController.glideTo` for the shuffle,
  `MokeAnimationState.rest`, `CameraTarget.rest`. Debug panel: Moke → `rest` phase and pose.

## Current Architecture
- `Game` owns the scene, renderer, input, physics, UI and state machine. Frame order:
  1. input
  2. global keys
  3. discrete actions (while playing): E → `InteractionSystem.interact()`, F → bark, Q → sniff, move keys → get up
  4. fixed steps: `MoveBasis` → `MoveIntent` → `Moke.fixedUpdate` (or `glideTo` / held still by `RestSystem`)
     → `RestSystem.update` → `PhysicsWorld.step` → `Prop.afterStep`
  5. `Moke.update`, `Prop.render`, interaction prompt, `ScentSystem` + `ScentWisps`, resting HUD
  6. `ThirdPersonCamera.update` (bark bubble placed after it)
  7. render
  8. debug
- **Moke:** `MokeController` → `MokeAnimationController` → `MokeVisual` (placeholder). Gameplay never touches meshes.
- **Physics:** `PhysicsWorld` (static boxes with collision layers, `sweepSphere`, `rayDistance`), `CharacterBody`
  (kinematic capsule + toy bumper) and `PropBody` (dynamic props on the `toy` layer).
- **Gameplay systems:** `interactions/` (`InteractionSystem`, `PickupSystem`, `RestSystem`), `props/` (`Prop`),
  `senses/` (`ScentSystem`, `ScentWisps`), `audio/` (`AudioManager`, synthesized sounds), `player/Bark.ts`.
- **World:**
  - `LivingRoom` (shell, layout, spawn, landmarks) is built from `furniture.ts` pieces via `StaticSceneBuilder`.
  - Palette in `materials.ts`, textures in `textures.ts`.
  - `RoomLighting` plus `applySoftEnvironment`.
- **Tuning** is in `src/config/`: `movement.ts`, `camera.ts`, `animation.ts`, `input.ts`, `engine.ts` (including the
  lighting balance), `world.ts`, `interaction.ts` (reach, rest), `props.ts`, `senses.ts`, `audio.ts`.
- **Moke's look:** `ToonMokeVisual` + `player/toon/` (fur geometry, toon/outline materials, face textures), tuned in `config/mokeLook.ts`.
- Details: `docs/ARCHITECTURE.md` (sections "Interactions", "Props and carrying", "Sniff mode", "Bark and audio").

## Current Gameplay State
**Milestone 10, Moke's look (2026-09-24):** checked in the in-app browser (dev server) with close-up renders from
the front ¾, side, behind and in play: standing, barking (mouth + tongue, squint), lying in the bed (shut ‿ eyes),
sniffing (nose down, squint), and carrying the sock. Running under the coffee table and the menu view look right.
Moke's rendering cost measured at about 0.34 ms per frame at 1280×720 (0.64 ms with him vs 0.30 ms without, a
close camera, synchronous `gl.finish()` timing); about 90k triangles including outlines. Production preview:
loads and plays with no console messages. **Not judged:** how he looks on the owner's display, in motion at full
frame rate, and in the dim hallway.

**Milestones 5–9 (overnight):** verified with unit and Rapier tests plus headless Chromium (SwiftShader, about
10 FPS, so no feel or performance judgement). Screens checked: sock/rope toy in mouth, "E — …" prompts, sniff
wisps + ranked debug list, the bark bubble animation, lying in the bed from front and back, quiet HUD. The
production preview loads and plays (Q, F, W) with no console errors apart from SwiftShader's
`KHR_parallel_shader_compile` capability warning. Not heard: any audio. Not done: keyboard-steered pickup in a
browser (it was driven through the dev `imdog` hook), hands-on feel, real-GPU performance.

From Milestone 4, verified in the browser (dev server and a production-build load):
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

New in Milestone 10 (Moke's look):
- The look is tuned by eye in the embedded browser only. Palette, outline width, tuft sizes and eye size are
  first passes for the owner to react to (all in `config/mokeLook.ts` and the `ToonMokeVisual` layout constants).
- From the usual follow camera (behind and above) his plume tail covers much of the back of his head. That's true
  to the real Moke, but it could be lowered if the owner prefers to see more head.
- The room props (sock, ball, rope toy) and furniture aren't toon-shaded or outlined, so Moke is a little more
  "anime" than his surroundings. Matching them is a possible next M10 step.
- The eyes are unlit decals: they don't darken in the dim hallway.
- Legs are simple fluffy columns; there's no sit pose (the reference picture shows him sitting).

New in Milestones 5–9:
- Carried props have no collision, so they can visually poke into walls.
- Ball kick strength and roll distance, sniff duration and wisp look, and the lie-down timing are first guesses; they need a feel check.
- The bark sound is a synthesized placeholder, unheard by Claude. The owner decides the final bark.
- Getting up while carrying: the drop prompt (priority 10) outranks "Lie Down", so E near the bed drops the item first.
- In headless tests the bark bubble fades within 0.85 s; its placement over his head is projected from his
  position and hasn't been judged on a real display.

## Verification Status
Run on 2026-09-24 after Moke's anime look (Milestone 10):

| Command / check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass: 21 files, 142 tests (new: `furGeometry` ×5, `ToonMokeVisual` ×7, incl. clearance under the coffee table, blinking, eyes shut while resting, mouth open/closed) |
| `npm run build` | Pass. Main bundle 750 kB (200 kB gzipped). `verify-dist`: no private photos. |
| In-app browser, dev server | Close-ups (front ¾, side, back), poses (bark, rest, sniff, carry), play from the follow camera, a run under the coffee table |
| In-app browser, production preview | Loads, PLAY: no console messages |
| Not verified | The owner's eye on the look; real-GPU FPS in motion; the dim hallway; Firefox and Safari |

Run on 2026-09-24 at the end of Milestone 9 (overnight):
Run on 2026-09-24 at the end of Milestone 9 (overnight):

| Command / check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass: 19 files, 130 tests (new: interaction, pickup, rest (incl. Rapier bed test), props (Rapier), scent, bark, animation) |
| `npm run build` | Pass. Main bundle 737 kB (195 kB gzipped). `verify-dist`: no private photos. |
| Headless Chromium (SwiftShader), dev server | Carry/drop, toys, sniff, bark and rest, as above (screenshots, DOM and debug values) |
| Headless Chromium, production preview | Loads, PLAY, Q/F/W: no console errors (only the SwiftShader capability warning) |
| Not verified | Hands-on feel; audio by ear; pointer lock; real-GPU FPS; Firefox and Safari |

Earlier, at the end of Milestone 4:

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
- `src/config/`: `movement.ts`, `camera.ts`, `engine.ts` (lighting balance), `interaction.ts`, `props.ts`, `senses.ts`, `audio.ts`.
- `src/camera/ThirdPersonCamera.ts`, `src/player/`, `src/physics/`, `src/core/Game.ts`.
- `src/interactions/`, `src/props/`, `src/senses/`, `src/audio/`.
- Moke's look: `src/player/ToonMokeVisual.ts`, `src/player/toon/`, `src/config/mokeLook.ts`.

## Next Recommended Task
1. The owner looks at the new Moke in Chrome (`npm run dev`) and says what to change: eye size, fur fluffiness,
   shading contrast, outline weight, tail height.
2. Tune the look from that feedback (`config/mokeLook.ts` first).
3. Continue Milestone 10 with the owner's priorities. Candidates:
   - matching toon shading/outlines on the props;
   - a sit pose when idle;
   - Known Issues above (loading-overlay ghosting, carried props poking walls, drop vs. lie-down priority);
   - the open questions: final bark sound, walk key C, camera auto-follow strength.
