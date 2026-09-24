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
| Greybox room, furniture, lighting | `src/world/` | Generated in code (temporary) |
| Placeholder Moke | `src/player/PlaceholderDogVisual.ts` | Generated in code from simple shapes (temporary until `moke.glb`) |

## Private references (never distributed)
| Asset | Where | Notes |
|---|---|---|
| Photos of the real Moke | `reference/moke/` | Git-ignored, blocked from bundling and dev serving, checked out of `dist/` on every build |

## Needed later (not sourced yet)
| Need | Milestone | Plan |
|---|---|---|
| Final `moke.glb` (rigged, animated) | Later | Separate modeling/rigging workflow from the reference photos |
| Bark, footsteps (carpet/wood), pickup, drop, room ambience | 10 (bark possibly earlier) | CC0 sources (e.g. Freesound CC0 only, Kenney) or recorded; ideally Moke's real bark if you record one |
| Furniture/prop models | 4 | Start with in-code stylized geometry; optionally CC0 packs (Kenney, Poly Pizza CC0) |
| Fabric/wood textures | 4/10 | Small CC0 textures (ambientCG, Poly Haven) if needed |
