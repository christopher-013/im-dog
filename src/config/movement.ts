/**
 * Moke's movement feel. Everything here is safe to tweak; in dev builds you can also change it
 * live from the browser console via `tuning.movement` (e.g. `tuning.movement.runSpeed = 5`).
 *
 * Units: metres, seconds, radians.
 */
export interface MovementTuning {
  /** Slow exploration (hold C). */
  walkSpeed: number;
  /** Default comfortable gait. */
  trotSpeed: number;
  /** Hold Shift. */
  runSpeed: number;
  /** Speeding up (m/s²). */
  acceleration: number;
  /** Coasting to a stop after letting go of the keys (m/s²). */
  deceleration: number;
  /** Braking when asked to turn sharply or reverse (m/s²). */
  brakeDeceleration: number;
  /** Multiplies acceleration and deceleration. Below 1 feels slippery; meant to vary by floor type later. */
  groundFriction: number;
  /** How fast Moke can turn when standing still (rad/s). A small dog pivots quickly. */
  turnSpeedStanding: number;
  /** How fast Moke can turn at full run (rad/s). Lower means wider, more natural arcs. */
  turnSpeedRunning: number;
  /** Still facing this far away from the requested direction: full speed. */
  fullSpeedTurnAngle: number;
  /** Still facing this far away or more: stop and turn first (no instant 180s, no backwards sliding). */
  stopToTurnAngle: number;
  /** Below this speed Moke counts as standing still (m/s). */
  idleSpeed: number;
  gravity: number;
}

export const MOVEMENT: MovementTuning = {
  walkSpeed: 0.8,
  trotSpeed: 1.8,
  runSpeed: 4.0,
  acceleration: 9,
  deceleration: 11,
  brakeDeceleration: 20,
  groundFriction: 1,
  turnSpeedStanding: 10,
  turnSpeedRunning: 4.5,
  fullSpeedTurnAngle: 0.5,
  stopToTurnAngle: 1.9,
  idleSpeed: 0.05,
  gravity: 9.81,
};

/**
 * Jumping (Space, controller B, the touch JUMP button). The height cap is measured from the floor, not from
 * where he jumps, so the couch seat and the coffee table (0.45 m) are the highest places he can get to: never
 * the TV console (0.56 m), the couch arms (0.64 m) or its back (0.88 m), however he chains his jumps.
 */
export const JUMP = {
  /**
   * Highest his feet can rise, in metres above the floor: clears 0.45 m surfaces with room to spare and stays
   * well short of 0.56 m ones (Rapier tests pin both). In the air he can't slide up over an edge either
   * (CharacterBody's noClimbing), so this really is the limit.
   */
  maxHeight: 0.5,
  /** Gravity for Moke while he's in the air (m/s²): stronger than real, so a hop is snappy, not floaty. */
  gravity: 18,
  /** No jump if this is all the rise the cap leaves (m), e.g. already up on the couch. */
  minRise: 0.02,
  /** A press this long before he lands still counts (s). */
  buffer: 0.1,
} as const;

export type JumpTuning = { readonly [K in keyof typeof JUMP]: number };

/**
 * Moke's collision body: a small upright capsule. It's deliberately under the 0.40 m clearance
 * of the coffee table so he can walk underneath. The visual's nose and tail poke slightly past it.
 */
export const MOKE_BODY = {
  radius: 0.17,
  halfHeight: 0.01,
  /** Gap the character controller keeps from surfaces (m). */
  skin: 0.01,
  /** Rough weight of a small Maltipoo (kg). Used when he bumps into toys later. */
  mass: 5,
  maxSlopeClimb: Math.PI / 4,
  /**
   * Coming down on the edge of the couch or table with his middle over thin air, he slides off rather than
   * balancing on the corner. (He only falls when there's nothing under his middle, so flat floors are unaffected.)
   */
  minSlopeSlide: 0.05,
  snapToGround: 0.1,
  /** Pushes the ball and toy along (see CharacterBody). Slightly inside the capsule, so it never snags on walls. */
  toyBumper: { radius: 0.155, halfHeight: 0.06, centerAboveFeet: 0.07 },
} as const;
