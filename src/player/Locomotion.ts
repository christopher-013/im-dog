import type { MovementTuning } from '../config/movement';
import { angleDelta, clamp, lerp, moveToward, smoothstep, wrapAngle } from '../utils/math';

export type Gait = 'idle' | 'walk' | 'trot' | 'run';

/** What the player is asking for, in world space. Direction magnitude is 0..1. */
export interface MoveIntent {
  x: number;
  z: number;
  walk: boolean;
  run: boolean;
}

export interface LocomotionState {
  /** Speed along the heading (m/s). Never negative: Moke turns around, he doesn't moonwalk. */
  speed: number;
  /** Facing angle (radians). 0 faces +z, π/2 faces +x. */
  heading: number;
  /** Heading change during the last step (rad/s). Positive = turning left. */
  turnRate: number;
  /** Speed Moke was aiming for during the last step (m/s). */
  targetSpeed: number;
}

export function createLocomotionState(heading = 0): LocomotionState {
  return { speed: 0, heading, turnRate: 0, targetSpeed: 0 };
}

/**
 * One fixed step of dog-style movement. Moke always travels the way he faces:
 * - he turns toward the requested direction at a limited rate (quick when standing, wider arcs at a run);
 * - the further he still has to turn, the less speed he aims for, so a reversal becomes
 *   "brake, pivot, go" rather than an instant 180 or a backwards slide;
 * - speed eases up and down with separate acceleration, coasting and braking rates.
 */
export function stepLocomotion(state: LocomotionState, intent: MoveIntent, tuning: MovementTuning, dt: number): void {
  const amount = Math.min(1, Math.hypot(intent.x, intent.z));
  const hasInput = amount > 1e-3;

  let target = 0;
  let alignment = 1;
  state.turnRate = 0;

  if (hasInput) {
    const desired = Math.atan2(intent.x, intent.z);
    const diff = angleDelta(state.heading, desired);
    const runT = clamp(state.speed / tuning.runSpeed, 0, 1);
    const maxTurn = lerp(tuning.turnSpeedStanding, tuning.turnSpeedRunning, runT) * dt;
    const turn = clamp(diff, -maxTurn, maxTurn);
    state.heading = wrapAngle(state.heading + turn);
    state.turnRate = turn / dt;

    const stillToTurn = Math.abs(diff - turn);
    alignment = 1 - smoothstep(tuning.fullSpeedTurnAngle, tuning.stopToTurnAngle, stillToTurn);
    const gaitSpeed = intent.run ? tuning.runSpeed : intent.walk ? tuning.walkSpeed : tuning.trotSpeed;
    target = gaitSpeed * amount * alignment;
  }

  let rate: number;
  if (target > state.speed) rate = tuning.acceleration;
  else if (hasInput && alignment < 0.98) rate = tuning.brakeDeceleration;
  else rate = tuning.deceleration;

  state.speed = moveToward(state.speed, target, rate * tuning.groundFriction * dt);
  state.targetSpeed = target;
}

export function gaitForSpeed(speed: number, tuning: MovementTuning): Gait {
  if (speed < tuning.idleSpeed) return 'idle';
  if (speed < (tuning.walkSpeed + tuning.trotSpeed) / 2) return 'walk';
  if (speed < (tuning.trotSpeed + tuning.runSpeed) / 2) return 'trot';
  return 'run';
}
