/**
 * How Moke notices and uses things around him. Units: metres, radians, seconds.
 */
export const INTERACTION = {
  /** Things further than this off his facing are ignored (half-angle of the cone in front of him). */
  facingHalfAngle: 1.75,
  /** Closer than this, facing doesn't matter (it's right under his nose). */
  facingFreeRadius: 0.28,
  /** How much being off-centre counts against a candidate, relative to distance (0..1 scale each). */
  facingWeight: 0.6,
  /** The current target keeps this much advantage, so the prompt doesn't flicker between two close things. */
  stickiness: 0.15,
} as const;
