import { Quaternion, Vector3, type Object3D } from 'three';
import type { PropDefinition } from '../config/props';
import type { Carryable } from '../interactions/PickupSystem';
import type { Vec3Like } from '../physics/CharacterBody';
import type { PropBody } from '../physics/PropBody';

const UP = new Vector3(0, 1, 0);
/** Anything further than this from the room, or below the floor, has escaped and goes home. */
const ESCAPE = { belowY: -1, radius: 15 };

/**
 * A loose prop in the world: a physics body plus its view. The view follows the body, smoothed
 * between physics steps, except while it rides in Moke's mouth. It implements Carryable, so the
 * PickupSystem can carry it without knowing what it is.
 */
export class Prop implements Carryable {
  readonly id: string;
  readonly name: string;
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
  ) {
    this.id = definition.id;
    this.name = definition.name;
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

  /** After each physics step. */
  afterStep(): void {
    if (this.carriedNow) return;
    this.previous.copy(this.current);
    this.previousRotation.copy(this.currentRotation);
    this.body.sync();
    const p = this.body.position;
    if (p.y < ESCAPE.belowY || Math.hypot(p.x, p.z) > ESCAPE.radius) {
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
