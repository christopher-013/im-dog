# Moke — Character Reference

Analysis of the real Moke (white Maltipoo) from the nine photos in `reference/moke/` (private, git-ignored).
**Everything under "Observations" is limited to what the photos show.** Design suggestions are kept
separate at the end and labelled as such.

How this feeds the final 3D model: [`MOKE_3D_SPEC.md`](MOKE_3D_SPEC.md) turns these observations into a build
specification (Phase 2); [`MOKE_INTEGRATION.md`](MOKE_INTEGRATION.md) covers how the model gets into the game.

## Photo index

| File | What it shows | Most useful for |
|---|---|---|
| `moke-01.webp` | Lying on a grey-taupe couch among pillows, front paws crossed, looking at camera; tail plume raised behind; black-and-white ball toy nearby | Lying pose, tail at rest, crossed paws |
| `moke-02.webp` | Close-up on a fleece blanket: mouth open, pink tongue out, eyes squinted; chew ball by his paws | Happy expression |
| `moke-03.webp` | Sitting on carpet next to an empty paper plate, seen from above, mouth slightly open | Head-to-body proportions, "waiting for food" |
| `moke-04.webp` | Lying on an oatmeal linen couch between leaf-print pillows, head tilted against a pillow, tail stretched back | Side-ish body while lying, tail length, paw pads |
| `moke-05.webp` | Peeking over a couch pillow in front of a window (soft focus) | Peeking pose, collar |
| `moke-06.webp` | Standing on a dark wood floor, sharp front-¾ close-up; tail carried high over the back | **Best face reference**, tail carriage |
| `moke-07.webp` | Sitting outdoors behind a cup of dog ice cream, tongue out, wearing a tan harness | Excited expression |
| `moke-08.webp` | Sitting on a fluffy tan rug in a green monstera-leaf bandana with a bone-shaped tag | Front view, coat tint |
| `moke-09.webp` | Sitting upright on a grey couch in a light-blue flamingo "Relax" bandana | Front view, ear shape, head silhouette |

## Observations

### Head
- **Overall shape:** very round. The fur on top of the head and the long ear fur merge into one continuous
  fluffy dome, so from the front the head reads as a circle or a slightly wide oval, widest at ear level
  (06, 09, 03). This is the grooming style, not the skull shape, which can't be seen.
- **Relative size:** with fur, the head looks large compared with the more closely trimmed body (clearest in 03).
- **Forehead:** domed and fluffy; the stop is hidden under fur.
- **Muzzle:** short to medium and fairly broad, not pointed. Covered in fluffy fur, with a slightly longer,
  wispy mustache/beard (06, 03).
- **Cheeks:** full and fluffy, blending straight into the ears.
- **Chin:** small beard. A light tan/beige tint shows around the mouth in some photos (07, and faintly 03) but
  not in others (06). This looks like staining rather than a marking.

### Eyes
- **Shape:** round.
- **Size:** medium; they look larger because they're very dark against white fur.
- **Placement:** forward-facing, set fairly wide apart, roughly at mid-height of the head, level with the top of
  the muzzle. The fur is trimmed enough that both eyes are always clearly visible.
- **Colour:** very dark brown to near-black; no iris detail is visible in these photos. Dark eye rims (06, 09).
  Small catch-lights.
- **Characteristic expressions:**
  - *Earnest look-up:* steady, attentive gaze straight at the camera (03, 06, 08, 09). Looking up, a sliver of
    white can show under the iris (03).
  - *Happy squint:* when the mouth is open with the tongue out, the eyes narrow into crescents (02).
  - *Calm/sleepy:* lying down, heavier lids, head resting and tilted (01, 04).

### Nose
- **Shape:** rounded "button", slightly wider than tall.
- **Size:** small to medium relative to the fluffy head, but very prominent because of the contrast.
- **Colour:** black, a little glossy (highlight in 06).
- **Placement:** end of the short muzzle, below the head's centre. In the two front views (06, 09) the nose sits
  roughly 0.6–0.7× the eye spacing below the eye line, so the eyes-and-nose triangle is wider than it is tall.
  (Approximate, measured by eye from the photos.)
- **Mouth:** dark, pigmented lips visible when the mouth is open (03, 06); pink tongue, often out (02, 03, 07).

### Ears
- **Type/shape:** drop ears. The ear leather is completely hidden by fur; what reads as "ear" is a long,
  soft, wavy-curly curtain.
