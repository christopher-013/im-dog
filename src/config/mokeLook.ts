/**
 * Moke's look (the soft-toon visual, modelled on the photos of the real Moke). Visual only; none of
 * this affects gameplay. Colours are display colours (the fur materials skip tone mapping so white
 * fur stays white).
 */
export const MOKE_LOOK = {
  /** Soft shading: colours on the lit and shaded side of each surface. */
  palette: {
    furLit: '#fffdf8',
    furShade: '#d4ced3',
    /** His ear fur has a faint cream tint. */
    earLit: '#fdf8f0',
    earShade: '#d6cfcf',
    noseLit: '#2e2729',
    noseShade: '#110d0e',
    tongueLit: '#f59aa5',
    tongueShade: '#cf7482',
    mouth: '#3a2226',
    line: '#9a8c8d',
    iris: '#3b2519',
    irisDark: '#170f0b',
    pupil: '#0b0706',
    eyeRim: '#0d0908',
  },
  /** A soft, character-only key light (view space: from the camera's upper left). */
  keyLight: {
    direction: [-0.45, 0.8, 0.4] as const,
    /** Where the shade starts (N·L), and how soft the lit/shade edge is. */
    center: 0.02,
    softness: 0.42,
  },
  /**
   * Room light still matters: the fur is scaled by how much light actually reaches it, relative
   * to a typical spot in the living room (`influence` 0 = ignore the room, 1 = fully), within [min, max].
   */
  roomLight: { reference: 0.62, influence: 0.65, min: 0.5, max: 1.0 },
  /** How much the curls show in the shading (0 = fur shades as smooth forms, 1 = every curl). */
  tuftDetail: 0.55,
  /** How much the creases between curls darken (0 = not at all). */
  cavity: 0.3,
  /** Soft warm rim on the silhouette. */
  rim: { color: '#fff4ea', power: 2.5, strength: 0.22 },
  /** A thin, soft silhouette line, as a fraction of the screen height (thinner as he gets further away). */
  outline: { enabled: true, width: 0.0013, referenceDistance: 1.4, minScale: 0.45 },
  /** His blue collar, and a navy bone-shaped name tag on a silver ring. */
  collar: {
    name: 'Moke',
    lit: '#3d8be0',
    shade: '#28609f',
    tagLit: '#34558f',
    tagShade: '#1b2f57',
    ringLit: '#eef0f4',
    ringShade: '#a3a8b4',
    text: '#e9eef6',
  },
  /** Idle blinks: seconds between blinks (min, random extra), and blink length. */
  blink: { every: [2.2, 3.4] as const, duration: 0.14 },
} as const;
