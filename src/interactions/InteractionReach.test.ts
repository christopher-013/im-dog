import { describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { InteractionSystem } from './InteractionSystem';
import type { Interactable } from './Interactable';

const actor = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
function item(y = 0.03): Interactable {
  return { id: 'toy', type: 'PICKUP', label: 'Pick Up Toy', interactionDistance: 0.5,
    position: { x: 0, y, z: 0.45 }, enabled: true, interact() {} };
}

describe('physical interaction reach', () => {
  it('does not offer objects far above Moke even if horizontal distance is small', () => {
    const system = new InteractionSystem();
    system.register(item(2));
    expect(system.update(actor)).toBeNull();
  });

  it('does not pick up through a wall or a thin furniture collider (real Rapier)', async () => {
    for (const blocksCamera of [true, false]) {
      const physics = await PhysicsWorld.create();
      try {
        physics.addStaticBoxes([{ center: [0, 0.5, 0.27], halfExtents: [1, 0.5, 0.06],
          rotation: [0, 0, 0, 1], blocksCamera }]);
        physics.commitStaticGeometry();
        const system = new InteractionSystem(undefined, (o, d, max) => physics.rayDistance(o, d, max));
        system.register(item());
        expect(system.update(actor)).toBeNull();
        expect(system.interact()).toBe(false);
      } finally { physics.world.free(); }
    }
  });

  it('still offers reachable floor objects on an unobstructed path', async () => {
    const physics = await PhysicsWorld.create();
    try {
      physics.addStaticBoxes([{ center: [0, -0.05, 0], halfExtents: [2, 0.05, 2], rotation: [0, 0, 0, 1] }]);
      physics.commitStaticGeometry();
      const system = new InteractionSystem(undefined, (o, d, max) => physics.rayDistance(o, d, max));
      system.register(item());
      expect(system.update(actor)?.id).toBe('toy');
    } finally { physics.world.free(); }
  });
});
