import { HUMAN } from '../config/human';
import type { Vec3Like } from '../physics/CharacterBody';
import { angleDelta } from '../utils/math';

/** True if nothing solid (walls, furniture) is between the two points. */
export type ClearSight = (from: Vec3Like, to: Vec3Like) => boolean;

type SightTuning = { readonly [K in keyof typeof HUMAN.sight]: number };

const eye: Vec3Like = { x: 0, y: 0, z: 0 };
const aim: Vec3Like = { x: 0, y: 0, z: 0 };

/**
 * Can the human see a small dog at `target` (his feet)? Simple, readable rules the player can learn:
 * - near enough (range), and
 * - inside their view (the direction they're looking, head included), and
 * - nothing solid in between (couch backs and tabletops hide a dog; so do walls);
 * - or he's right against their legs, which they always notice.
 * `eyeHeight` drops when they crouch, which is how they spot him under the coffee table.
 */
export function canSee(
  from: Vec3Like,
  viewHeading: number,
  eyeHeight: number,
  target: Vec3Like,
  clear: ClearSight,
  sight: SightTuning = HUMAN.sight,
  /** False when he's under furniture: then he isn't against their legs, whatever the distance. */
  canFeel = true,
): boolean {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const distance = Math.hypot(dx, dz);
  if (canFeel && distance <= sight.feelRange) return true;
  if (distance > sight.range) return false;
  if (Math.abs(angleDelta(viewHeading, Math.atan2(dx, dz))) > sight.halfAngle) return false;
  eye.x = from.x;
  eye.y = from.y + eyeHeight;
  eye.z = from.z;
  aim.x = target.x;
  aim.y = target.y + sight.targetHeight;
  aim.z = target.z;
  return clear(eye, aim);
}

/** Barks carry through the whole room (walls don't matter much for a yappy dog). */
export function canHear(from: Vec3Like, barkAt: Vec3Like, sight: SightTuning = HUMAN.sight): boolean {
  return Math.hypot(barkAt.x - from.x, barkAt.z - from.z) <= sight.hearingRange;
}
