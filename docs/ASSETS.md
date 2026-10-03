# Assets & Licenses

Policy: only original, CC0, or properly licensed assets. Nothing purchased without explicit approval.
No ripped assets, no copyrighted characters, nothing from the I'M DONUT? brand.

## External assets in use
| Asset | Purpose | Source | License | Placeholder / final | Attribution |
|---|---|---|---|---|---|
| Fredoka (variable, v5.3.0) | UI display font | npm `@fontsource-variable/fredoka` (Fontsource packaging of Google Fonts' Fredoka, © The Fredoka Project Authors) | SIL Open Font License 1.1 | Final candidate | Not required in-game; the license text ships in production as `THIRD_PARTY_NOTICES.txt`. Keep this entry. |

Libraries (not assets): three.js (MIT), Rapier `@dimforge/rapier3d-compat` (Apache-2.0). Their license texts also ship in production as `THIRD_PARTY_NOTICES.txt`.
Dev tooling: Vite (MIT), TypeScript (Apache-2.0), Vitest (MIT).

## Owner-approved public photo
| Asset | Purpose | Source and permission | Notes |
|---|---|---|---|
| `public/moke-about.png` | Real Moke portrait in the About dialog | The owner supplied this exact photo in chat and explicitly approved its public use on 2026-09-27 | 1031×1374 PNG; checked to contain only image-data PNG chunks, with no embedded location or camera metadata. This exception applies only to this photo, not to the private reference folders. |

## Original assets (made in this project)
| Asset | Where | Notes |
|---|---|---|
| Logo lettering + Moke-face "O", paw icon | `index.html` (inline SVG) | Original vector art |
| Favicon | `public/favicon.svg` | Simplified Moke face |
| Home-screen icons (192, 512, maskable 512, Apple 180) | `public/icons/` | Phase 3. Generated from the favicon's circles by `node scripts/make-icons.mjs` (rasterized in code, no image editor or third-party art) |
| Search-result favicons (`favicon.ico` 16/32/48, `favicon-96/192.png`) | `public/favicon.ico`, `public/icons/` | 2026-09-29, for the icon beside search results. Same script and art as the favicon, transparent background |
| Web app manifest | `public/manifest.webmanifest` | Phase 3. Name, colours, icons for installing to the home screen |
| Living room, hallway, furniture, lighting | `src/world/` | Built in code from simple shapes |
| Floorboard, rug, pillow, wall-art and garden textures | `src/world/textures.ts` | Original canvas drawings generated at startup (no image files) |
| Moke (incl. collar and tag), **stand-in** | `src/player/ToonMokeVisual.ts`, `src/player/toon/` | Generated in code: procedural curly fur geometry, original toon/outline shaders, an eye texture and the tag's "Moke" lettering (Fredoka font, OFL) drawn on a canvas at startup (no image files). Modelled on the private photos of the real Moke (looked at, never copied or bundled); an earlier pass followed an anime illustration the owner shared in chat. **Since Phase 2 it's the stand-in and permanent fallback** until the final `moke.glb` exists (see below). All its animation is procedural code, with no clips. |
| Synthetic test model | `src/player/gltf/testing/syntheticMoke.ts` | Test-only: a tiny box "dog" with bones, sockets and dummy clips built in code to the spec. Never shipped (only imported by tests). |
| Sock, tennis ball, rope toy | `src/props/propVisuals.ts` | Built in code from simple shapes |
| ~~The human (Sock Heist), placeholder~~ | ~~`src/human/ToonHumanVisual.ts`~~ | Phase 3; **removed in Phase 4**, replaced by the stylized human below. |
| The human (Phase 4) | `src/human/StylizedHumanVisual.ts`, `src/human/humanProps.ts` | Original, built in code: a stylized animated-film-style adult man (skinned body merged per material, lofted garments and sculpted hair, face bones for eyes, lids, brows and mouth, hands with fingers), an untucked sage long-sleeve button-down, blue jeans (colour and fades in the vertex colours; no textures), and one striped sock; held props (paperback, phone, mug, cutlery, wooden spoon, remote, a piece of laundry) from simple shapes. No model or image files. Not modelled on any real person. |
| The kitchen, family room, dining room and sunroom, their furniture and lighting | `src/world/home/`, `src/world/Home.ts` | Phase 4. **Original**, built in code from simple shapes, with no photographic textures and nothing from `reference/` copied or bundled (D18): the fireplace with its TV, built-ins, sectional, beige couch, rustic coffee table, monsteras in baskets, the white kitchen with its island and stools, the range and hood, the trestle table and chairs, the sideboard and wine fridges, the clock, sliders and curtains, the door sign's words. |
| Grey plank floor, arabesque and subway tiles, clock face, door sign, sun patch | `src/world/textures.ts` | Phase 4. Original canvas drawings generated at startup (no image files). The clock numerals and the sign ("I love you all") are drawn with the system's Georgia/serif font. |
| Steaming pot, dinner plate | `src/world/HouseholdEffects.ts` | Phase 4. Built in code from simple shapes (the TV glow that was here was replaced by the cartoon below, 2026-09-28) |
| GEARBOTS, a cartoon on the TVs (title card, gear emblem, two robots that transform from a pickup truck and a jet, their backgrounds) | `src/world/tv/Gearbots.ts` | 2026-09-28, owner request for a robot cartoon in the style of the 1980s transforming-robot shows. **Original**, drawn in code on a canvas each frame (no image, video or font files; the lettering uses system fonts). Deliberately no names, logos, emblems, taglines, character designs or colour schemes from any existing show or toy line. |
| Home gym (bike, dumbbell rack, mats, glass doors), the bird cage, the backyard | `src/world/home/gymAndYard.ts` | 2026-09-28. **Original**, built in code from simple shapes; no photographic textures. No brand names or logos. |
| The squeaky fish toy (a rubber taiyaki) | `src/props/propVisuals.ts` (`squeakyFish`) | 2026-09-28. Built in code (an extruded fish outline with raised scales, eye, gill and fin ridges), modelled on the owner's photo of Moke's real toy; no brand marks copied. |
| Malibu, the green-cheeked conure | `src/world/Conure.ts`, the `icon-bird` symbol in `index.html` | 2026-09-28. Built in code from simple shapes and animated procedurally; modelled on the owner's photo of their bird. |
| Flagstone patio and backyard sky/tree-line textures | `src/world/textures.ts` | 2026-09-28. Original canvas drawings generated at startup (no image files) |
| HIGHWAY HERO, a show on the TVs (a black sports car with a red scanner light, its partner, a getaway van, two cartoon crooks, night highways) | `src/world/tv/HighwayHero.ts` | 2026-09-29, owner request for a show like the 1980s talking-car series. **Original**, drawn in code (system fonts for the lettering). No names, logos, car designs or catchphrases from any real show; the crooks are caught without a fight. |
| CHEF SHOWDOWN, a show on the TVs (a spotlit arena, a tuna, chopping, sushi, judges, a winning chef) | `src/world/tv/ChefShowdown.ts` | 2026-09-29, owner request for a cooking contest like the dramatic TV cooking battles. **Original**, drawn in code. No names, hosts, catchphrases or sets from any real show. |
| The WORLD SERIES special broadcast on the TVs (bulletin, ballpark, pitch, swing, home run, bases, celebration, trophy) | `src/world/tv/WorldSeries.ts` | 2026-09-29, owner request (the easter egg). **Drawn in code** (system fonts for the lettering; no image, video or font files). **Real team names and colours, at the owner's request:** the San Diego Padres (brown `#3b2a20` and gold `#ffc425`) and the Los Angeles Dodgers (blue `#005a9c` and grey), written as plain text on the scoreboard and captions. **Nothing else of theirs:** no logos, emblems, wordmarks, cap insignia or uniform lettering, no real players or numbers, no real ballpark, no league or broadcaster graphics; the trophy is a generic gold cup. Note: the team names are the clubs' trademarks, used here only as names in a fan-made, non-commercial easter egg; if the game ever goes beyond a free preview, revisit (fictional names are a one-line change in `WorldSeries.ts`). |
| The link-preview image (`og-image.jpg`, 1200×630) | `public/og-image.jpg` | 2026-09-29, for search results and link previews. **Original**: rendered from the game (the procedural cartoon Moke in the living room, a TV showing HIGHWAY HERO) with the title in the game's own Fredoka lettering. Not the real-Moke photo. |
| Dog Logic and nap icons (nose, bed, sun, soft, human, ball, toy, kitchen, food, heart, nap, play, warm, quiet) | `index.html` (inline SVG symbols) | Phase 4. Original vector art |
| Treat (bone biscuit), laundry table with a woven basket of washing and a stack of folded clothes (2026-09-28), treat jar | `src/heist/Treat.ts`, `src/world/furniture.ts` | Phase 3. Built in code from simple shapes |
| Touch-control, rotate, sock and treat icons | `index.html` (inline SVG symbols) | Phase 3. Original vector art |
| Scent wisps | `src/senses/ScentWisps.ts` | Procedural particles, a small original shader |
| Background music, "Aloha, Moke" | `src/audio/music.ts` | **Original composition, written for this game** (owner's request, 2026-09-25: 8-bit video-game music in a Hawaiian, elevator-muzak style). 24 bars, C major, 90 BPM, swung: a triangle bass, a pulse-wave "ukulele" strum, a square-wave "steel guitar" lead with slides and vibrato, a noise shaker. Synthesized with Web Audio at play time; no recordings, samples or borrowed melodies. |
| Background music, "Irasshaimase!" (Japan Stores) | `src/audio/music.ts` | **Original composition, written for this game** (owner's request, 2026-09-25: 8-bit themes in the style of Japanese convenience-store entrance chimes). 24 bars, F major, 116 BPM: an original "ding-dong… welcome!" door chime, a tune in the Japanese pop pentatonic, an octave-bouncing triangle bass, pulse-wave chord stabs and lead, chiptune bells and a drum machine. **The real stores' jingles were not copied:** FamilyMart's entrance chime (a Panasonic melody) and Don Quijote's theme are other people's compositions, and an 8-bit cover would still copy them. The one borrowed tune is the **Westminster Quarters** (1793, public domain), the chime Japanese schools ring, played on the bells midway. |
| Bark, growl, sniff, pickup and drop sounds; Sock Heist sounds (surprise whistle, grab whoosh, treat-bag rustle, crunch, discovery chime); lapping at the water bowl and pouring (the human refilling it); Malibu's chirp; the squeaky fish's squeak | `src/audio/synth.ts` | **Original, synthesized with Web Audio at play time** (oscillators, formant filters and generated noise). No recordings or sample files. Placeholder until the owner picks a final bark (see below). |

## Temporary assets that must be replaced before release

Owner-requested household additions (2026-09-27): the front door, doorstep, parcel (plain canvas "amazon"
lettering, not a downloaded logo), blue-uniform variant of the original stylized human, chopping board, carrots
and reward bite are original code-built assets (`world/FrontDoor.ts`, `world/HouseholdEffects.ts`, `heist/Treat.ts`).
The louder repeating two-tone DING-DONG chime is synthesized in `audio/synth.ts`. No external files, recordings or private references
were added or transmitted. The visitor reuses the existing rig and animation contract.

| Temporary asset | Replaced by | Status |
|---|---|---|
| `ToonMokeVisual` (procedural stand-in Moke) | The final rigged, animated `moke.glb` (`docs/MOKE_3D_SPEC.md`) | **Carried forward from Phase 2.** Not made yet. The stand-in stays in code as the fallback only. |
| Synthesized bark, growl, sniff, pickup and drop sounds, and the Sock Heist sounds | The owner's chosen final sounds (ideally Moke's real bark) | Placeholders (original, so no licence problem), pending the owner's choice |

Everything else in the tables above is original or owner-approved and can ship as is. It could still be improved (for example
nicer furniture models), but nothing else has to be replaced.

## Private references (never distributed)
| Asset | Where | Notes |
|---|---|---|
| Other photos of the real Moke | `reference/moke/` | Git-ignored, blocked from bundling and dev serving, checked out of `dist/` on every build; the separately supplied `public/moke-about.png` is the sole approved exception |
| Other private reference photos | `reference/home/` | Git-ignored, blocked from bundling and dev serving, checked out of `dist/` on every build |

## Needed later (not sourced yet)
| Need | Milestone | Plan |
|---|---|---|
| **Final `moke.glb` (rigged, animated)** | **Carried forward from Phase 2** | **Not made yet.** The main missing piece of the character. Build it to `docs/MOKE_3D_SPEC.md` (mesh, PBR textures, skeleton, `blink` morph, sockets, and all clips from `idle` to `trick_spin` in one file) and install it per `docs/MOKE_INTEGRATION.md` at `public/assets/models/moke/moke.glb`. It must be original work made for this project (by the owner or someone they commission) or properly licensed for it. **No marketplace dog models or animation packs retargeted onto him without owner approval**, and never a purchase without approval. Record here: author, licence, date, and where the source files live (outside `public/`). The photos go to the modeller only via the owner (D8). |
| Animation clips for `moke.glb` | Phase 2 | Made with the model (same file). There's no animation source yet; motion capture or stock clips need the licence rules above. |
| Final bark (owner's choice), footsteps (carpet/wood), room ambience | 10 | Synthesized placeholders exist for bark/sniff/pickup/drop. For finals: CC0 sources (e.g. Freesound CC0 only, Kenney) or recorded; ideally Moke's real bark if you record one |
| Nicer furniture/prop models (optional) | 10 | In-code geometry is in place; optionally CC0 packs (Kenney, Poly Pizza CC0) later |
