import { MOKE_LOOK } from './mokeLook';

/**
 * How each playable dog looks in the soft-toon style (`ToonMokeVisual`). Visual only: none of this affects gameplay,
 * which is the same for every dog (D29). Moke's look is `MOKE_LOOK`, unchanged. Dougie's is translated by hand from
 * the owner's private photo (never bundled or used as a texture): a fluffy dark charcoal coat, a white patch on top
 * of the head, warm cream-tan eyebrows, cheeks and muzzle, brown eyes, a white chest and white lower legs.
 * Nori's is translated the same way from two private photos (2026-10-16): a curly, light apricot coat, creamier on
 * the face, muzzle, chest and feet, deeper apricot ears, dark eyes and a black nose.
 * Colours are display colours (the fur skips tone mapping).
 */

export type Vec3 = readonly [number, number, number];

export interface DogPalette {
  readonly furLit: string;
  readonly furShade: string;
  readonly earLit: string;
  readonly earShade: string;
  readonly noseLit: string;
  readonly noseShade: string;
  readonly tongueLit: string;
  readonly tongueShade: string;
  readonly mouth: string;
  readonly teeth: string;
  /** The thin silhouette line. */
  readonly line: string;
  readonly iris: string;
  readonly irisDark: string;
  readonly pupil: string;
  readonly eyeRim: string;
}

export interface CollarLook {
  /** Engraved on the tag. */
  readonly name: string;
  readonly lit: string;
  readonly shade: string;
  readonly tagLit: string;
  readonly tagShade: string;
  readonly ringLit: string;
  readonly ringShade: string;
  readonly text: string;
}

/**
 * A patch of colour on one part of the coat, laid over what's there. Measured in that part's own space: `dir` is a
 * direction from the part's middle (+z forward, +y up, +x the dog's left), with the patch `radius` radians across
 * and edges `soft` radians wide; `mirror` also paints it on the other side. `below`/`above` limit it to the part's
 * own height (m), and `front` to fur facing forward (the smooth normal's z at least this).
 */
export interface CoatPatch {
  readonly color: string;
  readonly dir?: Vec3;
  readonly radius?: number;
  readonly soft?: number;
  readonly mirror?: boolean;
  readonly below?: number;
  readonly above?: number;
  readonly front?: number;
}

export interface CoatRegion {
  readonly base: string;
  readonly patches?: readonly CoatPatch[];
}

/** A coat with markings, part by part. Without one the fur is a single colour (Moke). */
export interface CoatPattern {
  readonly head: CoatRegion;
  readonly muzzle: CoatRegion;
  readonly ear: CoatRegion;
  readonly body: CoatRegion;
  readonly chest: CoatRegion;
  readonly frontLeg: CoatRegion;
  readonly hindLeg: CoatRegion;
  readonly tail: CoatRegion;
}

export interface DogLook {
  readonly palette: DogPalette;
  readonly collar: CollarLook;
  /** Markings as vertex colours over the fur, or null for one colour (the palette's). */
  readonly coat: CoatPattern | null;
  /** The ear clumps' radii (m): how big the drop ears are. */
  readonly earRadii: Vec3;
}

/** Moke: exactly as he's always been (MOKE_LOOK), so his appearance can't drift. */
export const MOKE_DOG_LOOK: DogLook = {
  palette: MOKE_LOOK.palette,
  collar: MOKE_LOOK.collar,
  coat: null,
  earRadii: [0.046, 0.068, 0.054],
};

const DOUGIE_COAT = {
  charcoal: '#3a353c',
  white: '#faf7f2',
  tan: '#d9b089',
  grey: '#aca7ae',
  bridge: '#d2cdd2',
} as const;

/**
 * Dougie: the same fluffy toon build as Moke (same size, so every activity fits him), with his own markings, longer
 * drop ears, brown eyes and a sage collar. The fur's lit/shade colours are neutral; the coat gives the colour.
 */
