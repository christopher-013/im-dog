import { Vector3 } from 'three';
import { TV_CLOSE_UP } from '../config/camera';

/** A TV screen: the middle of the picture, which way it faces into the room, and its size (m). */
export interface CloseUpScreen {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly facing: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The close-up on a TV while Moke watches the game (Phase 5): straight on to the screen, just far enough back for the
 * picture to fill `TV_CLOSE_UP.fill` of the view, whichever way the window is shaped (a wide desktop or a phone held
 * upright). Writes the camera's position into `position` and where it looks into `look`; returns the distance.
 */
export function tvCloseUp(screen: CloseUpScreen, aspect: number, verticalFovDeg: number, position: Vector3, look: Vector3, tuning = TV_CLOSE_UP): number {
  const halfV = (verticalFovDeg * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const fill = tuning.fill;
  const distance = Math.min(tuning.maxDistance, Math.max(
    tuning.minDistance,
    screen.width / 2 / (Math.tan(halfH) * fill),
    screen.height / 2 / (Math.tan(halfV) * fill),
  ));
  look.set(screen.x, screen.y, screen.z);
  position.set(screen.x + Math.sin(screen.facing) * distance, screen.y, screen.z + Math.cos(screen.facing) * distance);
  return distance;
}
