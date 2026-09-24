import { describe, expect, it } from 'vitest';
import { MOKE_BODY, MOVEMENT } from '../config/movement';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { PickupSystem } from '../interactions/PickupSystem';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MokeController } from '../player/MokeController';
import { LivingRoom } from '../world/LivingRoom';
import type { Prop } from './Prop';
import { createRoomProps } from './roomProps';

// The props in the real room with real Rapier: they rest, fall, get carried and stay in the room.
const DT = 1 / 60;

async function setup() {
  const room = new LivingRoom();
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(room.colliders);
  physics.commitStaticGeometry();
  const moke = new MokeController(new CharacterBody(physics, room.spawn.position, MOKE_BODY), room.spawn.heading, { ...MOVEMENT });
  const props = createRoomProps(physics, room);
  const interactions = new InteractionSystem(undefined, (o, d, max) => physics.rayDistance(o, d, max));
  const pickup = new PickupSystem<Prop>(interactions, moke, (o, d, max, radius) => physics.sweepWorldSphere(o, d, radius, max));
  for (const p of props) pickup.add(p);
  const prop = (id: string) => props.find((p) => p.id === id)!;

  const step = (x = 0, z = 0, run = false) => {
    moke.fixedUpdate(DT, { x, z, walk: false, run });
    physics.step();
    for (const p of props) p.afterStep();
  };
  const idle = (seconds: number) => {
    for (let i = 0; i < seconds / DT; i++) step();
  };
  /** Trots toward (x, z). True if he gets within `within` metres. */
  const walkTo = (x: number, z: number, within = 0.12, maxSeconds = 8, run = false): boolean => {
    for (let i = 0; i < maxSeconds / DT; i++) {
      const dx = x - moke.position.x;
      const dz = z - moke.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < within) return true;
      const strength = Math.min(1, distance / 0.5) / distance;
      step(dx * strength, dz * strength, run);
    }
    return false;
  };
  return { room, physics, moke, props, prop, interactions, pickup, idle, walkTo, step };
}

