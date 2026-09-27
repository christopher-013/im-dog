# Activities (Phase 4)

Two kinds: the **human's** daily-life activities (a routine, data-driven), and **Moke's** dog activities (Treat
Hunt, Perfect Nap, Make Human Play; plus Sock Heist from Phase 3). None is started from a menu: they happen.

## The human's daily life (`config/activities.ts`)
Each activity is plain data, so a new one needs no code:

```ts
{
  id: 'watchTV', name: 'watching TV',
  steps: [{ places: ['couchSeat'], pose: 'watch', prop: 'remote', seconds: [45, 90], lookAtFocus: true, effect: 'tv' }],
  weight: 3, cooldown: 150, interruptible: 'always', attention: 0.3,
  lines: ['Ooh, this one again.', 'Just one episode…'],
}
```
- **steps:** done in order, each at the nearest free place of the given kinds (`world/home/places.ts`), with a pose,
  an optional prop, a random duration, optionally looking at the place's focus (the TV), and an optional `effect`
  the game shows (`tv` glow, `cooking` steam + a FOOD smell, `meal` a plate on the table).
- **weight / cooldown:** base chance and the rest before it can come round again.
- **interruptible:** how willing they are to stop for Moke's barking (`always`, `sometimes`, `rarely`).
- **attention:** how often they glance round the room while doing it (and so notice Moke).
- **follows:** much likelier straight after another (dinner after cooking).
- **requires:** only possible within so long after another was done (no dinner without cooking it).

| Activity | Where | Pose / prop | Time | Notes |
|---|---|---|---|---|
| Watch TV | Living room couch, the sectional | watch, remote | 45–90 s | The screen glows; noisy for naps nearby |
| Read | The window couch, sofas | read, book | 40–80 s | Engrossed (rare glances) |
| Phone | Island stool, sofas, dining chair | phone | 20–40 s | |
| Coffee at the table | Dining chairs | sip, mug | 30–55 s | |
| Make dinner | Fridge → counter → stove | fridge; prep, knife; cook, spoon | 3–5 + 12–18 + 18–28 s | Steam and a FOOD smell while cooking |
| Eat dinner | Dining chairs | eat, fork | 25–45 s | Only within 7 minutes of cooking it, and usually straight after; a plate on the table |
| Relax | Sofas | relax (hands behind head) | 20–40 s | |
| Coffee at the counter | Counter, island sink | sip, mug | 12–25 s | |
| Fold laundry | The living room laundry basket | fold, laundry cloth | 30–60 s | Where Sock Heist starts: bending into the (visibly full) basket, shaking each piece out and folding it; glances round the room often |

**The scheduler** (`human/activities/ActivityScheduler.ts`) runs when an activity ends: among those off cooldown with
a free place, it picks at random by weight × location (the same room ×1.5, and weight / (1 + distance / 9)) × follows
bonus, with the one just done very unlikely and somewhere other than where they just were preferred. Between
activities: a 1.5–4 s breather, or, sitting, the next thing in the same seat (half the time, at most twice running,
then up and about). An interaction point that snaps to an unreachable nearby NavGrid cell is abandoned after one
second once pathing reports arrival, and no path at all counts as stuck: either way they give up and choose
something else instead of standing at the furniture. Tuning: `ROUTINE`.

## Dog activities (`src/activities/`)
**Lifecycle** (`DogActivity.ts`): `AVAILABLE → STARTING → ACTIVE → SUCCESS | CANCELLED → COOLDOWN → READY_AGAIN →
AVAILABLE`. Each activity decides its own natural trigger (`wants`), setup, running and clean-up. The
**`DogActivityDirector`** updates them every fixed step and lets only one borrow the human at a time, never during the
Sock Heist (which cancels any human-dependent dog activity already running). The HUD line (the chip at the top)
shows the running one's objective when the heist has nothing to say. Tuning: `config/dogActivities.ts`.

### Treat Hunt (`TreatHunt.ts`)
1. **Trigger:** Moke does a trick within 3.2 m of the free human, in view (or within 2 m, facing or not); the first
   time always, then 60%. Or he barks for their attention (50%).
2. "Ooh, a treat? Let's play find-it!" They walk to the **kitchen treat jar**, rummage, and hold a treat (smelly and
   eye-catching: Moke is interested).
3. "Sit… stay…" They pick a **hiding spot** (16 in `TREAT_HIDING_SPOTS`, all tested reachable by Moke and by the
   human): at least 3 m from him, within 10 m of them, preferably **out of his line of sight**; walk there, crouch,
   and tuck it in (under the coffee table, behind the laundry basket, under the island overhang, by the hearth…).
4. "Okay… find it, Moke!" They go back to what they were doing.
5. **Sniffing:** R (or E / the paw with nothing else to do) shows the treat's wisps, stronger the closer he is (a
   hidden treat smells from 8 m). No arrows.
6. **Forgiving:** "Warmer… warmer!" when he's within 2.2 m after 30 s; "Try the dining room!" after 55 s; after 100 s
   they walk over and point at it ("It's right here, silly!"). Never a fail.
7. **Found:** "Eat Treat" → he eats it ("Nom nom!"), "Good find, Moke!" → **SNIFF = TREAT** (first time) → a toast
   with the time. Cooldown 90 s.
- Sock Heist has priority: taking the human mid-errand or after the treat is hidden calls the hunt off and returns
  the hunt treat to storage, so it cannot coexist with the heist reward.

