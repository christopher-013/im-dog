import { PROPS, type PropId } from '../config/props';
import { PropBody } from '../physics/PropBody';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { LivingRoom } from '../world/LivingRoom';
import { Prop } from './Prop';
import { createPropView } from './propVisuals';

/** The living room's loose props, each at its landmark spot. */
export function createRoomProps(physics: PhysicsWorld, room: LivingRoom): Prop[] {
  const spots: Record<PropId, { position: { x: number; y: number; z: number }; heading: number }> = {
    sock: { position: room.landmarks.sock, heading: 0.9 },
  };
  return (Object.keys(PROPS) as PropId[]).map((id) => {
    const def = PROPS[id];
    const { position, heading } = spots[id];
    const at = { x: position.x, y: position.y + def.restHeight, z: position.z };
    return new Prop(def, new PropBody(physics, def.physics, at, heading), createPropView(id), position, heading);
  });
}
