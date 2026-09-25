# Assets & Licenses

Policy: only original, CC0, or properly licensed assets. Nothing purchased without explicit approval.
No ripped assets, no copyrighted characters, nothing from the I'M DONUT? brand.

## External assets in use
| Asset | Purpose | Source | License | Placeholder / final | Attribution |
|---|---|---|---|---|---|
| Fredoka (variable, v5.3.0) | UI display font | npm `@fontsource-variable/fredoka` (Fontsource packaging of Google Fonts' Fredoka, © The Fredoka Project Authors) | SIL Open Font License 1.1 | Final candidate | Not required in-game; the license text ships in production as `THIRD_PARTY_NOTICES.txt`. Keep this entry. |

Libraries (not assets): three.js (MIT), Rapier `@dimforge/rapier3d-compat` (Apache-2.0). Their license texts also ship in production as `THIRD_PARTY_NOTICES.txt`.
Dev tooling: Vite (MIT), TypeScript (Apache-2.0), Vitest (MIT).

## Original assets (made in this project)
| Asset | Where | Notes |
|---|---|---|
| Logo lettering + Moke-face "O", paw icon | `index.html` (inline SVG) | Original vector art |
| Favicon | `public/favicon.svg` | Simplified Moke face |
| Home-screen icons (192, 512, maskable 512, Apple 180) | `public/icons/` | Phase 3. Generated from the favicon's circles by `node scripts/make-icons.mjs` (rasterized in code, no image editor or third-party art) |
| Web app manifest | `public/manifest.webmanifest` | Phase 3. Name, colours, icons for installing to the home screen |
| Living room, hallway, furniture, lighting | `src/world/` | Built in code from simple shapes |
| Floorboard, rug, pillow, wall-art and garden textures | `src/world/textures.ts` | Original canvas drawings generated at startup (no image files) |
| Moke (incl. collar and tag), **stand-in** | `src/player/ToonMokeVisual.ts`, `src/player/toon/` | Generated in code: procedural curly fur geometry, original toon/outline shaders, an eye texture and the tag's "Moke" lettering (Fredoka font, OFL) drawn on a canvas at startup (no image files). Modelled on the private photos of the real Moke (looked at, never copied or bundled); an earlier pass followed an anime illustration the owner shared in chat. **Since Phase 2 it's the stand-in and permanent fallback** until the final `moke.glb` exists (see below). All its animation is procedural code, with no clips. |
| Synthetic test model | `src/player/gltf/testing/syntheticMoke.ts` | Test-only: a tiny box "dog" with bones, sockets and dummy clips built in code to the spec. Never shipped (only imported by tests). |
| Sock, tennis ball, rope toy | `src/props/propVisuals.ts` | Built in code from simple shapes |
| The human (Sock Heist), **placeholder** | `src/human/ToonHumanVisual.ts` | Phase 3. A stylized person built in code from simple rounded shapes in the game's palette (coral sweater, jeans, one charcoal-striped sock matching the stolen one). Original; no model files. A placeholder until final human character art exists. |
| Treat (bone biscuit), laundry basket with folded clothes, treat jar | `src/heist/Treat.ts`, `src/world/furniture.ts` | Phase 3. Built in code from simple shapes |
| Touch-control, rotate, sock and treat icons | `index.html` (inline SVG symbols) | Phase 3. Original vector art |
| Scent wisps | `src/senses/ScentWisps.ts` | Procedural particles, a small original shader |
| Bark, growl, sniff, pickup and drop sounds; Sock Heist sounds (surprise whistle, grab whoosh, treat-bag rustle, crunch, discovery chime) | `src/audio/synth.ts` | **Original, synthesized with Web Audio at play time** (oscillators, formant filters and generated noise). No recordings or sample files. Placeholder until the owner picks a final bark (see below). |

## Temporary assets that must be replaced before release
| Temporary asset | Replaced by | Status |
|---|---|---|
| `ToonMokeVisual` (procedural stand-in Moke) | The final rigged, animated `moke.glb` (`docs/MOKE_3D_SPEC.md`) | **Carried forward from Phase 2.** Not made yet. The stand-in stays in code as the fallback only. |
| Synthesized bark, growl, sniff, pickup and drop sounds, and the Sock Heist sounds | The owner's chosen final sounds (ideally Moke's real bark) | Placeholders (original, so no licence problem), pending the owner's choice |
| The code-built placeholder human (`ToonHumanVisual`) | Final human character art, if the owner wants it (the visual is kept apart from behaviour, like Moke's) | Placeholder; not blocking. Sock Heist works with it |

Everything else in the tables above is original and can ship as is. It could still be improved (for example
nicer furniture models), but nothing else has to be replaced.

## Private references (never distributed)
| Asset | Where | Notes |
|---|---|---|
| Photos of the real Moke | `reference/moke/` | Git-ignored, blocked from bundling and dev serving, checked out of `dist/` on every build |

## Needed later (not sourced yet)
| Need | Milestone | Plan |
|---|---|---|
| **Final `moke.glb` (rigged, animated)** | **Carried forward from Phase 2** | **Not made yet.** The main missing piece of the character. Build it to `docs/MOKE_3D_SPEC.md` (mesh, PBR textures, skeleton, `blink` morph, sockets, and all clips from `idle` to `trick_spin` in one file) and install it per `docs/MOKE_INTEGRATION.md` at `public/assets/models/moke/moke.glb`. It must be original work made for this project (by the owner or someone they commission) or properly licensed for it. **No marketplace dog models or animation packs retargeted onto him without owner approval**, and never a purchase without approval. Record here: author, licence, date, and where the source files live (outside `public/`). The photos go to the modeller only via the owner (D8). |
| Animation clips for `moke.glb` | Phase 2 | Made with the model (same file). There's no animation source yet; motion capture or stock clips need the licence rules above. |
| Final bark (owner's choice), footsteps (carpet/wood), room ambience | 10 | Synthesized placeholders exist for bark/sniff/pickup/drop. For finals: CC0 sources (e.g. Freesound CC0 only, Kenney) or recorded; ideally Moke's real bark if you record one |
| Nicer furniture/prop models (optional) | 10 | In-code geometry is in place; optionally CC0 packs (Kenney, Poly Pizza CC0) later |
