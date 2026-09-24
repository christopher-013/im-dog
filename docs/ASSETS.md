# Assets & Licenses

Policy: only original, CC0, or properly licensed assets. Nothing purchased without explicit approval.
No ripped assets, no copyrighted characters, nothing from the I'M DONUT? brand.

## External assets in use
| Asset | Purpose | Source | License | Placeholder / final | Attribution |
|---|---|---|---|---|---|
| Fredoka (variable, v5.3.0) | UI display font | npm `@fontsource-variable/fredoka` (Fontsource packaging of Google Fonts' Fredoka, © The Fredoka Project Authors) | SIL Open Font License 1.1 | Final candidate | Not required in-game; the license text ships in `node_modules/@fontsource-variable/fredoka/LICENSE`. Keep this entry. |

Libraries (not assets): three.js (MIT), Rapier `@dimforge/rapier3d-compat` (Apache-2.0).
Dev tooling: Vite (MIT), TypeScript (Apache-2.0), Vitest (MIT).

## Original assets (made in this project)
| Asset | Where | Notes |
|---|---|---|
| Logo lettering + Moke-face "O", paw icon | `index.html` (inline SVG) | Original vector art |
| Favicon | `public/favicon.svg` | Simplified Moke face |
| Living room, hallway, furniture, lighting | `src/world/` | Built in code from simple shapes |
| Floorboard, rug, pillow, wall-art and garden textures | `src/world/textures.ts` | Original canvas drawings generated at startup (no image files) |
| Moke (anime-style) | `src/player/ToonMokeVisual.ts`, `src/player/toon/` | Generated in code: procedural fur geometry, original toon/outline shaders, and eye/blush textures drawn on a canvas at startup (no image files). Styled after an anime reference picture the owner supplied in chat on 2026-09-24; nothing from that picture is copied or bundled. |
| Sock, tennis ball, rope toy | `src/props/propVisuals.ts` | Built in code from simple shapes |
| Scent wisps | `src/senses/ScentWisps.ts` | Procedural particles, a small original shader |
| Bark, sniff, pickup and drop sounds | `src/audio/synth.ts` | **Original, synthesized with Web Audio at play time** (oscillators, formant filters and generated noise). No recordings or sample files. Placeholder until the owner picks a final bark (see below). |

## Private references (never distributed)
| Asset | Where | Notes |
|---|---|---|
| Photos of the real Moke | `reference/moke/` | Git-ignored, blocked from bundling and dev serving, checked out of `dist/` on every build |

## Needed later (not sourced yet)
| Need | Milestone | Plan |
|---|---|---|
| Final `moke.glb` (rigged, animated) | Later | Separate modeling/rigging workflow from the reference photos |
| Final bark (owner's choice), footsteps (carpet/wood), room ambience | 10 | Synthesized placeholders exist for bark/sniff/pickup/drop. For finals: CC0 sources (e.g. Freesound CC0 only, Kenney) or recorded; ideally Moke's real bark if you record one |
| Nicer furniture/prop models (optional) | 10 | In-code geometry is in place; optionally CC0 packs (Kenney, Poly Pizza CC0) later |
