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
  the game shows (`cooking` steam + a FOOD smell, `meal` a plate on the table; `tv` has them look at the screen,
  which always plays the GEARBOTS cartoon).
- **weight / cooldown:** base chance and the rest before it can come round again.
- **interruptible:** how willing they are to stop for Moke's barking (`always`, `sometimes`, `rarely`).
- **attention:** how often they glance round the room while doing it (and so notice Moke).
- **follows:** much likelier straight after another (dinner after cooking).
- **requires:** only possible within so long after another was done (no dinner without cooking it).

| Activity | Where | Pose / prop | Time | Notes |
|---|---|---|---|---|
| Watch TV | Living room couch, the sectional | watch, remote | 45–90 s | Eyes on the cartoon; noisy for naps nearby |
| Read | The window couch, sofas | read, book | 40–80 s | Engrossed (rare glances) |
| Phone | Island stool, sofas, dining chair | phone | 20–40 s | |
| Coffee at the table | Dining chairs | sip, mug | 30–55 s | |
| Make dinner | Fridge → island → stove | fridge; prep, knife; cook, spoon | 3–5 + 30–45 + 18–28 s | Carrots on a chopping board, then steam and a FOOD smell |
| Meal prep | Kitchen island | prep, knife | 35–55 s | Rotates into daily life; Moke can wait nearby and beg for a carrot |
| Eat dinner | Dining chairs | eat, fork | 25–45 s | Only within 7 minutes of cooking it, and usually straight after; a plate of pasta and meatballs on the table; Moke can sit beside the chair and beg for a bite |
| Relax | Sofas | relax (hands behind head) | 20–40 s | |
| Coffee at the counter | Counter, island sink | sip, mug | 12–25 s | |
| Fold laundry | The laundry basket on its table in the living room | fold, laundry cloth | 12–22 s | One of the random starting activities; lower selection weight (0.8), five-minute cooldown; glances round the room often |

**The scheduler** (`human/activities/ActivityScheduler.ts`) runs when an activity ends: among those off cooldown with
a free place, it picks at random by weight × location (the same room ×1.5, and weight / (1 + distance / 9)) × follows
bonus, with the one just done very unlikely and somewhere other than where they just were preferred. Between
activities: a 1.5–4 s breather, or, sitting, the next thing in the same seat (half the time, at most twice running,
then up and about). An interaction point that snaps to an unreachable nearby NavGrid cell is abandoned after one
second once pathing reports arrival, and no path at all counts as stuck: either way they give up and choose
something else instead of standing at the furniture. Tuning: `ROUTINE`.

**Chopping appointments:** meal prep and the island step of dinner share one schedule. The first appointment is
randomly due after 45–420 seconds of active routine time, with time allowed for finishing the current activity
and walking to the island (verified to start within ten minutes in the normal routine). Due prep takes the next
free routine slot rather than relying on weighted luck. Once actual chopping starts, the next appointment is
randomly due 600–900 seconds later; neither dinner nor meal prep can bypass that interval. Pause freezes the
clock; Sock Heist, dog activities and blocked prep places defer it until the human is available. A failed walk
doesn't consume the appointment. Begging/resuming the same prep doesn't restart its timer. A game reset clears
the schedule. Tunable ranges: `ROUTINE.prepFirst` / `prepRepeat`.

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

### Protect the House (`DoorDelivery.ts`, owner-requested addition, 2026-09-27)
An exterior door **to the left of the window**, viewed from inside the original TV living room, has a small,
non-playable doorstep on the exterior west wall. A temporary delivery visitor arrives after a random 25–45 seconds
of play; a louder original two-tone DING-DONG chime repeats every 2 seconds until Moke barks
within 1.25 m of the door's inside interaction point. **Bark at the Door** uses the normal interaction action;
the ordinary Bark action also works there (it chooses a bark, not a random growl, while the bell is ringing).
The bell stops immediately when Moke answers, even if the household human must finish another dog activity first.
While the bell rings, the door's panel and outline pulse with a warm glow so the objective is visible as well as
audible. The glow stops immediately when Moke answers or the visitor leaves. If unanswered for 30 seconds, the visitor leaves quietly, the bell/glow/prompt turn off, and another visit is
scheduled without granting a discovery. Ringing alone does not borrow the human or prevent other activities.

