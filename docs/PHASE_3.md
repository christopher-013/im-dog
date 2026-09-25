# Phase 3 — Sock Heist + Mobile Web Play

> **Status: complete.** Closed by the owner on 2026-09-25 and tagged `phase-3-complete`. Started 2026-09-24 from the
> owner's brief. Every milestone is done. The owner played Sock Heist on the desktop ("the chase works great, it is
> fun") and the game on their phone ("the mobile looks and plays great"), and an independent Codex audit found it
> ready to be the foundation for Phase 4. What's carried forward is listed at the end. Details in
> `CURRENT_STATE.md`, `SOCK_HEIST.md` and `MOBILE.md`.

**Goal:** the first complete, replayable gameplay loop (Sock Heist), playable on a phone's browser without a
keyboard or mouse, with the desktop experience preserved. One codebase.

## In scope
Sock Heist (steal → notice → chase → treat → trade → eat → SOCK = TREAT → replay); one human NPC; a reusable treat;
touch controls; input-aware UI; responsive canvas and orientation; mobile quality presets; PWA; lifecycle handling.

## Not in scope (owner's brief)
The full Dog Logic system, multiple humans, the complete house, kitchen, bedrooms, backyard, neighbourhood, more
mini-games, day/night, family schedules, other animals, native apps, multiplayer, accounts, backend and cloud saves.

## Milestones
| # | Milestone | Status |
|---|---|---|
| 3.1 | Mobile/input foundation | **Done.** Floating joystick, drag to look, action buttons (Interact, Bark, Sniff, Trick, Run, Pause); input modes by capability and last use; separate analog sources; input-aware prompts; portrait field of view and rotate hints; first-play onboarding. Desktop unchanged. |
| 3.2 | Mobile performance / PWA | **Done.** LOW/MEDIUM/HIGH presets with dynamic resolution on phones; pause and audio suspend when the page is hidden; manifest, icons, a generated service worker (production only); fullscreen where supported; `npm run dev:lan`. |
| 3.3 | Human foundation | **Done.** `HumanBrain` state machine, awareness (sight cone + line of sight + feel + hearing), NavGrid + A*, Rapier body, stylized placeholder human, speech bubbles. |
| 3.4 | Chase | **Done.** Pursuit round the furniture, fumbled grabs (never a catch), dog-only gaps, standoff under the table, losing him and searching, frustration → change of strategy. |
| 3.5 | Treat / trade | **Done.** Reusable `Treat` (smell, eye appeal, "Eat Treat"), the human fetches and offers it, "Give Sock" hand-over, eating. |
| 3.6 | Sock Heist orchestration | **Done.** `SockHeistController` phases, `GameEvents`, completion screen, PLAY AGAIN / KEEP EXPLORING, re-arming, edge cases. |
| 3.7 | SOCK = TREAT | **Done.** The discovery card and chime; remembered in the browser ("Still true" after the first time). |
| 3.8 | Cross-platform playtest / polish | **Done.** Sock Heist completed on desktop (keyboard) and phone-sized touch in emulation; the owner then played it on the desktop and on their phone (device and browser not recorded). Fixes and requests from those sessions are below. |

## Success criteria: where they stand
All met in automated tests and emulation, and by the owner's playtests where noted:
- **Phase 1/2 gameplay intact:** met (browser regression and tests).
- **A complete, replayable loop without a refresh:** met.
- **Noticing, reaction, playful chase, evading, the chase ending, the treat, the trade, eating, SOCK = TREAT, no
  soft-locks:** met (scripted play, 39 human and heist tests).
- **Desktop controls:** met.
- **Touch movement + camera together, touch interactions, the heist by touch only, phone UI, landscape, portrait:**
  met in emulation, and the owner reported the game "looks and plays great" on their phone.
- **Mobile performance:** only CPU and buffer sizes measured in emulation; **not measured on a phone** (carried
  forward).
- **Focus and suspension:** met (simulated).
- **PWA:** the service worker and manifest work on the production preview; **installation not tested on a device**.
- **Photos private, typecheck, tests, build, desktop smoke test, emulation test:** met.
- **"Sock Heist is fun":** met. The owner, on the desktop: "the chase works great, it is fun" (escaping, the treat,
  and not escaping all tried).
- **"A person can play it on their phone without a keyboard or mouse":** met, on the owner's phone.

## Added during Phase 3, at the owner's request
- **Jump** (Space, controller B, touch): up onto the couch seat and coffee table, never higher (D17).
- **One voice button:** F, controller Y and touch Bark bark or growl at random; G unbound.
- **The touch paw menu:** only the stick, the paw and pause on screen; hold the paw for Jump, Bark, Trick, Run (the
  Sniff button was later dropped on touch). Portrait welcome: no rotate prompts, no landscape lock.
- **Sound on phones:** audio wakes on any tap (including iOS's `interrupted` state), iPhones play through the
  silent switch, and the growl and drop carry on phone speakers.
- **Background music:** "Aloha, Moke" (8-bit Hawaiian muzak) and "Irasshaimase!" (an original 8-bit Japanese
  convenience-store theme), with a Music choice and volume on the pause screen.

## Carried forward
- **The final `moke.glb`** (from Phase 2): `MOKE_3D_SPEC.md`, now also listing `eat` and `jump` clips.
- **Real-device coverage:** a recorded device/browser matrix, installing the web app on a phone, sustained phone
  performance, heat and battery, and confirming the phone sound fixes (silent switch on and off, after a lock).
- **Listening to "Irasshaimase!"** (not yet heard by the owner when Phase 3 closed).
- **Detailed tuning** of the chase, the human's lines and the treat timing (first tunings from scripted play).
- The Phase 1 hands-on checks and the Known Issues in `CURRENT_STATE.md`.
