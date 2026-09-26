# The Human (Phase 4)

One adult lives with Moke (the brief: no other family members). They go about a believable day around the house,
notice and respond to Moke, and still run the Sock Heist when a sock goes missing. Behaviour, body, animation and
look are separate (like Moke, D7), so a modelled human could replace the built-in one.

```
Human (src/human/Human.ts): ties it together each fixed step and frame
├── HumanBrain           behaviour: the Sock Heist state machine (Phase 3), with an idle "driver" plugged in
│   └── HumanActivityController   the daily routine (the driver): activities, places, sit/stand, resume
│       ├── ActivityScheduler     what next: weighted, cooldowns, location-aware
│       ├── HumanReactions        moments with Moke: look, hello, bark replies, attention, praise, pats
│       └── roles                 dog activities borrowing the human (Treat Hunt, Make Human Play)
├── HumanController      body: Rapier capsule on NavGrid paths; sitting down and getting up; stuck recovery
├── HumanAnimationController      poses → joint angles, hips, face, prop (no meshes)
└── HumanVisual          look: StylizedHumanVisual (a skinned, code-built character); held props
```

## Behaviour: `HumanBrain` + the routine
- **`HumanBrain`** (`human/HumanBrain.ts`) is Phase 3's Sock Heist state machine, unchanged in its heist states. Its
  `idle` state now asks `driver.drive()` what to do (the routine), while it keeps watching for Moke with the sock
  (sight cone + line of sight + hearing). The moment it notices, it calls `driver.interrupt()` and the heist takes
  over; when the heist settles back to idle it calls `driver.resume()`. PLAY AGAIN calls `driver.reset()` (folding
  laundry, as the heist expects). Without a driver it folds laundry as before (its tests use that).
- **`HumanActivityController`** (`human/activities/`) runs the day: `pause → walking → settling → doing → leaving`.
  Each activity is data (`config/activities.ts`, see `ACTIVITIES.md`): steps at kinds of place, a pose, a prop, a
  duration range. It walks to the place, sits (seats) or lines up (counters), does it, glances round the room now
  and then (more often in activities that don't need full attention), stands, pauses, and asks the scheduler for
  the next thing. If the next activity suits the seat they're on, they stay sitting.
  - **Interrupted, never lost:** the Sock Heist or a dog activity saves the activity and time left; afterwards they
    walk back and carry on (within two minutes; otherwise something new). Right by the laundry after putting a sock
    away, they carry on folding.
  - **Moke in the way:** if he's lying on the seat they were heading for: "Scoot over, Moke." and another seat.
  - **Can't get there:** after 4 s without progress (or 45 s walking) they give that activity up (cooldown) and do
    something else. **Never a teleport** (only PLAY AGAIN resets their position, as in Phase 3).
- **`HumanReactions`** layers short moments on top (see "With Moke" below); a reaction that takes the body (a pat,
  praise) pauses the activity's clock.
- **Roles:** a dog activity can `claim()` the human (refused during the heist, another role, or a pat). The role
  fills the intent each step until it's done; the routine then resumes (`HumanRole` in
  `HumanActivityController.ts`, helpers in `intentHelpers.ts`).

## Places: interaction points
`world/home/places.ts` → `HOME_PLACES`: each has a kind (`couchSeat`, `readingSeat`, `diningChair`, `stool`,
`kitchenCounter`, `stove`, `sink`, `fridge`, `laundry`), the room, where the body **stands** (walkable floor), which way
they **face**, and for seats where the **hips** go, how high and how they sit (`upright`, `stool`, `lounge` on the
chaise). TV seats have a `look` point (the screen); counters and the table a `surface` (for the plate). Tests check
every stand point is walkable and reachable from every other.

## Body: `HumanController`
- Walks NavGrid A* paths (0.1 m cells over the whole house, grown by the body radius so dog gaps stay dog-only) at
  1.05 m/s (2.05 hurrying in the heist), with limited turning and acceleration.
- **Sitting:** given a seat (`intent.seat`) and at its stand point, it turns to the seat's facing, then lowers
  (`sitTime` 1.1 s); asked to stand (seat null, or a different seat) it gets up first (`standTime` 0.8 s) before
  walking. The **body stays at the stand point** (in front of the seat, where the legs are); the **visual** slides onto
  the seat (`Human.visualPosition`) while the legs step and fold. So a seated human still blocks the floor in front
  of the sofa, not the cushion Moke might hop onto.
- **Stuck recovery:** no progress over `stuckTime` → plan afresh; if Moke is what's in the way (within 1.2 m and not
  at the goal), the new path keeps 0.62 m from him (`NavGrid.findPath(…, avoid)`); starting off the walkable area,
  it steps out first. `stuckFor` tells the routine how long.

