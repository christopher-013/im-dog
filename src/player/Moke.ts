import { Vector3 } from 'three';
import { MOKE_CHARACTER } from '../config/mokeCharacter';
import type { Vec3Like } from '../physics/CharacterBody';
import { wrapAngle } from '../utils/math';
import type { MoveIntent } from './Locomotion';
import { MokeAnimationController } from './MokeAnimationController';
import type { MokeController } from './MokeController';
import type { MokeVisual } from './MokeVisual';

/**
 * Ties the player dog's gameplay controller to whatever visual they currently have. Named after the first dog, it
 * is every playable dog (D29): Moke and Dougie share the controller, the animation state and all gameplay; only the
 * visual differs, and `setVisual` changes it (Choose Your Dog).
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
  private readonly shift = { x: 0, z: 0 };

  private current: MokeVisual;

  constructor(
    readonly controller: MokeController,
    visual: MokeVisual,
  ) {
    this.current = visual;
    this.animation = new MokeAnimationController(controller.tuning);
    this.update(0, 1);
  }

  get visual(): MokeVisual {
    return this.current;
  }

  /**
   * A different look for the same dog body (another dog chosen): the new visual takes the old one's place in the
   * scene, posed where the body is, and the old one is disposed. Everything else reads `visual` when it needs it,
   * so nothing else has to change. Only done before play starts (Choose Your Dog), when nothing is in his mouth.
   */
  setVisual(visual: MokeVisual): void {
    const old = this.current;
    if (visual === old) return;
    const parent = old.object.parent;
    this.current = visual;
    if (parent) parent.add(visual.object);
    old.dispose();
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
    // Drawn a touch off his body where his nose or tail would otherwise be inside a wall (MokeController).
    const shift = c.interpolatedShift(alpha, this.shift);
    this.visual.object.position.set(this.renderPosition.x + shift.x, this.renderPosition.y, this.renderPosition.z + shift.z);
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
