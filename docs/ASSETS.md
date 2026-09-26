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
| ~~The human (Sock Heist), placeholder~~ | ~~`src/human/ToonHumanVisual.ts`~~ | Phase 3; **removed in Phase 4**, replaced by the stylized human below. |
| The human (Phase 4) | `src/human/StylizedHumanVisual.ts`, `src/human/humanProps.ts` | Original, built in code: a stylized animated-film-style adult (skinned body merged per material, face bones for eyes, lids, brows and mouth, hands with fingers), a cable-knit sweater texture and a denim twill drawn on canvases at startup; held props (paperback, phone, mug, cutlery, wooden spoon, remote) from simple shapes. No model or image files. Keeps Phase 3's colours and the one striped sock. Not modelled on any real person. |
| The kitchen, family room, dining room and sunroom, their furniture and lighting | `src/world/home/`, `src/world/Home.ts` | Phase 4. Built in code from simple shapes, **drawn from the owner's private home photos** (`reference/home/`, looked at, never copied, bundled or used as textures; D18): the fireplace with its TV, built-ins, sectional, beige couch, rustic coffee table, monsteras in baskets, the white kitchen with its island and stools, the range and hood, the trestle table and chairs, the sideboard and wine fridges, the clock, sliders and curtains, the door sign's words. |
| Grey plank floor, arabesque and subway tiles, clock face, door sign, sun patch | `src/world/textures.ts` | Phase 4. Original canvas drawings generated at startup (no image files). The clock numerals and the sign ("I love you all", from the photos) are drawn with the system's Georgia/serif font. |
| TV glow, steaming pot, dinner plate | `src/world/HouseholdEffects.ts` | Phase 4. Built in code from simple shapes |
| Dog Logic and nap icons (nose, bed, sun, soft, human, ball, toy, kitchen, food, heart, nap, play, warm, quiet) | `index.html` (inline SVG symbols) | Phase 4. Original vector art |
| Treat (bone biscuit), laundry basket with folded clothes, treat jar | `src/heist/Treat.ts`, `src/world/furniture.ts` | Phase 3. Built in code from simple shapes |
| Touch-control, rotate, sock and treat icons | `index.html` (inline SVG symbols) | Phase 3. Original vector art |
| Scent wisps | `src/senses/ScentWisps.ts` | Procedural particles, a small original shader |
| Background music, "Aloha, Moke" | `src/audio/music.ts` | **Original composition, written for this game** (owner's request, 2026-09-25: 8-bit video-game music in a Hawaiian, elevator-muzak style). 24 bars, C major, 90 BPM, swung: a triangle bass, a pulse-wave "ukulele" strum, a square-wave "steel guitar" lead with slides and vibrato, a noise shaker. Synthesized with Web Audio at play time; no recordings, samples or borrowed melodies. |
| Background music, "Irasshaimase!" (Japan Stores) | `src/audio/music.ts` | **Original composition, written for this game** (owner's request, 2026-09-25: 8-bit themes in the style of Japanese convenience-store entrance chimes). 24 bars, F major, 116 BPM: an original "ding-dong… welcome!" door chime, a tune in the Japanese pop pentatonic, an octave-bouncing triangle bass, pulse-wave chord stabs and lead, chiptune bells and a drum machine. **The real stores' jingles were not copied:** FamilyMart's entrance chime (a Panasonic melody) and Don Quijote's theme are other people's compositions, and an 8-bit cover would still copy them. The one borrowed tune is the **Westminster Quarters** (1793, public domain), the chime Japanese schools ring, played on the bells midway. |
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