## Animation: `HumanAnimationController` (+ `HumanRig`)
- `HumanRig.ts` is the contract: 21 joints (hips, spine, chest, neck, head, shoulder/elbow/wrist/fingers/thumb ×2,
  hip/knee/ankle ×2), their standing positions, the angle conventions, the pose names, props, sit styles, and the
  face dials (`jawOpen`, `mouthWide`, `smile`, `lids`, `brows`, `eyeYaw`, `eyePitch`).
- The controller turns the visual state (speed, crouch, pose, head turn, sit amount/style/height, a look target,
  talking, prop) into joint angles, hip height and a face each frame, blending between poses (faster for surprises
  and throws, slower for lounging). On top: a walk cycle, breathing and weight shifts, blinks, eye darts, eyes that
  follow what they look at (the head helps), and a moving mouth while a speech bubble is up.
- **Poses:** the heist's 14 (fold, surprised, chase, lunge, stumble, shrug, search, peek, rummage, offer, take,
  place, tidy, idle) and 17 new: read, phone, watch, relax, sip, cook, prep, eat, fridge, pet, call, shoo, laugh,
  windup, throw, point, cheer. Each works standing or seated (legs come from sitting/kneeling).
- Pure logic, tested (every pose finite standing and sitting; hips onto the seat; walking; blinking; talking; eyes).

## Look: `StylizedHumanVisual`
- Built in code (original; no files): a warm, friendly adult in the game's palette: brown tousled hair with a swept
  fringe, brown eyes with catch-lights, soft brows, blush, a coral cable-knit sweater with ribbed cuffs, hem and crew
  neck, cuffed denim jeans, and **one striped sock** (Moke has the other; the right foot is bare).
- **One skinned body:** every part is built in the standing pose, weighted to the rig's bones (smooth blends at the
  waist, elbows and knees; caps fill the hips, knees and elbows when bent), and merged per material into
  `SkinnedMesh`es sharing one `Skeleton`: 16 draw calls for the whole person (the Phase 3 toon had ~40 meshes).
  The face uses extra bones: eyes that turn, lids that roll down to blink, brows that lift, a jaw that opens the mouth,
  a smile line that curves.
- **Hands and props:** `hands.left/right` anchors ride the wrist bones (the Sock Heist's sock and treat use them, as
  before; so does a thrown toy). Activity props (`humanProps.ts`: a paperback, a phone, a mug, a fork, a wooden spoon,
  a knife, the remote) appear in the right hand when the activity asks.
- Fades see-through when between the camera and Moke (Phase 3 behaviour).
- **Fallbacks:** an unknown pose is simply idle; a missing prop shows nothing; a future modelled human only has to
  implement `HumanVisual` (`apply(dt, pose)`, `hands`, `setSeeThrough`, `dispose`) and map the rig's joints (or clips)
  to its skeleton. There is no GLB human; the built-in one is the implementation.

## With Moke (`HumanReactions`, tuning `MOKE_REACTIONS` in `config/activities.ts`)
| Moment | When | What they do |
|---|---|---|
| Look | He's within 2.6 m and in view | Eyes and head on him for ~2 s (cooldown 7 s) |
| Hello | He comes close after 40 s away | "Hi, buddy." with a smile |
| Bark reply | He barks within 7 m | A look; now and then "Yes, Moke?" |
| Attention | Three barks in 8 s, within 4.5 m (and the activity allows it) | "Okay, okay. What do you want?"; standing, they pat their knees; can lead to a Treat Hunt; BARK = ATTENTION |
| Praise | A trick within 3.2 m, in view | "Aww, good boy!", a cheer if standing; can start a Treat Hunt |
| Pats | "Get Pets" (E / the paw) within 1 m, or he sits by them while they sit | They reach down (kneel if standing, lean if seated) and pat; Moke sits, tips his head up into the hand and wags hard; a heart |
| Not now | He asks them to play while they're busy | A wave of the hand: "Not now, Moke…" (see Make Human Play) |
| The sock | He's seen with the sock | The Sock Heist (Phase 3, unchanged) |

Lines are short and rare (at most one every 7 s, and not every time).

## Tuning
`config/human.ts` (`HUMAN`: body, walking, sitting, avoiding Moke, sight, heist), `config/activities.ts`
(`HUMAN_ACTIVITIES`, `ROUTINE`, `MOKE_REACTIONS`), `config/dogActivities.ts` (roles in the dog activities).

## Performance
The routine decides only when an activity ends (the scheduler is never run per frame); reactions are a few distance
checks per fixed step plus one line-of-sight ray when he's near; paths are planned on demand (A* on a 207 × 103 grid).
The human renders as 16 skinned draw calls (plus shadows for the body, hair and clothes).
