import { Quaternion, Vector3, type Object3D } from 'three';
import type { PropDefinition } from '../config/props';
import type { Carryable } from '../interactions/PickupSystem';
import type { Vec3Like } from '../physics/CharacterBody';
import type { PropBody } from '../physics/PropBody';

const UP = new Vector3(0, 1, 0);
/** Anything below the floor, or outside the house's bounds (plus this margin), has escaped and goes home. */
const ESCAPE = { belowY: -1, margin: 1 };

/** The floor area a prop belongs in (the house's outer walls). */
export interface PropBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

const ANYWHERE_NEAR: PropBounds = { minX: -15, maxX: 15, minZ: -15, maxZ: 15 };

/**
 * A loose prop in the world: a physics body plus its view. The view follows the body, smoothed
 * between physics steps, except while it rides in Moke's mouth. It implements Carryable, so the
 * PickupSystem can carry it without knowing what it is.
 */
export class Prop implements Carryable {
  readonly id: string;
  readonly name: string;
  readonly dropRadius: number;
  private carriedNow = false;
  private readonly previous = new Vector3();
  private readonly current = new Vector3();
  private readonly previousRotation = new Quaternion();
  private readonly currentRotation = new Quaternion();

  constructor(
    readonly definition: PropDefinition,
    readonly body: PropBody,
    readonly view: Object3D,
    private readonly home: Vec3Like,
    private readonly homeHeading = 0,
    private readonly bounds: PropBounds = ANYWHERE_NEAR,
  ) {
    this.id = definition.id;
    this.name = definition.name;
    const shape = definition.physics.shape;
    this.dropRadius = shape.kind === 'ball' ? shape.radius
      : shape.kind === 'capsule' ? shape.radius + shape.halfLength
      : Math.hypot(...shape.halfExtents);
    this.view.name = `Prop:${this.id}`;
    this.snapToBody();
  }

  get position(): Vec3Like {
    return this.body.position;
  }

  get carried(): boolean {
    return this.carriedNow;
  }

  pickUp(): void {
    this.carriedNow = true;
    this.body.disable();
  }

  drop(at: Vec3Like, heading: number, velocity: Vec3Like): void {
    this.carriedNow = false;
    // Let go of it the way it was held (a sock or rope lands crosswise in front of him).
    this.body.place(at, heading + this.definition.carry.turn, velocity);
    this.snapToBody();
  }

  /** Puts it back where it started (it escaped the room, or a reset). */
  returnHome(): void {
    this.body.place({ x: this.home.x, y: this.home.y + this.definition.restHeight, z: this.home.z }, this.homeHeading);
    this.snapToBody();
  }

  /** A Sock Heist replay: back where it started and loose in the world again, whoever was holding it. */
  reset(parent: Object3D): void {
    this.carriedNow = false;
    parent.add(this.view);
    this.returnHome();
  }

  /** After each physics step. */
  afterStep(): void {
    if (this.carriedNow) return;
    this.previous.copy(this.current);
    this.previousRotation.copy(this.currentRotation);
    this.body.sync();
    const p = this.body.position;
    const b = this.bounds;
    const m = ESCAPE.margin;
    if (p.y < ESCAPE.belowY || p.x < b.minX - m || p.x > b.maxX + m || p.z < b.minZ - m || p.z > b.maxZ + m) {
      this.returnHome();
      return;
    }
    this.readBody();
  }

  /** Each rendered frame: place the view between the last two steps. */
  render(alpha: number): void {
    if (this.carriedNow) return;
    this.view.position.lerpVectors(this.previous, this.current, alpha);
    this.view.quaternion.slerpQuaternions(this.previousRotation, this.currentRotation, alpha);
  }

  /** Presentation: ride in Moke's mouth socket. */
  holdIn(socket: Object3D): void {
    const { offset, turn } = this.definition.carry;
    socket.add(this.view);
    this.view.position.set(offset[0], offset[1], offset[2]);
    this.view.quaternion.setFromAxisAngle(UP, turn);
  }

  /** In someone's hand (the human, about to throw it): out of the world, riding in `hand`. */
  holdInHand(hand: Object3D): void {
    this.pickUp();
    hand.add(this.view);
    this.view.position.set(0, -0.02, 0.03);
    this.view.quaternion.identity();
  }

  /** Presentation: back into the world under `parent`. */
  release(parent: Object3D): void {
    parent.add(this.view);
    this.render(1);
  }

  private readBody(): void {
    const { position: p, rotation: r } = this.body;
    this.current.set(p.x, p.y, p.z);
    this.currentRotation.set(r.x, r.y, r.z, r.w);
  }

  private snapToBody(): void {
    this.readBody();
    this.previous.copy(this.current);
    this.previousRotation.copy(this.currentRotation);
    this.render(1);
  }
}