One bark action starts Moke's automatic **bark → growl → bark → growl → bark → growl** routine, spaced 1.25 seconds
apart. The human waits for its 7.5-second performance before walking over and opening the door. Repeated input
does not restart the performance or shorten it. Pause freezes both the bell deadline and the guard routine.
Once free, the human walks to the door, opens it outward, takes an Amazon-labelled parcel from the blue-uniformed
visitor, closes the door and praises Moke. **BARK = PROTECTOR** is earned only after the handoff, not from a remote
bark. Moke declares that he defended the house. The human resumes the saved routine; another visitor is possible
after a random **10–15 minutes** of game time (plus brief success feedback), never sooner than ten minutes after
a handoff, and the same after any visit Moke answered by barking at the door, even if it was cut short (a Sock
Heist, the human couldn't get there). Unanswered visits retry after a random 2–4 minutes. Pausing consumes neither delay.
Only one parcel remains by the door (replaced next
delivery), never an accumulating pile. The threshold stays collision-blocked: this is not an outdoor expansion.
Sock Heist cancels an in-progress handoff safely; unreachable approach times out without false success.

### Dinner Helper (`KitchenBeg.ts`, owner-requested addition, 2026-09-27)
While the human chops carrots at the island (meal prep or the prep stage of dinner), stand within 1.15 m with an
empty mouth for 4 seconds. Leaving, running or carrying something clears that wait. The objective explains it,
then **Beg for a Carrot** appears on the normal interaction action. The Trick action also chooses this contextual
beg when ready. This is an explicit action: merely waiting never grants food.

Moke begs; the knife is put away, the human reaches to the board for a small carrot bite, crouches and offers it.
If Moke stays nearby with an empty mouth, he is fed automatically and learns **BEG + KITCHEN = FOOD**. If he
wanders off, the human leaves one bite on reachable floor by the island, with **Eat Carrot**. Uneaten food clears
after 60 seconds, and Sock Heist cancels it. One consumption earns one discovery; repeated input cannot duplicate
food or rewards. A 35-second cooldown and another wait/explicit beg permit repeat play during later prep (or a
long enough remaining prep session). The human returns to chopping afterwards. Tuning for both new moments:
`config/homeActivities.ts`; no new device-specific input or dependencies.

### Begging at Dinner (`DinnerBeg.ts`, owner request, 2026-09-28)
While the human sits eating dinner at the dining table, stand still on the floor beside their chair (either side, or
under the table by their knees; not behind it, not on the table) with an empty mouth for 1.5 seconds. **Sit & Beg**
appears on the interaction action (the Trick action also begs once it's ready). Moke sits up and begs. The human says
**"Moke… no begging at the table."**, looks at him, sighs, and gives in: **"Oh, alright. Just one bite."** Without getting
up, they pick a meatball off their plate with the hand on his side (the new seated `share` pose) and hold it down to
his nose. Moke begs again for it and eats it, and learns **BEGGING = FOOD** ("Begging = FOOD! I knew it!"). Then they carry
on eating: the routine resumes on the same seat, with no getting up and sitting down again (`HumanActivityController.stayPut`
and the still-seated resume). If he wanders off before taking it: "Suit yourself. More for me!", and the meatball goes
back. Sock Heist cancels it. A 45-second cooldown. Tuning: `HOME_ACTIVITIES.dinner` in `config/homeActivities.ts`.
A beg an activity asks for no longer sets off a Treat Hunt as the activity ends: Treat Hunt only counts a trick that
started while the human was free to watch it (this also fixes the same slip after the kitchen carrot).

### Pillow Mischief (`PillowDig.ts`, owner-requested addition, 2026-09-27)
On any of the three pillow-bearing sofas, with feet planted, mouth empty and not napping, use **Dig & Toss
Pillows** (E / controller A / touch paw). Moke digs with alternating front paws for 2.2 seconds, then tosses
that sofa's three existing throw pillows onto the floor. He learns **PILLOWS = FUN TO MOVE** and declares
"Pillows are fun to move!" The human says **"Moke don't mess up the pillows!"**, walks to each pillow, bends to
pick it up, carries it back, and puts it on the sofa. Other sofas stay untouched. After cleanup and an eight-second
cooldown, another explicit dig is possible. Held input cannot duplicate pillows or queue multiple cleanups.
The throw pillows alone are movable meshes (`world/CouchPillows.ts`); all other scenery remains merged.
The long L-shaped sectional has three visible throw pillows in front of its back cushions, including one at
the chaise; digging from either its long seat or chaise tosses those same pillows, and cleanup restores them.
Short toss/return arcs use game time and pause correctly. Cancellation/reset restores the original pillows and
releases the digging pose; Sock Heist retains priority. Existing back-cushion collisions and jump limits remain.

### Moke, Get Down (`TableManners.ts`, owner-requested addition, 2026-09-27)
Landing on either coffee table automatically borrows the human when they're free. They come to a walkable
table edge, say **"Moke, get down!"**, look irritated and stand with both hands on their hips. While Moke stays
there, they repeat that reminder and gentle variations every 4–5 seconds, with their eyes on him. They keep
watching until Moke jumps or walks off; hopping in place does not satisfy it. Moke's movement is never forced or
locked by the scolding. The human says "Thank you, Moke." and resumes their saved routine. Landing on a table
again can start another response after a short cooldown. Walking underneath or flying past a table does not
trigger it. The dining table is also described but remains above the existing absolute jump-height cap.
Unreachable approaches time out without trapping the human; heist interruptions and reset clear the role safely.
Furniture/timing/pose tuning: `config/mischief.ts`; no new keys, assets or dependencies.

### Bathroom Paper Mischief (`ToiletPaperMischief.ts`, owner-requested addition, 2026-09-27)
The first hallway's left wall, heading toward the kitchen, now opens into a compact bathroom. Its door starts
slightly ajar and swings open when Moke approaches from the hall. Inside are a vanity/sink, mirror, toilet and a
wall-mounted paper-roll holder to the toilet's right. With an empty mouth, Moke can use **Pull Toilet Paper** (the
normal E / controller A / touch-paw interaction). He moves to the loose end, lowers his head and takes it in his
mouth. Normal movement then resumes: back him through the doorway and pull the sheet down the hall. The paper
follows his actual route and remains attached to his animated mouth until he has traveled far enough outside the
bathroom. Only then does the human walk to the trail, say **"No, Moke! Don't make a mess!"**, and gather it up before
returning to their routine. Moke learns **TOILET PAPER = FUN + ATTENTION** after cleanup. The door returns to ajar
when Moke leaves and opens again when he approaches, so the sequence can be repeated after cooldown. Spam cannot
make duplicate trails or rewards. Heist interruption/reset, an unreachable approach, or an unavailable human
timeout clear loose paper safely. The panel is a visual proximity door, not a physics blocker; the surrounding
doorway and fixtures have colliders, and navigation tests confirm dog and human access in both directions.

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