### Perfect Nap (`PerfectNap.ts`)
1. **Nap spots** (`NAP_SPOTS`): his bed (in the window's sun), his pink bed (in front of the fire), the sunny couch (sun
   through the family room windows), the chaise, the sectional, the living room couch, the hearth. "Lie Down" (his
   bed) or "Nap Here" (the rest); the sofas are a hop up.
2. Lying down: the screen's edges dim softly and little "z…"s float over him.
3. After 6 s the nap is judged on how it **feels**: **sunny**, **soft**, **warm** (the fire within 3.4 m), **quiet**
   (no TV on or cooking within 4.5 m), **my human's near** (within 3.2 m). A card shows five little signs, lit or not,
   and a few words ("Sunny… soft… my human's right here. Perfect."). Four of five: **Perfect nap!**
4. **BED = NAP** (in his bed or on his blanket), **SUN + SOFT = NAP** (sunny and soft), shown once a session.
5. Getting up before he dozes off is simply no nap (no cooldown). One verdict per lie-down; cooldown 30 s.

### Make Human Play (`MakeHumanPlay.ts`)
1. **Trigger:** Moke brings the ball or the rope toy (not the sock: that's the Sock Heist) within 1.8 m of the free
   human.
2. **Ball — asking:** they're busy: "Not now, Moke…" with a wave. Each ask counts (2.2 s apart): dropping it at their feet,
   coming back over with it, barking, a trick, hanging about with it for 5 s. They give in after 2–4 asks ("Okay,
   okay! You win."). Wander off for 10 s and it's forgotten.
3. **Ball — fetch:** they get up and face him. If he has it: "Drop it!". Dropped near them: they pick it up, wind up
   ("Ready…?") and **throw** it 2.4–4.4 m onto open floor (a clear line, aimed roughly the way they face) → "Go get it!".
4. Then Moke's choice: **bring it back** (another throw), **drop it nearby** (they fetch it), **keep it** (they call
   "Bring it here!", then "Fine, keep it."), or **run off with it**: a few laughing steps after him ("Hey! Come back
   here, you!"), then "You little rascal.". After 3–5 throws: "Okay, that's enough for now. Good boy!".
5. **Rope — tug-of-war:** bringing the rope makes them get up immediately and take the other end. Moke braces,
   plants all four paws, actively pulls backward and growls while the human leans into a low, staggered tugging
   stance. After 6–8 seconds the human always gives up; Moke keeps the rope and decides he is the strongest dog in
   the house. After the win feedback and a 2-second rope cooldown, a rematch starts once Moke drops the rope or
   carries it away and brings it back; standing beside the human with it does not immediately loop into another
   contest.
6. Discoveries: first ball throw → **HUMAN + BALL = PLAY**; first tug win → **HUMAN + TOY = PLAY** and
   **MOKE = STRONGEST**. Ball cooldown 60 s.

### Sock Heist (Phase 3, kept; `SOCK_HEIST.md`)
Unchanged in its rules. Now the human might be anywhere: steal the sock from the living room rug and they'll notice
the moment they see him with it, wherever they are (the chase can cross the house). Folding laundry, they glance
round the room as before. Afterwards they carry on with their day.

## Moke's bowls and the refill errand
His bowls in the family room (by the hearth) start full: kibble in the blue slow feeder, water in the steel bowl
(`world/DogBowls.ts`; the bowls themselves are part of the house). At a full bowl Moke gets **Eat** or **Drink**: he
stays put, nose in the bowl (chewing, or lapping), and it drains over that time. Once a bowl is empty the human comes
to refill it (`human/activities/BowlRefill.ts`): 3 s later, as soon as they're free (not during the heist, another
errand or a pat), it borrows them from the routine like a dog activity's role: walk to the kitchen (the counter for
kibble, the island sink for water), get it (a scoop, a jug), carry it over, kneel and pour ("There you go, Moke."), then
back to what they were doing. Both empty: one trip after the other. Taken off it by the heist, they come back to it.
Tuning: `BOWL_REFILL` in `config/activities.ts`.

## Interruptions: ACTIVITY → MOKE → RESPONSE → (a dog activity) → RESUME
Reactions (a look, a pat…) only pause the activity's clock. A dog activity or the heist saves the activity and time
left; afterwards the routine walks back and carries on, or picks something new if too much time has passed.

## Tests
`human/activities/HumanActivityController.test.ts` (a 20-minute simulated day in the real house: all seven major
household activities, variety, rooms, sitting, no stuck, no give-ups; four more 20-minute days with Moke barking every
45 s: no give-ups, never stuck, hands empty between activities, no repeats, at most three things running in one seat,
dinner only after cooking, barks answered; cooking → dinner; cooldowns and location; resume; Moke in the seat;
invalid interaction-point recovery), `human/activities/HumanReactions.test.ts` (not a security camera; attention
weights; walking over to pet),
`activities/DogActivities.test.ts` (the lifecycle; Dog Logic; nap judging and timing; a full Treat Hunt in the
house, its hints and cancellation before and after hiding; Sock Heist priority; queued-reaction cleanup; Make Human
Play from asking to a real thrown ball, keep-away, and repeatable rope tug contests with automatic growls and a
guaranteed Moke win),
`world/Home.test.ts` (every nap and hiding spot reachable).
