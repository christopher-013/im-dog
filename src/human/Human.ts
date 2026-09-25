import { Vector3 } from 'three';
import type { Vec3Like } from '../physics/CharacterBody';
import type { ClearSight } from './HumanAwareness';
import type { HumanBrain, HumanSenses } from './HumanBrain';
import type { HumanController } from './HumanController';
import type { HumanVisual } from './ToonHumanVisual';

/** What the human needs to know about Moke and the sock each step (from gameplay, never from meshes). */
export interface HumanWorld {
  readonly moke: Vec3Like;
  readonly mokeCarryingSock: boolean;
  readonly mokeSpeed: number;
  readonly mokeUnderFurniture: boolean;
  readonly mokeBarked: boolean;
  readonly looseSock: Vec3Like | null;
  readonly clear: ClearSight;
}

/**
 * The human: behaviour (HumanBrain) + body (HumanController) + look (HumanVisual), kept apart like Moke's
 * gameplay and visuals (D7), so a modelled human could replace the toon one without touching behaviour.
 */
export class Human {
  readonly renderPosition = new Vector3();
  private readonly senses: { -readonly [K in keyof HumanSenses]: HumanSenses[K] };

  constructor(
    readonly brain: HumanBrain,
    readonly controller: HumanController,
    readonly visual: HumanVisual,
  ) {
    this.senses = {
      position: controller.position,
      heading: controller.heading,
      arrived: true,
      moke: { x: 0, y: 0, z: 0 },
      mokeCarryingSock: false,
      mokeSpeed: 0,
      mokeUnderFurniture: false,
      mokeBarked: false,
      looseSock: null,
      clear: () => true,
    };
    this.renderPosition.set(controller.position.x, controller.position.y, controller.position.z);
  }

  /** The fixed step: perceive, decide, move. */
  fixedUpdate(dt: number, world: HumanWorld): void {
    const s = this.senses;
    s.heading = this.controller.heading;
    s.arrived = this.controller.arrived;
    s.moke = world.moke;
    s.mokeCarryingSock = world.mokeCarryingSock;
    s.mokeSpeed = world.mokeSpeed;
    s.mokeUnderFurniture = world.mokeUnderFurniture;
    s.mokeBarked = world.mokeBarked;
    s.looseSock = world.looseSock;
    s.clear = world.clear;
    this.brain.update(dt, s);
    this.controller.fixedUpdate(dt, this.brain.intent);
  }

  /** Each rendered frame: place and animate the visual between fixed steps. */
  update(dt: number, alpha: number): void {
    const { heading } = this.controller.interpolated(alpha, this.renderPosition);
    const object = this.visual.object;
    object.position.copy(this.renderPosition);
    object.rotation.y = heading;
    const intent = this.brain.intent;
    this.visual.update(dt, { speed: this.controller.speed, crouch: intent.crouch, pose: intent.pose, headYaw: intent.headYaw });
  }

  /** A point just above their head (for speech bubbles), lower while kneeling. */
  headPosition(out: Vector3): Vector3 {
    return out.copy(this.renderPosition).setY(this.renderPosition.y + 1.82 - 0.45 * this.brain.intent.crouch);
  }

  /** Back home, folding laundry (Sock Heist replay). */
  reset(home: Vec3Like, facing: Vec3Like): void {
    this.brain.reset();
    this.controller.teleport(home, Math.atan2(facing.x - home.x, facing.z - home.z));
    this.renderPosition.set(home.x, this.controller.position.y, home.z);
  }
}
