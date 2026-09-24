# AGENTS.md — I'M DOG?

Shared, tool-independent instructions for every coding agent working in this repo (OpenAI Codex, Claude Code, others).
**The repository and its docs are the source of truth, not any agent's chat history.**

## Project
- **I'M DOG?** (keep the exact capitalization, apostrophe and question mark): a browser-based, stylized 3D
  third-person game about **Moke**, a real white Maltipoo. Cozy, funny, family friendly. No combat, no death.
- **Current phase:** Phase 1, the first playable prototype (one living room). Scope: `docs/PHASE_1.md`.
- **Completed:**
  - Milestone 1, project foundation and architecture.
  - Milestone 2, the basic Moke character.
  - Milestone 3, the third-person camera.
  - Milestone 4, the living room (plus a short hallway).
  - Milestones 5–9 (interactions, sock, physics toys, sniff + bark, rest), built overnight on
    `claude/milestones-5-9-qagq4b` as a draft PR, not yet merged.
  - Milestones 2–9 still await the owner's hands-on playtest.
- **Next:** the owner's review of Milestones 5–9, then Milestone 10 (polish). Only start it when the owner says to.
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

## Development rules
- Respect the current milestone. Don't expand scope without owner approval.
- Prefer simple, maintainable solutions. Avoid unnecessary dependencies.
- Don't silently change architectural decisions. Check `docs/DECISIONS.md`, propose any change, and record it once the owner approves.
- Keep Moke's visual model separate from controller and gameplay logic. Gameplay, camera, interactions and
  physics must never depend on the mesh, so a future `moke.glb` can replace the placeholder without rewrites.
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
  - `docs/MOKE_CHARACTER_REFERENCE.md`: character work.
  - `docs/ASSETS.md`: licence log. Record every external asset here. Original, CC0 or properly licensed only; never purchase anything.
- The title's visual identity is original. Never copy I'M DONUT? branding.

## Private Moke references
`reference/moke/` contains **private development photographs** of the real Moke. They're git-ignored (only the
folder's README is tracked), so a fresh clone won't include them. Never:
- move or copy them into `public/`, or import them from code;
- include them in production builds;
- upload or transmit them externally;
- modify or delete the originals;
- commit them unless the owner explicitly approves it.

Guards are already in place: `.gitignore`, a Vite plugin that fails the build on any import from `reference/`,
the dev server's `fs.deny`, and `scripts/verify-dist.mjs` after every build. Don't weaken them.

## Verification
These are the only scripts that exist (`package.json`):

| Purpose | Command |
|---|---|
| Development server | `npm run dev` (http://localhost:5173) |
| Type checking | `npm run typecheck` (strict `tsc` for the app and `vite.config.ts`) |
| Tests | `npm test` (Vitest, `src/**/*.test.ts`; `npm run test:watch` for watch mode) |
| Production build | `npm run build` (type check + `vite build` + private-photo leak check) |
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
