import { describe, expect, it } from 'vitest';
import { MOKE_BODY, MOVEMENT } from '../config/movement';
import { PROPS } from '../config/props';
import { NavGrid } from '../human/NavGrid';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { PickupSystem } from '../interactions/PickupSystem';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MokeController } from '../player/MokeController';
import { Home } from '../world/Home';
import type { Prop } from './Prop';
import { createPropView } from './propVisuals';
import { createRoomProps } from './roomProps';

// The squeaky fish in the real house with real Rapier: it starts in the family room, and Moke can go and get it.
const DT = 1 / 60;
const home = new Home();
const mokeNav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.05, agentRadius: MOKE_BODY.radius + 0.01, minY: 0.03, maxY: 0.38 });

describe('The squeaky fish', () => {
  it('starts on the family-room floor, at rest, where Moke can walk up to it, and he can pick it up and drop it', async () => {
    const physics = await PhysicsWorld.create();
    physics.addStaticBoxes(home.colliders);
    physics.commitStaticGeometry();
    const spot = home.landmarks.fishToy;
    const start = { x: spot.x + 0.6, y: 0, z: spot.z };
    const moke = new MokeController(new CharacterBody(physics, start, MOKE_BODY), -Math.PI / 2, { ...MOVEMENT });
    const props = createRoomProps(physics, home, home.bounds);
    const fish = props.find((p) => p.id === 'fish')!;
    expect(fish.name).toBe('Squeaky Fish');
    const interactions = new InteractionSystem(undefined, (o, d, max) => physics.rayDistance(o, d, max));
    const pickup = new PickupSystem<Prop>(interactions, moke, (o, d, max, radius) => physics.sweepWorldSphere(o, d, radius, max));
    for (const p of props) pickup.add(p);
    const step = (x = 0, z = 0) => {
      moke.fixedUpdate(DT, { x, z, walk: false, run: false });
      physics.step();
      for (const p of props) p.afterStep();
    };
    for (let i = 0; i < 1 / DT; i++) step();
    expect(home.roomAt(fish.position.x, fish.position.z).id).toBe('familyRoom');
    expect(fish.position.y).toBeGreaterThan(0);
    expect(fish.position.y).toBeLessThan(PROPS.fish.restHeight + 0.01);
    expect(Math.hypot(fish.position.x - spot.x, fish.position.z - spot.z)).toBeLessThan(0.03);
    expect(mokeNav.isWalkable(start.x, start.z)).toBe(true);
    // Up to it, facing it: "Pick Up Squeaky Fish", then carried; drop it again.
    for (let i = 0; i < 3 / DT && Math.hypot(moke.position.x - spot.x, moke.position.z - spot.z) > 0.32; i++) step(-1, 0);
    interactions.update(moke);
    expect(interactions.current?.label).toBe('Pick Up Squeaky Fish');
    interactions.interact();
    expect(pickup.carried).toBe(fish);
    interactions.update(moke);
    expect(interactions.current?.label).toBe('Drop Squeaky Fish');
    interactions.interact();
    expect(pickup.carried).toBeNull();
    physics.world.free();
  });

  it('has a squishable body for the bite squash, and is fish-sized (about 15 cm long)', () => {
    const view = createPropView('fish');
    expect(view.getObjectByName('squish')).toBeDefined();
    const [hx, , hz] = (PROPS.fish.physics.shape as { halfExtents: readonly [number, number, number] }).halfExtents;
    expect(hz * 2).toBeCloseTo(0.15, 2);
    expect(hx * 2).toBeCloseTo(0.09, 2);
  });
});
