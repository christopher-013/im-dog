# Playing on phones and tablets

I'M DOG? is one web game for desktop and mobile browsers: the same code, the same build, the same URL. There's
no native app and no separate mobile version. Phase 3 made it playable by touch, including Sock Heist from start
to finish.

> **Testing status:** everything below was built and checked in **browser emulation** (Chromium device emulation
> in the desktop app's browser pane, with synthetic touch events). It has **not yet been tested on a physical phone
> or tablet.** See "Testing performed" and "Not tested".

## Target browsers
| Priority | Browser | Status |
|---|---|---|
| 1 | iPhone Safari (and the home-screen web app) | Built for it; **not tested on a device** |
| 1 | Android Chrome (and the installed web app) | Built for it; **not tested on a device** |
| 2 | iPad Safari, Android tablets | Layout checked in emulation (768×1024, 1024×768) |
| — | Desktop Chrome/Edge | Unchanged, still the primary platform |

Needs WebGL 2. Phones from roughly 2019 onward should be fine; older or low-memory phones start on LOW quality.

## Architecture
One input layer feeds every device into the same gameplay actions. Gameplay code never asks what the device is.
```
keyboard + mouse ─┐
controller ───────┼─► InputState (actions: interact, bark, sniff, run…; move axis; look delta) ─► gameplay
touch ────────────┘
```
- **`core/TouchInput.ts`** (DOM) turns touches into:
  - the move axis (a floating joystick, `core/VirtualJoystick.ts`);
  - a look delta (camera drag);
  - virtual `Touch:*` keys (buttons), bound in `config/input.ts` like any other key.

  Every pointer is tracked by id. Everything is released on lift, cancel, lost capture, blur, pause or rotation.
- **`core/InputMode.ts`** decides which prompts and controls to show: keyboard, touch or controller.
  - It starts from device capabilities (`(pointer: coarse)` and touch points), never the user-agent string.
  - After that it follows the device last used: touch the screen and the touch controls appear; move a real
    mouse or press a key and they go away. So touchscreen laptops aren't forced into touch mode.
  - `?input=touch|keyboard|gamepad` forces a mode for testing.
- **`ui/ControlGlyphs.ts`** is the one place that turns an action into what to show: "E" on a keyboard, "A" on a
  controller, the on-screen button on touch. No gameplay system contains "Press E".
- **Analog sources:** InputState keeps the controller stick and the touch joystick separately and adds them up,
  so neither wipes the other.

## Orientation
- **Portrait and landscape both play well.** The owner found portrait works well on a real phone and may be how
  most people hold it (2026-09-25), so nothing asks you to rotate any more. (Phase 3 had a "Rotate your phone" line
  on the menu and a "Landscape is best" chip; both are gone.)
- In portrait the camera widens its vertical field of view (up to 80°) so enough of the room fits side to side (at
  least 60°); landscape and desktop keep 55°. The controls fit at the bottom either way.
- Rotating mid-game releases any held touches and resizes the canvas; play continues.
- Orientation is never locked: not by FULLSCREEN, and the installed app's manifest says `any`.

## Touch controls
| Control | How | Notes |
|---|---|---|
| Move | Left thumb, anywhere in the left 42% of the screen | A floating stick appears under the thumb; analog: partial push walks slowly, full push trots |
| Run | Push the stick past its ring (it turns coral), or **RUN** from the paw's buttons | Pushing past the ring needs no second finger; RUN is a toggle (on until tapped again), and the stick stays coral while it's on |
| Look | Right thumb: drag anywhere on the right that isn't a button | Mouse-like; the pause screen's Look sensitivity and Invert settings apply |
| Interact | **Tap** the paw button | Lights up coral with its label beside it ("Pick Up Sock", "Give Sock", "Eat Treat", "Lie Down"…). Fires on release, so a hold can't also interact. |
| Jump · Bark · Trick · Run | **Hold** the paw button (`TOUCH.menuHoldTime`, 0.3 s): they pop out of it along an arc | Slide onto one and let go, or let go and tap them. They tuck back in after `TOUCH.menuIdleClose` (2.5 s) unused, at once on a paw tap or a camera drag, and on pause, rotation or focus loss. Moving with the stick keeps them out. 58 px targets (the paw is 86 px). |
| Pause | **II**, top-right | |
| Fullscreen | Menu and pause screens | Only where the browser supports it (not iPhone Safari) and not when already installed |

- **A clear screen:** only the stick, the paw and pause stay visible (owner request, 2026-09-25). The other buttons
  live inside the paw. First play shows "Hold for more" above it, and the start toast says so too.
- Walk has no touch button. A partly pushed stick walks slowly anyway. Bark barks or growls at random (like F and
  controller Y). Jump sits just outside the arc, between Sniff and Trick.
- A button springing out passes under the paw finger; it only counts once the finger has left the paw's circle, so
  letting go right after the pop never presses anything by accident.
- **Why run works this way:** holding a run button while steering and looking needs a third thumb. Pushing past the
  ring works one-handed, and the RUN toggle is there for anyone who'd rather not (decision D15).
- **No browser gestures while playing:**
  - `touch-action: none` on the game surface;
  - blocked `touchmove`, and iOS `gesturestart` (pinch) only during play;
  - `overscroll-behavior: none` (no pull-to-refresh);
  - no text selection or long-press menu.

  Menus and dialogs keep normal zoom for accessibility.
- **First play:** the stick's resting spot is labelled "Move", "Drag to look" shows on the right, and "Hold for more"
  above the paw. After the first time, a one-line reminder.
- **No sniff on touch** (owner, 2026-09-25): it's rarely used on a phone, and the paw menu is shorter without it.
  Keyboard R and the controller's right-stick press still sniff.

## Start, audio, fullscreen, lifecycle
- **PLAY** (a tap) starts the audio. Browsers only allow sound after a gesture. There's no pointer lock on touch.
- **Background music** plays on phones too, and keeps its level through a phone speaker (it lives in the
  midrange: only 1.3 dB quieter through the phone-speaker filter). With the iPhone `playback` audio session, it
  pauses other apps' music while the game is open and playing. The pause screen chooses the song (Hawaiian or
  Japan Stores) or Off, and sets its volume. "Irasshaimase!" was remixed for phone speakers (a softer kick and
  bass, a stronger lead and chords): it loses 4.2 dB through the phone-speaker filter against the Hawaiian song's
  1.1 dB, and its loudness trim splits the difference (within ~1.5 dB on both).
