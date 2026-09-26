import { PROPS, type PropId } from '../config/props';
import { PropBody } from '../physics/PropBody';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { LivingRoom } from '../world/LivingRoom';
import { Prop, type PropBounds } from './Prop';
import { createPropView } from './propVisuals';

/** The living room's loose props, each at its landmark spot. They belong inside `bounds` (the house). */
export function createRoomProps(physics: PhysicsWorld, room: Pick<LivingRoom, 'landmarks'>, bounds?: PropBounds): Prop[] {
  const spots: Record<PropId, { position: { x: number; y: number; z: number }; heading: number }> = {
    sock: { position: room.landmarks.sock, heading: 0.9 },
    ball: { position: room.landmarks.ball, heading: 0 },
    toy: { position: room.landmarks.toy, heading: -0.6 },
  };
  return (Object.keys(PROPS) as PropId[]).map((id) => {
    const def = PROPS[id];
    const { position, heading } = spots[id];
    const at = { x: position.x, y: position.y + def.restHeight, z: position.z };
    return new Prop(def, new PropBody(physics, def.physics, at, heading), createPropView(id), position, heading, bounds);
  });
}
