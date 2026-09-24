import { describe, expect, it } from 'vitest';
import type { Vec3Like } from '../physics/CharacterBody';
import { InteractionSystem } from './InteractionSystem';
import { PickupSystem, type Carryable } from './PickupSystem';

class FakeItem implements Carryable {
  readonly position: Vec3Like;
  carried = false;
  dropped: { at: Vec3Like; heading: number; velocity: Vec3Like } | null = null;
  constructor(
    readonly id: string,
    readonly name: string,
    x: number,
    z: number,
  ) {
    this.position = { x, y: 0, z };
  }
  pickUp(): void {
    this.carried = true;
  }
  drop(at: Vec3Like, heading: number, velocity: Vec3Like): void {
    this.carried = false;
    this.position.x = at.x;
    this.position.y = at.y;
    this.position.z = at.z;
    this.dropped = { at: { ...at }, heading, velocity: { ...velocity } };
  }
}

const TUNING = { reach: 0.5, dropForward: 0.25, dropHeight: 0.2, dropWallGap: 0.05, dropCarryVelocity: 0.5 };

function setup(probe: ((o: Vec3Like, d: Vec3Like, max: number) => number) | null = null) {
  const interactions = new InteractionSystem();
  // Moke at the origin facing +z, trotting at 2 m/s.
  const moke = { position: { x: 0, y: 0, z: 0 }, heading: 0, actualSpeed: 2 };
  const pickup = new PickupSystem<FakeItem>(interactions, moke, probe, TUNING);
  const sock = new FakeItem('sock', 'Sock', 0, 0.35);
  const ball = new FakeItem('ball', 'Ball', 0.1, 0.4);
  pickup.add(sock);
  pickup.add(ball);
  return { interactions, moke, pickup, sock, ball };
}

describe('PickupSystem', () => {
  it('offers "Pick Up" for the item in front of him and picks it up with E', () => {
    const { interactions, moke, pickup, sock } = setup();
    expect(interactions.update(moke)?.label).toBe('Pick Up Sock');
    const events: string[] = [];
    pickup.onPickUp = (item) => events.push(`up:${item.id}`);
    interactions.interact();
    expect(pickup.carried).toBe(sock);
    expect(sock.carried).toBe(true);
    expect(events).toEqual(['up:sock']);
  });

  it('offers only "Drop" while carrying, wherever he goes', () => {
    const { interactions, moke, pickup, sock } = setup();
    pickup.pickUp(sock);
    moke.position.x = 3;
    moke.heading = Math.PI;
    expect(interactions.update(moke)?.label).toBe('Drop Sock');
    expect(pickup.pickUp(sock)).toBe(false);
  });

  it('drops the item just ahead of his mouth, keeping some of his momentum', () => {
    const { interactions, moke, pickup, sock } = setup();
    pickup.pickUp(sock);
    moke.position.x = 1;
    moke.heading = Math.PI / 2; // facing +x
    interactions.update(moke);
    interactions.interact();
    expect(pickup.carried).toBeNull();
    const d = sock.dropped!;
    expect(d.at.x).toBeCloseTo(1.25);
    expect(d.at.y).toBeCloseTo(0.2);
    expect(d.at.z).toBeCloseTo(0);
    expect(d.heading).toBeCloseTo(Math.PI / 2);
    expect(d.velocity.x).toBeCloseTo(1);
    // Back on the floor and can be picked up again.
    expect(interactions.update(moke)?.label).toBe('Pick Up Sock');
  });

  it('keeps a dropped item out of a wall right in front of him', () => {
    const { pickup, sock } = setup(() => 0.15); // wall 0.15 m ahead
    pickup.pickUp(sock);
    pickup.drop();
    expect(sock.dropped!.at.z).toBeCloseTo(0.1);
  });

  it('does nothing when dropping with an empty mouth', () => {
    const { pickup } = setup();
    expect(pickup.drop()).toBeNull();
  });
});
