# Controls

Desktop keyboard + mouse. Bindings live in `src/config/input.ts`, the single source of truth for the in-game Controls screen.

| Input | Action | Status |
|---|---|---|
| W A S D (or arrow keys) | Move (trot), relative to the camera: W = away from the camera | Working |
| Mouse | Look around / orbit the camera around Moke | Working |
| Mouse wheel | Zoom the camera in/out (0.7–2.6 m) | Working |
| Shift (hold) | Run | Working |
| C (hold) | Walk / sneak | Working. Not Ctrl, because Ctrl+W closes the browser tab. |
| E | Interact: pick up · drop · lie down in the bed · get up | Working: the prompt shows what E will do |
| F | Bark | Working: a little hop, "Arf!" and a synthesized bark (placeholder sound) |
| G | Cute growl | Working: Moke plants himself, pins his ears, squints, shows tiny teeth and makes a deep, rumbly synthesized "grrrr" |
| Q | Sniff mode | Working: about 4 s of scent wisps from nearby things (sock, toys, bed) |
| Space | Jump (optional, undecided) | Not planned yet |
| W A S D while resting | Get up out of the bed | Working |
| Esc | Pause and release the mouse | Working |
| ` (Backquote) | Toggle debug panel | Working |

**Mouse capture:** clicking PLAY or RESUME captures the mouse (pointer lock). Esc releases it and pauses.
Chrome needs about a second after Esc before it will capture again; if resume doesn't capture, click the room.
Where pointer lock isn't available, click and drag to look.

**Camera settings:** the pause screen has a mouse-sensitivity slider (0.25–3×) and an invert-vertical-look option.
They're remembered in this browser only.

**How WASD relates to the camera:** W moves away from the camera. While you keep a movement key held, the
direction stays put even if the camera swings by itself (behind Moke, or away from a wall). Only your own mouse
turns change it. Let go and press again to re-aim from the current view.

**Debug at startup:** add `?debug` to the URL.

**Live feel tuning (dev server only):** in the browser console, change values on `tuning.movement`
(e.g. `tuning.movement.runSpeed = 5`), `tuning.camera` (e.g. `tuning.camera.defaultDistance = 1.8`) or
`tuning.mouse`. The changes apply immediately. Copy good values into `src/config/movement.ts`, `camera.ts` or
`input.ts` to keep them.

## Gamepad

Standard-layout USB and Bluetooth controllers are detected automatically through the browser Gamepad API. Browsers may hide a newly connected controller until one of its buttons is pressed.

| Input | Action |
|---|---|
| Left stick or D-pad | Move (analog stick preserves speed and direction) |
| Right stick | Look around / orbit camera |
| A / bottom face button | Interact; start from the menu; resume from pause |
| B / right face button | Bark |
| X / left face button | Sniff |
| Y / top face button | Cute growl |
| Left shoulder or left trigger | Walk / sneak (hold) |
| Right shoulder or right trigger | Run (hold) |
| Menu / Start | Pause or resume |
| View / Back | Toggle debug panel |

Keyboard and mouse remain active while a controller is connected. Controller names and whether the browser reports a standard mapping are shown in the debug panel.
