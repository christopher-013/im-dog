# Phase 5 — FSD, Full Self Dog

> **Status: started 2026-10-04 at the owner's request.** The owner opened Phase 5 with its first feature, FSD. The
> rest of the phase isn't defined yet: further milestones are added here as the owner approves them.

**Goal:** let anyone watch what Moke can do. **FSD ("Full Self Dog")** is an autopilot: switch it on and Moke plays by
himself, going round the house and through his activities at random, until you take over.

## In scope (the owner's brief, 2026-10-04)
- **The FSD button:** top right, translucent; switching it on hands Moke to the autopilot. Its own status line says
  what he's up to.
- **Moke drives himself** round the house, through the activities at random: picking up and playing with the toys,
  begging for a carrot, answering the door, getting up on the table, and the rest (below).
- **The ballgame:** when the Padres game (the World Series special) is on the TVs, FSD goes and watches it, and while
  Moke sits watching, **the camera zooms in on the screen** to show the game in detail.

- **5.2 (owner's brief, 2026-10-04): the backyard and Liam's Obstacle Course.** "Allow one of the sliding doors open
  to the backyard which allows Moke to explore the contained backyard area. Behind the patio furniture there is a
  small circular obstacle course that has a few activities for Moke to run thru which will include areas where Moke
  has to jump or move left and right or run up and down a hill. Nothing that is too strenuous. When Moke completes the
  obstacle course, show a fireworks celebration screen that says Moke is tired! And when Moke goes inside the house,
  the human will be waiting for a good treat (hamburger patty) to give Moke as a reward. The obstacle course will
  have a sign that says "Liam's Obstacle Course" as a tribute to Liam's feedback about adding this."

## Not in scope
More humans or rooms; outdoors beyond this one backyard (no front yard, no walks); the human going outside; new
mini-games beyond the course; a "follow cam" director beyond the TV close-up; an FSD that learns or remembers between
sessions.

## Milestones
| # | Milestone | Status |
|---|---|---|
| 5.1 | FSD, Full Self Dog | **Built** (2026-10-04): see below. |
| 5.2 | The backyard and Liam's Obstacle Course | **Built** (2026-10-05): see below. |

## 5.1 FSD: how it works
- **On and off:** the **FSD** button (top right, left of the II button on touch) or **G** on a keyboard (with the mouse
  captured you can't click a button). Moving Moke yourself (keys, stick or thumb) switches it off, like taking the
  wheel. A toast says which.
- **A virtual player** (`src/autopilot/FullSelfDog.ts`, D27): each frame it decides a direction (run or walk) and
  which buttons to press (interact, jump, bark, trick, sniff), and the game takes them exactly like a person's input.
  No activity knows FSD exists; FSD only sees the prompts a player would see (`InteractionSystem.all`, `current`),
  plans routes on its own navigation grid at Moke's size, hops up onto furniture, and presses interact when the right
  prompt is showing.
- **Routines** (each a short plan of steps, chosen at random, weighted, each resting a while after it's done):
  play with the tennis ball, the rope toy or the squeaky fish; bring the ball to the human for a game of fetch; steal
  a sock and run off with it (Sock Heist), then trade it for the treat; beg for a carrot while they chop; beg at the
  dinner table; a trick near the human for a Treat Hunt, then sniff out the treat; ask for pets; eat and drink at
  his bowls; play with Malibu; nap in a random spot (his beds, the sofas, the hearth); hop up onto a coffee table
  until he's told to get down; dig in the sofa pillows; pull the toilet paper down the hall; explore a random room
  with a trick, bark, sniff or hop.
- **Urgent ones cut in:** the doorbell (bark at the door), a treat put down for him, the sock trade, the ballgame,
  carrying on dragging the toilet paper, running off with the sock.
- **Watching the game:** to the nearest TV, sit, **Watch the Game**, and stay put until the home run. The camera
  eases into a straight-on close-up of that screen (`camera/TvCloseUp.ts`, `TV_CLOSE_UP`), sized so the picture fills
  the view in any window shape, and that TV draws 2.5× sharper while it's close up (`TvChannels.setDetail`). It works
  the same when you watch the game yourself.
- **The Sock Heist, start to finish:** after taking the sock he goes and shows it off (a bark with it in his mouth gets
  him noticed), keeps away during the chase, waits while they fetch the treat, gives the sock up when it's offered and
  eats the treat (it follows `SockHeistController.phase`).
- **Getting unstuck:** re-plans every few seconds, hops if pushing gets nowhere, gives a routine up after a while and
  picks another. A treat tucked somewhere tight: he heads for the nearest floor he can reach and squeezes the last
  bit. Squeezed into a pocket the grid thinks is closed off (between dining chairs): straight out to floor that
  connects first. Both use `NavGrid.region` / `nearestReachable` (connected patches of floor, labelled once), so a
  hopeless goal never costs a whole-house search. Tuning: `src/config/autopilot.ts`.
- **Controls:** the FSD button, G, or the left stick pressed on a controller.

## Verification (2026-10-04)
- Unit tests (`autopilot/FullSelfDog.test.ts`, 10): exploring, the doorbell cutting in, routing round walls, watching
  the game and holding still, waiting out busy moments, getting up first, variety without impossible picks, the
  coffee-table hop from outside the footprint, the whole Sock Heist, and the pocket escape. With real Rapier and the
  real house (`FullSelfDog.house.test.ts`): spawn to the gym's bird cage, and onto the living-room coffee table and
  down. The close-up maths (`camera/TvCloseUp.test.ts`) for wide, landscape-phone and portrait-phone windows.
  `NavGrid.test.ts` covers the region labels.
- **Headless runs of the real game** (dev server, Chromium with SwiftShader, rendering skipped, 30 frames/s of game
  time). The last, 8 minutes: every routine started; two Sock Heists played all the way through (stolen → chase →
  treat → trade → eating → SOCK = TREAT) and a third was under way; the ballgame (started by hand at 200 s, and once
  by its own timer) watched twice, the close-up reaching full with that TV drawing sharp; Moke spent time in every
  room; FSD's own worst frame 9.5 ms (it had been 185 ms before the region labels); no console errors. A few routines
  gave up now and then (2 pillow digs, a nap, a few toys) and he moved on.
- Screenshots (960×540): the button off and on with its status line, and the close-up of the dining-room TV.
- **Not verified:** a person playing with FSD in a real browser, on a phone, or for long; how it feels to watch.

## 5.2 The backyard and Liam's Obstacle Course: how it works
- **Out the door:** the gym's southern slider stands open (slid in front of its fixed pane), and the backyard is part
  of the one connected space: solid patio and lawn, solid furniture, held in by the hedges, the back fence (moved
  back to make room) and the house (D28). A soft sky dome and a roof over the wing make it look right from outside.
- **Liam's Obstacle Course**, on the lawn behind the patio furniture: a small loop with a start/finish arch, the sign
  "Liam's Obstacle Course", two low hurdles to hop, five weave poles to go in and out of, and a gentle hill to run up
  and down. The HUD walks him through it; stations count in order; nothing fails. Details: `ACTIVITIES.md`,
  `HOME_REFERENCE.md`; numbers in `config/obstacleCourse.ts`.
- **Done:** fireworks over the screen and **"Moke is tired!"** with his time, then the human waits just inside the
  open slider with a **hamburger patty** and gives it to him when he comes in (`CourseReward`).
- **FSD** runs the course too, then goes in for the patty.

## Success criteria
- Switching FSD on makes Moke go round the house doing things, by himself, for as long as you leave it; moving takes
  over.
- Over a long run, most routines get done, none gets him stuck, nothing errors.
- When the ballgame is on, he goes and watches it, and the screen fills the view while he does.
- Everything still works without FSD (it's off by default).
- 5.2: Moke can walk out through the open slider, round the backyard but never out of it, and do the course; the
  hurdles need a hop, the weave needs in-and-out, the hill goes up and down; finishing shows the fireworks card and
  the human gives him a hamburger patty back inside.
