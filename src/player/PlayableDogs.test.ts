import { Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { dogById, type DogProfile } from '../config/dogs';
import { MOKE_BODY, MOVEMENT } from '../config/movement';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { PickupSystem } from '../interactions/PickupSystem';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { Prop } from '../props/Prop';
import { createRoomProps } from '../props/roomProps';
import { LivingRoom } from '../world/LivingRoom';
import { Moke } from './Moke';
import { MokeController } from './MokeController';
import { createDogVisual } from './MokeVisual';

// Dougie and Nori in the real living room with real Rapier, wired the way Game wires the player dog (D29): the same
// controller, body and systems as Moke, only their look on top. Everything here is what a player does with them.
const DT = 1 / 60;

async function setup(profile: DogProfile) {
  const room = new LivingRoom();
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(room.colliders);
  physics.commitStaticGeometry();
  const controller = new MokeController(new CharacterBody(physics, room.spawn.position, MOKE_BODY), room.spawn.heading, { ...MOVEMENT });
  const dog = new Moke(controller, createDogVisual(profile, undefined, false).visual);
  const props = createRoomProps(physics, room);
  const interactions = new InteractionSystem(undefined, (o, d, max) => physics.rayDistance(o, d, max));
  const pickup = new PickupSystem<Prop>(interactions, controller, (o, d, max, radius) => physics.sweepWorldSphere(o, d, radius, max));
  for (const p of props) pickup.add(p);
  // As in Game.spawnProps: what the dog carries rides in its visual's mouth socket.
  pickup.onPickUp = (prop) => {
    prop.holdIn(dog.visual.attachments.mouth);
    dog.carrying = true;
  };
  pickup.onDrop = (prop) => {
    prop.release(room.object);
    dog.carrying = false;
  };
  const step = (x = 0, z = 0, run = false) => {
    dog.fixedUpdate(DT, { x, z, walk: false, run });
    physics.step();
    for (const p of props) p.afterStep();
    dog.update(DT, 1);
  };
  const walkTo = (x: number, z: number, within = 0.12, maxSeconds = 8): boolean => {
    for (let i = 0; i < maxSeconds / DT; i++) {
      const dx = x - controller.position.x;
      const dz = z - controller.position.z;
      const d = Math.hypot(dx, dz);
      if (d < within) return true;
      const k = Math.min(1, d / 0.5) / d;
      step(dx * k, dz * k);
    }
    return false;
  };
  return { room, physics, controller, dog, props, interactions, pickup, step, walkTo };
}

function isInside(child: Object3D, parent: Object3D): boolean {
  for (let o: Object3D | null = child; o; o = o.parent) if (o === parent) return true;
  return false;
}

describe.each([dogById('dougie'), dogById('nori')])('$name plays the same game as Moke', (profile) => {
  it('walks to the sock, picks it up in their own mouth, carries it up onto the couch, does a trick and drops it', async () => {
    const { room, physics, controller, dog, props, interactions, step, walkTo } = await setup(profile);
    try {
      const sock = props.find((p) => p.id === 'sock')!;
      const { sock: at } = room.landmarks;
      expect(walkTo(at.x, at.z + 0.32, 0.1)).toBe(true);
      // Face it and pick it up, as E (or the paw) does.
      for (let i = 0; i < 30; i++) step(0, -0.2);
      for (let i = 0; i < 20; i++) step();
      expect(interactions.update(controller)?.id).toBe('pickup:sock');
      expect(interactions.interact()).toBe(true);
      expect(isInside(sock.view, dog.visual.attachments.mouth)).toBe(true);
      expect(dog.carrying).toBe(true);
      for (let i = 0; i < 10; i++) step();
      // In the mouth, out in front, at head height.
      dog.visual.object.updateMatrixWorld(true);
      const held = sock.view.getWorldPosition(new Vector3());
      const p = controller.position;
      const ahead = (held.x - p.x) * Math.sin(controller.heading) + (held.z - p.z) * Math.cos(controller.heading);
      expect(ahead).toBeGreaterThan(0.08);
      expect(held.y - p.y).toBeGreaterThan(0.12);

      // Up onto the couch seat with it, like Moke (LivingRoom's own jump test).
      expect(walkTo(-0.35, -1.0)).toBe(true);
      let jumped = false;
      for (let i = 0; i < 4 / DT && !jumped; i++) {
        if (controller.position.z <= -1.75) {
          controller.requestJump();
          jumped = true;
        }
        step(0, -1);
      }
      for (let i = 0; i < 1 / DT && (i < 3 || controller.airborne); i++) step(0, -1);
      for (let i = 0; i < 0.6 / DT; i++) step();
      expect(controller.position.y).toBeCloseTo(0.45, 2);
      expect(isInside(sock.view, dog.visual.attachments.mouth)).toBe(true);

      // A trick and a bark, then drop it on the couch.
      expect(dog.animation.trick('spin')).toBe(true);
      dog.animation.bark();
      for (let i = 0; i < 1.5 / DT; i++) step();
      expect(interactions.update(controller)?.type).toBe('DROP');
      expect(interactions.interact()).toBe(true);
      expect(isInside(sock.view, dog.visual.attachments.mouth)).toBe(false);
      expect(dog.carrying).toBe(false);
      for (let i = 0; i < 1 / DT; i++) step();
      expect(sock.position.y).toBeGreaterThan(0.3); // on the couch, not through it
    } finally {
      dog.visual.dispose();
      physics.world.free();
    }
  }, 60_000);
});
