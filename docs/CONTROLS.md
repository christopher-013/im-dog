# Controls

Bindings live in `src/config/input.ts`, the single source of truth for the in-game Controls screen. Every device
feeds the same gameplay actions (see `docs/ARCHITECTURE.md` → Input). Prompts show the right key for what you're
using: "E — Pick Up Sock" on a keyboard, "A — …" on a controller, a lit-up button on touch.

## Desktop: keyboard + mouse

| Input | Action | Status |
|---|---|---|
| W A S D (or arrow keys) | Move (trot), relative to the camera: W = away from the camera | Working |
| Mouse | Look around / orbit the camera around Moke | Working |
| Mouse wheel | Zoom the camera in/out (0.7–2.6 m) | Working |
| Shift (hold) | Run | Working |
| C (hold) | Walk / sneak | Working. Not Ctrl, because Ctrl+W closes the browser tab. |
| E | Interact: pick up · drop · **give** (the sock, for a treat) · **eat** (the treat) · lie down in the bed · get up | Working: the prompt shows what E will do |
| Space | Jump | Working: up onto the couch seat or the coffee table (0.45 m), the highest places he can get to. Never the TV console, the side table or the couch's arms or back. On the couch or table it's only a little hop; walk off the edge to hop down. No jumping under the coffee table. |
| F | Bark or growl, at random | Working. Bark: a little hop, "Arf!" and a synthesized bark; the human can hear it. Growl: Moke plants himself, pins his ears, squints, shows tiny teeth and makes a deep, rumbly "grrrr". |
| Q | Do a trick | Working: a random trick, never the same twice in a row: belly up, beg, give paw, or spin. He stays put for it; moving or E cuts it short. No belly-up with something in his mouth, no begging under the furniture. |
| R | Sniff mode | Working: about 4 s of scent wisps from nearby things (sock, toys, bed, a treat) |
| W A S D or Space while resting | Get up out of the bed | Working |
| Esc | Pause and release the mouse | Working. Esc never resumes (it also closes the Controls dialog); resume with RESUME, Enter/Space on it, or a click. |
| Enter / Space on a menu button | Press that button (PLAY, CONTROLS, RESUME, PLAY AGAIN…) | Working |
| ` (Backquote) | Toggle the debug panel | Working |

**Mouse capture:** clicking PLAY, RESUME or PLAY AGAIN captures the mouse (pointer lock). Esc releases it and
pauses. Chrome needs about a second after Esc before it will capture again; if resume doesn't capture, click the
room. Where pointer lock isn't available, click and drag to look.

**Camera settings:** the pause screen has a Look sensitivity slider (0.25–3×, for the mouse and touch look) and
an invert-vertical-look option. They're remembered in this browser only.

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
| A / bottom face button | Interact (pick up, drop, give, eat, lie down); start from the menu; resume from pause; PLAY AGAIN after Sock Heist |
| B / right face button | Jump |
| X / left face button | Do a trick |
| Y / top face button | Bark or growl, at random |
| Left shoulder or left trigger | Walk / sneak (hold) |
| Right shoulder or right trigger | Run (hold) |
| Right stick press | Sniff (all four face buttons are taken) |
| Menu / Start | Pause or resume; closes the Controls dialog if it's open |
| View / Back | Toggle the debug panel |

Keyboard and mouse remain active while a controller is connected; prompts switch to whichever you last used.

## Touch: phones and tablets
Shown automatically on phones and tablets (when a finger is the primary pointer), or as soon as you touch the
screen. Using a mouse or keyboard again switches back. **Landscape is best**; portrait works.

| Input | Action |
|---|---|
| Left thumb, anywhere on the left of the screen | Move. A stick appears under your thumb: push a little to walk, further to trot. |
| Push the stick past its ring (it turns coral) | Run, one-handed |
| Right thumb, drag anywhere on the right | Look around |
| Tap the paw button | Interact: it lights up and says what it will do ("Pick Up Sock", "Give Sock", "Eat Treat", "Lie Down"…) |
| **Hold** the paw button (~0.3 s) | The other buttons pop out of it: **Jump**, **Bark** (bark or growl, at random), **Sniff**, **Trick**, **Run**. Slide onto one and let go, or let go and tap one (as many as you like). They tuck back in after 2.5 s unused, or at once when you tap the paw or drag to look. |
| RUN (in the paw's buttons) | Run toggle: stays on until you tap it again. While it's on, the stick is coral. |
| II (top-right) | Pause |
| FULLSCREEN (menu and pause, where supported) | Fullscreen; on Android it also asks for landscape |

Only the stick, the paw and pause stay on screen, to keep it clear. There's no walk button; a partly pushed stick
walks slowly anyway. Details and tested sizes: `docs/MOBILE.md`.

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