- **Size:** medium; the fur reaches to about jaw/chin level (06, 09).
- **Position:** set at the sides of the head around eye level. There's no visible gap between the ear fur and
  the fur on top of the head (01, 03, 06).
- **How they hang:** close to the cheeks with a slight outward flare at the bottom, which widens the head
  silhouette. They move with the head (the left ear sits slightly lifted in 09).
- **Fur:** looser, longer curls than the body; often a faint cream/ivory tint (04, 08, 09).

### Coat
- **Colour:** white overall; reads cream in warm light. Faint cream/ivory on the ears and sometimes the muzzle.
  Occasional light tan staining around the mouth (07) and slightly greyish-beige paw fur (03). No other markings.
- **Texture/curl:** curly. The body has tight, small ringlets (clearest in 01 and 04). The head is fluffier and
  looks brushed out, like cotton (03, 06).
- **Fluffiness/length:** highest on head, ears and tail; the body and legs are trimmed noticeably shorter.
- **Face hair:** fluffy, cleared around the eyes; wispy mustache and beard.
- **Legs:** trimmed, curly, forming soft columns; toes covered by fur, so the feet look round (03, 06, 09).
- **Tail:** longest, most voluminous fur on the body (see Tail).

### Body
- **Overall:** small and compact. With the fur-heavy head and trimmed body, the proportions are
  "big round head, neat body".
- **Torso/chest:** compact; moderately deep chest with curly fur (03, 09). A full standing profile isn't
  available, so torso length vs. height can't be judged reliably.
- **Legs:** straight and fairly slim under the fur; front legs are straight, parallel columns when sitting (03, 09).
  Not noticeably short-legged.
- **Paws:** small and round, fur-covered; dark pads (04).
- **Neck:** looks short because of the fur; the collar sits down in the coat (06).
- **Apparent size:** a small dog. The only rough scale cue is the paper plate in 03, which is about as wide as
  his chest. **Actual size can't be measured from these photos**; the game assumes 0.28 m at the shoulder and
  0.43 m to the top of the head fur (`MOKE_CHARACTER.size` in `src/config/mokeCharacter.ts`, the one
  authoritative scale since Phase 2).

### Tail
- **Shape:** a big plume.
- **Length:** medium. Stretched out behind him while lying (04), it's roughly a third of his body length.
- **Curl/carriage:** carried high and curved forward over the back when standing (06); raised as a plume while
  lying alert (01); relaxed and extended behind while resting (04).
- **Fur:** long, curly and voluminous, like a pom-pom.

### Distinguishing features: what makes him *Moke*
1. **The cotton-ball head:** topknot and ears merge into one round, fluffy dome that's bigger than the trimmed body suggests.
2. **Two dark, round, wide-set eyes** peeking clearly out of the white fluff, with an earnest look-up gaze.
3. **Short, broad muzzle with a black button nose**; the eyes-and-nose triangle is wide and short.
4. **Contrast in texture:** tight ringlets on the body, soft cotton on the head, long curls on the ears.
5. **High, plumed tail** curving over his back when he's up and about.
6. **Faint cream tint on the ear fur.**
7. **Expressive face:** happy tongue-out squint, and head tilts (04, 09).
8. **Accessories he's been photographed in:** green monstera-leaf bandana, light-blue flamingo "Relax"
   bandana, grey collar with a silver ring, tan harness. These are nice optional cosmetics later.

### Modelling observations (added in Phase 2, for the 3D model)
Still observations only, gathered for whoever builds `moke.glb`.

- **Head width vs. body (03, from above; 09, front):** with the ear fur, the head is about as wide as his chest
  and shoulders, or slightly wider. From the front, the ear curtains flare the silhouette to roughly 1.5× the
  width of the face between the eyes' outer corners (09).
- **Ear curtains (06, 09):** hang from about eye level to about the mouth line, fluffy and slightly flared at the
  bottom, with wispy tips flicking outward (09). Seen lying down they read slightly more cream than the head (04).
- **Eye line vs. ear set (06, 09):** the eyes sit at about the same height as where the ears join the head. The
  nose sits clearly below the eye line, and the muzzle fur (mustache) is wider than the nose.
- **Sitting (03, 08, 09):** front legs straight, close together and parallel, with round fluffy feet. The haunches
  are tucked, with a hind foot showing just outside and behind the front feet (03). The tail rests on the floor
  behind him (03).
- **Standing (06):** straight front legs under the chest. The tail rises from the rump and curls forward over the
  back, its plume about the size of the head's top dome. The body and chest fur is tight, short curls.
