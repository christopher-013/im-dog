# Phase 6 — A Day with Moke

> **Status: proposed, waiting for the owner's approval.** Drafted 2026-10-16 from the owner's choice of next steps:
> a day in the life, Halloween, photo mode, and a car ride to the coast. No Phase 6 code until the owner approves
> this plan (and answers the open questions at the end). The milestones and numbers below are proposals.

**Goal:** give the game a shape (a day that goes from breakfast to bedtime, with a few gentle goals), a reason to
come back now (Halloween), a way to keep the moments (photo mode), and one big new treat: **going for a ride**, out
through the garage in the family car, head out of the window, along the coast to Torrey Pines and home again.

**Still true:** no scores, no failing, no combat. Every playable dog does everything (D29); FSD can do everything a
player can (D27); every input device feeds the same actions (D15); the dogs' looks stay separate from gameplay (D14).

## The owner's brief (2026-10-16)
- "**A day in the life:** a gentle clock from breakfast to bedtime, a few daily goals like 'nap in the sun', a Dog
  Logic album and an end-of-day card."
- "**Halloween:** trick-or-treaters at the door (reusing the delivery), a costume for each dog, pumpkins."
- "**Photo mode:** pause, move the camera around, hide the on-screen text, save a framed picture."
- "**A dog ride:** the human NPC will ask Moke if he wants to go on a ride. There will be a new room unlocked, 'the
  Garage', which will have a door to the left of the TV in the living room. If the dog says yes, the human will put on
  a harness and leash and open the door to the garage, which will show a Tesla Model X in the garage waiting. The
  human and dog will get into the car and the dog will sit in the passenger side window. The passenger side window
  will roll down and the dog will be happily sticking their head out the window and watching the drive. The drive
  will go from the home and go along the coast towards the Torrey Pines State Park and pass along the ocean for the
  famous drive that has the beach and coast by the side, 80s style pop music will be playing and the drive will last
  no more than 5 mins with the human driving back home, parking in the garage and bringing Moke back home."

## Milestones (proposed, in build order)
| # | Milestone | Why this order |
|---|---|---|
| 6.1 | Halloween | Halloween is 2026-10-31: it has to ship first to be worth anything this year. Small, reuses the doorbell. |
| 6.2 | Photo mode | Small and self-contained; makes the costumes (and everything after) shareable. |
| 6.3 | A day in the life | The clock, daily goals, the Dog Logic album, the end-of-day card. The ride slots into the day afterwards. |
| 6.4 | The Garage and the car | A new room behind the living room and the car in it; explorable, nothing to drive yet. |
| 6.5 | Going for a ride | The invitation, the harness and leash, getting in, the coastal drive, home again. The biggest piece. |
| 6.6 | Polish and the phone | Owner playtests, tuning, a recorded phone/browser check with measured frame rate (carried since Phase 3). |

## 6.1 Halloween
- **When:** automatically by the device's date, **17 October – 1 November**, with a setting (pause → Settings →
  Halloween: Auto / On / Off) so it can be seen, or switched off, any time. Nothing is downloaded or changed outside
  that window.
- **Trick-or-treaters** (reusing `DoorDelivery`): instead of the courier, now and then **two or three children in
  simple costumes** (a sheet ghost, a pumpkin, a witch hat) ring the bell. Bark at the door → the human answers
  quickly (as now), opens it, offers the **candy bowl**: "Trick or treat!", "Cute costume, Moke!", "Happy Halloween!".
  The dog never gets candy (chocolate is bad for dogs): the human gives him a **pumpkin dog biscuit** from a jar by the
  door instead. They stand at the door like the courier, never come in, and nothing else about them is simulated.
- **Costumes:** one for each dog, worn during the season and switchable on Choose Your Dog (Costume: on/off).
  Proposed: **Moke** a pumpkin, **Dougie** a vampire cape with a little collar, **Nori** a witch hat. Built in code
  as attachments to the toon visual, like the collar: they never change the dog's size, body or gameplay.
