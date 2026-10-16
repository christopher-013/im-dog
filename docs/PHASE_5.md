# Phase 5 — FSD, Full Self Dog

> **Status: started 2026-10-04 at the owner's request.** The owner opened Phase 5 with its first feature, FSD. The
> rest of the phase isn't defined yet: further milestones are added here as the owner approves them.

**Goal:** let anyone watch what Moke can do. **FSD ("Full Self Dog")** is an autopilot: switch it on and Moke plays by
himself, going round the house and through his activities at random, until you take over.

## In scope (the owner's brief, 2026-10-04)
- **The FSD button:** bottom right (moved there 2026-10-05; above the paw on touch), translucent; switching it on hands Moke to the autopilot. Its own status line says
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
| 5.3 | Watch TV full screen, and a fourth show (STAR VOYAGERS) | **Built** (2026-10-05): see below. |
| 5.4 | Dougie and Nori, more playable dogs, and Choose Your Dog | **Built** (2026-10-16), pushed to `main` at the owner's request; waiting for the owner's verdict: see below. |

## 5.1 FSD: how it works
- **On and off:** the **Engage FSD** button (bottom right; on touch above the paw, lifting clear of its pop-out buttons) or **G** on a keyboard (with the mouse
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
- **Getting unstuck:** exploration chooses reachable floor with space around it; if distant samples miss, he takes
  a shorter walk nearby. Recovery measures horizontal displacement, so hopping on the spot never resets it: one
  recovery hop, then abandon the move after 3.2 seconds without progress. Failed activities rest for at least 20
  seconds while he tries something else. A treat tucked somewhere tight: he heads for the nearest floor he can
  reach and squeezes at most 0.45 m beyond it. Squeezed into a pocket the grid thinks is closed off (between dining
  chairs): straight out to floor that connects first. Both use `NavGrid.region` / `nearestReachable` (connected patches of floor, labelled once), so a
  hopeless goal never costs a whole-house search. Tuning: `src/config/autopilot.ts`.
- **Toilet paper:** included in the random routines. FSD reads whether the activity is ready independently of its
  nearby-only prompt, visits `BATHROOM.paperApproach`, then waits for and presses Pull Toilet Paper. Once the dog
  holds it, `paperRun` takes over and goes out into the hall; normal activity rules release the paper and call the
  human to clean up. Before the 2026-10-15 Pacific fix, the routine required the nearby prompt before choosing to
  visit, so it could only start by chance.
- **Controls:** the FSD button, G, or the left stick pressed on a controller.
- **The rainbow path** (2026-10-05): while FSD drives, a glowing rainbow ribbon on the floor shows the way Moke is
  about to run: a solid rainbow road, its colours flowing forward (`autopilot/FsdPathView.ts`, `FullSelfDog.trail`, `FSD_PATH`).
- **Fetch** is a real game (2026-10-05): ask until they give in, then fetch and bring the ball back after each throw.
  Liam's Obstacle Course waits 2 minutes, then comes at most every 5 minutes. Squeezes (a treat under the dining
  table) use a finer grid at Moke's exact size for the last few metres.

## Reliability follow-up verification (2026-10-15 Pacific)
- Two seeded six-minute exploration simulations through the real house with Rapier. Baseline stalled pushes
  lasted 20.3 / 22.0 s; repaired runs keep them under 4 s, never repeat a recovery hop without horizontal progress,
  explore at least three rooms and complete at least ten exploration routines each.
- Unit regressions cover disconnected targets, short local exploration fallback, jumping without horizontal
  progress, failed urgent-routine retries, and selecting the paper routine before its nearby prompt appears.
- `FullSelfDog.paper.test.ts` drives the real dog body and human cleanup logic through two complete bathroom visits,
  pulls, trail releases and cleanups. Existing chair-gap, hidden-treat, furniture-hop and course tests still pass.