- **Sound on phones** (fixed 2026-09-25, after the owner heard no bark or growl on their phone):
  - **Every tap, click or key wakes the audio** (`AudioManager.wake()`), not just PLAY and RESUME. Phones stop web
    audio by themselves (a call, Siri, the lock screen, switching apps) and only a gesture may restart it. iOS
    Safari calls that state `interrupted`, which the old code never resumed, so the game could stay silent until
    a reload. A sound asked for by the tap that wakes the audio (the Bark button, say) waits for it rather than
    being lost.
  - **The iPhone silent switch:** web audio follows the ringer switch unless the page asks otherwise. The game asks
    for the `playback` audio session (Safari's Audio Session API, feature-detected; `AUDIO.iosSession`), so it's
    heard like a video even on silent. That also pauses other apps' music while it plays. `ambient` would do the
    opposite (respect the switch, mix with music).
  - **Phone speakers** play almost nothing below ~400 Hz. Every sound was rendered offline and measured through a
    phone-speaker filter (two 400 Hz high-passes), at its in-game level:

    | Sound | Full range | Phone speaker, before | Phone speaker, now |
    |---|---|---|---|
    | Bark | −28.6 dB | −26.4 dB | unchanged |
    | Growl | −23.8 dB | **−36.7 dB** (all but gone) | −29.0 dB, with a throaty rasp at 1.15 kHz |
    | Drop | −26.1 dB | **−42 dB** (all but gone) | −32.4 dB, with a soft "tock" |
    | Pickup, surprise, discovery, treat bag | −24 to −31 dB | within ~3 dB of full range | unchanged |
    | Sniff, whoosh, crunch (quiet by design) | −38 to −42 dB | within ~1 dB of full range | unchanged |

    The new layers change the full-range levels by under 0.5 dB (`AUDIO.speakerPresence`).
- **Leaving the game** (phone locked, app switched, tab hidden):
  - it pauses, audio is suspended, and every touch is released;
  - on return it's on the pause screen, and the next tap (RESUME, or anything) brings the sound back;
  - the frame clock restarts, so there's no catch-up jump.
- Fullscreen is offered, never required.

## Home screen / PWA
- `public/manifest.webmanifest`: name and short name "I'M DOG?", `display: fullscreen` (falling back to
  standalone), any orientation, cream theme and background. Icons in `public/icons/` are generated from the favicon art
  by `node scripts/make-icons.mjs`: 192, 512, maskable 512 and a 180 px Apple touch icon.
- iOS meta tags: `apple-mobile-web-app-capable`, title, status-bar style, and the touch icon.
- **Service worker (`dist/sw.js`):**
  - It's generated at build time by the `im-dog:service-worker` plugin in `vite.config.ts` from
    `scripts/sw-template.js`.
  - It precaches every file of the build, so repeat visits are fast and the game plays offline after one visit.
  - The cache name is a hash of the build's files. A new deploy gets a new cache, and old ones are deleted, with no
    manual versioning.
  - Pages are network-first (updates show up when online); built files are cache-first (their names are
    content-hashed).
- **Registered only in production builds, and not on localhost**, so `npm run dev` and `npm run preview` never
  serve stale files.
  - `?sw=on` registers it on localhost for testing.
  - **`?sw=off` unregisters it and deletes its caches**. That's handy on a phone with no DevTools.
  - On a desktop, you can also use DevTools → Application → Service workers → Unregister, and Storage → Clear site
    data.

## Performance and quality
Phones get less GPU, battery and heat headroom, so they start lower. Desktop is unchanged.

| Preset | Pixel ratio | MSAA | Shadow map | Dynamic resolution | Chosen for |
|---|---|---|---|---|---|
| HIGH | up to 2 | on | 2048, softness 3 | off | Desktops (anything without a coarse primary pointer) |
| MEDIUM | up to 1.5 (down to 1) | on | 1024, softness 2 | on | Phones and tablets |
| LOW | up to 1 (down to 0.75) | off | 512, softness 1 | on | Phones with 3 GB or less (where the browser says) or 4 cores or fewer |

- Force one with `?quality=low|medium|high`. The settings are in `src/config/quality.ts`.
- **Dynamic resolution** (MEDIUM and LOW): after about 3 s of frames slower than 22 ms (under ~45 fps), the pixel
  ratio drops a step (0.25). After about 10 s of frames under 17.5 ms it climbs back, within the preset's range.
- **Measured** in emulation at 740×360 with DPR 2 (CPU per stepped frame is noisy, ±0.4 ms):

  | | Buffer | Shadow map | Draw calls | CPU per frame |
  |---|---|---|---|---|
  | Phase 2 | 1480×720 | 2048 | 120 | 2.05–2.48 ms |
  | Phase 3 (MEDIUM) | 1110×540 (44% fewer pixels) | 1024 | 168 | 1.42–1.67 ms |

  The extra draw calls come from the placeholder human (about 30 small meshes plus their shadows). Real-phone GPU
  time and frame rate were **not** measured.
- **Thermal and long sessions:** not tested. Nothing renders while paused-hidden (the browser stops frames).
  Dynamic resolution is the only mechanism that responds to sustained load.

## Mobile debugging
Add `?debug` to the URL (phones have no backquote key). The panel shows:
- Frame: FPS, frame time, draw calls, triangles, quality (and dynamic-resolution cap), pixel ratio, buffer;
- Input: the input mode, viewport size, orientation and DPR, and held actions.

It stays hidden unless asked for.

## Testing on a real phone (local network)
1. Put the computer and the phone on the same Wi-Fi.
2. Run **`npm run dev:lan`** (Vite with `--host`). It prints a `Network:` URL, e.g. `http://192.168.x.y:5173/`.
   Open that on the phone. (Don't hard-code it: it depends on your network.)
3. Only do this on a network you trust: it serves the dev build to your LAN. Plain `npm run dev` stays
   localhost-only. The private-photo guard (`server.fs.deny`) still applies.
4. Over plain http on a LAN, service workers and PWA installation don't work (they need https or localhost). To try
   installing, use the hosted site (https://christopher-013.github.io/im-dog/).
5. To test a production build on the phone: `npm run build`, then `npx vite preview --host`.

## Testing performed (emulation, not real devices)
- **Viewports, automated layout check** (after the final button spacing): 390×844, 412×915, 375×667 (portrait);
  844×390, 915×412, 667×375 (landscape); 768×1024 and 1024×768 (tablet). At each size the controls were on
  screen, 6 px or more apart, nothing scrolled, and the camera's field of view suited the orientation. Sizes 768 px
  and wider used `?input=touch`, because the emulator only fakes touch below 768 px.
- **Viewports, screenshots and play-throughs:** 375×812 and 360×740 (portrait); 667×375 and 740×360 (landscape);
  the landscape pause and menu screens at 667×375; the Controls dialog at 390×844.
- **Touch input** (synthetic touch pointer events):
  - moving and looking at the same time;
  - running by pushing the stick past its ring, and with the RUN toggle;
  - every button;
  - releasing on lift, cancel and lost capture;
  - rotating mid-chase (touches released, play continues);
  - hiding the page mid-chase (pause, input released, audio suspended).
- **Sock Heist completed with touch only** at 740×360: steal, flee, trade, eat, SOCK = TREAT, completion, then
  PLAY AGAIN.
- **Service worker:**
  - registers, activates and precaches all 14 build files on `npm run preview` with `?sw=on`;
  - `?sw=off` removes it;
  - the manifest and icons are served correctly.
- **Quality:** a touch-emulated phone picks MEDIUM with a 1.5 pixel-ratio cap; desktop stays HIGH.

## Not tested
- **Any physical phone or tablet** (iPhone Safari, Android Chrome, iPad), and therefore:
  - how the controls feel under real thumbs;
  - real touch-event quirks;
  - iOS gesture handling;
  - safe areas on notched phones;
  - home-screen installation and the installed app's display mode;
  - real frame rate, GPU load, heat and battery;
  - audio on a real phone: whether the silent-switch and wake fixes work on the owner's phone, and how the
    growl's rasp and the drop's tock sound through a real speaker (only measured through a filter here).
- Fullscreen on a real Android device.
- Offline play from the home screen.
- Firefox for Android.

## Known limitations
- No pinch-to-zoom camera on touch (default distance only).
- iPhone Safari has no fullscreen for web pages; "Add to Home Screen" is the way to hide the browser bars.
- The placeholder human adds about 48 draw calls; merging its parts would cut that if phones need it.
- The service worker only activates on the hosted (https) build, not on a LAN dev server.
