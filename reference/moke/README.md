# Moke reference photos (private)

Photos of the real Moke go in this folder. They are **development references only**.

- Git ignores everything here except this README (`reference/moke/*` in `.gitignore`).
- Never copy them into `public/`, never import them from `src/`, and never upload them anywhere.
- The Vite config refuses to bundle anything under `reference/`, the dev server refuses to serve it,
  and `npm run build` fails if an identical copy shows up in `dist/` (`scripts/verify-dist.mjs`).

Current set: `moke-01.webp` … `moke-09.webp`. The analysis is in
[`docs/MOKE_CHARACTER_REFERENCE.md`](../../docs/MOKE_CHARACTER_REFERENCE.md), which also lists the extra angles we need.
