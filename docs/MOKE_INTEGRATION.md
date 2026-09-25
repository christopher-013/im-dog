# Moke — Integrating the Final Model

How the finished `moke.glb` goes into the game, how the game uses it, what happens when something is missing, and
how to test it. **What the file must contain** is in [`MOKE_3D_SPEC.md`](MOKE_3D_SPEC.md).

**Status (2026-09-24):** the integration path is built and covered by tests, but **there's no `moke.glb` yet.** The
game uses the procedural stand-in, `ToonMokeVisual`.

## 1. Where the file goes
```
public/assets/models/moke/moke.glb      (MOKE_CHARACTER.model.path = 'assets/models/moke/moke.glb')
```
- Everything in `public/` is published, so **only the exported .glb goes there.** Keep the source files (.blend,
  sculpts, texture sources) somewhere outside `public/`. Where is the owner's call; they must not be in the build.
- **Restart `npm run dev` after adding or removing the file.** At startup, `vite.config.ts` checks whether it exists and
  bakes the answer into the build as `__MOKE_MODEL_AVAILABLE__`. Without the file, the game never requests it, so there's no 404.
- Record the model in [`ASSETS.md`](ASSETS.md): who made it, its licence, and where the sources live.

## 2. How the game uses it
```
vite.config.ts ── file exists? ──► __MOKE_MODEL_AVAILABLE__ (src/env.d.ts)
                                        │
config/assets.ts  ASSET_MANIFEST ◄──────┘  adds { key: 'moke', kind: 'gltf', optional: true } only when it exists
                                        │
core/AssetManager (GLTFLoader, behind the loading screen)
                                        │
Game.spawnMoke ──► createMokeVisual(gltf, MOKE_MODEL_AVAILABLE)   (player/MokeVisual.ts, the only place that chooses)
                         ├── GltfMokeVisual   (player/gltf/): the final model
                         └── ToonMokeVisual   the procedural stand-in, also the permanent fallback
```
Every frame, `Moke` passes the model-independent `MokeAnimationState` (plain numbers: speed, gait blends, sit,
rest, sniff, bark, trick, head yaw and pitch, tail wag, crouch…) to whichever visual it has. **Gameplay never reads the
visual** (decision D7). Movement, physics, camera, interactions, carrying, scent and rest all work the same with
either visual. Carrying only uses `visual.attachments.mouth`.

## 3. Conventions (summary)
| Topic | Rule | Where in code |
|---|---|---|
| Scale | Metres. Head top 0.43 m, eyes 0.33 m, shoulder 0.28 m. The one authoritative size for the game: the camera pivot and ducking threshold derive from it. | `MOKE_CHARACTER.size` |
| Orientation | +Y up, faces +Z, left = +X | `MOKE_CHARACTER.model.yawOffset` (0) |
| Origin | Floor level, between the paws | — |
| Correction knobs | `model.scale` and `model.yawOffset` exist for emergencies. Prefer fixing the export. | `MOKE_CHARACTER.model` |
| Height check | Warns if the standing height is more than 20% off 0.43 m | `model.heightTolerance` |
| Bones the game drives | `neck`, `head`, `jaw`, `ear_L`, `ear_R`, `tail_01`…`tail_04` (`root` is expected) | `MOKE_CHARACTER.bones` |
| Morphs | `blink` | `MOKE_CHARACTER.morphs` |
| Sockets | `socket_mouth` (required for good carrying), `socket_collar`, `socket_back` | `MOKE_CHARACTER.sockets` |
| Clip names | Exact names, listed with loop and need | `MOKE_CLIPS` in `player/gltf/clips.ts` |
| Locomotion speeds | walk 0.8, trot 1.8, run 4.0 m/s, in place | `MOKE_CHARACTER.clipSpeeds` (= `MOVEMENT`) |

## 4. Animation: from game state to clips
`selectClips()` (`player/gltf/clips.ts`) turns the state into a target weight and playback speed per clip each
frame. `GltfMokeVisual` eases every clip's weight toward its target (a crossfade of about 0.1–0.3 s; nothing snaps).

| Game state | Clips |
|---|---|
| Speed | 1D blend of the two nearest of `idle` / `walk` / `trot` / `run`, playback scaled by real ÷ authored speed (0.3–2.5×). A missing gait falls back to the nearest one present. |
| Lying down in the bed / resting / getting up | `lie_down` → `rest` → `stand_up` (without the transitions, `rest` covers both ways) |
| Sitting (idle 8 s) / play-bow stretch | `sit` / `stretch` |
| Sniff mode, bark, growl, eating a treat (Sock Heist) | `sniff`, `bark`, `growl`, `eat` |
| Trick (Q / controller X) | `trick_belly_up`, `trick_beg`, `trick_paw`, `trick_spin` |
| Picking up / dropping | `pickup` / `drop`, played once when the carry state flips |
| Ducking under low furniture | `duck`, **additive**, on top of any of the above |