export const DOUGIE_LOOK: DogLook = {
  palette: {
    furLit: '#ffffff',
    furShade: '#cbc5cb',
    earLit: '#ffffff',
    earShade: '#cbc5cb',
    noseLit: '#2e2729',
    noseShade: '#110d0e',
    tongueLit: '#f59aa5',
    tongueShade: '#cf7482',
    mouth: '#3a2226',
    teeth: '#fffaf0',
    line: '#241e21',
    iris: '#7a4a2a',
    irisDark: '#2f1a0d',
    pupil: '#0b0706',
    eyeRim: '#0d0908',
  },
  collar: {
    name: 'Dougie',
    lit: '#a7b597',
    shade: '#728262',
    tagLit: '#d4d7dd',
    tagShade: '#8b909a',
    ringLit: '#eef0f4',
    ringShade: '#a3a8b4',
    text: '#33373d',
  },
  coat: {
    head: {
      base: DOUGIE_COAT.charcoal,
      patches: [
        // The white patch on top of his head, with a grey streak down the middle of the forehead.
        { color: DOUGIE_COAT.white, dir: [0, 1, 0.3], radius: 0.42, soft: 0.16 },
        { color: DOUGIE_COAT.grey, dir: [0, 0.55, 0.84], radius: 0.18, soft: 0.1 },
        // Cream-tan eyebrows over each eye, and tan cheeks and chin round the muzzle.
        { color: DOUGIE_COAT.tan, dir: [0.4, 0.44, 0.8], radius: 0.16, soft: 0.07, mirror: true },
        { color: DOUGIE_COAT.tan, dir: [0.52, -0.38, 0.76], radius: 0.4, soft: 0.14, mirror: true },
        { color: DOUGIE_COAT.tan, dir: [0, -0.72, 0.69], radius: 0.38, soft: 0.14 },
      ],
    },
    muzzle: {
      base: DOUGIE_COAT.tan,
      patches: [{ color: DOUGIE_COAT.bridge, dir: [0, 0.82, 0.57], radius: 0.5, soft: 0.2 }],
    },
    ear: { base: DOUGIE_COAT.charcoal },
    body: {
      base: DOUGIE_COAT.charcoal,
      patches: [
        // The white chest, running down under his front.
        { color: DOUGIE_COAT.white, dir: [0, -0.25, 1], radius: 0.62, soft: 0.2 },
        { color: DOUGIE_COAT.white, dir: [0, -1, 0.45], radius: 0.4, soft: 0.2 },
      ],
    },
    chest: {
      base: DOUGIE_COAT.white,
      patches: [{ color: DOUGIE_COAT.charcoal, dir: [1, 0.35, -0.2], radius: 0.6, soft: 0.2, mirror: true }],
    },
    frontLeg: {
      base: DOUGIE_COAT.charcoal,
      patches: [
        // A tan flash on the front of each foreleg, just above the white sock.
        { color: DOUGIE_COAT.tan, below: -0.055, front: 0.35 },
        { color: DOUGIE_COAT.white, below: -0.09 },
      ],
    },
    hindLeg: { base: DOUGIE_COAT.charcoal, patches: [{ color: DOUGIE_COAT.white, below: -0.095 }] },
    tail: { base: DOUGIE_COAT.charcoal, patches: [{ color: DOUGIE_COAT.white, above: 0.07 }] },
  },
  earRadii: [0.05, 0.088, 0.058],
};

const NORI_COAT = {
  apricot: '#ebc89c',
  deep: '#dfb380',
  cream: '#f6e6cd',
  ear: '#d9a56d',
  earTip: '#cc945a',
} as const;

/**
 * Nori: the same toon build and size as Moke (the photos give no real size), in a soft apricot curly coat that's
 * creamier on the face, muzzle, chest and feet and deeper along the back, the crown and the drop ears, with dark eyes,
 * a black nose and a teal collar with a gold tag. The fur's lit/shade colours are neutral; the coat gives the colour.
 */
export const NORI_LOOK: DogLook = {
  palette: {
    furLit: '#ffffff',
    furShade: '#d9cbc5',
    earLit: '#ffffff',
    earShade: '#d9cbc5',
    noseLit: '#2e2729',
    noseShade: '#110d0e',
    tongueLit: '#f59aa5',
    tongueShade: '#cf7482',
    mouth: '#3a2226',
    teeth: '#fffaf0',
    line: '#9c7a5e',
    iris: '#3b2519',
    irisDark: '#170f0b',
    pupil: '#0b0706',
    eyeRim: '#0d0908',
  },
  collar: {
    name: 'Nori',
    lit: '#3aa39b',
    shade: '#26736d',
    tagLit: '#efc65c',
    tagShade: '#b48a2c',
    ringLit: '#eef0f4',
    ringShade: '#a3a8b4',
    text: '#5a3d0e',
  },
  coat: {
    head: {
      base: NORI_COAT.apricot,
      patches: [
        // A deeper apricot crown, a creamy face round the eyes, and cream cheeks and chin round the muzzle.
        { color: NORI_COAT.deep, dir: [0, 1, -0.25], radius: 0.55, soft: 0.25 },
        { color: NORI_COAT.cream, dir: [0, 0.1, 1], radius: 0.5, soft: 0.22 },
        { color: NORI_COAT.cream, dir: [0, -0.7, 0.7], radius: 0.45, soft: 0.2 },
      ],
    },
    muzzle: { base: NORI_COAT.cream },
    ear: { base: NORI_COAT.ear, patches: [{ color: NORI_COAT.earTip, below: -0.035 }] },
    body: {
      base: NORI_COAT.apricot,
      patches: [
        // Deeper along the back, creamy down the front and underneath.
        { color: NORI_COAT.deep, dir: [0, 1, -0.2], radius: 0.6, soft: 0.3 },
        { color: NORI_COAT.cream, dir: [0, -0.25, 1], radius: 0.55, soft: 0.25 },
        { color: NORI_COAT.cream, dir: [0, -1, 0.3], radius: 0.45, soft: 0.25 },
      ],
    },
    chest: { base: NORI_COAT.cream },
    frontLeg: { base: NORI_COAT.apricot, patches: [{ color: NORI_COAT.cream, below: -0.07 }] },
    hindLeg: { base: NORI_COAT.apricot, patches: [{ color: NORI_COAT.cream, below: -0.08 }] },
    tail: { base: NORI_COAT.deep },
  },
  earRadii: [0.048, 0.08, 0.056],
};
