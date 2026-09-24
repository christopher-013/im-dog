/**
 * Collision layers. Rapier interaction groups pack 16 membership bits (high) and 16 filter bits (low);
 * two colliders interact only if each one's membership overlaps the other's filter.
 */
export const LAYER = {
  /** Walls, floor, furniture: solid things that don't move. */
  world: 1 << 0,
  /** Thin static things (table legs). They block Moke, but the camera ignores them so it doesn't pop in and out. */
  worldThin: 1 << 1,
  character: 1 << 2,
  /** Loose props: the sock, tennis ball and dog toy. Dynamic bodies; the camera ignores them. */
  toy: 1 << 3,
} as const;

const ALL = 0xffff;

export function interactionGroups(membership: number, filter: number = ALL): number {
  return (((membership & 0xffff) << 16) | (filter & 0xffff)) >>> 0;
}

/** What the camera's collision sweep can hit: solid world geometry only (not Moke, thin legs or toys). */
export const CAMERA_QUERY_GROUPS = interactionGroups(ALL, LAYER.world);

/** Solid world geometry, thick or thin: what a dropped item mustn't be placed inside. */
export const WORLD_QUERY_GROUPS = interactionGroups(ALL, LAYER.world | LAYER.worldThin);
