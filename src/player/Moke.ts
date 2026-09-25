import { Vector3 } from 'three';
import { MOKE_CHARACTER } from '../config/mokeCharacter';
import type { Vec3Like } from '../physics/CharacterBody';
import { wrapAngle } from '../utils/math';
import type { MoveIntent } from './Locomotion';
import { MokeAnimationController } from './MokeAnimationController';
import type { MokeController } from './MokeController';
import type { MokeVisual } from './MokeVisual';

/**
 * Ties Moke's gameplay controller to whatever visual he currently has.
 * The rest of the game talks to `controller` (and to `visual.attachments` for carried things), never to meshes.
 */
export class Moke {
  readonly animation: MokeAnimationController;
  /** Feet position interpolated for the current rendered frame. */
  readonly renderPosition = new Vector3();
  /** Set by gameplay (the pickup system) so body language can react. */
  carrying = false;
  /** Set by gameplay (sniff mode). */
  sniffing = false;
  /** Set by gameplay (lying in his bed). */
  resting = false;
  /** Something to glance at (world position), from the AttentionSystem. Visual only. */
  lookAt: Vec3Like | null = null;
  private readonly look = { yaw: 0, pitch: 0 };

  constructor(
    readonly controller: MokeController,
    readonly visual: MokeVisual,
  ) {
    this.animation = new MokeAnimationController(controller.tuning);
    this.update(0, 1);
  }

  fixedUpdate(dt: number, intent: MoveIntent): void {
    this.controller.fixedUpdate(dt, intent);
  }

  /** Once per rendered frame: place the visual between physics steps and animate it. */
  update(dt: number, alpha: number): void {
    const c = this.controller;
    c.interpolatedPosition(alpha, this.renderPosition);
    const heading = c.interpolatedHeading(alpha);
    this.visual.object.position.copy(this.renderPosition);
    this.visual.object.rotation.y = heading;

    this.animation.update(dt, {
      speed: c.actualSpeed,
      turnRate: c.locomotion.turnRate,
      headroom: c.headroom,
      carrying: this.carrying,
      sniffing: this.sniffing,
      resting: this.resting,
      airborne: c.airborne,
      verticalSpeed: c.verticalSpeed,
      look: this.lookAt ? this.lookDirection(this.lookAt, heading) : null,
    });
    this.visual.update(dt, this.animation.state);
  }

  /** Where `target` is from his eyes, relative to his facing: yaw (positive = to his left) and pitch (up). */
  private lookDirection(target: Vec3Like, heading: number): { yaw: number; pitch: number } {
    const p = this.renderPosition;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    this.look.yaw = wrapAngle(Math.atan2(dx, dz) - heading);
    this.look.pitch = Math.atan2(target.y - (p.y + MOKE_CHARACTER.size.eyeHeight), Math.hypot(dx, dz));
    return this.look;
  }
}
