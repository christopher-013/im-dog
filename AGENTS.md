# AGENTS.md — I'M DOG?

Shared, tool-independent instructions for every coding agent working in this repo (OpenAI Codex, Claude Code, others).
**The repository and its docs are the source of truth, not any agent's chat history.**

## Project
- **I'M DOG?** (keep the exact capitalization, apostrophe and question mark): a browser-based, stylized 3D
  third-person game about **Moke**, a real white Maltipoo. Cozy, funny, family friendly. No combat, no death.
- **Phase 1 is complete:** the first playable technical prototype (one living room), Milestones 1–10, closed by the
  owner on 2026-09-24 and tagged `phase-1-complete`. Scope and history: `docs/PHASE_1.md`.
- **Phase 2 is complete:** "Make Moke actually Moke", the Moke character foundation, closed by the owner on
  2026-09-24 and tagged `phase-2-complete`. Scope and history: `docs/PHASE_2.md`. It delivered the `moke.glb` path,
  animation blending, personality and attention, carrying, one authoritative scale (`MOKE_CHARACTER`) and the
  fallback.
- **Carried forward, not done: the final `moke.glb`.** A rigged, animated model built to `docs/MOKE_3D_SPEC.md` and
  installed per `docs/MOKE_INTEGRATION.md`. The game still shows the procedural `ToonMokeVisual` stand-in; don't
  call it the finished Moke.
- **Phase 3 is complete:** "Sock Heist + Mobile Web Play", closed by the owner on 2026-09-25 and tagged
  `phase-3-complete`. Scope and history: `docs/PHASE_3.md`. It delivered Sock Heist (one placeholder human, the
  treat trade, SOCK = TREAT), touch/mobile web play (the paw menu), jumping, phone audio fixes and background music.
  Real-device coverage is the owner's own phone playtest (device and browser not recorded): don't claim broader
  mobile testing. Details: `docs/SOCK_HEIST.md`, `docs/MOBILE.md`.
- **Phase 4 is built but not closed (and not committed):** "Moke's Home & Family Life" (`docs/PHASE_4.md`), from the
  owner's brief of 2026-09-25 with photos of the real home. The whole home (living room, kitchen, family room, dining
  room), a stylized human with a daily routine, Moke ↔ human interaction, Treat Hunt, Perfect Nap, Make Human Play and
  Dog Logic. Tested in automation and the browser (desktop, emulated phone) only: **not yet played by the owner or
  on a physical phone.** Details: `docs/HOME_REFERENCE.md`, `docs/HUMAN_SYSTEM.md`, `docs/ACTIVITIES.md`,
  `docs/DOG_LOGIC.md`.
- **Next:** the owner's review of Phase 4, then closing it. Don't start Phase 5, more humans, more rooms, the outdoors
  or another mini-game without the owner's approval. Also carried over: `docs/PHASE_4.md` → "Carried forward", and the
  Known Issues in `docs/CURRENT_STATE.md`.
- **Current handoff:** `docs/CURRENT_STATE.md`.
- **Philosophy.** When in doubt, ask "does this make it more fun to be Moke?"
  - FUN > FEATURES
  - RESPONSIVENESS > COMPLEXITY
  - PERSONALITY > TECHNOLOGY
  - SMALL AND POLISHED > LARGE AND UNFINISHED
  - PLAYABLE > PERFECT

## Technology (what exists today)
- TypeScript (strict), three.js (WebGL 2), Vite, and HTML/CSS/DOM overlays for all UI. No UI framework.
- Rapier (`@dimforge/rapier3d-compat`) for physics and collision, lazy-loaded.
- Vitest for unit tests. Runtime dependencies are only `three`, Rapier and the self-hosted Fredoka font. Node 22.12+.
- No backend, database or accounts. The build is a static site with relative paths.
- Do not migrate to React, React Three Fiber, Unity, Unreal, Godot or any other framework or engine without explicit owner approval.

## Shared workflow
- Claude Code and Codex work **sequentially**, never at the same time on overlapping files.
- Another agent may have changed the repo since you last saw it. Start with `git status`, the recent `git log`,
  and `docs/CURRENT_STATE.md`. Don't rely on memory of a previous session.
- The repository is **public**, and every push to `main` publishes the game to https://christopher-013.github.io/im-dog/ (GitHub Actions).
  Only push to `main` when the owner asks, and never commit anything private (the Moke photos stay git-ignored).

