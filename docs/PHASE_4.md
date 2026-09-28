# Phase 4 — Moke's Home & Family Life

> **Status: complete.** Closed by the owner on 2026-09-28 and tagged `phase-4-complete`. Started 2026-09-25 from the
> owner's brief, with nine private photos of the real home. Every milestone is done. The owner played it on the
> desktop and on their phone (the published game), asked for a run of additions and fixes (below), then tested and
> approved it; an independent audit and a final release check (stuck spots, security, privacy, performance) came
> back clean. **Carried forward:** a recorded device/browser list and measured phone performance (frame rate, heat,
> memory). Details: `HOME_REFERENCE.md`, `HUMAN_SYSTEM.md`, `ACTIVITIES.md`, `DOG_LOGIC.md`, `CURRENT_STATE.md`.

**Goal:** turn "Moke in a room" into "Moke living in his home with his family": a connected home drawn from the real
one, a high-quality stylized human with a believable daily routine, and three new dog activities, without breaking
Sock Heist or mobile play.

## In scope (the owner's brief)
- **A:** the home: living room + family room + kitchen + dining room, connected, no loading, recognisable from the
  photos, stylized.
- **B:** a high-quality stylized, animated-film human (not photoreal) replacing the placeholder.
- **C:** a reusable, data-driven daily-life activity system for the human: interaction points, a weighted scheduler
  with cooldowns, believable durations, location awareness, sit/stand, walking between rooms.
- **D:** new Moke activities: Treat Hunt, Perfect Nap, Make Human Play; Sock Heist kept.
- Moke ↔ human interaction (awareness, attention, interruptions, reactions, petting), the dog activity lifecycle,
  and a lightweight Dog Logic system backed by gameplay.

