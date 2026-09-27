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
- **Errands:** refilling Moke's bowls once he's emptied one (`BowlRefill`) borrows the human the same way (see
  ACTIVITIES.md: Moke's bowls).
- **Roles:** a dog activity can `claim()` the human (refused during the heist, another role, or a pat). The role
  fills the intent each step until it's done; the routine then resumes (`HumanRole` in
  `HumanActivityController.ts`, helpers in `intentHelpers.ts`).

## Places: interaction points
`world/home/places.ts` → `HOME_PLACES`: each has a kind (`couchSeat`, `readingSeat`, `diningChair`, `stool`,
`kitchenCounter`, `stove`, `sink`, `fridge`, `laundry`), the room, where the body **stands** (walkable floor), which way
they **face**, and for seats where the **hips** go, how high and how they sit (`upright`, `stool`). TV seats have a
`look` point (the screen); counters and the table a `surface` (its height drives the kitchen and table poses).
Seats are **stepped into straight**: a sofa straight back from its stand point; a dining chair or island stool,
whose stand point is behind it, from an `entry` beside it (the gap between chairs), so the body never passes through
a chair back or slides in sideways. The chaise is not a human seat (it can only be reached from its side); it stays a
nap spot. Tests check every stand point is walkable and reachable from every other, faces its surface, and steps
straight into its seat.

## Body: `HumanController`
- Walks NavGrid A* paths (0.1 m cells over the whole house, grown by the body radius so dog gaps stay dog-only) at
  1.05 m/s (2.05 hurrying in the heist), with limited turning and acceleration.
- **Sitting:** given a seat (`intent.seat`) and at its stand point, it turns to the seat's facing, then lowers
  (`sitTime` 1.2 s plus `seatStepTime` 1 s per metre it steps across); asked to stand (seat null, or a different
  seat) it gets up first (`standTime` 0.9 s plus the same) before walking, and it isn't "arrived" anywhere while
  getting up. The **body stays at the stand point** (in front of the seat, where the legs are); the **visual** steps
  across to the seat (stand → entry → seat, `Human.visualPosition`) and only then lowers. The animation reads the
  visual's *measured* motion, so those are real back- or side-steps, not a slide. So a seated human still blocks the
  floor in front of the sofa, not the cushion Moke might hop onto.
- **Stuck recovery:** no progress over `stuckTime` → plan afresh; if Moke is what's in the way (within 1.2 m and not
  at the goal), the new path keeps 0.62 m from him (`NavGrid.findPath(…, avoid)`); starting off the walkable area,
  it steps out first. `stuckFor` tells the routine how long. **No path at all is not arrival:** it counts as stuck, so
  the routine gives up and chooses something else. If pathing reports arrival at a snapped walkable point that is
  still too far from the activity's interaction point, the routine gives up after one second.
- **NavGrid consistency:** path smoothing's line of sight is as strict as the A* search (which never cuts corners): it
  samples a little either side of the line, so a smoothed path can't slip diagonally between two blocked cells
  into a scrap of floor the search can't plan out of. Standing on such a scrap anyway, the search steps onto the
  nearest cell that connects. (This was the "standing at the furniture doing nothing" failure between the chaise and
  the family-room coffee table.)

## Animation: `HumanAnimationController` (+ `HumanRig`)
- `HumanRig.ts` is the contract: 23 joints (hips, spine, chest, neck, head, clavicle/shoulder/elbow/wrist/fingers/
  thumb ×2, hip/knee/ankle ×2), their rest positions (an adult man, 1.78 m), the Euler order of each joint
  (`JOINT_ORDER`: shoulders ZXY, elbows, neck and head YXZ), the pose names, the semantic animation states, props,
  sit styles, and the face dials (`jawOpen`, `mouthWide`, `smile`, `lids`, `brows`, `eyeYaw`, `eyePitch`).
- **One owner per frame:** only `HumanAnimationController` writes joint angles; the visual only applies them. Its layers
  never fight: posture (standing stance, a speed-matched walk from the *measured* ground speed, stepping round a turn,
  sitting, kneeling) → the action (crossfaded; hands placed by two-bone IK in `humanIK.ts` where they hold or touch
  something) → attention → breathing and weight shifts → gentle per-joint smoothing.
- **Attention (eyes → head/neck → upper body):** a look target comes with a weight (`intent.lookWeight`): at 0.3 (a
  glance) the eyes do most of it and the head some, the shoulders stay square; by 0.6 the head and neck turn; only
  near 1 does the upper body help. Head and neck together never pass 1.0 rad; a target further round is the body's
  job (standing, a reaction turns them round). Weights ease in and out; the gaze turns at 3.2 rad/s, never a snap.
  The brain resets the weight every step, so a reaction's weight never outlives it.
- **Arms:** hanging arms stay hanging toward the floor when the back bends (bending carries them forward), and the
  arm IK picks the Euler solution nearest the resting arm (so blending never winds an arm round the long way).
- The controller turns the visual state (speed, crouch, pose, head turn, sit amount/style/height, a look target,
  talking, prop) into joint angles, hip height and a face each frame, blending between poses (faster for surprises
  and throws, slower for lounging). On top: a walk cycle, breathing and weight shifts, blinks, eye darts, eyes that
  follow what they look at (the head helps), and a moving mouth while a speech bubble is up.
- **Poses:** the heist's 14 (fold, surprised, chase, lunge, stumble, shrug, search, peek, rummage, offer, take,
  place, tidy, idle) and 17 new: read, phone, watch, relax, sip, cook, prep, eat, fridge, pet, call, shoo, laugh,
  windup, throw, point, cheer. Each works standing or seated (legs come from sitting/kneeling).
