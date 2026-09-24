# Controls

Desktop keyboard + mouse. Bindings live in `src/config/input.ts`, the single source of truth for the in-game Controls screen.

| Input | Action | Status |
|---|---|---|
| W A S D (or arrow keys) | Move (trot), relative to the camera: W = away from the camera | Working |
| Mouse | Look around / orbit the camera around Moke | Working |
| Mouse wheel | Zoom the camera in/out (0.7–2.6 m) | Working |
| Shift (hold) | Run | Working |
| C (hold) | Walk / sneak | Working. Not Ctrl, because Ctrl+W closes the browser tab. |
| E | Interact · pick up · drop | Working (Milestones 5–6): the prompt shows what E will do |
| F | Bark | Later milestone |
| Q | Sniff mode | Milestone 8 |
| Space | Jump (optional, undecided) | Not planned yet |
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

Gamepad support is planned for later; the input system is action-based so it can be added without touching gameplay code.
