# I'M DOG? — Current Development State

_Last updated: 2026-09-24. Repo: **public** `christopher-013/im-dog` (D13), branch `main`; the game is hosted at https://christopher-013.github.io/im-dog/ and republished on every push to `main`. Moke's real-dog look, collar and tag, the title-screen fixes, Codex's Phase 1 audit and gamepad support are committed locally on `main`. So are Moke's new tail, the deeper growl and the trick button, with sniff moved to R (Claude). Nothing of Claude's is pushed. See `git log` and `git status`._

## Current Phase
Phase 1

## Current Milestone
**Milestone 10 (polish) is in progress**, started 2026-09-24 at the owner's request. The owner played Milestones 5–9
("the overall gameplay is incredible… I like it") and asked to start M10 with Moke's look: anime style instead of
polygon shapes, following a reference picture they shared (see `docs/MOKE_CHARACTER_REFERENCE.md` → "Owner style
target"). After seeing it, the owner asked for Moke to look **less jagged and more like the real dog** (their photos), then
for shorter ears and a collar with a name tag, and for two title-screen fixes (no scrollbar/cut-off; the dog-face "O"
in line with D and G). Then a tail attached to his body and shaped like the real one, and a deeper growl. All done
and awaiting the owner's look. The rest of M10 (Known Issues below) is not started.

## Last Developer
Claude Code (a review of Codex's commits, three fixes from it, and GitHub Pages hosting; before that the trick button, Moke's tail and a deeper growl). Before that, OpenAI Codex committed its
Phase 1 audit, gamepad support, the cute growl and a collar refit.

## Completed
**Milestone 1: foundation.**
- Vite + strict TypeScript + three.js, Vitest, static build.
- Original I'M DOG? screens; state machine; fixed 60 Hz step; resize/DPR-aware renderer; action-based input.
- Standard USB/Bluetooth gamepad support: automatic polling/detection, analog movement, right-stick camera, D-pad,
  face/shoulder actions, and controller start/pause/resume. Keyboard and mouse work concurrently.
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
- A dark-grey sock with a lighter grey cuff pattern lies on the rug (`landmarks.sock`). "E — Pick Up Sock" → it rides crosswise in
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

**Milestone 10 (in progress): Moke's look, modelled on the real Moke.**
- `ToonMokeVisual` replaces `PlaceholderDogVisual` (deleted). Generated entirely in code, no image files.
- First pass: an anime look from the owner's illustration. Current pass: the owner asked for "less jagged, more like
  the real dog", so it now follows the photos in `reference/moke/`:
  - **Coat:** soft rounded clumps covered in a layer of small curls (`furClump` `curls`), with a soft shadow in the
    creases between curls (`furCavity` vertex attribute). No pointed tufts. A round cotton-ball head, wavy
    cream-tinted ears that widen his head at ear level, a fluffy chest, trimmed curly legs.
  - **Face:** round, very dark glossy eyes (not big anime eyes), a bigger glossy black button nose on a short,
    broad muzzle with a fluffy mustache and beard. No blush, no drawn smile: the mouth only shows (dark lips, pink
    tongue) when he barks or pants. Closed eyes are a short dark lash line.
  - **Shading:** soft (wide lit/shade transition) with neutral grey shade, and a thin soft grey silhouette line
    (`MOKE_LOOK.outline.enabled` switches it off).
  - **Ears shortened** (owner, comparing with the "Relax" bandana photo): they end at about mouth level instead
    of below the jaw. Only their length changed.
  - **Collar and tag** (owner request, then refined against a photo of Moke wearing his): a blue strap snug round
    his neck immediately beneath the round head, ending under the chin before the muzzle and hidden by fur at the
    sides and back; a navy bone-shaped tag attached to the strap by a silver ring, hanging straight down and
    jingling a little as he trots. Colours and the name are in `MOKE_LOOK.collar`.
  - **Tail** (owner, from a photo of Moke from the side): one long, curly plume that rises out of the top of his
    rump, arches and curls forward over his back. It's a single fur clump bent along a curve
    (`bendAlongCurve`), rooted inside the rump so it stays attached while it wags, sweeps back at a run or tucks
    down. Shape and root are `TAIL` in `ToonMokeVisual.ts`. (Before, a round pom-pom floated above his back on a
    thin stem hidden in the fur, so it looked detached.)
- Static parts are merged: 9 fur meshes, each with a silhouette line; about 110k triangles including the lines.
- The tail tucks lower while he ducks, so the plume still clears the coffee table.
- All look numbers are in `src/config/mokeLook.ts` (palette, key light, crease shading, outline, collar, blinks).
- Gameplay untouched (D7): same `MokeVisual` interface, same `mouthSocket`, same animation state.

**Milestone 10 (in progress): tricks** (owner request: "replace the smell button with a trick button").
- Q / controller X: a random trick, never the same twice in a row, all things a small dog really does:
  - **belly up:** lies down, rolls onto his back with all four paws up and a wiggle, head turned to look at you,
    tongue out;
  - **beg:** up on his hind legs, front paws paddling, a little sway for balance, tail out behind;
  - **give paw:** sits, lifts his right front paw and shakes, with a head tilt;
  - **spin:** one quick circle chasing his tail, paws pattering.
- He stays put for a trick (about 1.2–2.8 s); moving or E cuts it short straight away. No belly-up with something
  in his mouth; no begging under the furniture; not in his bed, while sniffing or mid-trick.
- **Sniff moved** (owner's choice) from Q to **R**, and from X to **pressing the right stick** on a controller.
- Code: `player/Tricks.ts`, `MokeAnimationController.trick/cancelTrick`, `TrickPose` in `ToonMokeVisual`, lengths in
  `MOKE_ANIMATION.tricks`.

**Milestone 10 (in progress): review fixes and hosting.**
- Code review of Codex's commits (`6804ffd`, `3a2d761`); fixed:
  - Enter/Space on any focused menu control (CONTROLS, the invert-Y box…) also started or resumed the game. Menu
    confirm/resume are now controller-only (A, Start); keyboard menus use the focused button natively.
  - Esc on the pause screen resumed the game, so closing the Controls dialog with Esc resumed play (and Esc that
    released the mouse could un-pause at once). Esc now only pauses.
  - Controller buttons still held after a pause or focus loss were dropped until re-pressed. They're now held
    again without counting a new press (so holding Start can't re-trigger a resume).
  - Menu decisions moved into `core/MenuInput.ts` (tested); A or Start closes the Controls dialog when it's open.
- Not fixed yet (from the same review): the toast and "E — …" prompt aren't announced by screen readers (their
  text changes while still `aria-hidden`); Codex recoloured the sock charcoal without updating the docs (the M6 notes
  below still say coral); two small controller-code allocations per frame.
- **Hosting:** GitHub Pages at https://christopher-013.github.io/im-dog/ via `.github/workflows/deploy-pages.yml` (tests + build on every push to
  `main`). The owner chose to make the repo public; the git history was audited first (only the photo folder's
  README was ever committed; no images, secrets or private files).

**Milestone 10 (in progress): title screen.**
- The title and loading stacks are no longer scroll containers (that produced a horizontal scrollbar and clipped
  the tilted "?"). The logo scales with both width and height (`min(10.5vw, 17vh)`), and very short windows hide
  the Japanese tag. Cards (pause, error, controls) still scroll on tiny windows.
- Critical inline styles keep the loading logo, text and HUD hidden until their full stylesheet is ready, preventing
  an unstyled image/text flash during refresh.
- The dog-face "O" is now 0.76em and centred on the capitals, in line with D and G.

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
- **Moke's look:** `ToonMokeVisual` + `player/toon/` (fur geometry with curls and creases, soft toon/outline materials, eye and tag textures), tuned in `config/mokeLook.ts`.
- Details: `docs/ARCHITECTURE.md` (sections "Interactions", "Props and carrying", "Sniff mode", "Bark and audio").

## Current Gameplay State
**Gamepad controls (2026-09-24):** standard browser gamepads are detected automatically. Left stick/D-pad moves,
right stick looks, A/bottom interacts and confirms, B/right barks, X/left does a trick, Y/top growls, right stick press
sniffs, LB/LT walks, RB/RT runs,
Menu/Start pauses/resumes, and View/Back toggles debug. The Controls screen and `docs/CONTROLS.md` show the mapping.
Automated mapping/deadzone/disconnect coverage passes; final feel and physical-button confirmation require the owner's
connected controller because the embedded automation session cannot actuate USB hardware.

**Moke's tail + deeper growl (2026-09-24):** the new tail was checked in the browser from the side, from behind at
full wag, and by tests (its root stays under his body fur idle, mid-wag, running and ducking; he still clears the
coffee table). The growl synth is now deeper and throatier: a ~80 Hz buzzing voice with a ~26 Hz "rrr" rattle, a
little grit, dark chest/mouth resonances and rough breath. Rendered offline and measured: strongest pitch 127 → 81
Hz, spectral centroid 473 → 352 Hz, energy below 300 Hz 78% → 96%; it peaks lower than a bark and its loudness while
sounding is ~1.4× the bark's (lows read quieter). It played through `AudioManager` in the game without errors.
**Not heard by Claude**: the owner should listen.

**Cute growl + collar fit (2026-09-24):** G / controller Y triggers a short mock-tough growl: lower planted stance,
forward chest, pinned ears, squint, head tremble, four tiny visible teeth, an original soft growl synth and a comic
“grrr” bubble. It has no gameplay/combat effect. The collar loop was moved 14 mm farther back and seated 4 mm
deeper into the neck fluff, with a slightly shorter front arc; the rest of Moke's appearance was not changed.

**Milestone 10, ears + collar (2026-09-24, third pass):** the shorter ears and the collar/tag were checked from the
front, side, behind and lying in the bed ("Moke" is readable on the tag in a front close-up; lying down, the collar
stays under his chin and the tag rests between his paws).

**Milestone 10, real-Moke restyle + title screen (2026-09-24, second pass):** checked in the in-app browser (dev
server) with close-ups from the front, front ¾, side and behind, plus lying in the bed (lash-line eyes) and barking
(open mouth, tongue). The title screen was checked at 1360×745 (the owner's size), 800×450 and 375×812: no
scrollbar, the page doesn't scroll, and the "O" sits in line with D and G. Render timing at 800×450 was too noisy to
isolate Moke's share (under 1 ms per frame either way). **Not judged:** the owner's eye on the new look, in motion
at full frame rate, the dim hallway.

**Milestone 10, first anime pass (2026-09-24):** close-ups, poses and play from the follow camera; about 0.34 ms
per frame for Moke at 1280×720; production preview loaded and played with no console messages.

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
- Pointer lock is untested with a physical mouse (the embedded test browser uses drag-to-look).
- The embedded browser reported roughly 25–29 FPS at 1920×953, but automation/background throttling and 100 ms stalls make that unsuitable as a real-GPU benchmark; recheck manually.
- Moke's nose and tail can poke a few centimetres into walls; the walk key C is unconfirmed; Moke's real size is still an estimate.
- The camera turns by itself in a few situations (intentional, tunable) and needs the owner's feel check.
- Chrome logs one non-fatal WebGL shader precision warning (`X4122`) while compiling the current Moke material; rendering continues normally.

New in Milestone 4:
- The potted plant looks a little sparse and spiky. It could be lusher in the polish milestone.
- The window's sun patch is fairly subtle under the brighter room lighting.
- There's no ambient occlusion (a post-processing choice), so contact areas under furniture are softer than in a film look.

New in Milestone 10 (Moke's look):
- Tuned by eye in the embedded browser only. Curl size, crease strength, eye size and ear width are first passes
  for the owner to react to (`config/mokeLook.ts` and the `ToonMokeVisual` layout constants).
- The curls are geometry, so they're coarser than his real tight ringlets; finer curl texture would need a shader
  pattern or more triangles.
- From the usual follow camera (behind and above) his plume tail covers much of the back of his head. That's true
  to the real Moke, but it could be lowered.
- The eyes are unlit decals: they don't darken in the dim hallway.
- There's no sit pose (several photos show him sitting).
- The logo "O" face (inline SVG) is still the earlier cartoon face with pink cheeks; it could be redrawn to match.
- The tag's name is small: readable in close-ups, not from the usual follow camera behind him.
- The collar's loop is measured in the standing pose. It moves with his head, so when he sniffs or lies down it can
  dip into his chest fur for a moment.

New in Milestones 5–9:
- Carried props have no collision, so they can visually poke into walls.
- Ball kick strength and roll distance, sniff duration and wisp look, and the lie-down timing are first guesses; they need a feel check.
- The bark sound is a synthesized placeholder, unheard by Claude. The owner decides the final bark.
- Getting up while carrying: the drop prompt (priority 10) outranks "Lie Down", so E near the bed drops the item first.
- In headless tests the bark bubble fades within 0.85 s; its placement over his head is projected from his
  position and hasn't been judged on a real display.

## Verification Status
Run on 2026-09-24 after the review fixes and adding hosting:

| Command / check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass: 27 files, 179 tests (new: menu input ×5, a controller button held through a pause ×1) |
| `npm run build` | Pass. `verify-dist`: no private photos. |
| In-app browser, dev server | Enter on CONTROLS opens the dialog and stays on the menu; Space in the dialog doesn't start; Esc pauses; Esc closing the dialog on the pause screen stays paused; plain Esc on the pause screen stays paused |
| GitHub Pages | See the deploy run on GitHub (Actions → Deploy to GitHub Pages) |
| Not verified | A physical controller; Firefox and Safari |

Run on 2026-09-24 after adding tricks:

| Command / check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass: 26 files, 173 tests (new: trick picking ×4, trick timing and cancelling ×2, every trick stays above the floor and begging fits its headroom, back to normal after a trick; gamepad test updated for X = trick, right stick press = sniff) |
| `npm run build` | Pass. `verify-dist`: no private photos. |
| In-app browser, dev server | Each trick posed and looked at; in play (frames stepped by hand, as the pane pauses when hidden): six Q presses gave all four tricks with no repeats, he stayed put and each trick ended on its own; W cut belly-up short and he trotted off; R started sniff mode; the Controls screen shows Q/X = trick and R/right stick = sniff; no console errors |
| Not verified | Trick feel at full frame rate; a physical controller's right-stick press; Firefox and Safari |

Run on 2026-09-24 after Moke's tail and the deeper growl:

| Command / check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass: 25 files, 165 tests (new: `bendAlongCurve` ×2, tail stays rooted in his body ×1) |
| `npm run build` | Pass. `verify-dist`: no private photos. |
| In-app browser, dev server | Tail from the side and from behind at full wag; growl played via `AudioManager` (no errors); growl rendered offline and measured (see above) |
| Not verified | Hearing the growl; the tail in motion at full frame rate; real-GPU FPS; Firefox and Safari |

Run on 2026-09-24 for this commit (Moke's real-dog look, ears, collar and tag, title screen):

| Command / check | Result |
|---|---|
| Committed files alone (exported to a clean folder) | `npm run typecheck` pass; `npm test` pass (21 files, 144 tests); `npm run build` pass, `verify-dist` pass (the private photos are git-ignored, so the full working tree covers that check) |
| Full working tree (with the other agent's uncommitted batch) | typecheck, 24 files / 153 tests, build: pass |
| In-app browser, dev server | Moke close-ups (front, ¾, side, back), rest and bark poses, the collar and tag from every side; title screen at 1360×745, 800×450, 375×812 |
| Not verified | The owner's eye; real-GPU FPS in motion; the dim hallway; Firefox and Safari; the production preview (not re-run) |

Run on 2026-09-24 after the independent Codex Phase 1 audit, with Claude's real-Moke restyle and title-screen fixes preserved:

| Command / check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass: 24 files, 152 tests, including real-Rapier reach/occlusion, swept drop clearance, repeated pickup/drop and rest cycles, and frame timing |
| `npm run build` | Pass. Main bundle 751.29 kB (200.24 kB gzipped); Rapier 2853.74 kB (1094.44 kB gzipped). `verify-dist`: no private photos. `THIRD_PARTY_NOTICES.txt` emitted. |
| `git diff --check` | Pass |
| In-app browser, dev server | Loading/menu/play/pause/resume/controls/debug; drag orbit; Q sniff; F bark; short-viewport controls; hidden-screen accessibility state |
| In-app browser, production preview | Loaded and played; controls dialog, Q sniff, F bark and pause worked; no console warnings or errors |
| Not verified | Physical pointer lock and audio-by-ear; sustained keyboard feel; real-GPU FPS; Firefox and Safari; owner's approval of Moke's look |

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
- Gamepad: `src/core/GamepadInput.ts`, `src/core/InputState.ts`, and mappings/tuning in `src/config/input.ts`.
- Moke's look: `src/player/ToonMokeVisual.ts`, `src/player/toon/`, `src/config/mokeLook.ts`.

## Next Recommended Task
1. The owner playtests on real machines (https://christopher-013.github.io/im-dog/): mouse capture, audio by ear, a controller, real-GPU frame rate,
   and the feel of movement, camera and tricks. Then says what to change. Tune from that (`config/mokeLook.ts` first).
2. Continue Milestone 10 with the owner's priorities. Candidates:
   - redraw the logo "O" face to match the real Moke;
   - a sit pose when idle;
   - Known Issues above (loading-overlay ghosting, carried props poking walls, drop vs. lie-down priority);
   - the open questions: final bark sound, walk key C, camera auto-follow strength.
