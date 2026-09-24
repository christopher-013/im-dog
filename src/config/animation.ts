/**
 * How Moke's body language reacts to movement. Visual only; none of this affects gameplay.
 * Units: radians, seconds.
 */
export const MOKE_ANIMATION = {
  /** Roll into turns per (rad/s of turning × m/s of speed). */
  leanPerTurnSpeed: 0.05,
  maxLean: 0.22,
  /** While moving, the head leads into turns by this fraction of the turn rate. */
  headLeadIntoTurn: 0.12,
  maxHeadYaw: 0.7,
  /** Idle personality: seconds between little looks around / head tilts (min, random extra). */
  idleActionEvery: [2, 3] as const,
  idleLookRange: 0.65,
  headTiltAngle: 0.38,
  headTiltChance: 0.35,
  headTiltHold: 1.4,
  /** Tail wag intensity (0..1) when idle vs. moving. */
  idleTailWag: 0.6,
  movingTailWag: 0.35,
  /** Carrying a prize makes him happy. */
  carryTailWag: 0.8,
  /** Head lift while carrying (radians). */
  carryHeadLift: 0.14,
  /** Nose dip while sniffing (radians). */
  sniffHeadDip: 0.45,
  /** How long a bark's body language lasts (s). */
  barkDuration: 0.38,
  /** Start ducking when the space above Moke's feet is below this (m). His fluffy head reaches ~0.42 m. */
  duckBelowHeadroom: 0.45,
  /** Headroom range over which he goes from standing to fully ducked (m). */
  duckRange: 0.08,
} as const;
