import { Vector3, type PerspectiveCamera } from 'three';
import { CAMERA, type CameraTuning } from '../config/camera';
import { MOUSE } from '../config/input';
import { angleDelta, clamp, damp } from '../utils/math';

/** What the camera follows. */
export interface CameraTarget {
  /** Feet position, interpolated for this frame. */
  position: Vector3;
  /** Facing (radians, 0 = +z). */
  heading: number;
  /** Ground speed (m/s). */
  speed: number;
  /** Free space above the feet (m); Infinity when nothing low is overhead. */
  headroom: number;
}

/** Player input for this frame: mouse movement in pixels, wheel notches (positive = zoom out). */
export interface CameraInput {
  lookX: number;
  lookY: number;
  zoom: number;
}

/** Collision queries the camera needs. PhysicsWorld implements this; tests use a fake. */
export interface CameraCollider {
  /** Free distance a sphere can travel from `origin` along unit `direction`, up to `maxDistance`. */
  sweepSphere(origin: Vector3, direction: Vector3, radius: number, maxDistance: number): number;
}

export type CameraMode = 'attract' | 'follow';

/**
 * Moke's third-person camera: a low, close orbit around his head that the mouse controls.
 * - Follows smoothly, never rigidly parented, and drifts behind him while he runs and the mouse is idle.
 * - A swept sphere keeps it out of walls and furniture: it pulls in instantly and eases back out.
 * - Under low furniture it flattens out to stay underneath. When he backs into something, it lifts up and over him.
 */
export class ThirdPersonCamera {
  mode: CameraMode = 'attract';
  collider: CameraCollider | null = null;

  private yawTarget = 0;
  private pitchTarget: number;
  private currentYaw = 0;
  private currentPitch: number;
  private desiredDistance: number;
  private currentDistance: number;
  private freeDistance = Infinity;
  private raise = 0;
  private ceilingPitchLimit: number;
  private fov: number;
  private sinceMouse = Infinity;
  private manualYaw = 0;

  private readonly pivot = new Vector3();
  private readonly direction = new Vector3();
  private readonly lookTarget = new Vector3();

  constructor(
    readonly camera: PerspectiveCamera,
    target: CameraTarget,
    private readonly tuning: CameraTuning = CAMERA,
  ) {
    this.pitchTarget = this.currentPitch = tuning.defaultPitch;
    this.desiredDistance = tuning.defaultDistance;
    this.currentDistance = tuning.attract.distance;
    this.ceilingPitchLimit = Math.PI / 2;
    this.fov = tuning.fov;
    this.snapBehind(target);
  }

  /** Horizontal viewing angle. Movement input is relative to this. */
  get yaw(): number {
    return this.currentYaw;
  }

  /** Yaw the player has turned with the mouse since the last call (automatic camera motion excluded). */
  takeManualYawDelta(): number {
    const delta = this.manualYaw;
    this.manualYaw = 0;
    return delta;
  }

  /** Swing (smoothly, the short way round) to behind the target at the default pitch, e.g. when play starts. */
  recenterBehind(target: CameraTarget): void {
    this.yawTarget = this.currentYaw + angleDelta(this.currentYaw, target.heading + Math.PI);
    this.pitchTarget = this.tuning.defaultPitch;
  }

  /** Jump straight to a spot behind the target (spawn, teleports). */
  snapBehind(target: CameraTarget): void {
    this.yawTarget = this.currentYaw = target.heading + Math.PI;
    this.pivot.copy(target.position);
    this.pivot.y += this.tuning.pivotHeight;
    this.update(0, { lookX: 0, lookY: 0, zoom: 0 }, target);
  }

