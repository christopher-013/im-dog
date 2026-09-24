# Phase 1 — First Playable Prototype

**Goal:** make it genuinely fun to control Moke around one small living room, from a dog's perspective.

## In scope
One living room (plus a short doorway/hallway only if useful for camera testing), containing: floor, walls,
window, couch, coffee table, rug, TV + console, lamp, plant, dog bed, sock, tennis ball, dog toy.

Player: walk, trot, run, smooth turning, camera, bark, sniff, interact, pick up / carry / drop the sock,
push the ball and toy, lie down in the bed, stand up. Jump is optional.

## Not in scope
Humans, full house, backyard, missions/quests, economy, complex needs, mobile controls, backend.

## Milestones
| # | Milestone | Status |
|---|---|---|
| 1 | Foundation: Vite/TS/three, renderer, loop, resize, input, start/loading screens, docs, Moke reference | **Done** |
| 2 | Moke movement: placeholder visual, controller, walk/trot/run, accel/decel, turning, collision | **Done.** Rapier physics, placeholder Moke, trot/run/walk, collision. The owner's hands-on feel playtest is still pending. |
| 3 | Third-person camera: orbit, follow, collision, pointer lock, tuning | **Done, awaiting owner review.** Collision and wall avoidance, low-ceiling handling, zoom, auto-follow, sensitivity/invert settings. Pointer lock still needs a physical-mouse check. |
| 4 | Living room: stylized room, furniture, colliders, lighting | **Done, awaiting owner review.** Furnished room plus a short hallway, procedural textures, merged scenery, navigation-tested colliders, lamp light and soft reflections. |
| 5 | Interaction framework and contextual prompts | **Done (overnight, branch `claude/milestones-5-9-qagq4b`), awaiting owner review.** `Interactable` + `InteractionSystem` (reach, facing cone, priority, anti-flicker), "E — …" prompt overlay, debug section. |
| 6 | Sock: pick up, mouth attachment, carry, drop | **Done (overnight), awaiting owner review.** Generic `PickupSystem` + `Carryable`; `PropBody` (dynamic Rapier) and `Prop` (body + interpolated view); the sock rides in `mouthSocket`, drops ahead of his mouth (kept clear of walls) and falls. |
| 7 | Physics toys: tennis ball, dog toy | **Done (overnight), awaiting owner review.** Tennis ball (rolls when bumped, knocked ahead at a run) and a rope toy, both pushable and carryable through the same `Prop`/`PickupSystem`; a toy-only bumper collider on Moke; speed caps and escape rescue. |
| 8 | Sniff mode: scent sources, detection, stylized wisps | **Done (overnight), awaiting owner review.** `ScentSystem`/`ScentSource` (sock, rope toy, ball, dog bed), Q sniff with fades and cooldown, soft wisps and pulses (one draw, fixed budget), nose-down pose, warm vignette. **Bark (F)** landed here too: hop + head jolt + comic "Arf!" bubble + a synthesized bark via a small `AudioManager`. |
| 9 | Rest: dog bed, lie down, stand up, camera adjustment | |
| 10 | Polish: movement, camera, visuals, audio, UI, performance | |

## Success criteria (end of Phase 1)
Open in Chrome → start screen → PLAY → control Moke in third person → walk, run and turn naturally → comfortable
camera → explore around furniture → bark → sniff and detect objects → pick up, carry, run with and drop the sock →
push the tennis ball → lie down in the bed and get up → good performance.

**Most important:** simply running around the room as Moke is enjoyable before there's any objective.
