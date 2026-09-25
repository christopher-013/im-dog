# Moke — 3D Model Specification (`moke.glb`)

What the final, rigged and animated Moke must look like and how the file must be built so the game can use it
without code changes. Written for whoever makes the model (an artist, the owner, or a modelling pipeline).

- **What he looks like:** [`MOKE_CHARACTER_REFERENCE.md`](MOKE_CHARACTER_REFERENCE.md) (observations from the photos).
- **How the game loads and tests it:** [`MOKE_INTEGRATION.md`](MOKE_INTEGRATION.md).
- **The numbers in code:** `src/config/mokeCharacter.ts` (`MOKE_CHARACTER`) and the clip list in
  `src/player/gltf/clips.ts` (`MOKE_CLIPS`). If this document and the code ever disagree, the code wins and this
  document should be fixed.

> **Private photos.** The photos of the real Moke are private (`reference/moke/`, git-ignored, decision D8). Only the
> owner may share them with an artist. Agents must never upload them anywhere. Screenshots of the in-game stand-in
> (below) are fine to share.

## 1. Style target
**The real Moke, softly stylized** (decisions D5 and D12): a warm animated-film look that anyone who knows him
recognizes as *Moke*. Not a generic cartoon dog, not an anime puppy, not photoreal, not chibi, not crude low-poly.

- **Silhouette first.** He must read as Moke even as a shadow:
  - a round "cotton-ball" head, where the topknot, cheeks and ear curtains merge into one fluffy dome, widest at ear level;
  - a neat, trimmed, curly body on straight, slim leg columns with round, furry feet;
  - a high plume tail, curled forward over the back when he's up and about.
- **Face:** two dark, round, wide-set eyes clearly visible in the white fluff; a short, broad muzzle with a
  wispy mustache and beard; a glossy black button nose. The eyes and nose form a triangle that's wider than it's tall.
- **Texture contrast:** tight ringlets on the body, soft brushed cotton on the head, looser and longer curls on the
  ears and tail. Sculpted curl clumps, not individual hairs.
- **Colour:** warm white, never flat pure white. Faint cream to apricot on the ear fur and around the muzzle.
- **Stylization budget:** eyes at most 10–15% larger than life; the head may be slightly larger. Keep the muzzle
  short, and add no blush, drawn smile or pointed anime tufts. (The owner asked for "less jagged, more like the real dog".)
- **Accessories:** a **blue collar** snug in the neck fluff, with a **navy bone-shaped tag** reading "Moke" on a
  silver ring. The owner asked for this; it's modelled on a photo of his real collar and bone tag.
- **The benchmark to beat** is the in-game stand-in, `ToonMokeVisual`. It follows the photos and the owner's feedback,
  but its curls are coarse geometry and it can't deform like a rigged model.