## Not in scope (the brief's "do not add")
Multiple family members, complex family simulation, day/night, backyard, neighbourhood, dog park, car, groomer,
vet, pet store, native apps, multiplayer, accounts, backend, cloud saves, and other mini-games (Doorbell, Where's My
Human, Someone's Home, Dinner Time, Backyard Patrol, Squirrel, Laundry Day, Trash Inspector, walks, outside).

## Milestones
| # | Milestone | Status |
|---|---|---|
| 4.1 | References and architecture | **Done.** Photos protected in `reference/home/` (git-ignored, guarded like the Moke photos); `HOME_REFERENCE.md` (layout, landmarks, scale, colours, dog-scale features, uncertainties, missing references); the game layout decided (the new wing rotated 180° to join the living room's hallway). |
| 4.2 | Expanded home | **Done.** `Home` = the living room + hallway (now open at the end) + a new wing: kitchen, family room (one open great room with it) and dining room, and a sunroom seen through glass. Built in code from the photos (no photo textures). Rapier colliders, whole-house NavGrid and shadow fit, 20 navigation tests (every room reachable, what Moke can and can't jump on, under the dining table and island overhang, nap and hiding spots reachable). |
| 4.3 | Human character | **Done.** `StylizedHumanVisual`: one skinned body (21-joint skeleton) merged into 16 meshes (one per material), face with moving eyes, blinking lids, brows and an expressive mouth, hands with fingers, props. `HumanAnimationController` turns poses into joint angles apart from any mesh (`HumanRig`). The old toon human is gone. |
| 4.4 | Human activity system | **Done.** `HumanActivityController` (the routine), `ActivityScheduler`, activities as data (`config/activities.ts`), interaction points (`world/home/places.ts`), sit/stand at seats, stuck recovery (re-plan, route round Moke, give up rather than teleport), plugged into `HumanBrain` as its idle behaviour so Sock Heist still interrupts and resumes it. A 20-minute simulated day: 6+ activities, 4+ rooms, no give-ups. |
| 4.5 | Moke ↔ human | **Done.** `HumanReactions`: glances, hellos, "yes, Moke?" to barks, attention after three barks, praise for tricks, pats (asked for with "Get Pets", or spontaneous when he sits by them); Moke sits, leans in and wags; the activity underneath pauses and resumes. |
| 4.6 | Treat Hunt | **Done.** A trick near the human (or barking for their attention) → a kitchen treat, "stay…", hidden out of his sight → found by sniffing (the paw sniffs on touch) → SNIFF = TREAT. Hints if it takes a while. |
| 4.7 | Perfect Nap | **Done.** Seven nap spots; each nap judged on sunny, soft, warm, quiet and "my human's near", shown as five little signs; four of five is perfect; BED = NAP and SUN + SOFT = NAP. |
| 4.8 | Make Human Play | **Done.** Bring the ball or rope toy to a busy human; ignored, then pester (drop it at their feet, bark, trick, hang about) until they give in; they throw it; bring it back, keep it, or run off (they give chase, laughing). HUMAN + BALL/TOY = PLAY. |
| 4.9 | Dog Logic | **Done.** A registry of discoveries (eight at first, fourteen by the close), each backed by play (`config/dogLogic.ts`); the discovery card draws any of them; they queue; remembered in the browser. |
| 4.10 | Cross-platform polish | **Done.** Desktop and phone-sized play-throughs, performance against the Phase 3 baseline, privacy build check, an independent audit, then the owner's playtests on the published game, desktop and phone (device and browser not recorded), and a final release check. |

## Success criteria: where they stand
Met in automated tests and browser play (desktop and emulated touch) unless noted:
- **The house feels inhabited:** the human lives a day across four rooms (TV, reading, phone, coffee, cooking then
  dinner, laundry, relaxing), with the TV glowing, a pot steaming and dinner on the table. **Needs the owner's eye.**
- **Recognisable as the real home** (layout, fireplace wall, white kitchen and island, trestle table, sectional,
  pink blanket, bowls, the door sign): by design from the photos; **needs the owner's eye.**
- **Human quality, navigation, sitting, activities, interruptions, resuming, stuck recovery, long runs:** met in
  tests (47 human tests including a 20-minute simulation) and browser play.
- **Moke ↔ human, petting, the three activities, their replays, Dog Logic:** met in tests (14 activity tests) and
  browser play-throughs.
- **Sock Heist intact:** met (its tests, and full browser play-throughs in the new house). Since 2026-09-28 it ends
  with a card that fades, not PLAY AGAIN / KEEP EXPLORING (the owner's request).
- **Mobile first-class:** every new action works from the paw (Get Pets, Nap Here, Drop, Eat Treat; sniff when
  there's nothing else); emulated only. **Not measured on a phone.**
- **Performance:** measured on this desktop against the baseline (see `CURRENT_STATE.md` → Verification). Real
  phone GPU cost unknown.
- **Privacy:** the build's leak check covers all 18 private photos (Moke's and the home's); nothing from
  `reference/` is imported, served or bundled.

## Added during Phase 4, at the owner's request
- **Household moments:** the doorbell and delivery driver (bark to protect the house; a distinct courier in a
  brown uniform), kitchen begging, couch pillows, table manners and the toilet-paper trail, each with its Dog Logic.
- **The home gym** in place of the sunroom (stationary bike, dumbbell rack, glass doors onto a modelled backyard)
  and **Malibu**, the green-cheeked conure, to play with (MALIBU = FRIEND).
- **The squeaky fish toy** in the family room: Moke chews it and it squeaks until he drops it.
- **The laundry table** and a new basket; the human **starts the day somewhere different** each game; longer gaps
  between deliveries.
- **Sock Heist:** ends with a card that fades (no menu), and the human gives up the chase 10 s sooner.
- **Fixes from the owner's reports:** flickering walls (z-fighting; now guarded by a test), the bathroom door's
  behaviour, the shirt collar, room to get past a seated human (their body now moves onto the seat), shins through
  the couches, the family-room windows' painted view.
- **A release review** (stuck spots, performance, security, privacy) with fixes, re-run on the final build.

## Carried forward
- **Recorded real-device coverage** (from Phase 3, and now the bigger house and the new human): which phone and
  browser, and measured frame rate, heat and memory. The owner's phone playtest passed, but none of that was noted.
- **Listening:** no one has yet confirmed Malibu's chirp, the fish's squeak or "Irasshaimase!" by ear; the bark
  is still a placeholder.
- **The final `moke.glb`** (from Phase 2).
- **References that would help** (`HOME_REFERENCE.md`): the real front living room, measurements, the bedroom hall.