- **Pumpkins and decorations:** jack-o'-lanterns (one by the front door inside, one on the living-room mantel, a few
  on the patio), a paper bat garland, the candy bowl and biscuit jar by the door, and a flickering candle glow in the
  pumpkins (no extra shadow-casting lights).
- **Dog Logic:** "DOORBELL + COSTUMES = FRIENDS" (the first trick-or-treat answered).
- **FSD:** answers the trick-or-treaters exactly like the courier (it already waits at the door until the visit's done).
- **Optional:** an original spooky-but-cute 8-bit song for the season ("Pumpkin Paws"), following the Music setting.

## 6.2 Photo mode
- **Open:** from the pause menu (Photo), a key on the keyboard and a controller button. Touch: the Photo button in
  the pause menu.
- **What it does:** the game freezes; the HUD hides; the camera is free:
  - orbit round the dog, tilt and zoom (mouse, stick or one-finger drag, two-finger pinch);
  - always kept inside the walls (the camera's collision against the house);
  - a **Pose** button cycles the dog through a few poses (sit, beg, head tilt, lie down, play bow), using only the
    animation state, never the mesh.
- **Frames:** a plain white instant-photo border with the dog's name and the day (and a Halloween frame in season);
  "no frame" too.
- **Save:** render one frame at the canvas size into a PNG.
  - **Desktop:** download it.
  - **Phones:** the browser's own share sheet (Save Image, Messages…), falling back to a download.
  - **Nothing is uploaded anywhere** and nothing is stored on a server.
- **Works everywhere:** in the house, the backyard and (6.5) during the ride.

## 6.3 A day in the life
- **The clock:** one game day lasts about **20 minutes of play**, morning → afternoon → evening → night. The clock
  pauses with the game.
  - **Light:** the sun's angle and colour follow the clock: warm morning sun, bright afternoon, golden evening, then
    a dim blue night with the lamps on. Built on `RoomLighting`, with no extra shadow passes.
  - **Clocks:** the house's clocks (the dining room's Roman-numeral clock) show the time.
- **The human's day follows it:** coffee and breakfast in the morning, chores and the phone in the afternoon,
  cooking and dinner in the evening (the existing prep and meal), TV after dinner, then "Bedtime, Moke!": they head
  to the bedroom-hall door, and the dog goes to his bed for the night. The current activities stay; the clock only
  steers which ones they pick, and when.
- **Daily goals:** three a day, drawn only from things already in the game. For example:
  - nap in the sun;
  - protect the house;
  - get a hamburger patty;
  - steal a sock and trade it;
  - play fetch;
  - find a hidden treat;
  - watch the ballgame;
  - chew the squeaky fish;
  - (6.5) go for a ride.
  
  They show in the pause menu and as a small checklist that slides in when one is done (a paw stamp). Nothing
  fails: unfinished goals just aren't stamped, and tomorrow brings new ones.
- **The Dog Logic album** (pause → Dog Logic): every discovery as a card (the equation's icons and words); ones he
  hasn't learned yet show as "???" with a small hint. Each dog has their own (their existing Dog Logic memory).
- **The end-of-day card:** at bedtime, "Moke's day", day N: the goals stamped, Dog Logic learned today, a few
  counts (naps, socks stolen, treats found), and the day's photo if one was taken. Then **Sleep** → a new morning.
  The day number and today's goals are remembered in the browser, per dog.
- **FSD** plays through the days like a player and its goals count (it's the same dog). This is an open question
  below.

## 6.4 The Garage and the car
- **The door:** in the living room's south wall, **to the left of the TV** as you face it from the couch (around
  x 2.4, between the TV console and the room's east corner), a white interior door like the others.
- **The garage:** a two-car garage behind the living room, about 6.6 × 6.5 m (x −3.4…3.4, z 3.1…9.6). It has:
  - a sealed concrete floor, white walls and the roll-up door;
  - storage shelves, bikes, a recycling bin and a wall charger;
  - **the car**.
  
  Built in code like the rest of the house. Before the first ride the door is closed and can't be opened; after
  that the garage is part of the house, with its own name in "where am I" and Treat Hunt hiding spots. Whether it
  stays closed between rides is an open question.
- **The car:** an **original, code-built electric SUV that clearly reads as the family's Model X**:
  - the long, rounded body and the huge windshield running back over the front seats;
  - the **falcon-wing rear doors that open upward**;
  - the flush handles and the light bar.
  
  **No Tesla name, "T" logo or badges in the game or the code's player-facing text:** the repository and the site
  are public, and the brand is someone else's trademark. This follows the STAR VOYAGERS and store-music approach:
  an affectionate homage, not a copy. The colour is the owner's choice (open question).

## 6.5 Going for a ride
- **The invitation:** now and then (at most once a game day; not during the Sock Heist, the ballgame or another
  activity), the human picks up the keys by the garage door: "**Moke, want to go for a ride?**" The prompt reads
  **Go for a Ride!** near them.
  - **Yes:** interact, or bark. "Let's go!"
  - **No:** wander off or ignore it for 15 seconds. "Okay, maybe later."
  
  FSD says yes most of the time.
- **Harness and leash:** the human crouches and puts on a **harness** (each dog's own colour, worn over the collar,
  attached to the visual like the costumes) and clips on the **leash** (a line from the harness to their hand). Then
  they walk him to the garage door: on the leash he follows them, and the player can still look around, bark and wag.
- **Into the car:** the garage door opens on the car waiting. The **passenger-side falcon-wing door rises**; the
  human lifts him onto the **front passenger seat** and buckles the harness to the seat. They get in on the driver's
  side, the roll-up door goes up, and they back out.
- **The drive** (a separate scene, not the house):
  - **The route:** out of the neighbourhood and down to the coast. Then north along the beach to **Torrey Pines**:
    Torrey Pines State Beach, the lagoon bridge, the sandstone bluffs and the gnarled Torrey pines on top, the climb
    up the grade. Then back down and south along the ocean.
  - **The ocean on his side:** with the dog on the passenger (right) side, the ocean is right below his window on
    the drive back south, which is why the route turns round at the top.
  - **What's on show:** surfers, pelicans and gulls, the sun on the water, the beach on one side and the cliffs on
    the other.
  - **The light:** the time of day follows the day clock (an evening ride is a sunset drive).
  - **How it's made:** stylized and built in code, from general knowledge of the place. No map data or photos ship
    in the game (the owner can share private reference photos under D18).
- **His head out of the window:** the passenger window rolls down. He puts his head out with his ears and fur
  fluttering in the wind, tongue out, eyes squinting happily. The player can:
  - bark at things (gulls, a dog on the beach);
  - pull his head in and put it out again;
  - look around;
  - switch between a few camera shots: alongside the car, the dog's close-up, a wide coastal view from ahead, and
    a view from his seat.
  
  Nobody but the human drives.
- **Music:** an **original 80s-style synth-pop song** for the drive: a drum machine with a big gated snare, a
  pulsing synth bass, bright chords and a singable lead. It follows the Music setting. No real song is copied.
- **Length:** about **3–4 minutes**, never more than 5. Pause → **Head Home** skips straight to the drive home.
- **Home again:** into the garage, the roll-up door comes down, the falcon-wing door rises, the human lifts him out
  and walks him in on the leash, then takes off the harness: "Best ride ever, Moke!". Dog Logic "CAR + WINDOW =
  WIND", and the daily goal "go for a ride".
- **While they're out:** the house waits. The human's routine, the doorbell and every other activity are frozen (the
  doorbell can't ring for an empty house), and the day clock moves on by the drive's length.

## Proposed decisions (recorded in `DECISIONS.md` once approved)
- **D30, seasonal content:** Halloween turns on by the device's date (17 Oct – 1 Nov), with a setting to force it on
  or off. It's all built in; nothing is fetched. Winter can follow the same pattern.
- **D31, the day clock:** a game day of about 20 minutes that drives the lighting and steers the human's routine. Goals
  and the end-of-day card are presentation only: no scores, nothing to fail.
- **D32, the Garage:** a new room, the first since Phase 4, opening off the living room. An exception to "no more
  rooms", for the ride.
- **D33, the ride:** a scripted scene away from the house, its own lazy-loaded scene (`src/ride/`), not free roaming,
  with no physics needed (the car follows a path). Refines D6 and D28: the human and the dog leave the house only
  here, and only together. The house simulation pauses while they're away.
- **D34, real brands and places:** the car is an original design with no brand marks; the coast is a stylized homage
  to Torrey Pines, built in code; the music is original. (Place names are fine; logos and real songs are not.)

## Not in scope
- Driving the car yourself, or anywhere other than this coastal loop.
- Getting out at the beach.
- More residents of the house. The trick-or-treaters only come to the door.
- More dogs on screen at once ("The Pack" stays a later idea).
- Winter and other seasons (a later phase).
- Uploading or sharing photos to any service.
- Scores, streaks or anything that fails.

## Success criteria
- **6.1:** between 17 Oct and 1 Nov (or forced on):
  - trick-or-treaters come to the door, are answered and leave;
  - the dog gets a biscuit, never candy;
  - each dog wears their costume and it can be switched off;
  - the decorations are up;
  - outside the window (or forced off), the game is exactly as before;
  - FSD answers them too.
- **6.2:** photo mode opens and closes from every device, the camera never leaves the walls, and the saved PNG
  matches what was framed. It saves on desktop Chrome and through the share sheet on a phone (a real phone, recorded).
- **6.3:**
  - a full day runs from morning to bedtime with the light changing;
  - the human's routine follows the time of day;
  - three goals a day, each achievable with what's already in the game;
  - the album shows every discovery and the "???" ones;
  - the end-of-day card leads into a new morning;
  - each dog's day number and goals are kept separately, and nothing breaks if storage is unavailable.
- **6.4:** the garage door sits left of the TV. The garage is navigable for the dog, the human and FSD. The car
  looks like the family's car to the owner, with no brand marks anywhere.
- **6.5:**
  - the invitation can be accepted or declined, by a player and by FSD;
  - harness, leash, in, drive, home and harness off all run without getting stuck;
  - the drive lasts no more than 5 minutes (or is skipped), the ocean is beside the dog's window, the 80s song
    plays, and every dog's head and ears work out of the window;
  - the house is just as it was when they get back;
  - the frame rate on the owner's phone during the drive is measured and acceptable to the owner.
- **Every milestone:** typecheck, tests, build and the private-photo check pass, and the owner plays it on the
  published game.

## Risks
- **Halloween's deadline:** 15 days. 6.1 is kept small on purpose. If it slips past the 31st it still works next
  year (the date window), but this year's moment is gone.
- **The drive scene is the biggest new piece:** a second world, coastal scenery, a car interior and cameras. It's
  built after the garage so the house side is proven first. The scenery stays stylized (low-poly cliffs, a painted
  sea, instanced trees) to stay fast on phones.
- **Day and night lighting** touches every room; the night look must stay cozy, not dark.
- **Likeness:** the car and Torrey Pines come from general knowledge. The owner's own (private) photos would help,
  and stay out of the build (D18).

## Open questions for the owner
1. **Halloween:** automatically by the date (17 Oct – 1 Nov) with an on/off switch? Are the proposed costumes right
   (Moke a pumpkin, Dougie a vampire cape, Nori a witch hat)? Children in costumes at the door are OK as visitors?
2. **The day:** about 20 minutes per game day? Should FSD's days count toward goals and the end-of-day card?
3. **The Garage:** once unlocked, can the dog wander in any time, or does its door stay shut except for rides?
4. **The car:** OK to keep it unbadged (no Tesla name or logo) and recognisable by its shape? Which colour?
5. **The ride:** only when the human offers, or can the dog ask too (e.g. bark at the garage door or bring the leash)?
6. **References:** would you like to share private photos of the garage and the car for likeness (kept out of the
   build, like the home photos)?
