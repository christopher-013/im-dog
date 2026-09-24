/**
 * Moke's anime-style look (the toon visual). Visual only; none of this affects gameplay.
 * Colours are display colours (the toon materials skip tone mapping so white fur stays white).
 */
export const MOKE_LOOK = {
  /** Cel shading: colours on the lit and shaded side of each surface. */
  palette: {
    furLit: '#fffdfa',
    furShade: '#c4bad9',
    earLit: '#fffaf2',
    earShade: '#cbbdd3',
    noseLit: '#3a3033',
    noseShade: '#171214',
    tongueLit: '#ff9aa8',
    tongueShade: '#dc7488',
    mouth: '#5a2a30',
    line: '#4a3a3f',
    iris: '#7a4a33',
    irisDark: '#2c1a14',
    pupil: '#120b09',
    eyeRim: '#1f1512',
    blush: '#ff9fae',
  },
  /** A soft, character-only key light (view space: from the camera's upper left). */
  keyLight: {
    direction: [-0.45, 0.8, 0.4] as const,
    /** Where the shade starts (N·L), and how soft the lit/shade edge is. */
    center: 0.22,
    softness: 0.1,
  },
  /**
   * Room light still matters: the fur is scaled by how much light actually reaches it, relative
   * to a typical spot in the living room (`influence` 0 = ignore the room, 1 = fully), within [min, max].
   */
  roomLight: { reference: 0.62, influence: 0.6, min: 0.5, max: 1.06 },
  /** How much each tuft shows in the shading (0 = fur shades as smooth forms, 1 = every tuft). */
  tuftDetail: 0.2,
  /** Soft warm rim on the silhouette. */
  rim: { color: '#fff1e4', power: 3, strength: 0.28 },
  /** Ink outline, as a fraction of the screen height (thinner as he gets further away). */
  outline: { width: 0.0028, referenceDistance: 1.4, minScale: 0.45 },
  /** Idle blinks: seconds between blinks (min, random extra), and blink length. */
  blink: { every: [2.2, 3.4] as const, duration: 0.14 },
} as const;
