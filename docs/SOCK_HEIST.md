# Sock Heist

The first complete gameplay loop (Phase 3). Moke steals a sock, the human wants it back, chasing him doesn't
work, a treat does: **SOCK = TREAT**. It's playful rather than stressful: no combat, no damage, no failure, no
punishment. The human never catches Moke. Played straight (scripted runs), it takes about a minute from the steal
to the completion card. Keep-away and hiding stretch the chase, which ends after roughly 48 s at most (sooner with
each fumbled grab and each time Moke gets away, and twice as fast while he's out of reach under the table). The
brief's 3–5 minutes for a first play, exploring included, hasn't been timed with a real player.

## The flow
```
waiting ──(Moke picks up the sock)──► stolen ──(the human notices)──► chase
   ▲                                    │ put down unseen                │ (fumbled grabs, hiding, searching)
   │                                    ▼                                ▼
   └──────(human takes it back without a trade)────────────────────── treat (fetches a treat, kneels, offers it)
                                                                        │ "Give Sock" (or drop it by them)
                                                                        ▼
complete ◄── discovery (SOCK = TREAT) ◄── eating ◄───────────────────── trade (treat on the floor: "Eat Treat")
   │ PLAY AGAIN: reset everything        │ KEEP EXPLORING: carry on; the next steal is a new heist
```
- **Phases** belong to `SockHeistController` (`src/heist/`): `waiting · stolen · chase · treat · trade · eating ·
  discovery · complete`. The heist's clock starts at the steal; the completion card shows how long it took.
- **HUD:** a short objective line appears only when it helps ("Keep away!", "A treat! Trade the sock for it",
  "Eat the treat!"). The human's speech bubbles, the sounds and Moke's glances carry the rest.

## The human (`src/human/`)
One human, folding laundry at a basket between the lamp and Moke's bed, with their back to the rug where the sock
lies. They wear one charcoal-striped sock; the other foot is bare. Behaviour, body and look are separate:

| Part | File | What it does |
|---|---|---|
| Brain | `HumanBrain.ts` | An explicit state machine: one small handler per state, returning the next state. Pure logic (tested). |
| Awareness | `HumanAwareness.ts` | What they can see and hear (pure functions). |
| Body | `HumanController.ts` | Walks along NavGrid paths through a Rapier character body, at human speeds (tested with Rapier). |
| Navigation | `NavGrid.ts` | A walkability grid built from the room's colliders, A* and path smoothing (tested). |
| Look | `ToonHumanVisual.ts` | A stylized placeholder person built in code; poses blend smoothly. |
| Composite | `Human.ts` | Perceive → decide → move each fixed step; draw each frame. |

### States
| State | What happens | Leaves when |
|---|---|---|
| `idle` | Folds laundry at the basket. Every 5.5–9 s they glance round at the room for 2.2 s. | They notice Moke **with the sock**: seen for 0.35 s, or they hear him bark with it. |
| `noticed` | Turns, arms up: "Moke! Is that my sock?!" (the second time: "Again?!"). | After 1.1 s: chase (or fetch the sock if he dropped it). |
| `chase` | Hurries after him (2.05 m/s; he trots at 1.8 and runs at 4.0) along paths round the furniture. | See the chase rules below. |
| `lunge` → `recover` | "Gotcha—", a grab that always fumbles ("…nope."), a stumble. | Back to the chase, or to searching if he's gone. |
| `search` | Walks to where they last saw him, looks around, bends down to peek under the furniture. | Finds him (chase), finds the loose sock (fetch), or gives up after 4.5 s. |
| `giveUp` | "Okay. New plan." | Off to the treat jar. |
| `getTreat` | Walks to the treat jar on the TV console and rummages (a treat-bag rustle). | Treat in hand: "Treat time!" |
| `offerTreat` | Walks toward Moke with it. | Within 1.35 m of him: kneels. |
| `waitForTrade` | Kneeling, treat held out, calling "Mo-ke~" now and then (with a rustle). | The trade (below). If he stays away for 18 s, they move closer. |
| `receiveSock` | "Thank you!" / "Good boy!" | Puts the treat down on the floor near him. |
| `reward` | Stands up. | Takes the sock back to the basket. |
| `fetchSock` | Walks to a sock lying loose and picks it up. | With a treat in hand: gives it anyway ("Close enough"). Otherwise: back to the basket. |
| `returnSock` | Tosses the sock by the basket. | Back to folding (`idle`). |

### Awareness: what they notice, and why
- **Sight:** within 6 m, inside a 120° view where they're looking (head glances count), and a clear line of
  sight from their eyes to his back. Solid scenery blocks it: walls, the couch, and the coffee table's top. Thin
  legs, props and characters don't.
- **Feel:** a dog right against their legs (0.9 m) is always noticed, **except** under furniture.
- **Hearing:** a bark within 7 m, while he carries the sock, tells them where he is. Barking from a hiding place
  gives him away.
- **Eyes move:** standing eyes at 1.5 m, kneeling at 0.62 m, bent down peeking at 0.34 m. That's why the coffee
  table hides him from a standing human but not a peeking one.
- They only care about Moke **with the sock**. A loose sock they can see gets fetched.

### Chase rules
- **Never caught.** A grab needs him within 0.62 m, in front of them, and not sprinting past (under 2.6 m/s). It
  winds up (0.45 s) and always fumbles, followed by a 1.3 s recovery and 3 s before the next try.
- **Keep-away is built into the room.** The human's grid is widened by their radius (0.24 m), so the space under
  the coffee table and the gap behind it are dog-only. Round the table, the human has to go the long way.
- **Up on the couch or coffee table** (Moke can jump up, sock and all): the human comes to the edge and grabs from
  there, fumbling as always. It's a perch, not a hiding place. A sock he leaves up there gets picked up from the
  edge (a human's arms reach). Played through in the browser: 7 fumbles, gave up at 33 s, treat, trade, complete.
- **Standoff:** Moke under the table within 1.4 m of them. They crouch and peer at him ("Come out of there!"),
  can't reach, and lose patience twice as fast.
- **Losing him:** out of sight for 1.6 s → search. The hallway is a dead end: no hiding there.
- **The chase always ends.** Frustration grows 1 per second of chasing or searching (2 in a standoff), plus 4 per
  fumble and 5 per failed search. At 48, or after any search that doesn't find him, they change strategy and fetch
  a treat. In playtests: about 25 s hiding under the table, 33–37 s running around in view, about 8 s if he gets
  clean away. All tunable in `src/config/human.ts`.

## Treat and trade (`src/heist/Treat.ts`, `SockHeistController.ts`)
- **Treat** is reusable: a type, a reward value, a state (`stored → held → placed → eaten`), a smell (sniff mode
  finds it: category TREAT), eye appeal (Moke glances at it: attention kind `food`), and an "Eat Treat"
  interaction once it's on the floor. No treat economy.
- **The trade:** while the human wants to trade (kneeling with the treat) and Moke carries the sock within
  1.15 m, the interaction is **"Give Sock"** (priority 30, above "Drop Sock"). The sock goes from his mouth into
  their left hand (`PickupSystem.handOver()`), never touching the floor. Dropping the sock at their feet (within
  1.3 m) counts too.
- **Where the treat goes down:** toward Moke, on the floor, but never past the first furniture in between
  (`treatSpot`: a small sweep from the human's feet, `HEIST.treatSweep`). So with Moke up on the couch, it lands
  on open floor in front of it, never inside it, and he hops down to eat it.
- **Eating:** "Eat Treat" → Moke holds still, nose to the floor, chewing (1.4 s), "Nom nom!" and a crunch.
- **SOCK = TREAT:** a big pop-up card and a chime, for about 3.4 s. The first time it says Moke "has learned
  something very important"; after that, "Still true. Moke checked." The discovery is remembered in this browser
  (`DogLogicMemory`, key `imdog.dogLogic`). That's the only piece of Phase 4's Dog Logic that exists.
- **Completion:** the "Sock Heist Complete" screen (a game state: the world waits, the pointer is freed) with the
  time taken, **PLAY AGAIN** (focused; controller A) and **KEEP EXPLORING**.

## Reset and replay
- **PLAY AGAIN** → `SockHeistController.reset()`:
  - the sock comes out of whoever has it and goes back to its spot on the rug;
  - the treat goes back in the jar;
  - the human is back at the basket, folding, frustration zero;
  - the phase is `waiting` and the HUD clears.

  Moke stays where he is, since nothing else needs resetting.
- **KEEP EXPLORING** → `waiting` once the human has tossed the sock back by the basket. The next steal starts a
  new heist. Frustration is kept only when the human got the sock back without a trade.

## Events (`src/core/GameEvents.ts`)
A tiny typed publish/subscribe hub: no queues or wildcards. The brain and the heist emit events; the heist, UI and
audio listen.
`SOCK_PICKED_UP · SOCK_DROPPED · SOCK_RETURNED · HUMAN_NOTICED · CHASE_STARTED · CHASE_LOST · CHASE_FOUND ·
GRAB_MISSED · CHASE_GAVE_UP · TREAT_FETCHED · TREAT_OFFERED · SOCK_TRADED · TREAT_PLACED · TREAT_EATEN ·
DOG_LOGIC_DISCOVERED · HEIST_COMPLETE · HEIST_RESET · HUMAN_SAID`

## Presentation
- **Speech bubbles** follow the human's head, kept on screen and below the objective line. A new line replaces the
  controls reminder toast so they never overlap. Lines are in `src/config/heist.ts`, taken in turn without repeats.
- **Sounds** (original, synthesized): a slide-whistle "!", a whoosh for fumbles, a treat-bag rustle, crunches, and
  the discovery chime.
- **The camera** ignores characters (no jitter), so a human standing between the camera and Moke fades to
  see-through instead.

## Debugging
- The debug panel (`` ` `` or `?debug`) has a **Sock Heist** section:
  - the phase and elapsed time;
  - the human's state and time in it;
  - whether they see Moke;
  - frustration against its limit;
  - what they're holding, where they are and their speed;
  - the treat's state;
  - the last few events.
- **Dev console** (dev server only): `imdog.heist.heist` is the controller (`phase`, `reset()`),
  `imdog.heist.human.brain` the brain (`state`, `frustration`, `intent`), and `imdog.events.on(name, fn)`
  listens to events.
- Tuning: `src/config/human.ts` (speeds, sight, chase, treat) and `src/config/heist.ts` (lines, timings).

## Known limitations
- The human is a placeholder built from simple shapes: stylized, not final character art. Their face is mostly
  above the dog-height camera, so speech bubbles and body language carry the comedy.
- Fun and pacing have only been judged by scripted play in an embedded browser. A hands-on feel check is still
  needed: chase length, grab frequency, how quickly they give up, and line frequency.
- Grab fumbles are guaranteed. That's intentional (no punishment), but a player standing still in a corner will
  see several in a row.
- The hallway is a dead end: a dog cornered there can't slip past the human until they give up.
- Navigation is a fixed grid of the living room, and assumes no furniture moves. Other rooms would need their own.
- One human, one sock and one treat, with no other humans or mini-games (Phase 3 scope).