- **Lying (01, 04):** the body is a rounded, curly "loaf" with the hind legs folded under, the front paws
  crossed (01) or stretched forward, and dark paw pads showing (01, 04). The tail is either raised as a plume (01) or stretched straight back with
  looser curls toward the tip (04).
- **Mouth (02, 03, 07):** open, it shows dark lips, a pink tongue and a short, wide mouth. Panting (02, 07), the
  tongue hangs forward over the lower lip.
- **Collar (06):** a thin dark grey collar sits deep in the neck fluff, almost hidden at the sides, with a silver
  ring at the throat and a tag hanging from it (out of focus).

**From photos the owner shared in chat** (not stored in the repo, so they can't be re-checked):
- a **side profile** with a level back, legs about as long as the body is deep, and the plume tail curled over the
  back; faint apricot tint on the ear tips;
- his **real collar** (grey) with a **navy bone-shaped tag** (the in-game collar is blue at the owner's request),
  with the lower teeth visible when his mouth is open.

## Additional reference needed
The third-person camera will mostly show Moke **from behind and above**, and none of the photos show that. For
the final 3D model (Phase 2), items 1, 2, 5 and 7 matter most: a modeller needs a turnaround and real
measurements, and an animator needs video. A side profile was shared in chat but isn't stored, so it can't be
handed to an artist. In priority order:

1. **Standing side profile** at dog height, full body, neutral pose: torso length, leg length, back line, neck, tail set.
2. **Rear and rear-¾ views**, standing and walking: back of the head, ears from behind, tail from behind.
3. **Top-down while standing**: body width and head/body ratio from the camera's usual angle.
4. **Front view at eye level in even daylight**, neutral expression: eye colour and exact eye/nose spacing.
5. **Measurements:** shoulder height, nose-to-tail length, head width including fur, weight.
6. **Canonical groom:** which trim should the character wear? (It varies between photos.)
7. **Short phone videos:** walk, trot, run, sit down, lie down, head tilt, tail wag, a shake-off. These are for animation.
8. **Close-ups** of paws/pads and ears lifted vs. at rest.
9. Optional: **a recording of his real bark**, which could become the in-game bark if you want.

## Owner style target (2026-09-24)
- **First,** the owner shared an anime illustration of a white fluffy puppy (in chat, not stored in the repo):
  cel shading, ink outlines, pointed fur tufts, big glossy brown eyes, blush, a "w" smile. Moke was built that way.
- **Then, the same day,** the owner asked for him to look "less jagged and more like the real dog", pointing back
  to the photos here. **This is the current target.** The in-game Moke (`ToonMokeVisual`) now follows the
  Observations above: a curly rounded coat (no pointed tufts), round very dark eyes, a black button nose on a
  short broad mustached muzzle, wavy cream-tinted ears, a pom-pom tail, and no blush or drawn smile. The shading
  stays soft and gently stylized, not photoreal.
- **Then** shorter ears (ending about at mouth level, as in the "Relax" bandana photo), and a collar: blue, snug in
  the fluff just under his head, with a navy bone-shaped name tag on a silver ring, after a photo of Moke in his
  own collar and bone tag.
- **Phase 2 brief ("Make Moke actually Moke"):** the target is the *real Moke, softly stylized*, not a generic
  anime dog. The final character is a rigged, animated `moke.glb` built to [`MOKE_3D_SPEC.md`](MOKE_3D_SPEC.md);
  the code-built `ToonMokeVisual` is the stand-in and fallback until then.

## Design notes for the stylized character (suggestions, not observations)
- **Protect the silhouette first.** A round fluffy dome for the head, a neat curly body and a high pom tail make
  him recognizable even as a shadow. Build the head as merged fur masses (topknot + ear curtains + cheek fluff).
- **Eyes:** at most ~10–15% larger than life, kept dark and round with a single strong catch-light. Their charm
  is how clearly they read against the white, not their size. (The anime pass briefly made them much bigger; the
  owner's "more like the real dog" request restored this.)
- **Keep the muzzle short and the nose a glossy black button.** Pointing the muzzle would turn him into a generic dog.
- **Show the texture contrast** with sculpted curl clumps rather than realistic hair. Tighter on the body,
  softer on the head, looser on the ears and tail.
- **White with warm cream accents** (ears, muzzle shadow). Avoid a flat pure white; it will clip under warm lighting.
- **Signature animation beats:** head tilt, happy squint with tongue out, the earnest look-up, the pom tail wag.
