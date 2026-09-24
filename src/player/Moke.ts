import { Vector3 } from 'three';
import type { MoveIntent } from './Locomotion';
import { MokeAnimationController } from './MokeAnimationController';
import type { MokeController } from './MokeController';
import type { MokeVisual } from './MokeVisual';

/**
 * Ties Moke's gameplay controller to whatever visual he currently has.
 * The rest of the game talks to `controller` (and later the mouth socket), never to meshes.
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
    this.visual.object.position.copy(this.renderPosition);
    this.visual.object.rotation.y = c.interpolatedHeading(alpha);

    this.animation.update(dt, {
      speed: c.actualSpeed,
      turnRate: c.locomotion.turnRate,
      headroom: c.headroom,
      carrying: this.carrying,
      sniffing: this.sniffing,
      resting: this.resting,
    });
    this.visual.update(dt, this.animation.state);
  }
}
