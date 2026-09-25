# Phase 2 — Make Moke Actually Moke

> **Status: in progress. Blocked on the final 3D asset.** The owner started Phase 2 on 2026-09-24 with the brief
> "Make Moke actually Moke". Everything the codebase can do is built and tested: the model path, the animation
> system, personality, attention, carrying, one authoritative scale, the fallback, and the docs. **Phase 2 can't be
> finished until a real, rigged and animated `moke.glb` exists.** It has to be made outside this repo to
> [`MOKE_3D_SPEC.md`](MOKE_3D_SPEC.md). The procedural `ToonMokeVisual` is a stand-in, not the Phase 2 result.

**Goal:** the character on screen is recognizably *the real Moke*, softly stylized (not a generic anime dog), and
moves, reacts and carries things like him. Phase 1 gameplay stays exactly as it is.

## In scope
- A character reference and a buildable 3D specification from the private photos (observations only).
- A model-independent visual layer: load `moke.glb`, scale and orient it from config, blend its clips from gameplay
  state, attach carried items to a mouth socket, and fall back cleanly when anything is missing.
- An animation controller covering the core, action and personality states, with locomotion blending tied to his speed.
- A subtle personality layer (idle sit, play-bow stretch, curious head tilt) and a lightweight attention/look system.
- Better carrying, bark, sniff and rest presentation. A review of camera scale and performance.
- Regression-testing every Phase 1 feature.

## Not in scope (owner's brief)
Humans or human AI, Sock Heist, treat economy, Dog Logic progression, the full house, more rooms, backyard,
neighbourhood, other animals, new mini-games, missions or quests, a day/night system, family routines, and renaming or
rebranding the game.

## Work items
| # | Item | Status |
|---|---|---|
| 1 | Baseline: typecheck, tests, build, dev server | **Done.** On `phase-1-complete` in a clean worktree: typecheck pass, 27 files / 179 tests pass, build pass (773 kB), dev server smoke test with no console errors. |
| 2 | Character reference from the photos | **Done.** `MOKE_CHARACTER_REFERENCE.md` gains modelling observations and the reference still needed. |
| 3 | 3D specification | **Done.** `MOKE_3D_SPEC.md`: style, units/orientation/origin/size, triangle budget, PBR materials, textures, skeleton, face controls, sockets, the clip list with speeds, export and acceptance checklists. |
| 4 | Integration guide | **Done.** `MOKE_INTEGRATION.md`: path, conventions, state-to-clip mapping, attachments, fallback table, testing procedure. |
| 5 | Visual/gameplay separation (D7) | **Verified.** Gameplay, camera, physics, interactions and scent never read the visual. Carrying goes through `visual.attachments.mouth`. |
| 6 | `MokeVisual` component for `moke.glb` | **Done, tested with a synthetic model.** `GltfMokeVisual`: config-driven scale and orientation, `AnimationMixer`, clip lookup by name, damped crossfades, sockets, a procedural head/tail/ear/jaw/blink layer (plus a head lift while carrying), an additive `duck`, spec checks reported as `issues`. **Not tried with a real model** (none exists). |
| 7 | Animation states; missing clips handled | **Done, except scratch.** `selectClips`: idle/walk/trot/run, sit, stretch, lie down/rest/stand up, sniff, bark, growl, pickup, drop, duck, four tricks. Carry, head tilt, tail wag, ears and looking around are procedural. A missing clip is skipped, never a freeze or a crash. **Scratch** is only a reserved clip name: nothing triggers it yet. |
| 8 | Locomotion blending tied to speed | **Done.** A 1D blend of the two nearest gaits, playback scaled by real ÷ authored speed. |
| 9 | Personality layer | **Done.** Sits after ~8 s idle (sometimes a play-bow stretch first), hops straight up to move, a head tilt when something catches his eye. Lying down is staged rump first. |
| 10 | Attention / look system | **Done.** `AttentionSystem`: glances at interesting things in front of him, looks away, gets bored of staring; follows the strongest scent while sniffing; quiet while busy or running. |
| 11 | Mouth attachment and carrying | **Done.** A reusable `socket_mouth` on both visuals; carry offsets retuned so the sock, ball and rope toy sit in his mouth. |
| 12 | Bark, sniff, rest presentation | **Done.** Sniff: head lowered and turned toward the scent. Bark: tail lift. Rest: rump first, then front. |
| 13 | Camera and scale | **Done.** `MOKE_CHARACTER.size` is the one authoritative scale; the camera pivot and ducking threshold derive from it, with values unchanged. |
| 14 | Performance | **Reviewed.** ~1.31 ms per stepped frame vs. the baseline's ~1.22 ms; Moke's visual update ~0.004 ms; per-frame allocations removed from the new code and the gamepad path; bundle +31 kB. The stand-in is heavy (~110k triangles), which the final model's 15–40k budget fixes. |
| 15 | Fallback when `moke.glb` is missing | **Done.** The stand-in, a clear dev warning, and no 404 (a build-time flag). |
| 16 | Asset documentation | **Done.** `ASSETS.md`. |
| 17 | Phase 1 regression | **Done.** In the browser (dev server, frames stepped by hand) and tests. See `CURRENT_STATE.md`. |
| 18 | **Final `moke.glb`** | **Not started. Needs external 3D work** (modelling, texturing, rigging, animation) to `MOKE_3D_SPEC.md`. |

## Success criteria (end of Phase 2)
1. A `moke.glb` built to `MOKE_3D_SPEC.md` loads with **no `[moke]` warnings**, and the debug panel shows `visual: model`.
2. It passes the testing procedure in `MOKE_INTEGRATION.md`: every Phase 1 action looks right, with no foot sliding,
   no popping and nothing clipping through the coffee table, and carried toys sit in his mouth.
3. It stays within budget (≤ 40k triangles, ≤ 8 MB), and the frame rate holds on the owner's machine.
4. **The owner recognizes him as Moke.**
5. Phase 1 gameplay is unchanged.

## What happens next
1. The owner arranges the model: an artist, their own work, or another pipeline. They share the private photos with
   that person themselves, with the spec and the extra reference listed in `MOKE_CHARACTER_REFERENCE.md`.
2. The finished file goes in `public/assets/models/moke/moke.glb` and is tested per `MOKE_INTEGRATION.md`.
3. Fixes follow from the console's `[moke]` notes and the owner's reaction; then Phase 2 closes.
