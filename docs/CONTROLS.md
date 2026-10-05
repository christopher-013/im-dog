# Controls

Bindings live in `src/config/input.ts`, the single source of truth for the in-game Controls screen. Every device
feeds the same gameplay actions (see `docs/ARCHITECTURE.md` → Input). Prompts show the right key for what you're
using: "E — Pick Up Sock" on a keyboard, "A — …" on a controller, a lit-up button on touch.

The Controls screen shows one input at a time, with tabs (Keyboard, Controller, Touch). It opens on the input in use,
so the list fits a phone without scrolling (2026-10-01).

## Desktop: keyboard + mouse

| Input | Action | Status |
|---|---|---|
| W A S D (or arrow keys) | Move (trot), relative to the camera: W = away from the camera | Working |
| Mouse | Look around / orbit the camera around Moke | Working |
| Mouse wheel | Zoom the camera in/out (0.7–2.6 m) | Working |
| Shift (hold) | Run | Working |
| C (hold) | Walk / sneak | Working. Not Ctrl, because Ctrl+W closes the browser tab. |
| E | Interact: pick up · drop · **give** (the sock, for a treat) · **eat** (the treat, or his dinner at his bowl) · **drink** (at his water bowl) · lie down in the bed · **nap here** (the sofas, his pink bed by the fire, the hearth) · **get pets** (near the human) · **pull toilet paper** (in the hall bathroom) · get up. **With nothing to interact with, E sniffs** (like R). | Working: the prompt shows what E will do |