- Actions take their share of the body first; locomotion gets the rest, so the weights always add up to 1.
  Overlapping actions share it.
- One-shot clips restart from their first frame each time they're called for, and hold their last frame while fading out.
- **A missing clip never breaks anything:** its action is skipped (he keeps idling or walking) and it's listed in the console.

On top of the clips, a light **procedural layer** runs every frame, each turn applied in the model's own frame from
the bone's rest pose (so bone axes don't matter and nothing accumulates):
- head and neck glances and tilts (from the attention system);
- the head held a little higher while carrying (`MOKE_ANIMATION.carryHeadLift`, the same lift as the stand-in);
- tail wag;
- ear bounce;
- jaw open for barks, growls and panting;
- blinks, and eyes closed while resting;
- without a `duck` clip, a head dip and a lowered tail for ducking.

## 5. Attachments
`MokeVisual.attachments` = `{ mouth, collar, back }`.
- `Game` parents a carried prop's view to `attachments.mouth` with that prop's `carry` offset and rotation
  (`config/props.ts`). If a toy sits wrong in the new model's mouth, first check where `socket_mouth` is, then tune
  the prop's `carry` values.
- `collar` and `back` are there for future cosmetics (bandanas, harness, a tag on a real model). Nothing uses them yet.
- The stand-in provides the same three nodes, so code written against them works with both visuals.

## 6. Fallback behaviour
Moke is never invisible and the game never crashes over the model:

| Situation | Visual | Console |
|---|---|---|
| No file (today) | stand-in | dev: `warn` "[moke] no assets/models/moke/moke.glb in public/ yet; using the procedural stand-in (ToonMokeVisual). See docs/MOKE_INTEGRATION.md." Production: the same as `info`. |
| File present but failed to load (corrupt, bad path) | stand-in | `[assets] Could not load optional "moke"…` then `[moke] … failed to load …` |
| Loaded but unusable (no meshes) | stand-in | `[moke] … can't be used (the model has no meshes) …` |
| Loaded with problems | **model** | `[moke] … loaded with issues:` then one line per issue (missing required clips, unknown clip names, missing bones, sockets or `blink`, wrong height) |
| Loaded cleanly | **model** | nothing |

The debug panel (`` ` ``, or `?debug` in the URL) shows **Moke → visual:** `model` or `stand-in`, with a note count.
In the dev console, `imdog.visualChoice` has the choice and its notes, `imdog.moke.visual.issues` the spec problems,
and `imdog.moke.visual.clips` the clips it found.

## 7. Testing procedure
1. **Validate** the .glb in the Khronos glTF Validator (no errors) and look at it in any glTF viewer: facing,
   scale, textures.
2. **Install:** copy it to `public/assets/models/moke/moke.glb` and restart `npm run dev`.
3. **Check the console:** open http://localhost:5173/?debug. Moke → visual should say `model`. Fix every `[moke]`
   issue in the file (or, for a deliberate choice, in `MOKE_CHARACTER`).
4. **Play through** (keyboard; a controller works too):

   | Check | What to do |
   |---|---|
   | Idle | Stand still: he glances at nearby toys, then sits after ~8 s (sometimes a play bow first). |
   | Gaits | Walk (hold C), trot, run (Shift): no foot sliding, smooth blends when speeding up and slowing down. |
   | Turns and stops | Sharp turns and sudden stops: no popping between clips. |
   | Ducking | Under the coffee table: he ducks, and neither his head nor his tail goes through it. |
   | Carrying | E near the sock, ball and rope toy: each sits in his mouth, including at a run. E again to drop. |
   | Sniff | R: nose down, sniffing, head turned toward the strongest scent. |
   | Bark, growl | F and G: mouth opens. |
   | Tricks | Q ×4: belly up, beg, paw, spin; moving cancels a trick smoothly. |
   | Rest | E at his bed: lies down rump first, rests with eyes closed; E or a move key gets him up. |
   | Rapid mixed input | Mash moves, E, R, F and Q together: no stuck pose. |
   | Pause | Pause and resume. |
5. **Automated checks:** `npm run typecheck`, `npm test` and `npm run build`. The model path's tests
   (`player/gltf/*.test.ts`, `player/MokeVisual.test.ts`) use a synthetic model built to the spec, so they run with
   or without the real file. After building, check that `dist/assets/models/moke/moke.glb` exists, then try
   `npm run preview`.
6. **Performance:** the debug panel's frame time with the model versus the stand-in; ≤ 40k triangles.
7. **Hosted build:** only when the owner asks for a push. Every push to `main` publishes the game (D13).

To go back to the stand-in, delete the file and restart the dev server.
