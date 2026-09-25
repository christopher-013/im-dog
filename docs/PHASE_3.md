# Phase 3 — Sock Heist + Mobile Web Play

> **Status: built, in need of real-device and hands-on checks.** Started 2026-09-24 from the owner's brief. Every
> milestone is implemented and passes automated tests and browser emulation, desktop and phone-sized. **Not done
> yet:** play on a physical phone, and the owner's own feel check of Sock Heist. Details in `CURRENT_STATE.md`,
> `SOCK_HEIST.md` and `MOBILE.md`.

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
| 3.8 | Cross-platform playtest / polish | **Done in emulation**: Sock Heist completed on desktop (keyboard) and phone-sized touch (synthetic touch events); fixes from those runs. **Not done on a real phone.** |

## Success criteria: where they stand
All met in automated tests and emulation, except where marked:
- **Phase 1/2 gameplay intact:** met (browser regression and tests).
- **A complete, replayable loop without a refresh:** met.
- **Noticing, reaction, playful chase, evading, the chase ending, the treat, the trade, eating, SOCK = TREAT, no
  soft-locks:** met (scripted play, 39 human and heist tests).
- **Desktop controls:** met.
- **Touch movement + camera together, touch interactions, the heist by touch only, phone UI, landscape, portrait:**
  met **in emulation only**.
- **Mobile performance:** only CPU and buffer sizes measured in emulation; **not measured on a phone**.
- **Focus and suspension:** met (simulated).
- **PWA:** the service worker and manifest work on the production preview; **installation not tested on a device**.
- **Photos private, typecheck, tests, build, desktop smoke test, emulation test:** met.
- **"Sock Heist is fun"** and **"a person can play it on their phone without a keyboard or mouse"** need a person
  and a phone. That's the remaining work.