## 2. Units, orientation, origin and size
| Rule | Value |
|---|---|
| Units | **metres** (1 unit = 1 m). Apply all transforms before export: object scale 1, rotation 0. |
| Up | **+Y** (glTF standard). In Blender: +Z up, converted by the exporter's "+Y Up" option. |
| Forward | Moke faces **+Z** in glTF, which is **−Y in Blender** (facing the camera in Front view, numpad 1). |
| Left / right | His left side is **+X**, so `_L` bones sit on +X (Blender's own `.L`/`_L` convention). |
| Origin | On the floor (**y = 0**), centred between the four paws. Standing, the paws touch y = 0. |
| Standing height | Top of the head fur **0.43 m** in the neutral standing pose (`MOKE_CHARACTER.size.headTop`). |
| Shoulder (withers) | **0.28 m** (`size.shoulderHeight`). |
| Eyes | **0.33 m** (`size.eyeHeight`). The camera pivots just above this. |

The game warns if the standing height is more than 20% off (`model.heightTolerance`). If the owner ever measures the
real Moke, the change is made in one place (`MOKE_CHARACTER.size`); a finished model can then be re-exported or scaled
by `MOKE_CHARACTER.model.scale`.

**Proportions measured from the stand-in** (neutral standing, metres, model space; a guide, not a cage):

| Point | Where |
|---|---|
| Nose tip | z ≈ +0.31 |
| Back of the tail plume | z ≈ −0.24 (nose to tail ≈ 0.55 m) |
| Width across the ear fur | ≈ 0.32 m |
| Hips / shoulders pivot height | y ≈ 0.17 |
| Front legs / hind legs | z ≈ +0.06 / z ≈ −0.15 (paws about 0.11 m apart side to side) |
| Mouth (grip point) | (0, 0.28, 0.23) |
| Collar front (tag ring) | (0, 0.22, 0.19) |
| Top of the back, between the shoulders | (0, 0.305, −0.06) |

**Clearance.** The coffee table is 0.40 m high underneath, lower than his head. He fits under it by ducking (the
`duck` clip, section 8). Under the table the game applies only about **60%** of that pose, so the full `duck` pose
must lower his head top by about **8 cm** (to ≈ 0.35 m) without the fur clipping badly. His collision capsule is 0.17 m in radius and 0.36 m tall (`MOKE_BODY`), and the model may
overhang it a little.

## 3. Geometry and triangle budget
- **Budget: 15k–30k triangles** for the whole dog including eyes, mouth interior, collar and tag; **hard cap 40k.**
  (The procedural stand-in is ~110k, because its fur is all geometry. The final model has to be cheaper.)
- **Draw calls:** at most 4 materials, so 1–4 draw calls plus shadows. Ideally one skinned body mesh plus small
  separate meshes only where a material differs.
- **Fur:** sculpt the curl clumps and bake them to normal and occlusion maps. Keep real geometry for the silhouette
  bumps that matter (the head dome, ear curtains, tail pom-pom, beard). No hair cards or shells: they're costly, and
  alpha sorting breaks in the browser.
- **Eyes:** separate domes or spheres under eyelids, so the `blink` morph can close the lids over them.
- **Mouth interior:** a pink tongue, dark gums and lips, and a few small lower teeth (visible in his open-mouth photos).
  The `jaw` bone opens it.
- **Topology:** clean edge loops around the eyes, the mouth and every joint (shoulders, elbows, hips, hocks, neck,
  tail root). Quads while modelling; glTF triangulates on export.
- **Normals and tangents:** smooth normals; export tangents when normal maps are used.
- **No** n-gon artefacts, loose or duplicate vertices, hidden internal faces, or zero-area triangles.

## 4. Materials and textures (PBR)
Standard glTF **metallic-roughness PBR** (three.js `MeshStandardMaterial`). He's lit by the room: hemisphere fill, a
window sun with soft shadows, and a soft image-based environment, with Neutral tone mapping. No custom shaders are
required. Material names are suggestions; the game doesn't look them up.

| Material | Base colour | Roughness | Metallic | Notes |
|---|---|---|---|---|
| `M_Moke_Fur` | warm white (≈ #F3EEE6), cream/apricot tint on ears and muzzle | 0.8–0.9 | 0 | Normal map for the curls; occlusion map for the creases between clumps. |
| `M_Moke_Eyes` | near-black brown (≈ #1A1210) | 0.05–0.15 | 0 | Must catch one strong highlight: that's where his charm is. |
| `M_Moke_Details` | nose black, tongue pink, gums dark | nose ≈ 0.35, tongue ≈ 0.5 | 0 | Can share an atlas with the eyes. |
| `M_Moke_Collar` | strap blue, tag navy with "Moke", ring silver | strap 0.7, tag 0.4, ring 0.3 | ring 1, others 0 | The tag's name should be legible in a close-up. |

- **Texture sizes:** fur base colour and normal at 2048² (1024² acceptable); packed occlusion-roughness-metallic at
  1024²; details and collar atlas at 512–1024².
- **Formats:** PNG or JPEG, **embedded in the .glb**. Base colour in sRGB; normal and ORM linear (glTF default).
- **No compression extensions:** no Draco, meshopt or KTX2/Basis. The game's `GLTFLoader` isn't configured for them;
  adding them would need a decision and a code change.
- **Alpha:** avoid blending. Alpha-test (glTF `MASK`) only if a fringe really needs it.
- **File size:** aim for ≤ 5 MB, at most 8 MB. It downloads behind the loading screen.
- **Optional later:** the stand-in uses a soft toon shader. If the owner prefers that look on the final model,
  `GltfMokeVisual` could swap in the toon material. That isn't implemented and would be an owner decision.

## 5. Skeleton
One armature, deformation bones only. **Bold names are required by the code** (`MOKE_CHARACTER.bones`); the rest are
recommended so clips and future tools stay predictable.

```
root                      on the floor at the origin; not animated in locomotion
└─ pelvis
   ├─ spine_01 ─ spine_02 (chest)
   │               ├─ neck ─┬─ head ─┬─ jaw ─ [socket_mouth]
   │               │        │        ├─ ear_L, ear_R
   │               │        │        └─ eye_L, eye_R (optional)
   │               │        └─ [socket_collar]
   │               ├─ front_upper_L ─ front_lower_L ─ front_paw_L   (and _R)
   │               └─ [socket_back]
   ├─ hind_upper_L ─ hind_lower_L ─ hind_ankle_L ─ hind_paw_L      (and _R)
   └─ tail_01 ─ tail_02 ─ tail_03 ─ tail_04                        (root to tip)

[…] = an empty node (socket), not a bone
```

- Required names: **`root`, `neck`, `head`, `jaw`, `ear_L`, `ear_R`, `tail_01`…`tail_04`**. Missing ones are reported
  in the console and their procedural touches are skipped. The model still works.
- **Rest pose = the neutral standing idle**, facing +Z, jaw closed, ears relaxed, tail in its usual high carriage.
  The game turns the head, neck, jaw, ears and tail *from their rest pose* and resets them every frame.
- **Bone axes don't matter.** The game applies its turns in the model's own frame (+Y up, +Z forward), so any
  bone roll convention works.
- **Skinning:** at most 4 influences per vertex, normalized. Around 40–60 bones in total.
- **What the game adds on top of the clips:**
  - glancing at things and head tilts: neck 40%, head 60%, up to ±40° yaw and ±20° pitch;
  - the head held ~8° higher while carrying something;
  - tail wag: yaw, growing toward the tip;
  - ear bounce with his steps;
  - opening the jaw (~20°) for barks, growls and panting at a run;
  - blinks.

  Keep these subtle in the clips themselves, so the two don't fight.

## 6. Face controls (kept simple)
| Control | Type | Name | Used for |
|---|---|---|---|
| Blink | morph target (shape key), 0 open → 1 closed | **`blink`** | Idle blinks; eyes closed while resting in his bed |
| Jaw | bone rotation (chin down opens) | **`jaw`** | Bark, growl, panting at a run |
| Ears | bones | **`ear_L`**, **`ear_R`** | Bounce with steps; clips can pin them back (growl) or perk them up |
| Head | bones | **`neck`**, **`head`** | Glancing at things, head tilts, looking up at something |

Reserved for later (optional, not read by the game yet): morphs `squint` (his happy tongue-out squint),
`tongue_out`, `brow_up_L`/`brow_up_R` (the earnest look-up) and `ears_back`; bones `eye_L`/`eye_R` (gaze).

## 7. Attachment points (sockets)
Empty nodes (no mesh) parented to bones. In the rest pose their axes line up with the model's (+Y up, +Z forward), so
attached things don't come out rotated.

| Node | Parent | Where | Used for |
|---|---|---|---|
| **`socket_mouth`** | `jaw` (or `head`) | On the centre line between the front teeth, where he grips a toy | Carried items: the sock, tennis ball and rope toy are held crosswise along X (offsets in `config/props.ts`) |
| `socket_collar` | `neck` | Front of the collar at the throat, where the tag ring hangs | Future cosmetics: tag, bandana knot |
| `socket_back` | `spine_02` | On top of the back, between the shoulders | Future cosmetics: harness, bandana |

Without `socket_mouth`, the game estimates a mouth position in front of the head and warns. Carrying still works.

## 8. Animations
**Clip names must match exactly** (lower case, underscores). Anything else is ignored, with a console note. All clips
are **in place**: no root motion, and `root` stays at the origin (the game moves him). Loops must cycle seamlessly
(first frame = last frame). Key every deforming bone at least on the first frame, so a blend never inherits a pose
from a previous clip. 30 fps is fine.

**Locomotion is authored at the game's speeds** (`MOKE_CHARACTER.clipSpeeds`). The game blends between the two
nearest gaits by his real speed and scales playback (0.3–2.5×), so the paws only stay planted if stride × cadence
matches:

| Clip | Loop | Need | Speed / length | What it looks like |
|---|---|---|---|---|
| `idle` | loop | **required** | 2–4 s | Standing, breathing, small weight shifts. Head and tail calm: the game adds glances, tilts, wags and blinks. |
| `walk` | loop | **required** | **0.8 m/s**, ~1 s cycle | Relaxed four-beat walk. |
| `trot` | loop | **required** | **1.8 m/s**, ~0.5 s cycle | His default gait: bouncy, happy, tail up. |
| `run` | loop | **required** | **4.0 m/s**, ~0.35–0.4 s cycle | Excited bounding run, ears flopping; mouth may be open. |
| `sit` | loop | **required** | 2–3 s | Settled sit, front legs straight parallel columns, breathing. He sits by himself after ~8 s idle; the game crossfades in and out. |
| `lie_down` | once | **required** | ~1.0 s | Standing to sphinx pose, **rump first** like a real dog, when he enters his bed. |
| `rest` | loop | **required** | 3–5 s | Sphinx pose, tummy down, front paws forward, head resting, slow breathing. The game closes his eyes. |
| `stand_up` | once | **required** | **0.45 s** | Sphinx to standing. The game's rise takes 0.45 s. |
| `sniff` | loop | **required** | 1–2 s | Nose to the floor, snuffling side to side, tail slowly wagging. |
| `bark` | once | **required** | 0.4–0.6 s | One happy bark: small front hop, chest forward, tail up. The game opens the jaw too. |
| `pickup` | once | recommended | ~0.45 s | A quick dip and grab. The item is attached to `socket_mouth` right away, so grip early. |
| `drop` | once | recommended | ~0.45 s | A small dip, mouth opening. |
| `growl` | once | recommended | ~1 s | Mock-tough and cute: front lowered and planted, head forward, ears back, tiny tremble. |
| `eat` | once | recommended | **1.4 s** | Nose down to a treat on the floor, a few happy chews, tail wagging (Sock Heist, Phase 3). |
| `stretch` | once | recommended | ~1.5 s | A play bow before he sits (sometimes, when idle). |
| `duck` | once, **additive** | recommended | ~0.3 s | First frame = the neutral standing pose; last frame = low-slung: legs bent, chest and head lowered so the head top drops ~8 cm, tail down. Layered on top of any gait while he's under the coffee table (at about 60% weight there). |
| `trick_belly_up` | once | recommended | **2.8 s** | Rolls onto his back, paws curled, wiggles, rolls back. |
| `trick_beg` | once | recommended | **2.1 s** | Sits up on his hind legs, front paws tucked, then back down. |
| `trick_paw` | once | recommended | **2.4 s** | From a sit, offers a front paw (a little shake), then stands. |
| `trick_spin` | once | recommended | **1.2 s** | One happy spin in place (the root may turn 360° and must end where it started). |
| `scratch` | once | optional | ~1.5 s | Sits and scratches behind an ear with a hind foot. Not used yet. |
| `look_around` | once | optional | ~2 s | Curious look left and right. Not used yet. |

- **Required** clips are the minimum for a model that plays properly; missing ones are listed in the console.
  **Recommended** ones are used when present and skipped cleanly when not; without `duck`, the game dips his head
  and tail procedurally instead. **Optional** ones aren't used yet.
- Trick lengths match `MOKE_ANIMATION.tricks`. The game eases each trick in (0.28 s) and out (0.35 s), so start and
  end near the standing pose.
- The game handles every transition by crossfading (damped weights), so there are no transition clips beyond
  `lie_down` and `stand_up`.

## 9. Export checklist (Blender glTF 2.0 exporter)
1. Apply all transforms (armature and meshes: scale 1, rotation 0). Origin on the floor between the paws.
2. **File → Export → glTF 2.0**, format **glTF Binary (.glb)**.
3. Include: the armature and its meshes only. No cameras, lights or helper objects.
4. Transform: **+Y Up** on.
5. Mesh: Apply Modifiers, UVs, Normals, Tangents (with normal maps). **Compression (Draco) off.**
6. Materials: Export; images embedded (Automatic, or PNG/JPEG).
7. Shape keys on (for `blink`). Skinning on, limit to 4 influences. "Deformation bones only" on.
8. Animation: each clip as its own **Action named exactly as in section 8**, pushed to the NLA or marked for export.
   Sampling on (30 fps), "Export all actions", no merged or combined tracks.
9. Save as `public/assets/models/moke/moke.glb`.
10. Check the file in the [Khronos glTF Validator](https://github.khronos.org/glTF-Validator/) (no errors) and a
    glTF viewer, then follow the testing procedure in [`MOKE_INTEGRATION.md`](MOKE_INTEGRATION.md).

## 10. Acceptance checklist
- [ ] The debug panel (`` ` ``) shows `visual: model`, and the console has no `[moke]` warnings.
- [ ] Standing height ≈ 0.43 m, facing the way he moves, paws on the floor.
- [ ] All required clips are present; loops are seamless; no foot sliding at walk, trot or run.
- [ ] The sock, ball and rope toy sit in his mouth when carried.
- [ ] He ducks under the coffee table without his head or tail going through it.
- [ ] Lying in his bed, standing up, sitting, sniffing, barking and each trick look right.
- [ ] ≤ 40k triangles, ≤ 4 materials, ≤ 8 MB.
- [ ] **The owner recognizes him as Moke.** This is the real acceptance test.