## Development rules
- Respect the current milestone. Don't expand scope without owner approval.
- Prefer simple, maintainable solutions. Avoid unnecessary dependencies.
- Don't silently change architectural decisions. Check `docs/DECISIONS.md`, propose any change, and record it once the owner approves.
- Keep Moke's visual model separate from controller and gameplay logic. Gameplay, camera, interactions and
  physics must never depend on the mesh, so `moke.glb` can replace the toon visual without rewrites. Carrying
  uses only `visual.attachments.mouth`. Moke's size lives only in `MOKE_CHARACTER.size` (D14). The same goes for the
  Sock Heist human: `HumanBrain` and `HumanController` never touch `ToonHumanVisual` (D16).
- Every input device (keyboard/mouse, controller, touch) feeds the same `InputState` actions; gameplay never
  branches on the device (D15). Don't detect phones by user-agent.
- Gameplay reads input *actions* from `src/config/input.ts`, never raw keys. Tunable numbers belong in `src/config/`.
- Never claim something was tested unless it actually was. Say what wasn't verified.
- Fix failures caused by the requested work before declaring completion.
- Preserve existing user changes: inspect `git status` and the diff before editing overlapping files, and never
  discard someone else's work. Don't commit or push unless the owner asks.
- Use the repository docs relevant to the task. You don't need to read every document for a minor edit.
  - `docs/ARCHITECTURE.md`: system boundaries.
  - `docs/DECISIONS.md`: established decisions.
  - `docs/PHASE_1.md`: milestone scope.
  - `docs/PHASE_1_SPEC.md`: detailed requirements for Milestones 5–10.
  - `docs/PHASE_2.md`: Phase 2 scope and status.
  - `docs/PHASE_3.md`: Phase 3 scope, history and what's carried forward; `docs/SOCK_HEIST.md` (the mini-game, the human) and
    `docs/MOBILE.md` (touch, quality, PWA, phone testing).
  - `docs/PHASE_4.md`: Phase 4 scope and status; `docs/HOME_REFERENCE.md` (the real home → the game's house),
    `docs/HUMAN_SYSTEM.md` (the human's layers), `docs/ACTIVITIES.md` (daily life and dog activities),
    `docs/DOG_LOGIC.md`.
  - `docs/MOKE_CHARACTER_REFERENCE.md`: character work.
  - `docs/MOKE_3D_SPEC.md` and `docs/MOKE_INTEGRATION.md`: the final `moke.glb` and how it plugs in.
  - `docs/ASSETS.md`: licence log. Record every external asset here. Original, CC0 or properly licensed only; never purchase anything.
- The title's visual identity is original. Never copy I'M DONUT? branding.

## Private references (Moke and the home)
`reference/moke/` contains **private development photographs** of the real Moke, and (since Phase 4)
`reference/home/` photographs of the real home (D18). They're git-ignored (only each folder's README is tracked), so a
fresh clone won't include them. Never:
- move or copy them into `public/`, or import them from code;
- include them in production builds;
- upload or transmit them externally;
- modify or delete the originals;
- use them as textures (the rooms are modelled and textured in code);
- commit them unless the owner explicitly approves it.

Guards are already in place: `.gitignore`, a Vite plugin that fails the build on any import from `reference/`,
the dev server's `fs.deny`, and `scripts/verify-dist.mjs` after every build. Don't weaken them.

## Verification
These are the only scripts that exist (`package.json`):

| Purpose | Command |
|---|---|
| Development server | `npm run dev` (http://localhost:5173) |
| Development server on the local network (phone testing, opt-in) | `npm run dev:lan` (Vite `--host`; trusted Wi-Fi only, see `docs/MOBILE.md`) |
| Type checking | `npm run typecheck` (strict `tsc` for the app and `vite.config.ts`) |
| Tests | `npm test` (Vitest, `src/**/*.test.ts`; `npm run test:watch` for watch mode) |
| Production build | `npm run build` (type check + `vite build` with the generated service worker + private-photo leak check) |
| Serve the build | `npm run preview` (http://localhost:4173) |

No linter or formatter is configured. For visual or interactive changes, also run the game in a browser and check the console.

## Handoff
After significant implementation work:
1. Run the relevant validation commands.
2. Update `docs/CURRENT_STATE.md`.
3. Update `docs/DECISIONS.md` only when a meaningful decision changes.
4. Report the files you changed.
5. Report the verification you actually performed.
6. Leave the repository coherent for the next developer.
