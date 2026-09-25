# Phase 2 — Make Moke Actually Moke

> **Status: complete.** The owner closed Phase 2 as the Moke character foundation on 2026-09-24 (git tag
> `phase-2-complete`). Everything the codebase can do is built and tested: the model path, the animation system,
> personality, attention, carrying, one authoritative scale, the fallback, and the docs. Every engineering success
> criterion from the owner's brief is met (below).
>
> **Carried forward, not done: the final `moke.glb`.** No real, rigged and animated model exists yet; it has to be
> made outside this repo to [`MOKE_3D_SPEC.md`](MOKE_3D_SPEC.md) and installed per
> [`MOKE_INTEGRATION.md`](MOKE_INTEGRATION.md). Until then the game shows the procedural `ToonMokeVisual`
> **stand-in, which isn't the final Moke.** Also carried forward: an idle scratch (only a reserved clip name) and
> the hands-on checks in `docs/CURRENT_STATE.md`.

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
| 18 | **Final `moke.glb`** | **Carried forward. Not started.** Needs external 3D work (modelling, texturing, rigging, animation) to `MOKE_3D_SPEC.md`. |

## Engineering success criteria (the owner's brief): all met
1. Phase 1 gameplay still works.
2. Moke's gameplay controller is independent from the visual model.
3. A finished `moke.glb` can replace the current visual without rewriting gameplay.
4. Character scale and orientation are standardized (`MOKE_CHARACTER`, D14).
5. The animation architecture supports Moke's required behaviours.
6. Locomotion animation follows his real speed.
7. Carrying uses a reusable mouth attachment.
8. There's a foundation for subtle personality.
9. He visually attends to interesting objects.
10. Character rendering stays performant.
11. The reference photos stayed private.
12. The production Moke specification is documented.
13. Final-model integration is documented.
14. Placeholder and final asset status is clear.
15–18. Typecheck, tests, production build and the browser playtest all pass (`CURRENT_STATE.md` → Verification Status).

## Carried forward: when the final model arrives
These criteria were written for the final asset. They still apply to it, and the owner decides which phase they belong to:
1. A `moke.glb` built to `MOKE_3D_SPEC.md` loads with **no `[moke]` warnings**, and the debug panel shows `visual: model`.
2. It passes the testing procedure in `MOKE_INTEGRATION.md`: every Phase 1 action looks right, with no foot sliding,
   no popping and nothing clipping through the coffee table, and carried toys sit in his mouth.
3. It stays within budget (≤ 40k triangles, ≤ 8 MB), and the frame rate holds on the owner's machine.
4. **The owner recognizes him as Moke.**

Steps:
1. The owner arranges the model: an artist, their own work, or another pipeline. They share the private photos with
   that person themselves, along with the spec and the extra reference listed in `MOKE_CHARACTER_REFERENCE.md`.
2. The finished file goes in `public/assets/models/moke/moke.glb` and is tested per `MOKE_INTEGRATION.md`.
3. Fixes follow from the console's `[moke]` notes and the owner's reaction.