- Final full suite: 89 files / 645 tests (`npm test -- --maxWorkers=2`); strict typecheck and build pass. Browser smoke
  confirmed FSD engagement, roaming, toys, doorbell/table activities and pause without runtime errors. The final
  browser run also completed Toilet Paper Mischief once, resumed exploring and watched the ballgame. This was not
  a physical-phone test or a long browser soak. The owner subsequently requested committing and pushing these fixes to `main`.

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
- **Liam's Obstacle Course**, on the lawn behind the patio furniture: a small loop with a start/finish arch whose
  banner reads "Liam's Obstacle Course · START AND FINISH" (the sign at the back was taken down, owner 2026-10-05), a
  paved path in from the patio (straight out, then curving right to the START arrow), two low hurdles to hop, five weave poles to go in and out of, and a gentle hill to run up
  and down. The HUD walks him through it; stations count in order; nothing fails. Details: `ACTIVITIES.md`,
  `HOME_REFERENCE.md`; numbers in `config/obstacleCourse.ts`.
- **Done:** fireworks over the screen and **"Moke is tired!"** with his time, then the human waits just inside the
  open slider with a **hamburger patty** and gives it to him when he comes in (`CourseReward`).
- **FSD** runs the course too, then goes in for the patty.
- **One-press help** (owner, 2026-10-05: "easier to navigate"): during a run, coming up to the next hurdle the paw
  (E, or the paw on touch) reads **Jump Hurdle**, and at the weave poles **Weave Pole n/5**. One press and Moke does
  that one obstacle by himself (a run-up and a hop; round the pole on the right side), scored by the course's own
  rules; moving yourself takes over at any time, and doing it all yourself still works. `activities/CourseAssist.ts`,
  `COURSE_ASSIST` in config. Not offered while FSD drives.
- **The FSD button** turns light green and pulses gently while FSD drives (still, with reduced motion).

## 5.3 Watch TV full screen, and STAR VOYAGERS (owner's request, 2026-10-05)
"If Moke is close to the TV they can watch whatever show is playing as a full screen display of the show; they can
exit out of it if they are done by pressing any button. Add one more show that is like 'Star Trek: The Next
Generation'… the captain, the first officer, the android and the security chief on the bridge… going into warp
speed with the words 'Engage'."
- **Watch TV** (`activities/WatchTv.ts`): see `ACTIVITIES.md`. The camera eases into a close-up of that TV, like the
  ballgame. Any button, click or tap exits.
- **STAR VOYAGERS** (`world/tv/StarVoyagers.ts`, channel 9): an original homage (no real names, ship or insignia):
  the title among the stars, the bridge crew at their posts, the captain points at the viewscreen, **"ENGAGE!"**, the
  stars stretch into warp, the ship flashes away, "next time: a new world!" (23 s). With four shows on three TVs, a
  channel change now sometimes switches a TV to the one that isn't on (`TvChannels.switchChannels`).

## 5.4 Dougie and Choose Your Dog (owner request, 2026-10-16; D29)
"Add a second playable dog, Dougie… When the player clicks PLAY, show a 'Choose Your Dog' screen before gameplay
begins… Dougie must be able to do everything Moke currently can."
- **Choose Your Dog** (between PLAY and the game): Moke and Dougie side by side in 3D, facing you; the highlighted one
  steps forward in a spotlight, looks at you, tilts its head, blinks, wags and does a little hop and a silent bark now
  and then (still with reduced motion). Switch with the arrow buttons, a click or tap on a dog, a swipe, ← → or A/D,
  the D-pad or LB/RB; BEGIN (focused, so Enter works; A or Start on a controller); Esc or B back to the title. The
  name chips are a radio group; the name and a line about the dog are on the card. Desktop, phone portrait and
  landscape layouts.
