# Phase 1 — Requirements for Milestones 5–10

Condensed from the owner's original Phase 1 brief so any agent can continue without the chat history.
Scope rules, tone and constraints are in `AGENTS.md`, `docs/GAME_DESIGN.md` and `docs/PHASE_1.md`.

## Milestone 5 — Interaction framework
- A reusable `InteractionSystem` and `Interactable` concept. **Don't hard-code interactions inside `MokeController`.**
- An interactable has: id, type, label, interaction distance, enabled state, and an action callback.
- Categories: PICKUP, DROP, REST, SNIFF, PLAY, EAT, DRINK, INVESTIGATE. Phase 1 only needs the relevant subset.
- When Moke approaches an interactable, show a small contextual prompt, e.g. **"E — Pick Up Sock"**, as a minimal
  HTML/CSS overlay. No inventory, no big HUD.
- E = interact (already bound as `interact`).
- Debug panel: the current interactable.

## Milestone 6 — Sock (the most important Phase 1 object)
1. Moke approaches the sock and sees "E — Pick Up Sock".
2. E picks it up, and it attaches near his mouth via `MokeVisual.mouthSocket`.
3. He can walk, turn and run with it.
4. E again drops it. With physics on, it falls naturally.

- The architecture must support other carried objects later (a `PickupSystem`, not sock-specific code).
- Debug panel: the carried object.

## Milestone 7 — Physics toys
- **Tennis ball:** reacts when Moke bumps it (rolls), using lightweight Rapier physics. Ideally he can also pick it up
  with the same pickup system; if that complicates things, rolling comes first.
- **Dog toy:** uses the same reusable interaction and pickup architecture, with no one-off logic.
- Rapier's character controller already applies impulses to dynamic bodies (`CharacterBody`).
  - Put toys on their own collision layer so the camera sweep ignores them (`physics/collisionGroups.ts`).
- Physics must stay bounded and cheap. Debug panel: physics status.

## Milestone 8 — Sniff mode
- Q activates Sniff Mode briefly. Nearby scent-enabled objects become noticeable.
- Reusable `ScentSystem` and `ScentSource`.
  - Future categories: FOOD, TREAT, OWNER, FAMILY, SOCK, TOY, OUTSIDE, INTERESTING.
  - Phase 1 sources: sock, toy, dog bed, and an optional treat placeholder.
- The look must be stylized, **not a sci-fi scanner**: soft scent wisps, small floating particles, gentle animated
  trails, subtle pulses. Use a bounded particle budget and no per-frame allocation.
- Debug panel: nearby scent sources.

## Milestone 9 — Rest
- Near the dog bed: "E — Lie Down". E enters a resting state:
  - Moke stops moving and takes a lying pose (in the placeholder visual, via `MokeAnimationState`).
  - The camera adjusts slightly.
  - The UI goes quieter, with optional subtle "Resting…" text.
- A movement key or E stands him back up. **Don't build the full nap mini-game.**
- The bed is at `LivingRoom.landmarks.dogBed` and is open at its front (`dogBedFront`).

## Bark (in the success criteria; not assigned to a milestone)
- F = bark (already bound). Play a bark sound if a legal temporary sound is available: CC0, or synthesized in code.
  Record its source and licence in `docs/ASSETS.md`.
- Simple visual/animation feedback, optionally a subtle camera or character reaction. No NPC reactions (there are no humans in Phase 1).

## Audio (for Milestone 10, or earlier alongside bark)
- A basic `AudioManager` for bark, footsteps, pickup, drop and ambient room audio. Legal placeholder audio only.
- Resume the AudioContext on a user gesture (the PLAY click).

## Milestone 10 — Polish
Movement, camera, visuals, lighting, audio, UI, performance, bugs. Known candidates are listed in `docs/CURRENT_STATE.md`.

## Phase 1 success criteria
The owner can, in Chrome:
- see the start screen, click PLAY, and control Moke in the third person;
- walk, run and turn naturally, with a comfortable camera;
- explore the room around the furniture;
- bark, and use Sniff Mode to detect objects;
- pick up, carry, run with and drop the sock;
- push the tennis ball;
- lie down in the bed and stand back up;

all with good performance.

**Most important:** simply running around as Moke is enjoyable before there's any objective.
