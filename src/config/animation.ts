import { MOKE_CHARACTER } from './mokeCharacter';

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
  /** How long the mock-tough growl pose lasts (s). */
  growlDuration: 1.15,
  /** Eating a treat off the floor (s). */
  eatDuration: 1.4,
  /** Being petted: he sits, tips his head up into the hand and wags hard (s). */
  petDuration: 2.8,
  petHeadPitch: 0.35,
  /** The little squash when he lands from a jump or a drop (s). */
  landDuration: 0.22,
  /** Vertical speed (m/s) at which his body is fully pitched up (rising) or down (falling) in the air. */
  airPitchSpeed: 3,
  /** Tricks (Q / controller X): how long each lasts (s) and how he eases into and out of it. */
  tricks: {
    bellyUp: 2.8,
    beg: 2.1,
    paw: 2.4,
    spin: 1.2,
    blendIn: 0.28,
    blendOut: 0.35,
    /** Moving cuts a trick short: he's back on his feet this fast (s). */
    cancelOut: 0.18,
    /** He loves doing tricks. */
    tailWag: 0.95,
    /** Standing on his hind legs needs this much space above his feet (m). */
    begHeadroom: 0.62,
  },
  /** Glancing at something interesting (see AttentionSystem): how far his head may turn and tip (radians). */
  lookMaxPitch: 0.35,
  /** When he first notices something while standing still, sometimes a curious head tilt. */
  noticeTiltChance: 0.3,
  /**
   * Personality when left alone: after standing still this long (s) he sits down, sometimes stretching first
   * (a play bow). Any movement, trick, sniff or rest cancels it straight away.
   */
  idleSitAfter: 8,
  idleStretchChance: 0.4,
  stretchDuration: 1.5,
  /** Responsiveness of sitting down / hopping back up (per second). */
  sitDownRate: 4,
  standUpRate: 14,
  /** Responsiveness of lying down / getting up (per second). */
  lieDownRate: 4,
  getUpRate: 9,
  /** Start ducking when the space above Moke's feet is below this (m): a little above the top of his fluffy head. */
  duckBelowHeadroom: MOKE_CHARACTER.size.headTop + 0.02,
  /** Headroom range over which he goes from standing to fully ducked (m). */
  duckRange: 0.08,
} as const;
