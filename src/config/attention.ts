/**
 * What catches Moke's eye (AttentionSystem). Visual personality only; none of this affects gameplay.
 * Units: metres, seconds, radians.
 */
export const MOKE_ATTENTION = {
  /** Things further than this, or closer than `minDistance` (right under his nose), don't catch his eye. */
  range: 2.6,
  minDistance: 0.25,
  /** Only things within this angle either side of where he faces (he doesn't look over his shoulder). */
  fieldOfView: 1.9,
  /** How much less interesting something at the edge of his view is (0..1). */
  sideFalloff: 0.5,
  /** Above this speed (m/s) he's busy running and doesn't glance about. */
  maxSpeed: 2.6,
  /** How long a glance lasts (min, random extra), and the pause before the next one. */
  glance: [1.6, 1.6] as const,
  lookAway: [1.5, 3.0] as const,
  /** After a glance, that thing is less interesting for this long, so he doesn't stare. */
  boredFor: 7,
  /** Interest by kind (1 = normal). */
  interest: {
    sock: 1.4,
    toy: 1.1,
    ball: 1.2,
    bed: 0.7,
    scent: 1,
    food: 1.6,
    human: 1.5,
  },
} as const;
