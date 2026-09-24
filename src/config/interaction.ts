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

/** Lying down in the dog bed (Milestone 9). */
export const REST = {
  /** "Lie Down" shows when Moke's feet are this close to the bed's centre (only reachable through its open front). */
  reach: 0.62,
  /** Shuffling into place: speed (m/s) and turn rate (rad/s). */
  settleSpeed: 0.7,
  settleTurnRate: 4,
  /** Close enough to lie down: distance (m) and facing error (rad). */
  arriveDistance: 0.05,
  arriveAngle: 0.12,
  /** Lie down wherever he is if settling takes longer than this (blocked). */
  settleTimeout: 2,
  /** Seconds to get back up before he can move again. */
  riseTime: 0.45,
} as const;
