import { describe, expect, it } from 'vitest';
import { PROPS } from '../config/props';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { PickupSystem } from '../interactions/PickupSystem';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PropBody } from '../physics/PropBody';
import { Prop } from './Prop';
import { createPropView } from './propVisuals';

describe('drop clearance', () => {
  it('keeps an angled rope toy wholly inside a wall, not just its centre', async () => {
    const physics = await PhysicsWorld.create();
    try {
      // Moke is stopped 18 cm from a wall and looks diagonally into it.
      physics.addStaticBoxes([{ center: [0.24, 0.5, 0], halfExtents: [0.06, 0.5, 2], rotation: [0, 0, 0, 1] }]);
      physics.commitStaticGeometry();
      const carrier = { position: { x: 0, y: 0, z: 0 }, heading: Math.PI / 4, actualSpeed: 0 };
      const prop = new Prop(PROPS.toy, new PropBody(physics, PROPS.toy.physics, carrier.position), createPropView('toy'), carrier.position);
      const pickup = new PickupSystem(new InteractionSystem(), carrier, (o, d, max, radius) => physics.sweepWorldSphere(o, d, radius, max));
      pickup.add(prop);
      pickup.pickUp(prop);
      pickup.drop();
      const xExtent = 0.03 + Math.abs(Math.sin(carrier.heading + PROPS.toy.carry.turn)) * 0.09;
      expect(prop.position.x + xExtent).toBeLessThanOrEqual(0.18);
    } finally { physics.world.free(); }
  });
});
