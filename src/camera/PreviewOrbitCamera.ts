import type { PerspectiveCamera, Vector3 } from 'three';
import { MOUSE } from '../config/input';
import type { Vec2Like } from '../core/InputState';
import { clamp, damp } from '../utils/math';

const ATTRACT = { distance: 1.9, pitch: 0.2, spinSpeed: 0.07 };
const LOOK = { distance: 1.45, minPitch: -0.12, maxPitch: 1.15 };
const SMOOTHING = { rotation: 16, distance: 3 };

export type PreviewCameraMode = 'attract' | 'look';

/**
 * TEMPORARY (Milestone 1). Orbits the spot where Moke will stand, at dog height, so we can
 * judge scale, lighting and mouse input before Moke exists. 'attract' slowly circles behind
 * the start menu; 'look' follows the mouse. Replaced by ThirdPersonCamera in Milestone 3.
 */
export class PreviewOrbitCamera {
  mode: PreviewCameraMode = 'attract';

  private yaw = 0.5;
  private pitch = ATTRACT.pitch;
  private distance = ATTRACT.distance;
  private targetYaw = this.yaw;
  private targetPitch = this.pitch;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly pivot: Vector3,
  ) {
    this.update(0, { x: 0, y: 0 });
  }

  update(dt: number, look: Vec2Like): void {
    let targetDistance: number;
    if (this.mode === 'attract') {
      this.targetYaw += ATTRACT.spinSpeed * dt;
      this.targetPitch = ATTRACT.pitch;
      targetDistance = ATTRACT.distance;
    } else {
      // Mouse right turns the view right; mouse down looks down (camera rises).
      this.targetYaw -= look.x * MOUSE.sensitivity;
      const pitchDelta = look.y * MOUSE.sensitivity * (MOUSE.invertY ? -1 : 1);
      this.targetPitch = clamp(this.targetPitch + pitchDelta, LOOK.minPitch, LOOK.maxPitch);
      targetDistance = LOOK.distance;
    }

    this.yaw = damp(this.yaw, this.targetYaw, SMOOTHING.rotation, dt);
    this.pitch = damp(this.pitch, this.targetPitch, SMOOTHING.rotation, dt);
    this.distance = damp(this.distance, targetDistance, SMOOTHING.distance, dt);

    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.pivot.x + Math.sin(this.yaw) * horizontal,
      this.pivot.y + Math.sin(this.pitch) * this.distance,
      this.pivot.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.pivot);
  }

  debugInfo(): Record<string, string> {
    const deg = (rad: number) => `${((rad * 180) / Math.PI).toFixed(1)}°`;
    return {
      mode: this.mode,
      yaw: deg(this.yaw),
      pitch: deg(this.pitch),
      distance: `${this.distance.toFixed(2)} m`,
      height: `${this.camera.position.y.toFixed(2)} m`,
    };
  }
}
