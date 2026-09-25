/**
 * Third-person camera feel. Safe to tweak; in dev builds also live from the browser console via
 * `tuning.camera` (e.g. `tuning.camera.defaultDistance = 1.8`).
 *
 * Units: metres, seconds, radians, degrees for field of view.
 * "Smoothing" values are responsiveness per second: ~4 is lazy, ~15 is snappy.
 */
import { MOKE_CHARACTER } from './mokeCharacter';
export interface CameraTuning {
  fov: number;
  /** Extra field of view at full speed, for a sense of speed (degrees). */
  runFovBoost: number;
  /** Speed at which the full boost applies (m/s). */
  fovFullSpeed: number;

  defaultDistance: number;
  /** Mouse-wheel zoom range. */
  minDistance: number;
  maxDistance: number;
  /** Each wheel notch multiplies the distance by this. */
  zoomFactorPerStep: number;

  /** Height above Moke's feet that the camera orbits around (about his head). */
  pivotHeight: number;
  /** Lowest the pivot may go when ducking under furniture. */
  minPivotHeight: number;
  /** Aim this far above the pivot, so Moke sits a little low in frame and you see more room. */
  lookAbove: number;

  defaultPitch: number;
  /** Negative = camera below his head, looking up at the towering furniture. */
  minPitch: number;
  maxPitch: number;

  rotationSmoothing: number;
  followSmoothing: number;
  followSmoothingVertical: number;

  /** Radius of the sphere swept from Moke to the camera to find walls and furniture. */
  collisionRadius: number;
  /** If walls force the camera closer than this to Moke's head, hide him rather than show his insides. */
  hideTargetDistance: number;
  /** How gently the camera drifts back out after an obstacle clears (it always pulls in instantly). */
  distanceEaseOut: number;

  /** Gap kept under low ceilings (table tops). */
  ceilingClearance: number;
  ceilingSmoothing: number;

  /** When the normal camera spot has less room than this (Moke backed into a wall), lift up and over him... */
  closeDistance: number;
  /** ...up to this pitch when fully squeezed (about 80°: looking down over him). */
  squeezeMaxPitch: number;
  raiseSmoothing: number;

  /**
   * "Whiskers": when squeezed and the mouse is idle, probe these yaw offsets to either side (radians,
   * smallest first) and drift toward open space. Walls then push the camera round to a side view.
   */
  avoidance: {
    angles: number[];
    /** Drift rate toward the open side (per second). */
    rate: number;
    delayAfterMouse: number;
    /** Only move if a side has at least this much more room (m). */
    minGain: number;
  };

  /** While Moke moves and the mouse is idle, gently swing the camera around behind him. */
  autoFollow: {
    /** 0 disables. Swing rate per (m/s of Moke's speed). */
    strength: number;
    delayAfterMouse: number;
    minSpeed: number;
    /** Don't swing when he's running more or less at the camera (it would flip what "back" means mid-run). */
    maxAngle: number;
  };

  /** Slow orbit behind the start menu. */
  attract: { distance: number; pitch: number; spinSpeed: number };

  /**
   * While Moke lies in his bed: the pivot drops with him (m), the camera settles a little closer (× distance)
   * and looks down into the bed at least this steeply (rad), so the bolster never fills the view.
   */
  rest: { pivotDrop: number; distanceScale: number; minPitch: number };
}

export const CAMERA: CameraTuning = {
  fov: 55,
  runFovBoost: 6,
  fovFullSpeed: 4,

  defaultDistance: 1.35,
  minDistance: 0.7,
  maxDistance: 2.6,
  zoomFactorPerStep: 1.12,

  /** A little above his eyes (MOKE_CHARACTER.size.eyeHeight), so the view skims over his head. */
  pivotHeight: MOKE_CHARACTER.size.eyeHeight + 0.03,
  minPivotHeight: 0.14,
  lookAbove: 0.06,

  defaultPitch: 0.2,
  minPitch: -0.15,
  maxPitch: 1.1,

  rotationSmoothing: 20,
  followSmoothing: 12,
  followSmoothingVertical: 8,

  collisionRadius: 0.1,
  hideTargetDistance: 0.22,
  distanceEaseOut: 3.5,

  ceilingClearance: 0.03,
  ceilingSmoothing: 10,

  closeDistance: 0.7,
  squeezeMaxPitch: 1.4,
  raiseSmoothing: 5,

  avoidance: { angles: [0.5, 1.0, 1.5], rate: 2.5, delayAfterMouse: 1.0, minGain: 0.1 },

  autoFollow: { strength: 0.35, delayAfterMouse: 1.5, minSpeed: 0.5, maxAngle: 1.9 },

  attract: { distance: 1.9, pitch: 0.2, spinSpeed: 0.07 },

  rest: { pivotDrop: 0.08, distanceScale: 0.85, minPitch: 0.42 },
};
