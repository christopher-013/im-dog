# I'M DOG? — Current Development State

_Last updated: 2026-09-25. Repo: **public** `christopher-013/im-dog` (D13), branch `main`; the game is hosted at https://christopher-013.github.io/im-dog/ and republished on every push to `main`. **Phases 1–3 are complete** (tags `phase-1-complete`, `phase-2-complete`, `phase-3-complete`). **Phase 4, "Moke's Home & Family Life", is built but not closed and not committed** (the owner's brief: "do NOT automatically commit"): the whole home from the owner's photos, a new stylized human with a daily routine, Moke ↔ human interaction, Treat Hunt, Perfect Nap, Make Human Play and Dog Logic. The hosted game is still the Phase 3 build._

## Current Phase
**Phase 1: complete** (technical prototype), closed by the owner on 2026-09-24 and tagged `phase-1-complete`.
**Phase 2: complete** ("Make Moke actually Moke", the Moke character foundation), started and closed by the owner
on 2026-09-24, tagged `phase-2-complete` and pushed. Scope and criteria: `docs/PHASE_2.md`.
**Phase 3: complete** ("Sock Heist + Mobile Web Play", from the owner's brief of 2026-09-24), closed by the owner on
2026-09-25 and tagged `phase-3-complete`. Every milestone (3.1–3.8) is implemented, tested and played through in the browser on desktop
and at phone sizes (emulated touch). The owner also played on a physical phone and reported that mobile looks and
plays great. **Still not documented:** the exact phone/browser, installing the web app and real-device performance.
The owner judged the desktop Sock Heist chase fun. Scope, criteria and what's carried forward: `docs/PHASE_3.md`.
**Phase 4: built, not closed** ("Moke's Home & Family Life", from the owner's brief of 2026-09-25, with photos of the
real home). Milestones 4.1–4.10 implemented, tested and played through in the browser (desktop and emulated phone).
**Not done:** the owner's own play, a physical phone, real-GPU frame rate. **Uncommitted.** Scope, criteria and status:
`docs/PHASE_4.md`.

## Current Milestone
**Phase 4, Milestone 4.10 (cross-platform polish): done in emulation;** the phase awaits the owner's review.
Before Phase 4: Phase 3 is closed. Carried forward from it (`docs/PHASE_3.md` → "Carried forward"): a documented
browser/device matrix, PWA installation, sustained phone performance and post-fix phone audio
(`docs/MOBILE.md`, `docs/SOCK_HEIST.md`), listening to "Irasshaimase!", and detailed Sock Heist tuning.
The owner played Sock Heist on the desktop ("the chase works great, it is fun"; escaping, the treat, and not
escaping all tested), then later reported that mobile looks and plays great. They also asked for a jump and a
clearer phone screen (below): done, committed and pushed.
**Still carried forward from Phase 2: the final `moke.glb`** (FINAL MOKE 3D ASSET REQUIRED), a rigged, animated model
built outside the repo to `docs/MOKE_3D_SPEC.md` (which now also lists `eat` and `jump` clips) and installed per
`docs/MOKE_INTEGRATION.md`. Until then the game uses the procedural stand-in (`ToonMokeVisual`).

How Milestone 10 went: it started 2026-09-24 at the owner's request. The owner played Milestones 5–9
("the overall gameplay is incredible… I like it") and asked to start M10 with Moke's look: anime style instead of
polygon shapes, following a reference picture they shared (see `docs/MOKE_CHARACTER_REFERENCE.md` → "Owner style
target"). After seeing it, the owner asked for Moke to look **less jagged and more like the real dog** (their photos), then
for shorter ears and a collar with a name tag, and for two title-screen fixes (no scrollbar/cut-off; the dog-face "O"
in line with D and G). Then a tail attached to his body and shaped like the real one, a deeper growl, a trick button,
a code review of Codex's commits with fixes, and hosting on GitHub Pages. What's left is in Known Issues below and
carries into Phase 2.

## Last Developer
Claude Code: all of Phase 4 (2026-09-25, uncommitted). Before that, Claude Code: the jump, the combined bark/growl button and the touch paw menu (committed and pushed at the owner's
request), after all of Phase 3 (committed and pushed
at the owner's request for phone testing) and committing, tagging and pushing Phase 2.
Before that, Claude closed Phase 1 (a review of Codex's commits with fixes, GitHub Pages hosting, the trick button,
Moke's tail and a deeper growl). OpenAI Codex committed its Phase 1 audit, gamepad support, the cute growl and a
collar refit.

## Completed
**Phase 4, "Moke's Home & Family Life" (2026-09-25, uncommitted; the owner's brief).** Details in `docs/PHASE_4.md`,
`HOME_REFERENCE.md`, `HUMAN_SYSTEM.md`, `ACTIVITIES.md`, `DOG_LOGIC.md`.
- **4.1 References:** nine home photos in `reference/home/` (git-ignored like the Moke photos; the build's leak check
  covers them; `reference/home/README.md` explains), studied into `docs/HOME_REFERENCE.md` (layout, landmarks,
  scale, colours, dog-scale features, uncertain details, missing references).
- **4.2 The home:** `world/Home.ts`: the living room's hallway now opens into a new wing drawn from the photos: the
  kitchen and family room (one great room) and the dining room, plus the sunroom through glass (`world/home/`). Built
  in code, no photo textures. Whole-house colliders, NavGrid and fitted sun shadows; props kept inside the house.
- **4.3 The human:** `StylizedHumanVisual` (a skinned, code-built stylized adult: face with moving eyes, blinks,
  brows and mouth; hands with fingers; props), animated by `HumanAnimationController` over the `HumanRig` contract.
  `ToonHumanVisual` removed.
- **4.4 Daily life:** `HumanActivityController` + `ActivityScheduler` + activities as data (`config/activities.ts`)
  at interaction points (`world/home/places.ts`): TV, reading, phone, coffee, cooking then dinner, relaxing, the
  counter, laundry. Sits and stands; routes round Moke; gives up rather than teleports; plugged into `HumanBrain` as
  its idle driver so the Sock Heist interrupts and resumes it. The TV glows, a pot steams, dinner appears.
- **4.5 Moke ↔ human:** `HumanReactions` (look, hello, bark replies, attention, praise, pats, "not now"); "Get Pets";
  Moke's petted reaction (sit, head up into the hand, wag, a heart).
- **4.6–4.8:** Treat Hunt, Perfect Nap (seven nap spots; "Nap Here"), Make Human Play, on one lifecycle
  (`activities/`). E / the paw sniffs when there's nothing to interact with.
- **4.9 Dog Logic:** eight equations (`config/dogLogic.ts`), the card draws any of them, queued, remembered.
- **4.10:** browser play-throughs (desktop, emulated phone), performance vs. the baseline, the build's privacy check.

**Owner requests, 2026-09-25 (committed and pushed): Moke can jump; one button barks or growls; the paw menu on touch.** The owner asked for nothing
else to change in the game's look and feel.
- **Jump:** Space, controller **B** (was bark), and a new touch **JUMP** button. He can get up onto the couch seat
  and the coffee table (0.45 m), the highest places he can reach: never the TV console or side table (0.56 m), the
  couch's arms (0.64 m) or its back (0.88 m). The cap is measured from the floor, so jumping from the couch is only
  a little hop and can't chain higher. No jumping under the coffee table; a press just before landing still counts;
  Space or B in his bed gets him up.
  - **How it's enforced:** the take-off speed puts his feet at exactly 0.50 m at the top. He counts as standing only
    with something under his middle (`CharacterBody.groundBelow`), so he slides off an edge rather than balancing on
    a corner. In the air he can't slide up over an edge (`move({ noClimbing })`). Tuning: `JUMP` and
    `MOKE_BODY.minSlopeSlide` in `config/movement.ts`.
  - **So he stands on cushions, not inside them:** Moke-only (`thin`) colliders for the couch's arms, back cushions
    and pillows, the books and mug on the coffee table, and the plant's leaves (so he can't stand on the pot).
    Their footprints are inside the furniture's own, so the camera, the human's eyes and pathing are unchanged.
  - **Look:** in the air his legs stop walking and reach: front paws forward, hind legs back. His nose goes up on
    the way up and down on the way down, his ears and tail fly, his mouth opens, and he squashes a little on landing
    (`air`, `rise`, `land` in `MokeAnimationState`). The glTF path gets a `jump` clip.
  - **Sock Heist:** jumping up with the sock works as keep-away; the human grabs from the edge and fumbles as
    always. The treat is now never put down inside furniture (`treatSpot`): with Moke up on the couch it could have
    landed inside the couch and stalled the heist.
- **Voice:** F, controller **Y** (was growl) and the touch Bark button now bark **or** growl at random (50/50,
  `BARK.growlChance`). **G no longer does anything** (it was the separate growl key). Only barks alert the human, as
  before.
- **Touch layout:** JUMP sits just outside the small-button arc, between Sniff and Trick. In portrait the interact
  label moved up 18 px to clear it.
- **Then (owner: "too many button controls on the screen"): the paw menu.** On touch, only the stick, the paw and
  pause show. A **tap** on the paw interacts (on release). **Holding** it for 0.3 s pops Jump, Bark, Sniff, Trick and
  Run out of it along the same arc. Slide onto one and let go, or let go and tap one. They tuck back in after 2.5 s
  unused, at once on a paw tap or a camera drag, and on pause, rotation or focus loss; moving with the stick keeps
  them out. With RUN on, the stick is coral. First play shows "Hold for more" above the paw, and the start toast
  says "Hold the paw button for more". Code: `TouchInput` (`TOUCH.menuHoldTime`, `menuIdleClose` in
  `config/input.ts`), `.touch-actions.is-open` in `main.css`.

**Owner request, 2026-09-25 (committed and pushed): a music volume, and a second song, "Japan Stores".** The owner: "The music
sounds great." The pause screen now has **Music** (Hawaiian, Japan Stores or Off) and **Music volume** (0–150%),
both remembered; old saved settings carry over (Music off stays off). The owner asked for 8-bit versions of real
Japanese store entrance chimes (FamilyMart, Lawson, 7-Eleven, Don Quijote), linking videos. Those jingles are other
people's compositions (FamilyMart's is a Panasonic melody; Don Quijote's is its own theme song), and the repo is
public with an original/CC0/licensed-only rule, so they weren't copied. Instead, an original theme in that spirit,
"Irasshaimase!" (`src/audio/music.ts`): every 50 s loop opens with an original "ding-dong… welcome!" door chime,
then a bright tune in the Japanese pop pentatonic over a bouncy shop-radio groove (octave-jumping bass, off-beat
stabs, a thin pulse lead, a kick/snare/hat drum machine). Midway the bells play the Westminster Quarters, the
Japanese school chime (1793, public domain). Switching songs crossfades. The music code now takes a band per song;
the Hawaiian song's note list was fingerprinted before and after the change and is identical.

**Owner request, 2026-09-25 (committed and pushed): background music.** "8-bit video games but Hawaiian styled… like
elevator muzak". An original tune, "Aloha, Moke" (`src/audio/music.ts`): 24 bars, a 64 s loop, 90 BPM, gently swung;
a triangle bass walking between chords, a pulse-wave ukulele strumming the island rhythm on real uke chord
shapes, a square-wave "steel guitar" lead sliding into notes with vibrato and a soft echo, and a quiet shaker. The
harmony is the classic Hawaiian vamp (C6, F6, D7, G7, a bridge through A7). It starts with PLAY, fades in, carries
on quieter on the pause screen, and the pause screen's new **Music** switch turns it off (remembered). Level 0.09:
about −36 dB, some 7 dB under a bark; measured, not heard.

**Owner's phone test, 2026-09-25 (committed and pushed): sound on phones, no sniff button, portrait welcome.** The owner:
"the mobile looks and plays great", but no bark or growl sound on their phone.
- **Sound on phones:** every tap, click or key now wakes the audio (`AudioManager.wake()`); it used to be woken only
  by PLAY/RESUME, and never from iOS Safari's `interrupted` state (a call, the lock screen, switching apps). A
  sound asked for by the waking tap waits for the audio instead of being lost. iPhones get the `playback` audio
  session, so the silent switch doesn't mute the game (`AUDIO.iosSession`; it also pauses other apps' music).
- **Other sounds checked:** all ten rendered offline through a phone-speaker filter. Only the growl (−13 dB) and the
  drop (−16 dB) vanished on a phone speaker; they now have mid-range layers (a throaty rasp, a soft tock) that bring
  them back while changing full-range playback by under 0.5 dB (`AUDIO.speakerPresence`). Table in
  `docs/MOBILE.md`. The bark was always loud enough, so a silent bark means the audio never started: the
  silent switch or the unresumed `interrupted` state are the likely causes. Neither can be reproduced here.
- **No sniff on touch:** the paw menu is Bark, Jump, Trick, Run on one arc (Jump took Sniff's spot, closer to the
  thumb). R and the controller's right-stick press still sniff.
- **Portrait welcome:** the "Rotate your phone" line and the "Landscape is best" chip are gone, the manifest allows any
  orientation, and FULLSCREEN no longer locks landscape.

**Phase 3 (built and pushed, not closed): Sock Heist + mobile web play.** Details: `docs/SOCK_HEIST.md`, `docs/MOBILE.md`,
`docs/PHASE_3.md`.
- **Sock Heist,** the first complete loop. Moke steals the sock from the rug; the human, folding laundry by the basket, notices
  ("Hey! That's my sock!"), chases him round the furniture, fumbles every grab, loses him and searches, gets
  frustrated and fetches a treat from the jar on the TV console, offers it, and trades it for the sock. Moke eats
  the treat, and SOCK = TREAT pops up. Then PLAY AGAIN (reset without a reload) or KEEP EXPLORING. About a minute
  when played straight; longer when he hides or keeps away.
  - **No failure:** the human never catches him, and frustration always ends the chase with a treat. Hiding under
    the coffee table gives a standoff ("Come out of there!") that frustrates him faster. Dropping the sock
    mid-chase makes him fetch it back to the basket and re-arm.
  - **The human** (`src/human/`): `HumanBrain` (explicit state machine, one handler per state, pure logic),
    `HumanAwareness` (sight cone + line of sight + feel + hearing a bark), `NavGrid` (A* on a grid built from the
    room's colliders, no dependency), `HumanController` (Rapier capsule), `ToonHumanVisual` (a code-built
    placeholder person, kept apart from behaviour like Moke's). A speech bubble over his head; he turns
    see-through when he blocks the camera.
  - **Orchestration** (`src/heist/`): `SockHeistController` (phases, the "Give Sock" hand-over, eating,
    discovery, completion, reset), the reusable `Treat` (scent, eye appeal, "Eat Treat"), `DogLogicMemory`
    (SOCK = TREAT remembered in the browser, "Still true" on repeats) and the `GameEvents` hub
    (`src/core/GameEvents.ts`).
  - New furniture: a laundry basket and a treat jar. New synthesized sounds: surprise whistle, grab whoosh,
    treat-bag rustle, crunch, discovery chime. Moke has an eating animation (`eat` in the clip spec).
- **Mobile web play,** the same build:
  - **Touch:** a floating joystick on the left half (push past its ring to run), drag anywhere else to look, and
    buttons for Interact (context label), Bark, Sniff, Trick, Run (toggle) and Pause. Multi-touch by pointer ID;
    everything releases on lift, cancel, blur, pause and rotation. Browser gestures (scroll, pinch, the iOS
    double-tap zoom) are blocked only during play.
  - **Input modes:** keyboard, touch or gamepad, chosen from device capabilities and switched by last use (never the
    user-agent); a touchscreen laptop stays in keyboard mode until the screen is touched. All three feed the same
    `InputState` actions. Prompts and hints follow the mode ("E — Pick Up Sock" / "Pick Up Sock").
  - **Screen:** safe areas, landscape first, portrait playable with a wider field of view and a rotate hint;
    fullscreen button where the browser supports it; first-play onboarding per input mode.
  - **Quality:** HIGH (desktop, unchanged), MEDIUM and LOW (phones) presets with dynamic resolution
    (`src/core/Quality.ts`, `src/config/quality.ts`); `?quality=` overrides.
  - **Lifecycle:** hiding the page pauses the game, suspends audio and resets the frame clock (no time jump).
  - **Home-screen web app:** manifest, icons (`scripts/make-icons.mjs`), a service worker generated at build time
    (production only, never on localhost unless `?sw=on`; `?sw=off` removes it).
  - **LAN testing:** `npm run dev:lan` (opt-in; plain `npm run dev` stays local-only).
- **Tests:** 11 new test files (touch, joystick, input mode, quality, events, control glyphs, nav grid, awareness,
  the brain, the human's body, the heist controller), 283 tests in all.

**Phase 2 (complete, tag `phase-2-complete`): "Make Moke actually Moke", the Moke character foundation.**
- **The final-model path:**
  - `GltfMokeVisual` (`src/player/gltf/`) plays a `moke.glb` built to `docs/MOKE_3D_SPEC.md`:
    - scale and orientation from config;
    - an `AnimationMixer` with clips looked up by name;
    - damped crossfades;
    - the `socket_mouth`, `socket_collar` and `socket_back` sockets;
    - a procedural layer (head/neck glances and tilts, a head lift while carrying, tail wag, ear bounce, jaw, blink);
    - an additive `duck` for the coffee table.
  - Spec problems (clips, bones, sockets, the `blink` morph, height) are reported, never fatal.
  - `createMokeVisual()` picks the model or the stand-in and warns why. A build-time flag means no request and no
    404 while the file is missing.
- **Animation:** `selectClips` maps the model-independent state to clips:
  - actions take their share first, locomotion gets the rest as a 1D blend of the two nearest gaits, with playback
    scaled so the feet keep pace;
  - missing clips are skipped cleanly;
  - clip names and need levels are in `MOKE_CLIPS`.
- **Personality:** after ~8 s standing still he sits (sometimes a play-bow stretch first) and hops straight up when
  he moves. Sometimes he tilts his head at something new. Lying down is staged rump first, then front. Sniffing
  lowers his head toward the strongest scent; a bark lifts his tail.
- **Attention:** `AttentionSystem` has him glance at toys and his bed in front of him, look away, get bored of
  staring, follow the scent while sniffing, and stay quiet while busy or running.
- **Carrying:** carried toys use the reusable `attachments.mouth` socket on both visuals. The sock, ball and rope toy
  offsets were retuned so each sits in his mouth.
- **One authoritative scale:** `MOKE_CHARACTER.size` (`src/config/mokeCharacter.ts`). The camera pivot and ducking
  threshold derive from it, with values unchanged; `MOKE_SIZE` is gone from `world.ts`.
- **Performance:** no per-frame allocations in the new code; the gamepad path's two per-frame allocations were
  removed (a Phase 1 review item).
- **Docs:**
  - new: `MOKE_3D_SPEC.md`, `MOKE_INTEGRATION.md` and `PHASE_2.md`;
  - updated: `MOKE_CHARACTER_REFERENCE.md` (modelling observations), `ASSETS.md`, `ARCHITECTURE.md`,
    `DECISIONS.md` (D14; D12 is now the stand-in), `AGENTS.md` and `README.md`.
- **Not done: the final `moke.glb`.** It needs external modelling, texturing, rigging and animation.
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

**Milestone 10 (done): Moke's look, modelled on the real Moke.**
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

**Milestone 10 (done): tricks** (owner request: "replace the smell button with a trick button").
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

**Milestone 10 (done): review fixes and hosting.**
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
  below still say coral). The two small controller-code allocations per frame were fixed in Phase 2.
- **Hosting:** GitHub Pages at https://christopher-013.github.io/im-dog/ via `.github/workflows/deploy-pages.yml` (tests + build on every push to
  `main`). The owner chose to make the repo public; the git history was audited first (only the photo folder's
  README was ever committed; no images, secrets or private files).

**Milestone 10 (done): title screen.**
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
- `Game` owns the scene, renderer, input, physics, UI and state machine (loading, menu, playing, paused,
  **complete**, error). Frame order:
  1. input (`InputManager`: keyboard/mouse, gamepad and touch into one `InputState`; input mode tracking)
  2. global keys and menu commands (including PLAY AGAIN on the completion screen)
  3. discrete actions (while playing): interact → `InteractionSystem.interact()`, bark, growl, trick, sniff,
     move → get up
  4. fixed steps: `MoveBasis` → `MoveIntent` → `Moke.fixedUpdate` (or `glideTo` / held still by `RestSystem`, a
     trick or eating) → `RestSystem.update` → **`SockHeistRuntime.fixedUpdate`** (the human's senses, brain and
     body; the heist controller) → `PhysicsWorld.step` → `Prop.afterStep`
  5. `updateAttention` (what he glances at) → `Moke.update`, **the human's visual, speech bubble and see-through**,
     `Prop.render`, interaction prompt, `ScentSystem` + `ScentWisps`, resting HUD
  6. `ThirdPersonCamera.update` (bark bubble placed after it)
  7. dynamic resolution (phones only) → render
  8. debug
- **Sock Heist:** `SockHeistRuntime` (`src/heist/`) builds and wires the pieces: `SockHeistController` (phases),
  the `Human` (`HumanBrain` → `HumanController` → `StylizedHumanVisual` since Phase 4, with `HumanAwareness` and `NavGrid`), the
  `Treat` and `DogLogicMemory`. They talk to the rest of the game through `GameEvents` and the existing
  `InteractionSystem` / `PickupSystem`. See `docs/SOCK_HEIST.md` and `docs/ARCHITECTURE.md` → "Sock Heist".
- **Input and mobile:** `TouchInput` + `VirtualJoystick` feed virtual `Touch:*` keys and a touch analog source;
  `InputMode` picks and tracks the mode; `ControlGlyphs` makes mode-aware labels. Quality presets and
  `AdaptiveResolution` in `core/Quality.ts`. See `docs/MOBILE.md`.
- **Moke:** `MokeController` → `MokeAnimationController` (+ `AttentionSystem` → `Moke.lookAt`) → `MokeVisual`.
  `createMokeVisual()` picks `GltfMokeVisual` (`moke.glb`, not made yet) or the `ToonMokeVisual` stand-in. Gameplay
  never touches meshes. Carrying uses `visual.attachments.mouth`. Moke's size lives only in `MOKE_CHARACTER.size`.
- **Physics:** `PhysicsWorld` (static boxes with collision layers, `sweepSphere`, `rayDistance`), `CharacterBody`
  (kinematic capsule + toy bumper) and `PropBody` (dynamic props on the `toy` layer).
- **Gameplay systems:** `interactions/` (`InteractionSystem`, `PickupSystem`, `RestSystem`), `props/` (`Prop`),
  `senses/` (`ScentSystem`, `ScentWisps`), `audio/` (`AudioManager`, synthesized sounds), `player/Bark.ts`.
- **Phase 4:** `Home` (the living room + the wing) replaces `LivingRoom` in `Game`; the human's routine
  (`HumanActivityController`) is the brain's idle driver; `DogActivityDirector` runs the dog activities in the fixed
  step after the heist; `HouseholdEffects` shows the TV, cooking and dinner. See `docs/ARCHITECTURE.md`.
- **World:**
  - `LivingRoom` (shell, layout, spawn, landmarks) is built from `furniture.ts` pieces via `StaticSceneBuilder`.
  - Palette in `materials.ts`, textures in `textures.ts`.
  - `RoomLighting` plus `applySoftEnvironment`.
- **Tuning** is in `src/config/`: `movement.ts`, `camera.ts`, `animation.ts`, `input.ts` (including `TOUCH`),
  `engine.ts` (including the lighting balance), `world.ts`, `interaction.ts` (reach, rest), `props.ts`,
  `senses.ts`, `audio.ts`, `mokeCharacter.ts` (size and `moke.glb` conventions), `attention.ts`, and since Phase 3
  `human.ts` (the human's body, movement, sight, chase and treat timing), `heist.ts` (lines, SOCK = TREAT timing)
  and `quality.ts`.
- **Moke's look:** `ToonMokeVisual` + `player/toon/` (fur geometry with curls and creases, soft toon/outline materials, eye and tag textures), tuned in `config/mokeLook.ts`.
- Details: `docs/ARCHITECTURE.md` (sections "Interactions", "Props and carrying", "Sniff mode", "Bark and audio").

## Current Gameplay State
**Jump (2026-09-25):** Space / controller B / touch JUMP hops him up onto the couch seat or the coffee
table and no higher. F / controller Y / touch Bark barks or growls at random. On touch, the screen shows only the
stick, the paw and pause: tap the paw to interact, hold it for the other buttons. Everything else is as in Phase 3.

**Phase 3 (2026-09-25):** the living room now has a person folding laundry by the basket, and the
charcoal sock on the rug is theirs. Steal it and Sock Heist runs (see Completed). Everything from Phases 1 and 2
still works, including with the human in the room. On phones and tablets the game is played by touch; desktop
controls are unchanged, and the Controls screen and prompts follow whichever device was used last.

**Phase 2 personality (2026-09-24):**
- Standing still, Moke glances at the toys and his bed in front of him, sometimes with a curious head tilt.
- After about 8 s he sits, sometimes with a play bow first, and hops straight up when you move.
- Sniff mode turns his head toward the strongest scent.
- He lies down in his bed rump first, then front.
- Carried toys sit in his mouth.

Controls and gameplay are otherwise exactly as in Phase 1.

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
New with Phase 4:
- **Nobody but Claude has looked at it.** The home's likeness to the real one, the human's look and animation, and
  whether the house "feels inhabited" need the owner's eye. The human's poses were tuned from screenshots only.
- **The human's body:** stylized and smooth-skinned, but simple: long tube arms and legs, a boxy sweater torso, cap
  spheres at the joints that can show at extreme bends; no clothing folds; a few poses (reading, sipping) have hands
  that don't quite meet the prop.
- **No shadows in the wing:** the sun can't reach it (by design, and its furniture no longer casts), so the human and
  Moke have no ground shadow there; point lights don't cast. A blob shadow would help.
- **The family room's sun is drawn on** (an additive patch on the couch and floor), not real light.
- **Timings are first guesses:** routine durations, reaction cooldowns, Treat Hunt hints, how many asks before they
  play (`config/activities.ts`, `config/dogActivities.ts`).
- **The human stops a hunt errand for the heist**, and Treat Hunt's "Sit… stay…" is said even if Moke is far away.
- **Only one Treat Hunt treat and one pair of hands:** the heist's treat and the hunt's are separate; both can't be in
  the hand at once (the heist cancels the hunt's errand).
- **Performance on phones is unmeasured** (emulation only; more triangles and draw calls than Phase 3).
- **Missing references** (`HOME_REFERENCE.md`): the real front living room, measurements, the bedroom hall.

New with the music:
- ~~Nobody has heard it yet~~: the owner says the Hawaiian song "sounds great". **"Irasshaimase!" hasn't been heard
  yet**: its tune, groove and mix are by design and measurement only. Mix: its `band` in `music.ts`; loudness:
  its `gain`.
- It isn't the stores' own chimes (not ours to copy; see Completed); it's an original in their style.
- Each song is one loop (64 s and 50 s), repeated.
- On iPhones (the `playback` session) it pauses the player's own music app while the game plays.

New with the jump:
- **Jump feel hasn't been judged by a person:** height, the snappy gravity (18 m/s²) and the pose (`JUMP`,
  `MOKE_ANIMATION.landDuration`/`airPitchSpeed`). The camera follows his height with its existing smoothing and
  wasn't changed; nobody has judged whether it bobs too much.
- On the couch or table, jump is only a small hop (the cap is measured from the floor). To get down, walk off the
  edge.
- He can also jump onto lower things: the laundry basket (0.32 m) and his bed's bolster. Allowed, since they're
  below the couch, but nobody has looked closely at how they look.
- G is no longer bound (the owner merged bark and growl onto one button).
- **On touch, jumping is slower now:** hold the paw, slide to Jump, let go (or keep the buttons out and tap Jump
  again within 2.5 s). The hold time (0.3 s) and idle time (2.5 s) are first guesses for the owner's thumbs.
- ~~In portrait, the start toast could sit under the "Landscape is best" chip~~: the chip is gone.
- **Phone sound fixes are unverified on a real phone:** the silent switch and `interrupted` fixes need the owner's
  phone to confirm, and the growl's new rasp and the drop's tock were measured, not heard.
- Carried props still have no collision, so a toy in his mouth can poke into the couch back cushions while he's up
  there (as it already could with walls).

New in Phase 3:
- **Physical-device coverage is limited.** The owner reported that mobile looks and plays great on their phone,
  but the device/browser and coverage were not recorded. PWA installation, post-fix phone audio, performance, heat
  and battery remain verified only through emulation or static checks (`docs/MOBILE.md` → "Not tested").
- **Sock Heist's chase has been judged fun by the owner, but its individual tunings have not had a detailed feel
  review.** Chase length, how often he lunges, the lines, the standoff and the treat timing are first tunings from
  scripted play (`config/human.ts`, `config/heist.ts`). Played
  straight, a heist takes about a minute, shorter than the brief's 3–5 minutes; it runs longer only when Moke
  hides or keeps away. It wasn't padded.
- The human is a code-built placeholder: ~48 more draw calls (166 vs 118 at 1280×720) and ~11.8k triangles. Merging
  its parts would cut the calls if phones need it.
- Desktop frame time rose a little (see Verification Status: roughly 1.3–1.6 → 2.0–2.3 ms per stepped frame at
  1280×720, noisy). The heist's own logic is ~0.014 ms per fixed step; the rest is drawing, mostly the human.
- The human's pathing is grid A* with simple steering: he can look a bit robotic round corners, and in the
  dead-end hallway he gives up by frustration rather than cornering Moke (intended: no catches).
- No dedicated growl button (the Bark button randomly barks or growls) and no pinch-zoom on touch; iPhone Safari
  has no fullscreen for pages (use Add to Home Screen).
- The service worker only runs on the https build; over a LAN dev server it doesn't (by design).
- SOCK = TREAT is remembered in `localStorage`; a private window forgets it (the card says "New!" again).
- The main bundle grew from 804 kB to ~861 kB (236 kB gzipped).

New in Phase 2:
- **There's no final `moke.glb`, so Phase 2's goal isn't met yet.** The Moke on screen is the procedural stand-in.
- The glTF path is tested only with a synthetic model (a box with named bones, sockets and dummy clips). A real
  model may still turn up problems: skinned bounds for the height check, blend quality, socket placement, how
  PBR fur looks under the room lighting.
- Without a `duck` clip, the procedural head dip may not be enough for a real model to clear the coffee table.
  The spec asks for `duck`.
- The stand-in is heavy: 37 meshes and ~110k triangles of fur geometry. The final model's budget is 15–40k.
- The main bundle grew from 773 kB (the `phase-1-complete` build) to 804 kB (217 kB gzipped), +31 kB, with the
  animation mixer and glTF path.
- Scratching isn't triggered by anything yet. `scratch` and `look_around` are reserved clip names; looking around
  already happens through the procedural idle head looks.
- Glance pacing, interest values, sitting after 8 s, the stretch chance and the head-tilt chance are first guesses
  that need the owner's feel check (`config/attention.ts`, `config/animation.ts`).
- The browser checks stepped frames by hand (`imdog.frame`, since the pane pauses rendering while hidden), so
  nothing has been judged at full frame rate.

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
- ~~There's no sit pose.~~ Fixed in Phase 2: he sits after standing still for ~8 s.
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
Run on 2026-09-25 for Phase 4 (uncommitted):
- `npm run typecheck`: pass. `npm test`: **49 files, 364 tests pass** (46 new: the house's navigation 20, the human's
  animation 6 and visual 3, the routine 6, dog activities and Dog Logic 11). No lint script is configured.
- `npm run build`: pass; JS 989 kB (277 kB gzipped; Phase 3: 880 / 242), CSS 22.8 kB, Rapier unchanged; `verify-dist`
  checked 20 built files against **18 private reference files** (9 Moke, 9 home): none leaked. `dist/` holds no
  photos (its only images are the four app icons).
- **Browser (desktop, 1280×720, this PC):** the house renders (each room checked by screenshot), the human lives the
  routine (folded laundry → TV → phone → reading on the living room couch, walked to the kitchen and family room),
  "Get Pets" (they kneel and pat; he sits, a heart), a full Treat Hunt (trick → kitchen jar → hidden by the bedroom
  door → found → SNIFF = TREAT), a Perfect Nap (his bed: 4 of 5, BED = NAP, SUN + SOFT = NAP), Make Human Play
  (asked twice → "Drop it!" → picked up and thrown → "Bring it here, buddy!"), and **a complete Sock Heist in the new
  house** (noticed while folding → chase → fumbles → lost → gave up → treat → trade → eaten → SOCK = TREAT → complete
  → PLAY AGAIN resets it; the routine resumed folding afterwards). Frame cost (CPU, 200 frames, same method as the
  Phase 3 baseline): living room 1.74–1.84 ms, kitchen 1.9–2.2 ms, family room 1.8–1.9 ms, dining 1.9–2.3 ms; 185–218
  draw calls, 300–353 k triangles (Phase 3 baseline, living room: 1.59–2.10 ms, 166 calls, 230 k). These were
  measured before the wing's furniture stopped casting shadows, which cut ~35 calls on the phone preset.
- **Browser (emulated phone, touch, MEDIUM):** portrait 375×812: the paw shows "Get Pets", petting works; landscape
  740×360 (1110×540 buffer): 1.6–2.3 ms, 158–185 calls, 264–298 k triangles (baseline 1.1–1.2 ms, 152, 223 k).
- **Not verified:** a physical phone (any), real-GPU frame rate, audio by ear, a physical controller, the owner's
  judgement of fun, likeness and feel.

Independent Phase 3 Codex audit on 2026-09-25 (no physical device used by Codex): typecheck pass; 44 files / 318
tests pass; production build pass; `verify-dist` checked 20 built files against 9 private reference files and found
no leak. No lint script is configured. Desktop browser smoke testing covered startup, browser-reported pointer lock, movement/actions,
pause and rendering. Touch emulation covered movement, camera and layouts at 390×844, 844×390, 667×375,
412×915 and 915×412 with no overflow or clipped controls. The console had no runtime errors; its only warning was
the documented procedural-Moke fallback because `moke.glb` is not installed. The production preview served the
manifest, generated service worker and all 14 precached build files successfully. Source/state-machine review and
the automated tests covered heist completion, replay, adversarial drop/retrieve paths, chase termination, human
navigation, trade eligibility, Dog Logic memory, input abstraction and touch cleanup. No gameplay code change was
needed; the audit corrected stale physical-phone claims in `README.md`, `docs/MOBILE.md` and this document.

Run on 2026-09-25 for the music volume and "Japan Stores" (the working tree that became its commit): typecheck pass; 44 files, 318 tests pass (the song tests
now run for both songs ×3 each, plus the door chime and school chime placement; `AudioManager`: song choice,
crossfade, Off, volume 0 as off; settings: choice and volume saved, old on/off settings and nonsense handled). The
Hawaiian note list's fingerprint (468 notes) is identical before and after the refactor. Offline renders: no errors
or clipping; after remixing and a ×2.15 trim, "Irasshaimase!" −34.4 dB (phone filter −38.6) against "Aloha, Moke"
−36.0 (−37.1). In the browser: the pause screen offers Hawaiian / Japan Stores / Off and a 0–150% volume; choosing
Japan Stores crossfaded (Hawaiian faded out and stopped, Japan faded in to the paused level 0.087); 50% halved it;
Off stopped it and saved. The pause card fits at 568×320 (after tightening its spacing there), 667×375, 375×667
and 800×450. **Not verified: listening to "Irasshaimase!".**

Run on 2026-09-25 for the background music (the working tree that became its commit): typecheck pass; 44 files, 313 tests pass (new: the song ×5:
full bars, strong-beat notes fit their chords, a sorted loop with the island strum and swing, the sequencer hands
out each note once and loops without a seam, no burst after a stall; `AudioManager` ×2: music only once play
begins and follows the setting, off from the start when turned off; settings: `music` saved, and old settings
default to on). Offline render of a whole pass (64 s, 44.1 kHz): no errors, peak 0.27, steady loudness (−20.5 to
−22.1 dB at level 0.5, so about −36 dB at the chosen 0.09); through a phone-speaker filter only 1.3 dB quieter.
In the browser: no audio before PLAY; after PLAY the music plays and fades in to 0.09; the pause screen lowers it to
0.04; the Music checkbox stops it, saves "off", and brings it back. The pause card fits with the new row at
568×320 and 375×667. No console errors. **Not verified: listening to it.**

Run on 2026-09-25 for the phone sound fixes, no touch sniff and portrait (the working tree that became their commit): typecheck pass; 43 files, 306
tests (new: `AudioManager` ×4: the iOS audio session, waking from `interrupted`, a sound asked for mid-wake still
plays, no Web Audio never throws). Offline render of all ten sounds through a phone-speaker filter (table in
`docs/MOBILE.md`). Touch emulation (390×844): audio running after PLAY; forced to sleep, a tap woke it; a bark asked
for mid-wake played once it woke; the growl and drop play; touch buttons are interact, bark, jump, trick, run, pause;
no rotate prompts. Paw-menu layout with 4 buttons at 390×844, 844×390 and 568×320: all on screen, no overlaps. **Not
verified: sound on a real phone** (Chromium can't reproduce iOS's silent switch or `interrupted` state).

Run on 2026-09-25 for the jump, the combined bark/growl and the paw menu (the working tree that became their commit). No physical phone, controller or mouse:
desktop browser pane, synthetic keys, synthetic touch, frames stepped by hand.

| Command / check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass (after the paw menu): 42 files, 302 tests. Before it: 297 tests (14 new: jump reach and limits against boxes ×6 and in the real room ×3, the air pose ×2, the `jump` clip, bark-or-growl, the treat never inside furniture; the gamepad, glyph and touch tests updated for B = jump, Y = bark or growl, the touch JUMP button) |
| `npm run build` | Pass; `verify-dist`: no private photos |
| Real room, Rapier tests | Onto the couch seat and the coffee table; never onto the TV console from 6 distances, trotting or running; the arms and back cushions stop him up there. A box test sweeps 13 distances (0–1.2 m) at a trot and a run against a 0.56 m box: never on top. Landing on a 0.45 m box works from up to 0.2 m away walking, 0.5 m trotting, 0.7 m running |
| In-app browser, dev server | Keyboard: onto the coffee table (peak 0.50 m, ~0.22 s in the air); onto the couch seat; the back cushions and arm stop him; a jump from the seat peaks at 0.499 m; the TV console refused from 4 distances and from right against it, trotting and running; the air pose checked from the side (front paws forward, hind legs back, nose up, tail flying). F ×24: 12 barks, 12 growls, both bubbles; G does nothing. The Controls dialog lists Space/B = Jump and F/Y = Bark or growl. No new console errors. |
| In-app browser, touch emulation | Layout check with the JUMP button at 844×390, 667×375, 740×360, 568×320, 390×844, 375×667, 1024×768: all on screen, no overlaps, no scrolling. The one tight gap is Sniff/Trick at 5.6 px, unchanged from Phase 3. Tapping JUMP jumps (peak 0.50 m). |
| Paw menu (touch emulation, 844×390 and 390×844, synthetic touch in real time) | Closed by default: only the stick, paw and pause visible. A quick paw tap picked up the sock (no pop-out). Holding popped the buttons out after 0.3 s without interacting. Letting go right after the pop pressed nothing (this caught a bug, fixed: RUN, still springing out under the finger, got toggled). Sliding onto Jump lit it and jumped him (peak 0.50 m). Tapping Bark barked. They tucked away after 2.5 s. All on screen in portrait with them out. Tests: 11 touch tests (was 6), 302 in all. |
| Sock Heist from the couch (browser) | Stole the sock, jumped up, barked: 7 fumbled grabs, the human gave up at 33 s and fetched a treat; the sock dropped from the couch was fetched ("close enough"); the treat went down on open floor in front of the couch (not inside it); hopped down, ate, SOCK = TREAT, complete |
| Not verified | Jump feel at full frame rate; a physical controller's B; a real phone; the `jump` clip with a real `moke.glb` (there isn't one) |

Run on 2026-09-24/25 for Phase 3 (the working tree that became the Phase 3 commit). **No physical phone or tablet was used:** every
"mobile" line is desktop Chrome device emulation in the app's browser pane, with synthetic touch events.

| Command / check | Result |
|---|---|
| Baseline (HEAD `93ca47d`, before any Phase 3 change) | Typecheck pass; 31 files / 215 tests pass; build pass (main bundle 804.15 kB, 217.42 kB gzipped); desktop smoke test (trot, bark, sniff) OK, no new console errors; ~0.9–1.0 ms per stepped frame, 102 draw calls. At 375×812 it loaded but had no touch controls and desktop-only hints: unplayable on a phone. |
| `npm run typecheck` | Pass |
| `npm test` | Pass: 42 files, 283 tests (68 new: touch ×6, joystick ×4, input mode ×4, quality ×5, events ×3, control glyphs ×3, nav grid ×6, awareness ×6, brain ×16, human body ×4, heist controller ×7, plus 4 in existing input and camera tests) |
| `npm run build` | Pass. Main bundle ~861 kB (~236 kB gzipped); Rapier chunk unchanged. `verify-dist`: no private photos. Service worker generated with 14 precache entries. |
| Desktop, dev server (keyboard, frames stepped by hand) | Sock Heist completed twice (~54 s each, scripted), SOCK = TREAT "New!" then "Still true"; PLAY AGAIN and KEEP EXPLORING. Edge cases: drop before noticed, pick back up, drop mid-chase (fetched and re-armed), hide under the table (standoff, then gives up), dead-end hallway, drop far away during the offer, pause mid-chase, focus loss mid-chase, replay. |
| Desktop regression (Phase 1/2) | Trot 1.8, run 4.0, walk 0.8 m/s; bark, growl, trick, sniff; sock, ball and rope toy pickup/carry/drop; ball push; rest in the bed and get up; pause/resume; debug toggle. No new console errors. |
| Mobile emulation | Layout check at 390×844, 844×390, 412×915, 915×412, 375×667, 667×375, 768×1024, 1024×768 (no overflow, controls on screen, ≥ 6 px apart). Screenshots/play at 375×812, 360×740, 667×375, 740×360. **Sock Heist completed with touch only at 740×360.** Rotation mid-chase released touches and play continued. |
| Performance (same conditions, Phase 2 worktree vs Phase 3) | Desktop 1280×720: 1.31–1.59 → 2.04–2.34 ms per stepped frame (noisy), 118 → 166 draw calls, 199k → 230k triangles. Phone-sized 740×360 at DPR 2: Phase 2 rendered 1480×720 at 2.05–2.48 ms; Phase 3 MEDIUM renders 1110×540 at 1.42–1.67 ms. Desktop GPU; says nothing about phone GPUs. |
| Production preview | Loaded at 740×360 with touch UI and the human; service worker activated with `?sw=on` (cache `im-dog-<hash>`); `?sw=off` removed it; console only the `[moke]` stand-in note. |
| Not verified | **Any physical phone or tablet** (feel, safe areas, iOS gestures, installing, real FPS, heat, battery); a person's judgement of fun; audio by ear; pointer lock with a physical mouse; a physical controller; Firefox and Safari |

Run on 2026-09-24 for Phase 2 (the working tree that became the Phase 2 commit):

| Command / check | Result |
|---|---|
| Baseline (`phase-1-complete`, a clean worktree) | Typecheck pass; 27 files / 179 tests pass; build pass (main bundle 773 kB); dev server smoke test: sock pickup, carry, run, drop, bark, sniff, trick; no console errors; ~1.22 ms per stepped frame. (Its first run was the pre-brief check on the same commit. This was re-run in the verification pass, since no fresh baseline had run before the first Phase 2 change.) |
| `npm run typecheck` | Pass |
| `npm test` | Pass: 31 files, 215 tests. New: clip selection ×8, `GltfMokeVisual` ×11, choosing the visual ×4, `AttentionSystem` ×5, sit/stretch/busy/look ×4, stand-in size/attachments/rump-first/floor ×4 |
| `npm run build` | Pass. Main bundle 804 kB (217 kB gzipped). `verify-dist`: no private photos. The test-only synthetic model isn't in the bundle. |
| In-app browser, dev server (frames stepped via `imdog.frame`) | Idle: glanced at the sock and ball, then sat. From the sit he moved off (sit 0.01, 1.8 m/s). Carrying: "Pick Up Sock", sock in the mouth, running with it at 4 m/s, dropped back into the world. Also: sock, ball and rope toy carry offsets; run → stop → bark; sniff (head toward the scent), including while moving; lying in the bed and W to get up; rapid mixed input recovered; tricks (paw, belly up); growl; under the coffee table (headroom 0.40 m, crouch 0.62, the stand-in's top 0.383 m, clear). Console: only the intended `[moke]` stand-in warning, no errors. |
| In-app browser, production preview | Loaded, PLAY started the game with the stand-in; `moke.glb` never requested; the console's only line is the `[moke]` stand-in note as `info` |
| Verification pass (same day) | Run → pickup (grabbed at 4 m/s, sock in the mouth); carry + run + turn (sock ≥ 14.6 cm above the floor); ball knocked 0.32 m by a run into it; Esc pauses and RESUME resumes; no console errors. Also resolved the "speed 0 after pickup" reading: he'd run into a wall (the same in the baseline). |
| Performance (dev server, 800×450 pane) | ~1.31 ms per stepped frame vs. the baseline's ~1.22 ms (same method, 3 × 300 frames each; the Phase 2 tab also had the debug panel on). Moke's visual update ~0.004 ms. 105 draw calls and ~190k triangles rendered including shadows; the stand-in alone is 37 meshes, ~110k triangles |
| Not verified | A real `moke.glb` (none exists); feel at full frame rate; real-GPU FPS; a physical controller; Firefox and Safari |

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
- **Phase 4:** docs `PHASE_4.md`, `HOME_REFERENCE.md`, `HUMAN_SYSTEM.md`, `ACTIVITIES.md`, `DOG_LOGIC.md`; the house
  `src/world/Home.ts`, `src/world/home/` (`layout.ts`, `places.ts`, `Wing.ts`, `homeFurniture.ts`),
  `src/world/HouseholdEffects.ts`; the human `src/human/` (`HumanRig.ts`, `HumanAnimationController.ts`,
  `StylizedHumanVisual.ts`, `humanProps.ts`, `activities/`); dog activities `src/activities/`; tuning
  `src/config/activities.ts`, `dogActivities.ts`, `dogLogic.ts`; wiring in `src/core/Game.ts`.
- `AGENTS.md`, `CLAUDE.md`, and in `docs/`: `PHASE_1.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `CONTROLS.md`.
- Phase 3:
  - docs: `docs/PHASE_3.md`, `docs/SOCK_HEIST.md`, `docs/MOBILE.md`;
  - Sock Heist: `src/heist/` (`SockHeistController.ts`, `SockHeistRuntime.ts`, `Treat.ts`, `DogLogic.ts`),
    `src/human/` (`HumanBrain.ts`, `HumanAwareness.ts`, `NavGrid.ts`, `HumanController.ts`, `Human.ts`;
    `ToonHumanVisual.ts` was removed in Phase 4), `src/core/GameEvents.ts`, `src/config/human.ts`, `src/config/heist.ts`;
  - mobile: `src/core/TouchInput.ts`, `VirtualJoystick.ts`, `InputMode.ts`, `Quality.ts`, `src/ui/ControlGlyphs.ts`,
    `src/config/quality.ts`, `TOUCH` in `src/config/input.ts`, `public/manifest.webmanifest`, `public/icons/`,
    `scripts/make-icons.mjs`, `scripts/sw-template.js` and the `serviceWorker()` plugin in `vite.config.ts`.
- `src/world/LivingRoom.ts` (layout, landmarks), `furniture.ts`, `materials.ts`, `textures.ts`, `StaticSceneBuilder.ts`, `RoomLighting.ts`.
- `src/config/`: `movement.ts`, `camera.ts`, `engine.ts` (lighting balance), `interaction.ts`, `props.ts`, `senses.ts`, `audio.ts`.
- `src/camera/ThirdPersonCamera.ts`, `src/player/`, `src/physics/`, `src/core/Game.ts`.
- `src/interactions/`, `src/props/`, `src/senses/`, `src/audio/`.
- Gamepad: `src/core/GamepadInput.ts`, `src/core/InputState.ts`, and mappings/tuning in `src/config/input.ts`.
- Moke's look: `src/player/ToonMokeVisual.ts`, `src/player/toon/`, `src/config/mokeLook.ts`.
- Phase 2:
  - docs: `docs/PHASE_2.md`, `docs/MOKE_3D_SPEC.md`, `docs/MOKE_INTEGRATION.md`;
  - character and scale: `src/config/mokeCharacter.ts`;
  - the model path: `src/player/MokeVisual.ts` and `src/player/gltf/` (`GltfMokeVisual.ts`, `clips.ts`,
    `testing/syntheticMoke.ts`);
  - attention: `src/player/AttentionSystem.ts` and `src/config/attention.ts`;
  - `vite.config.ts` (the `__MOKE_MODEL_AVAILABLE__` flag).

## Next Recommended Task
1. **Owner review of Phase 4** (uncommitted, so `npm run dev` on this machine): walk the house, watch the human's day,
   pet them, do a trick near them (Treat Hunt), nap in a few spots, bring them the ball. Is it recognisably home? Does
   it feel inhabited? Then tune (`config/activities.ts`, `config/dogActivities.ts`, the human's poses in
   `HumanAnimationController.ts`). Commit or push only when the owner asks: a push to `main` publishes the game.
2. **Play it on a real phone** once pushed (or `npm run dev:lan`): the paw for pets, naps and sniffing; frame rate
   and warmth in the big house.
3. **Owner listens to "Irasshaimase!"** (pause → Music → Japan Stores) and says whether it has the
   convenience-store feel; adjust its band in `src/audio/music.ts` if not.
3. **Carried-forward real-device checks** (`docs/MOBILE.md`): record the phone and browser, install the web app,
   the phone sound check (silent switch on and off, after a lock), frame rate and warmth after 10+ minutes.
4. **Still carried forward:** the final `moke.glb` (`docs/MOKE_3D_SPEC.md`, including the `eat` and `jump` clips),
   Sock Heist tuning (`config/human.ts`, `config/heist.ts`), and the Phase 1 checks (pointer lock with a physical
   mouse, audio by ear, a physical controller, real-GPU frame rate, Firefox and Safari).

**Not to start without the owner's approval:** Phase 5, more humans, more rooms, the outdoors, other mini-games.