- **The announcer:** "CHOOSE YOUR DOG" slams onto the screen with an original drum-and-brass stinger, and the
  browser's speech voice says "Choose your dog!" low and slow; BEGIN brings "BEGIN!" over the game with a hit and the
  spoken "Begin!". Started from the PLAY / BEGIN clicks (browsers' autoplay rules). Where there's no speech voice,
  or the device is muted, the words are still on screen. Not a copy or imitation of any game's announcer.
- **Follow-up (owner request, 2026-10-16):** "move the Choose your Dog text lower. Play 8-bit style fighting music in
  the background… When the user clicks and selects either Moke and Dougie have the announcer say the dog name."
  - The title sits lower, nearer the dogs (a share of the screen height: about 100 px lower on a tall desktop window,
    50 px on a phone upright, barely at all on a phone on its side); the dogs moved down a little with it.
  - **"Paws Up!"**, an original 8-bit fight theme in the style of an arcade fighting game's character select (E minor,
    148 BPM, a pumping octave bass, power stabs, four-on-the-floor kicks, a pulse lead), plays while the screen is up and
    hands over to the chosen background song at BEGIN; going back leaves the title quiet as before. It follows the Music
    setting (off means off here too) and dips under the announcer's voice. No real game's music is copied.
  - The announcer calls out the dog's name ("Moke!", "Dougie!") whenever one is picked: an arrow, a swipe, a key or
    the controller, or a click or tap on a dog or its name (also when that dog is already highlighted).
- **Dougie:** the same toon build and size as Moke, with his own markings (dark charcoal coat and long ears, a white
  patch on top of his head, cream-tan eyebrows, cheeks and muzzle, white chest and socks, tan flashes on his
  forelegs, a white tail tip), brown eyes and a sage collar with "Dougie" on the tag. Same mouth socket, so he carries
  everything Moke does.
- **Same game:** every activity, Sock Heist, the course, FSD and the controls are shared; the human and the HUD say
  "Dougie" when he's playing. His Dog Logic is his own; Moke's saved progress is untouched.
- **Nori, the third dog (owner request, 2026-10-16):** "Add another dog to the options 'Nori' use the same process as
  what was done for Dougie… add them as the 3rd dog to select." Built the same way from two private photos: the same
  toon build and size, a curly light apricot coat (creamier face, muzzle, chest and feet, a deeper crown, back and
  tail), caramel drop ears with darker ends, dark eyes, a black nose, and a teal collar with a gold "Nori" tag. Third
  on Choose Your Dog (Moke, Dougie, Nori; the arrows wrap round), "Nori!" from the announcer, "Nori" in every line,
  Dog Logic of Nori's own (`imdog.dogLogic.nori`). The announcer says Moke's name "Moke-ee" (spelled "Mokey" for the
  speech voice, `DogProfile.spoken`; owner request), and he's still "Moke" on screen. Nori is a girl: the lines say "she", "her", "herself" and
  "good girl" for her (`pronoun: 'she'`). The stage was re-spaced for three (closer together, more room at
  the ends; on a phone upright the arrows sit below the dogs).
- **Then (owner request, 2026-10-16):** "remove the Back button on the Choose your dog screen, put Moke in the middle
  and make Moke the first choice default dog." The dogs stand Dougie, Moke, Nori; the screen always opens on Moke
  and every visit starts as Moke (the last choice is no longer remembered: `imdog.dog` and `core/DogChoice.ts` are
  gone). The BACK button is gone; Esc and B still go back to the title, and on a touch screen there's no way back
  but reloading.

## Success criteria
- Switching FSD on makes Moke go round the house doing things, by himself, for as long as you leave it; moving takes
  over.
- Over a long run, most routines get done, none gets him stuck, nothing errors.
- When the ballgame is on, he goes and watches it, and the screen fills the view while he does.
- Everything still works without FSD (it's off by default).
- 5.2: Moke can walk out through the open slider, round the backyard but never out of it, and do the course; the
  hurdles need a hop, the weave needs in-and-out, the hill goes up and down; finishing shows the fireworks card and
  the human gives him a hamburger patty back inside.
