# Decisions

Established project decisions. Change one only with owner approval. When one changes, edit its entry and note
what replaced it and when. Implementation-level rationale (timestep, tone mapping, asset folders, input design)
lives in [`ARCHITECTURE.md`](ARCHITECTURE.md).

| # | Decision | What it means in practice | Since |
|---|---|---|---|
| D1 | **Browser-first game** | Desktop Chrome/Edge first; Firefox/Safari kept reasonable. Deploys as a static site. No backend, database or accounts in Phase 1. | 2026-09-23 |
| D2 | **TypeScript and Three.js** | Strict TypeScript; rendering with three.js (WebGL 2). No Unity, Unreal, Godot, React or React Three Fiber without owner approval. | 2026-09-23 |
| D3 | **Vite for development and build** | `npm run dev` and `npm run build`; Vitest for unit tests. | 2026-09-23 |
| D4 | **Simple DOM-based interface** | HTML/CSS overlays. Markup lives in `index.html`, behaviour in `src/ui/`. No UI framework. | 2026-09-23 |
| D5 | **Stylized animated-film presentation with anime-inspired expression** | Warm, soft and cozy. Not photoreal, not chibi, not crude low-poly. Moke stays clearly dog-like and recognizable as *Moke*. | 2026-09-23 |
| D6 | **Small Phase 1 vertical slice before expanding the world** | One living room with polished movement, camera and interactions before any other rooms or areas. | 2026-09-23 |
| D7 | **Moke's visual model stays separate from controller/gameplay logic** | Swapping the placeholder dog for `moke.glb` must not require changes to movement, camera, physics, interactions, pickup or scent. | 2026-09-23 |
| D8 | **Private Moke photographs are development-only** | `reference/moke/` is git-ignored and never bundled, served, uploaded, modified or deleted. | 2026-09-23 |
| D9 | **Claude Code and Codex work sequentially** | Never simultaneously on overlapping files. Each session starts from Git and `docs/CURRENT_STATE.md`. | 2026-09-23 |
| D10 | **The repository and its documentation are the source of truth** | Not either agent's chat history. Status, decisions and handoff notes live in `docs/`. | 2026-09-23 |
| D11 | **Rapier for physics, starting in Milestone 2** | Owner approved it. In use since Milestone 2 (`@dimforge/rapier3d-compat` 0.20, lazy-loaded). One collision world for Moke now and, later, the toys. | 2026-09-23 |
| D12 | **Moke is built in code and modelled on the real Moke, softly stylized** | `ToonMokeVisual` replaces the old placeholder. First pass (2026-09-24) followed an anime illustration (cel shading, ink outlines, pointed tufts, big brown eyes, blush, "w" smile). The owner then asked for "less jagged, more like the real dog" (same day), which replaced it: curly rounded coat with soft crease shading, soft neutral-grey shading, a thin soft silhouette line, realistic dark eyes, black button nose on a mustached muzzle, no blush or drawn smile. Refines D5, keeps D7 (a `moke.glb` could still replace it via `createMokeVisual()`). | 2026-09-24 |
