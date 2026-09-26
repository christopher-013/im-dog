import { HUMAN } from '../../config/human';
import type { Vec3Like } from '../../physics/CharacterBody';
import type { HumanIntent } from '../HumanBrain';
import type { HumanPose } from '../HumanRig';

/** Small helpers for roles (dog activities driving the human): write the whole intent in one call. */

/** Walk somewhere (getting up first if they're sitting). */
export function walkTo(intent: HumanIntent, to: Vec3Like, speed: number = HUMAN.move.walkSpeed, within = 0.2): void {
  intent.goal = to;
  intent.speed = speed;
  intent.stopWithin = within;
  intent.face = null;
  intent.seat = null;
  intent.pose = 'idle';
  intent.crouch = 0;
  intent.prop = null;
}

/** Stay put, doing `pose`, facing `face` (if given), crouched `crouch`, eyes on `look`. */
export function hold(intent: HumanIntent, pose: HumanPose, face: Vec3Like | null = null, crouch = 0, look: Vec3Like | null = null): void {
  intent.goal = null;
  intent.speed = 0;
  intent.face = face;
  intent.seat = null;
  intent.pose = pose;
  intent.crouch = crouch;
  intent.prop = null;
  intent.lookAt = look;
}

export const flatDistance = (a: Vec3Like, b: Vec3Like): number => Math.hypot(a.x - b.x, a.z - b.z);