| Space | Jump | Working: up onto the couch seat or the coffee table (0.45 m), the highest places he can get to. Never the TV console, the side table or the couch's arms or back. On the couch or table it's only a little hop; walk off the edge to hop down. No jumping under the coffee table. |
| F | Bark or growl, at random | Working. Bark: a little hop, "Arf!" and a synthesized bark; the human can hear it. Growl: Moke plants himself, pins his ears, squints, shows tiny teeth and makes a deep, rumbly "grrrr". |
| Q | Do a trick | Working: a random trick, never the same twice in a row: belly up, beg, give paw, or spin. He stays put for it; moving or E cuts it short. No belly-up with something in his mouth, no begging under the furniture. |
| R | Sniff mode | Working: about 4 s of scent wisps from nearby things (sock, toys, bed, a treat) |
| G | **FSD, Full Self Dog** on or off (Phase 5): Moke plays by himself | Working. The same as the Engage FSD button (bottom right), which you can't click while the mouse is captured. Moving Moke yourself switches it off. |
| W A S D or Space while resting | Get up out of the bed | Working |
| Esc | Pause and release the mouse | Working. Esc never resumes (it also closes the Controls dialog); resume with RESUME, Enter/Space on it, or a click. |
| Enter / Space on a menu button | Press that button (PLAY, CONTROLS, RESUME…) | Working |
| ` (Backquote) | Toggle the debug panel | Working |

At the bathroom roll, Pull Toilet Paper first lets Moke take the loose end in his mouth. Then use normal movement
to back out through the door and down the hallway; he lets go after enough distance outside, and the human cleans up.

**Watch TV (Phase 5):** in front of any TV, interact (E, A, the paw) to watch its show full screen; any key or button,
a click or a tap stops watching.

**Liam's Obstacle Course (Phase 5):** during a run, the interact prompt offers **Jump Hurdle** coming up to each
hurdle and **Weave Pole n/5** at the weave poles: one press of E (the paw on touch, A on a controller) and Moke does
that one obstacle by himself. Moving takes over; doing it yourself still works.

**FSD, Full Self Dog (Phase 5):** the translucent **Engage FSD** button (it reads **FSD Engaged!**, light green and
gently pulsing, while it drives) at the bottom right (on touch, just above the paw
button, and lifted clear of the paw's buttons while they're out), or G on a keyboard, hands Moke to the autopilot: he goes round the house through his activities at random
(the toys, fetch, the sock heist, begging, the door, naps, the coffee table, the pillows, the toilet paper, Malibu),
and when the Padres game is on he sits and watches it while the camera zooms in on the screen. A line under the
button says what he's up to. Moving him yourself (keys, stick or thumb) takes back over; so does pressing the button
or G again. On a controller, press the left stick.

**Mouse capture:** clicking PLAY or RESUME captures the mouse (pointer lock). Esc releases it and
pauses. Chrome needs about a second after Esc before it will capture again; if resume doesn't capture, click the
room. Where pointer lock isn't available, click and drag to look.

**Settings (pause screen):** a Look sensitivity slider (0.25–3×, for the mouse and touch look), an
invert-vertical-look option, **Music** (Hawaii, Konbini or Off) and **Music volume** (0–150%; 100% is the
level it was mixed at). They're remembered in this browser only.

**How WASD relates to the camera:** W moves away from the camera. While you keep a movement key held, the
direction stays put even if the camera swings by itself (behind Moke, or away from a wall). Only your own mouse
turns change it. Let go and press again to re-aim from the current view.

## Controller
Standard-layout USB and Bluetooth controllers are detected automatically through the browser Gamepad API. Browsers
may hide a newly connected controller until one of its buttons is pressed.

| Input | Action |
|---|---|
| Left stick or D-pad | Move (analog stick preserves speed and direction) |
| Right stick | Look around / orbit camera |
| A / bottom face button | Interact (pick up, drop, give, eat, lie down); start from the menu; resume from pause |
| B / right face button | Jump |
| X / left face button | Do a trick |
| Y / top face button | Bark or growl, at random |
| Left shoulder or left trigger | Walk / sneak (hold) |
| Right shoulder or right trigger | Run (hold) |
| Right stick press | Sniff (all four face buttons are taken) |
| Left stick press | FSD, Full Self Dog on or off (moving the stick takes over) |
| Menu / Start | Pause or resume; closes the Controls dialog if it's open |
| View / Back | Toggle the debug panel |

Keyboard and mouse remain active while a controller is connected; prompts switch to whichever you last used.

## Touch: phones and tablets
Shown automatically on phones and tablets (when a finger is the primary pointer), or as soon as you touch the
screen. Using a mouse or keyboard again switches back. Portrait and landscape both work.

| Input | Action |
|---|---|
| Left thumb, anywhere on the left of the screen | Move. A stick appears under your thumb: push a little to walk, further to trot. |
| Push the stick past its ring (it turns coral) | Run, one-handed |
| Right thumb, drag anywhere on the right | Look around |
| Tap the paw button (or the bubble beside it) | Interact: it lights up and says what it will do in a bubble beside it ("Pick Up Sock", "Give Sock", "Eat Treat", "Eat", "Drink", "Lie Down", "Nap Here", "Get Pets", "Pull Toilet Paper"…); **tapping that bubble does the same**. **With nothing to interact with, it sniffs** (for Treat Hunt: there's no separate sniff button on touch). |
| **Hold** the paw button (~0.3 s) | The other buttons pop out of it: **Jump**, **Bark** (bark or growl, at random), **Trick**, **Run**. Slide onto one and let go, or let go and tap one (as many as you like). They tuck back in after 2.5 s unused, or at once when you tap the paw or drag to look. |
| RUN (in the paw's buttons) | Run toggle: stays on until you tap it again. While it's on, the stick is coral. |
| II (top-right) | Pause |
| FULLSCREEN (menu and pause, where supported) | Fullscreen, in whichever way you hold the phone |

Only the stick, the paw and pause stay on screen, to keep it clear. There's no walk button (a partly pushed stick
walks slowly anyway) and no sniff button (rarely used on a phone). Details and tested sizes: `docs/MOBILE.md`.

## First play
The first time on each kind of controls, a few seconds of how-to:
- keyboard or controller: a small card with Move, Look, Interact, Run, Jump, Sniff, Bark;
- touch: "Move" under the stick's resting place, "Drag to look" on the right, and "Hold for more" above the paw.

After that, a one-line reminder when play starts.

## Handy URL options
- `?debug`: the debug panel at startup (useful on phones).
- `?input=touch|keyboard|gamepad`: force the controls layout.
- `?quality=low|medium|high`: force a graphics preset.
- `?sw=off`: remove the offline cache (service worker).

**Live feel tuning (dev server only):** in the browser console, change values on `tuning.movement`
(e.g. `tuning.movement.runSpeed = 5`), `tuning.camera` or `tuning.mouse`. Copy good values into `src/config/`.

## Phase 4: new things to do (no new buttons)
- **Get Pets:** walk up to the human when they're free and press E / A / the paw. They reach down and pat him; he
  sits and wags.
- **Eat / Drink:** at his bowls in the family room (by the hearth), when there's something in them: he eats it all
  (about 3.4 s) or laps up the water (about 2.8 s), staying put. Once a bowl is empty, the human comes and refills it.
- **Nap Here:** lie down on the sofas (a hop up), his pink bed in front of the fireplace or the hearth, as well as his bed. Any move key
  (or E) gets him up.
- **Treat Hunt:** do a trick (Q / X / the paw menu's Trick) near the human. Then sniff (R, or E / the paw when there's
  nothing to interact with) and follow the wisps.
- **Make Human Play:** bring the ball or rope toy to the human and keep at it (drop it at their feet, bark, do a trick)
  until they give in.
- **Get their attention:** bark (F / Y / the paw menu's Bark) at them three times.
- **Protect the house:** when the bell rings, run to the pulsing, warm-glowing exterior door left of the window in the original TV room.
  Use **Bark at the Door** (E / A / paw), or Bark (F / Y / paw menu), once: Moke automatically alternates three
  barks and three growls before the human answers. Remote barks don't count. An unanswered bell stops after
  30 seconds; the glow stops with it. Successful deliveries wait a random **10–15 minutes** before recurring; missed visits retry
  after 50–110 seconds. Both use game time, so pausing doesn't shorten the wait.
- **Dinner helper:** wait still beside the human while they chop at the kitchen island, mouth empty, for four
  seconds. Use **Beg for a Carrot** (E / A / paw), or Trick (Q / X / paw menu) once ready. Stay nearby to be fed;
  if you wander off, use **Eat Carrot** on the bite they leave by the island. Both activities repeat naturally.
- **Begging at dinner:** while the human eats at the dining table, stand still beside their chair (not behind it) for a
  moment, then use **Sit & Beg** (E / A / paw), or Trick (Q / X / paw menu). They'll say no, then give in and hand
  you a meatball from their plate.
- **Pillow mischief:** jump onto a pillow-bearing couch with an empty mouth, then use **Dig & Toss Pillows**
  (E / A / paw). Moke digs and throws the pillows; the human puts them back. After cleanup, you can do it again.
- **Table manners:** jump onto a coffee table. The human comes over, says "Moke, get down!" and repeats varied
  reminders every 4–5 seconds, keeping an irritated hands-on-hips pose until you jump or walk off. No additional
  button is needed; normal movement stays available.