- **Folding laundry** is a readable cycle (bend into the basket, straighten and shake a piece out wide at chest
  height, fold it in half twice, back down), 5.8–7.6 s per piece. **Petting** uses the hand on Moke's side, the other
  resting on the knee or thigh; the palm lands on his back.
- Pure logic, tested (every pose finite standing and sitting; hips onto the seat; walking; blinking; talking; eyes;
  the attention hierarchy and its limits; petting from a kneel with no arm behind the back).

## Look: `StylizedHumanVisual`
- Built in code (original; no files): a warm, friendly stylized adult man drawn with Moke's own toon shading and
  thin outline: warm tan skin, short black hair sculpted into locks, brown eyes, straight brows, an untucked sage
  long-sleeve button-down (placket, buttons, collar band and points, cuffs; curved tails over the jeans), blue jeans,
  and **one striped sock** (Moke has the other; the right foot is bare).
- **Garments are lofted, not assembled from primitives:** the shirt is one lofted shell, roomy enough over the hips
  that the jeans never show through it (tested); the **jeans are one garment**, each leg lofted from the waist with a
  flat inner side so the two halves make one waist and seat with a soft seam down the middle and part below the
  crotch into two legs (a slight fade down the thighs and knees in the vertex colours). No body geometry under the
  clothes: the arms are sleeves to the cuff, with only a strip of wrist.
- **Hair** is one sculpted shell over the skull: locks radiate from the crown and curve forward and to his right
  (ridges in the shape, a sheen along each lock in the vertex colours), and their tips make the hairline, fringe and
  nape, which it tucks under.
- **One skinned body:** every part is built in the rest pose, weighted to the rig's bones (smooth blends at the
  waist, shoulders, elbows, knees and neck; the rear of the seat stays with the pelvis when the thigh bends), and
  merged per material into `SkinnedMesh`es sharing one `Skeleton`: six material meshes plus five outlines (about
  24,000 triangles, 33 bones). The face uses extra bones: irises that slide across flat toon eyes (each turned a
  little with the face), upper lids that come down from the top of the eye, a lash line on the lid's edge, brows
  that lift, a jaw that opens the mouth, a smile line that curves.
- **Hands and props:** `hands.left/right` anchors ride the wrist bones (the Sock Heist's sock and treat use them, as
  before; so does a thrown toy). Activity props (`humanProps.ts`: a paperback, a phone, a mug, a fork, a wooden spoon,
  a knife, the remote, and a two-handed folded cloth) appear when the activity asks. The laundry cloth and larger
  chest-height folding motion make the opening routine readable from Moke's low rear camera.
- Fades see-through when between the camera and Moke (Phase 3 behaviour).
- **Fallbacks:** an unknown pose is simply idle; a missing prop shows nothing; a future modelled human only has to
  implement `HumanVisual` (`apply(dt, pose)`, `hands`, `setSeeThrough`, `dispose`) and map the rig's joints (or clips)
  to its skeleton. There is no GLB human; the built-in one is the implementation.

## With Moke (`HumanReactions`, tuning `MOKE_REACTIONS` in `config/activities.ts`)
| Moment | When | What they do |
|---|---|---|
| Look | He turns up within 2.6 m and in view (after 4 s away); otherwise only now and then (0.1/s × how free the activity leaves them) | A glance (weight 0.3: eyes, a little head) for ~2 s; cooldown 12 s. Not a security camera |
| Hello | He comes close after 40 s away | "Hi, buddy." with a smile |
| Bark reply | He barks within 7 m | A look; now and then "Yes, Moke?" |
| Attention | Three barks in 8 s, within 4.5 m (and the activity allows it) | "Okay, okay. What do you want?"; standing, they pat their knees; can lead to a Treat Hunt; BARK = ATTENTION |
| Praise | A trick within 3.2 m, in view | "Aww, good boy!", a cheer if standing; can start a Treat Hunt |
| Pats | "Get Pets" (E / the paw) within 1.3 m, or he sits by them while they sit | Standing: turn to him, walk over (hands free), kneel within 0.5 m, pat his back with the hand on his side, then back to what they were doing. Seated: lean. Moke sits, tips his head up into the hand and wags hard; a heart |
| Not now | He asks them to play while they're busy | A wave of the hand: "Not now, Moke…" (see Make Human Play) |
| The sock | He's seen with the sock | The Sock Heist (Phase 3, unchanged) |

Lines are short and rare (at most one every 7 s, and not every time). How much of them turns (`MOKE_REACTIONS.weights`):
a look 0.3, a bark reply 0.5, hello 0.65, praise 0.85, attention and pats 1. Anything more than a look with Moke
behind them (over 1.3 rad round), standing, and they turn round to him. While doing something, their eyes are on
it (the TV: `ROUTINE.focusWeight` 0.55); a look round the room is lighter (0.45) and narrower when absorbed.

## Tuning
`config/human.ts` (`HUMAN`: body, walking, sitting, avoiding Moke, sight, heist), `config/activities.ts`
(`HUMAN_ACTIVITIES`, `ROUTINE`, `MOKE_REACTIONS`), `config/dogActivities.ts` (roles in the dog activities).

## Performance
The routine decides only when an activity ends (the scheduler is never run per frame); reactions are a few distance
checks per fixed step plus one line-of-sight ray when he's near; paths are planned on demand (A* on a 207 × 103 grid).
The human's body renders as six material meshes plus five matching outline meshes (11 skinned draw calls), with
additional small face details, a held prop when needed, and shadows.
