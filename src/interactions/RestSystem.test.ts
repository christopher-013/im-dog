import { describe, expect, it } from 'vitest';
import { REST } from '../config/interaction';
import { MOKE_BODY, MOVEMENT } from '../config/movement';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MokeController } from '../player/MokeController';
import { LivingRoom } from '../world/LivingRoom';
import { InteractionSystem } from './InteractionSystem';
import { RestSystem } from './RestSystem';

const DT = 1 / 60;
const SPOT = { id: 'bed', position: { x: 0, y: 0, z: 0 }, facing: Math.PI / 2 };

describe('RestSystem (state machine)', () => {
  it('offers "Lie Down" only within reach, then "Get Up" while resting', () => {
    const interactions = new InteractionSystem();
    const rest = new RestSystem(interactions, SPOT);
    expect(interactions.update({ position: { x: 1, y: 0, z: 0 }, heading: 0 })).toBeNull();
    const inBed = { position: { x: 0.3, y: 0, z: 0 }, heading: -Math.PI / 2 };
    expect(interactions.update(inBed)?.label).toBe('Lie Down');
    interactions.interact();
    expect(rest.phase).toBe('settling');
    expect(rest.glideTarget).toBe(SPOT.position);
    expect(rest.holdsMoke).toBe(true);
    expect(interactions.update(inBed)?.label).toBe('Get Up');
  });

  it('walks in facing the bed, turns to face out at the centre, lies down, and gets up', () => {
    const rest = new RestSystem(new InteractionSystem(), SPOT);
    rest.lieDown();
    expect(rest.glideHeading({ position: { x: 0.5, y: 0, z: 0 }, heading: 0 })).toBeCloseTo(-Math.PI / 2);
    expect(rest.glideHeading({ position: { x: 0.02, y: 0, z: 0 }, heading: 0 })).toBeCloseTo(Math.PI / 2);
    rest.update(DT, { position: { x: 0.02, y: 0, z: 0 }, heading: Math.PI / 2 });
    expect(rest.phase).toBe('resting');
    expect(rest.lying).toBe(true);
    expect(rest.standUp()).toBe(true);
    expect(rest.phase).toBe('rising');
    rest.update(REST.riseTime + 0.01, { position: SPOT.position, heading: 0 });
    expect(rest.phase).toBe('standing');
    expect(rest.holdsMoke).toBe(false);
  });

  it('lies down where he is if he cannot reach the centre', () => {
    const rest = new RestSystem(new InteractionSystem(), SPOT);
    rest.lieDown();
    for (let t = 0; t < REST.settleTimeout + 0.1; t += DT) rest.update(DT, { position: { x: 0.4, y: 0, z: 0 }, heading: 0 });
    expect(rest.phase).toBe('resting');
  });
});

describe('RestSystem in the living room (Rapier)', () => {
  it('Moke walks into his bed, settles facing out, and walks back out after getting up', async () => {
    const room = new LivingRoom();
    const physics = await PhysicsWorld.create();
    physics.addStaticBoxes(room.colliders);
    physics.commitStaticGeometry();
    const moke = new MokeController(new CharacterBody(physics, room.spawn.position, MOKE_BODY), room.spawn.heading, { ...MOVEMENT });
    const { dogBed, dogBedFront } = room.landmarks;
    const interactions = new InteractionSystem();
    const rest = new RestSystem(interactions, { id: 'dogBed', position: dogBed, facing: Math.atan2(dogBedFront.x - dogBed.x, dogBedFront.z - dogBed.z) });

    const still = { x: 0, z: 0, walk: false, run: false };
    const step = (x = 0, z = 0) => {
      const target = rest.glideTarget;
      if (target) moke.glideTo(DT, target, rest.glideHeading(moke), REST.settleSpeed, REST.settleTurnRate);
      else moke.fixedUpdate(DT, rest.holdsMoke ? still : { x, z, walk: false, run: false });
      rest.update(DT, moke);
      physics.step();
    };
    const walkTo = (x: number, z: number) => {
      for (let i = 0; i < 8 / DT; i++) {
        const dx = x - moke.position.x;
        const dz = z - moke.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.12) return true;
        const k = Math.min(1, d / 0.5) / d;
        step(dx * k, dz * k);
      }
      return false;
    };

    expect(walkTo(dogBedFront.x, dogBedFront.z)).toBe(true);
    // Not yet close enough to lie down from the front landmark.
    expect(interactions.update(moke)?.label).not.toBe('Lie Down');
    expect(walkTo(dogBed.x + 0.4, dogBed.z)).toBe(true);
    expect(interactions.update(moke)?.label).toBe('Lie Down');
    interactions.interact();

    for (let i = 0; i < 2.5 / DT && rest.phase !== 'resting'; i++) step();
    expect(rest.phase).toBe('resting');
    expect(Math.hypot(moke.position.x - dogBed.x, moke.position.z - dogBed.z)).toBeLessThan(0.1);
    expect(Math.abs(Math.atan2(Math.sin(moke.heading - Math.PI / 2), Math.cos(moke.heading - Math.PI / 2)))).toBeLessThan(0.15);

    // Movement keys are ignored while resting.
    for (let i = 0; i < 30; i++) step(1, 0);
    expect(Math.hypot(moke.position.x - dogBed.x, moke.position.z - dogBed.z)).toBeLessThan(0.1);

    expect(interactions.update(moke)?.label).toBe('Get Up');
    interactions.interact();
    for (let i = 0; i < 40; i++) step();
    expect(rest.phase).toBe('standing');
    expect(walkTo(dogBedFront.x + 0.5, dogBedFront.z)).toBe(true);
  });
});
