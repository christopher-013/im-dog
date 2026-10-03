# Home reference photos (private)

Private reference photos go in this folder. They are **development references only** and never part of the game
(see [`docs/HOME_REFERENCE.md`](../../docs/HOME_REFERENCE.md) for the game's house).

- Git ignores everything here except this README (`reference/home/*` in `.gitignore`).
- Never copy them into `public/`, never import them from `src/`, never use them as textures, and never upload them
  anywhere.
- The Vite config refuses to bundle anything under `reference/`, the dev server refuses to serve it, and
  `npm run build` fails if an identical copy shows up in `dist/` (`scripts/verify-dist.mjs`).
- Don't edit the photos; add new ones alongside.

Folders: `family-room/`, `kitchen/`, `dining-room/`, and `connections/` (shots that show how rooms join up,
including a panorama).