  update(dt: number, input: CameraInput, target: CameraTarget): void {
    const t = this.tuning;
    let wantedDistance: number;

    // 1. Orbit: mouse (or the slow menu spin), zoom, and the lazy swing behind Moke.
    if (this.mode === 'attract') {
      this.yawTarget += t.attract.spinSpeed * dt;
      this.pitchTarget = t.attract.pitch;
      wantedDistance = t.attract.distance;
    } else {
      const sensitivity = MOUSE.sensitivity * MOUSE.sensitivityScale;
      this.sinceMouse = input.lookX !== 0 || input.lookY !== 0 ? 0 : this.sinceMouse + dt;
      // Mouse right turns the view right; mouse down looks down (the camera rises).
      const yawInput = -input.lookX * sensitivity;
      this.yawTarget += yawInput;
      this.manualYaw += yawInput;
      this.pitchTarget = clamp(
        this.pitchTarget + input.lookY * sensitivity * (MOUSE.invertY ? -1 : 1),
        t.minPitch,
        t.maxPitch,
      );
      this.desiredDistance = clamp(
        this.desiredDistance * Math.pow(t.zoomFactorPerStep, input.zoom),
        t.minDistance,
        t.maxDistance,
      );
      this.swingBehind(dt, target);
      wantedDistance = this.desiredDistance;
    }
    this.currentYaw = damp(this.currentYaw, this.yawTarget, t.rotationSmoothing, dt);
    this.currentPitch = damp(this.currentPitch, this.pitchTarget, t.rotationSmoothing, dt);

    // 2. Follow Moke's head, but keep the pivot under low ceilings (the coffee table).
    const pivotHeight = clamp(target.headroom - t.collisionRadius - t.ceilingClearance, t.minPivotHeight, t.pivotHeight);
    const p = target.position;
    this.pivot.x = damp(this.pivot.x, p.x, t.followSmoothing, dt);
    this.pivot.y = damp(this.pivot.y, p.y + pivotHeight, t.followSmoothingVertical, dt);
    this.pivot.z = damp(this.pivot.z, p.z, t.followSmoothing, dt);
    if (dt === 0) this.pivot.set(p.x, p.y + pivotHeight, p.z);

    // 3. Under something low, flatten the orbit so the camera stays underneath with him.
    const ceilingY = p.y + target.headroom;
    const room = ceilingY - t.ceilingClearance - t.collisionRadius - this.pivot.y;
    const ceilingLimit = room >= wantedDistance ? Math.PI / 2 : Math.asin(clamp(room / wantedDistance, -1, 1));
    this.ceilingPitchLimit = dt === 0 ? ceilingLimit : damp(this.ceilingPitchLimit, ceilingLimit, t.ceilingSmoothing, dt);

    // 4. Squeezed from behind (Moke backed into something): lift up and over him. The lift is based on
    //    the room at the *natural* angle, not on the result, so it can't feed back into itself and wobble.
    const naturalPitch = Math.min(this.currentPitch, this.ceilingPitchLimit);
    const naturalFree = this.sweep(naturalPitch, wantedDistance);
    this.avoidWalls(dt, naturalPitch, wantedDistance, naturalFree);
    const squeeze = clamp((t.closeDistance - naturalFree) / t.closeDistance, 0, 1);
    const raiseTarget = squeeze * Math.max(0, t.squeezeMaxPitch - this.currentPitch);
    this.raise = dt === 0 ? raiseTarget : damp(this.raise, raiseTarget, t.raiseSmoothing, dt);
    const pitch = Math.min(this.currentPitch + this.raise, this.ceilingPitchLimit);

    // 5. Collision: the final spot is wherever a small sphere swept from the pivot first touches something.
    this.freeDistance = this.raise > 1e-3 ? this.sweep(pitch, wantedDistance) : naturalFree;
    // Walls always win: pull in instantly (never show the inside of a wall); ease back out gently.
    const allowed = Math.max(0.02, this.freeDistance);
    this.currentDistance =
      allowed < this.currentDistance || dt === 0 ? allowed : damp(this.currentDistance, allowed, t.distanceEaseOut, dt);
    this.setDirection(pitch);

    // 6. Place and aim.
    this.camera.position.copy(this.pivot).addScaledVector(this.direction, this.currentDistance);
    this.lookTarget.copy(this.pivot);
    this.lookTarget.y += t.lookAbove;
    this.camera.lookAt(this.lookTarget);

    // 7. A touch wider at speed.
    const fovTarget = t.fov + t.runFovBoost * clamp(target.speed / t.fovFullSpeed, 0, 1);
    this.fov = dt === 0 ? fovTarget : damp(this.fov, fovTarget, 4, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * True when walls have forced the camera right up against Moke's head. The owner should hide
   * him for that moment rather than render the inside of his fluff.
   */
  get isInsideTarget(): boolean {
    return this.currentDistance < this.tuning.hideTargetDistance;
  }

  private setDirection(pitch: number, yaw = this.currentYaw): void {
    const cosPitch = Math.cos(pitch);
    this.direction.set(Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch);
  }

  /** Free distance from the pivot toward the camera at this pitch and yaw. */
  private sweep(pitch: number, maxDistance: number, yaw = this.currentYaw): number {
    if (!this.collider) return maxDistance;
    this.setDirection(pitch, yaw);
    return this.collider.sweepSphere(this.pivot, this.direction, this.tuning.collisionRadius, maxDistance);
  }

  /**
   * Whiskers: when squeezed and the player isn't steering the camera, look a little to each side
   * (smallest angles first) and drift toward the first side with enough room, or else the roomiest one.
   */
  private avoidWalls(dt: number, pitch: number, wantedDistance: number, naturalFree: number): void {
    const t = this.tuning;
    const a = t.avoidance;
    if (this.mode !== 'follow' || !this.collider || dt === 0) return;
    if (naturalFree >= t.closeDistance || this.sinceMouse < a.delayAfterMouse) return;

    let bestOffset = 0;
    let bestFree = naturalFree + a.minGain;
    for (const angle of a.angles) {
      for (const offset of [angle, -angle]) {
        const free = this.sweep(pitch, wantedDistance, this.currentYaw + offset);
        if (free > bestFree) {
          bestFree = free;
          bestOffset = offset;
        }
      }
      if (bestOffset !== 0 && bestFree >= t.closeDistance) break;
    }
    if (bestOffset !== 0) this.yawTarget += bestOffset * (1 - Math.exp(-a.rate * dt));
  }

  /** While Moke moves and the mouse is idle, drift around behind him, faster the faster he goes. */
  private swingBehind(dt: number, target: CameraTarget): void {
    const a = this.tuning.autoFollow;
    if (a.strength <= 0 || this.sinceMouse < a.delayAfterMouse || target.speed < a.minSpeed) return;
    const diff = angleDelta(this.yawTarget, target.heading + Math.PI);
    if (Math.abs(diff) > a.maxAngle) return;
    this.yawTarget += diff * (1 - Math.exp(-a.strength * target.speed * dt));
  }

  debugInfo(): Record<string, string> {
    const deg = (rad: number) => `${((rad * 180) / Math.PI).toFixed(1)}°`;
    const blocked = this.freeDistance < (this.mode === 'attract' ? this.tuning.attract.distance : this.desiredDistance) - 1e-3;
    return {
      mode: this.mode,
      yaw: deg(this.currentYaw),
      pitch: `${deg(this.currentPitch)} (+${deg(this.raise)} lift, max ${deg(this.ceilingPitchLimit)})`,
      distance: `${this.currentDistance.toFixed(2)} m (want ${this.desiredDistance.toFixed(2)})`,
      blocked: blocked ? `yes, free ${this.freeDistance.toFixed(2)} m` : 'no',
      height: `${this.camera.position.y.toFixed(2)} m`,
      fov: `${this.camera.fov.toFixed(1)}°`,
    };
  }
}
