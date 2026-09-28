/** Paper-heist timing and distances (metres/seconds). Input devices share the same activity. */
export const BATHROOM_ACTIVITY = {
  approachSpeed: 0.75,
  approachTurnRate: 5,
  approachTolerance: 0.14,
  approachTimeout: 5,
  biteTime: 0.55,
  outsideTrailDistance: 1.1,
  trailSampleDistance: 0.12,
  maxTrailPoints: 160,
  cleanupTime: 3.5,
  humanWaitTimeout: 45,
  walkTimeout: 45,
  cooldown: 25,
} as const;

/**
 * The hall bathroom door rests ajar. It opens while someone walks through the doorway (within this zone round the
 * threshold, m), and stays open while Moke is in the bathroom or his toilet-paper trail runs out through it.
 */
export const BATHROOM_DOOR = {
  /** Resting (ajar) and fully open angles (rad), and how fast it swings (rad/s). */
  ajar: 0.35,
  open: 1.45,
  swingSpeed: 6,
  /** Half the zone's width along the hallway, from the middle of the doorway. */
  halfWidth: 0.75,
  /** How far the zone reaches into the bathroom (covers where the ajar door stands) and out into the hallway. */
  inside: 0.6,
  outside: 0.35,
} as const;