describe('room props', () => {
  it('all props survive 30 repeated pickup/drop cycles without adding bodies or losing physics', async () => {
    const { props, physics, moke, interactions, pickup, idle } = await setup();
    const count = physics.bodyCount;
    try {
      for (const p of props) {
        for (let cycle = 0; cycle < 30; cycle++) {
          // Exercise the same action route as E, without depending on browser key-hold support.
          p.drop({ x: moke.position.x, y: 0.08, z: moke.position.z - 0.25 }, Math.PI, { x: 0, y: 0, z: 0 });
          expect(interactions.update(moke)?.id).toBe(`pickup:${p.id}`);
          expect(interactions.interact()).toBe(true);
          expect(pickup.carried).toBe(p);
          expect(p.body.enabled).toBe(false);
          expect(interactions.update(moke)?.type).toBe('DROP');
          expect(interactions.interact()).toBe(true);
          idle(0.2);
          expect(p.body.enabled).toBe(true);
          expect(p.position.y).toBeGreaterThan(-0.01);
          expect(physics.bodyCount).toBe(count);
        }
        p.returnHome();
      }
    } finally { physics.world.free(); }
  });

  it('rescues escaped props back to their original landmarks', async () => {
    const { props, physics, room } = await setup();
    try {
      for (const p of props) {
        p.drop({ x: 30, y: -2, z: 30 }, 0, { x: 0, y: 0, z: 0 });
        p.afterStep();
        const home = room.landmarks[p.definition.id];
        expect(p.position.x).toBeCloseTo(home.x);
        expect(p.position.z).toBeCloseTo(home.z);
        expect(p.body.enabled).toBe(true);
      }
    } finally { physics.world.free(); }
  });
  it('start at rest on the floor at their spots', async () => {
    const { room, prop, idle } = await setup();
    idle(1);
    const sock = prop('sock').position;
    expect(sock.y).toBeGreaterThan(0);
    expect(sock.y).toBeLessThan(0.03);
    expect(Math.hypot(sock.x - room.landmarks.sock.x, sock.z - room.landmarks.sock.z)).toBeLessThan(0.02);
  });

  it('never trips Moke on the sock: he walks straight over it', async () => {
    const { room, prop, walkTo } = await setup();
    const { sock } = room.landmarks;
    expect(walkTo(sock.x, sock.z, 0.05)).toBe(true);
    expect(walkTo(sock.x - 0.8, sock.z - 0.3, 0.12)).toBe(true);
    expect(Math.hypot(prop('sock').position.x - sock.x, prop('sock').position.z - sock.z)).toBeLessThan(0.02);
  });

  it('are invisible to the camera sweep', async () => {
    const { room, physics } = await setup();
    const { sock } = room.landmarks;
    const origin = { x: sock.x - 0.5, y: 0.01, z: sock.z };
    expect(physics.sweepSphere(origin, { x: 1, y: 0, z: 0 }, 0.005, 1)).toBe(1);
  });

  it('sock: pick up with E, carry at a run, drop, and it falls to the floor ahead of him', async () => {
    const { room, moke, prop, interactions, pickup, walkTo, idle } = await setup();
    const { sock } = room.landmarks;
    expect(walkTo(sock.x, sock.z + 0.35, 0.08)).toBe(true);
    // Face the sock, then E.
    expect(walkTo(sock.x, sock.z + 0.25, 0.05)).toBe(true);
    idle(0.3);
    expect(interactions.update(moke)?.label).toBe('Pick Up Sock');
    interactions.interact();
    expect(pickup.carried?.id).toBe('sock');
    expect(prop('sock').body.enabled).toBe(false);

    // Run across the room with it.
    expect(walkTo(1.8, 0.8, 0.12, 8, true)).toBe(true);
    expect(interactions.update(moke)?.label).toBe('Drop Sock');
    interactions.interact();
    expect(pickup.carried).toBeNull();

    const dropped = prop('sock').position;
    expect(dropped.y).toBeGreaterThan(0.15);
    idle(1.5);
    expect(dropped.y).toBeLessThan(0.04);
    const ahead = (dropped.x - moke.position.x) * Math.sin(moke.heading) + (dropped.z - moke.position.z) * Math.cos(moke.heading);
    expect(ahead).toBeGreaterThan(0.1);
  });

  it('dropping while nose-to-the-wall keeps the item inside the room', async () => {
    const { moke, prop, pickup, walkTo, step, idle } = await setup();
    pickup.pickUp(prop('sock'));
    expect(walkTo(-1.5, 2.5)).toBe(true);
    for (let i = 0; i < 90; i++) step(0, 1); // push into the front wall (z = 3)
    expect(moke.position.z).toBeGreaterThan(2.7);
    pickup.drop();
    idle(1.5);
    const p = prop('sock').position;
    expect(p.z).toBeLessThan(3);
    expect(p.y).toBeGreaterThan(-0.01);
  });

  it('tennis ball: rolls away when Moke trots into it, with bounded speed, and he is not blocked', async () => {
    const { room, moke, prop, walkTo, step } = await setup();
    const { ball } = room.landmarks;
    // Line up 1 m in front of the ball (toward -x), then trot straight through its spot.
    expect(walkTo(ball.x - 1, ball.z)).toBe(true);
    let maxSpeed = 0;
    let mokeMaxY = 0;
    for (let i = 0; i < 90; i++) {
      step(1, 0);
      maxSpeed = Math.max(maxSpeed, prop('ball').body.speed);
      mokeMaxY = Math.max(mokeMaxY, moke.position.y);
    }
    const p = prop('ball').position;
    expect(p.x - ball.x).toBeGreaterThan(0.3);
    expect(maxSpeed).toBeLessThanOrEqual(4.5 + 1e-3);
    expect(moke.position.x).toBeGreaterThan(ball.x - 0.2); // he kept going
    expect(mokeMaxY).toBeLessThan(0.03); // didn't climb onto it
    for (let i = 0; i < 600; i++) step();
    expect(prop('ball').body.speed).toBeLessThan(0.05); // settles down
    expect(Math.abs(prop('ball').position.x)).toBeLessThan(3.5);
    expect(Math.abs(prop('ball').position.z)).toBeLessThan(3);
  });

  it('tennis ball survives a full-speed run into it and stays in the room', async () => {
    const { room, prop, walkTo, step } = await setup();
    const { ball } = room.landmarks;
    expect(walkTo(ball.x - 2.5, ball.z)).toBe(true);
    for (let i = 0; i < 120; i++) step(1, 0, true);
    for (let i = 0; i < 300; i++) step();
    const p = prop('ball').position;
    expect(p.y).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(3.5 + 3.2); // in the room or the hallway
    expect(Math.abs(p.z)).toBeLessThan(3);
  });

  it('rope toy: nudged by a bump, and carried and dropped with the same pickup system', async () => {
    const { room, moke, prop, interactions, pickup, walkTo, idle, step } = await setup();
    const { toy } = room.landmarks;
    expect(walkTo(toy.x, toy.z - 0.8)).toBe(true);
    for (let i = 0; i < 60; i++) step(0, 1);
    expect(Math.hypot(prop('toy').position.x - toy.x, prop('toy').position.z - toy.z)).toBeGreaterThan(0.05);

    for (let i = 0; i < 60 && interactions.update(moke)?.label !== 'Pick Up Rope Toy'; i++) {
      const t = prop('toy').position;
      walkTo(t.x - Math.sin(moke.heading) * 0.3, t.z - Math.cos(moke.heading) * 0.3, 0.1, 0.2);
    }
    expect(interactions.update(moke)?.label).toBe('Pick Up Rope Toy');
    interactions.interact();
    expect(pickup.carried?.name).toBe('Rope Toy');
    idle(0.2);
    pickup.drop();
    idle(1.5);
    expect(prop('toy').position.y).toBeLessThan(0.06);
  });
});
