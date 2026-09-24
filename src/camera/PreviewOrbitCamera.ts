import { Vector3, type PerspectiveCamera } from 'three';
import { MOUSE } from '../config/input';
import type { Vec2Like } from '../core/InputState';
import { clamp, damp } from '../utils/math';

const ATTRACT = { distance: 1.9, pitch: 0.2, spinSpeed: 0.07 };
const LOOK = { distance: 1.45, minPitch: -0.12, maxPitch: 1.15 };
const SMOOTHING = { rotation: 16, distance: 3, followHorizontal: 16, followVertical: 8 };

export type PreviewCameraMode = 'attract' | 'look';

/**
 * TEMPORARY until Milestone 3's ThirdPersonCamera. Orbits Moke at dog height and follows him
 * with light smoothing: 'attract' slowly circles behind the start menu, 'look' follows the mouse.
 * No camera collision yet, so it can clip through walls and furniture.
 */
export class PreviewOrbitCamera {
  mode: PreviewCameraMode = 'attract';

  private currentYaw = 0.5;
  private pitch = ATTRACT.pitch;
  private distance = ATTRACT.distance;
  private targetYaw = this.currentYaw;
  private targetPitch = this.pitch;
  private readonly pivot = new Vector3();

  constructor(
    private readonly camera: PerspectiveCamera,
    initialTarget: Vector3,
  ) {
    this.pivot.copy(initialTarget);
    this.update(0, { x: 0, y: 0 }, initialTarget);
  }

  /** Horizontal viewing angle; movement input is relative to this. */
  get yaw(): number {
    return this.currentYaw;
  }

  update(dt: number, look: Vec2Like, target: Vector3): void {
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

    this.currentYaw = damp(this.currentYaw, this.targetYaw, SMOOTHING.rotation, dt);
    this.pitch = damp(this.pitch, this.targetPitch, SMOOTHING.rotation, dt);
    this.distance = damp(this.distance, targetDistance, SMOOTHING.distance, dt);

    this.pivot.x = damp(this.pivot.x, target.x, SMOOTHING.followHorizontal, dt);
    this.pivot.y = damp(this.pivot.y, target.y, SMOOTHING.followVertical, dt);
    this.pivot.z = damp(this.pivot.z, target.z, SMOOTHING.followHorizontal, dt);
    if (dt === 0) this.pivot.copy(target);

    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.pivot.x + Math.sin(this.currentYaw) * horizontal,
      this.pivot.y + Math.sin(this.pitch) * this.distance,
      this.pivot.z + Math.cos(this.currentYaw) * horizontal,
    );
    this.camera.lookAt(this.pivot);
  }

  debugInfo(): Record<string, string> {
    const deg = (rad: number) => `${((rad * 180) / Math.PI).toFixed(1)}°`;
    return {
      mode: this.mode,
      yaw: deg(this.currentYaw),
      pitch: deg(this.pitch),
      distance: `${this.distance.toFixed(2)} m`,
      height: `${this.camera.position.y.toFixed(2)} m`,
    };
  }
}
