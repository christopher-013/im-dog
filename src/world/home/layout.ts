import { HOUSE_SCALE } from '../../config/world';

/**
 * Where everything is in Moke's home (metres; x east, z south, y up). The living room (Phases 1–3) spans
 * x -3.5..3.5, z -3..3; its hallway runs east to the new wing: the kitchen, the family room (one open great room)
 * and the dining room, drawn from the home photos and turned 180° to fit (docs/HOME_REFERENCE.md).
 * Interior faces of walls unless noted.
 */
export const WALL = 0.12;
export const CEILING = HOUSE_SCALE.ceilingHeight;

/** The hallway from the living room: its end opens into the kitchen (where the real front hall meets it). */
export const HALL = { x0: 3.5, x1: 6.74, zMin: 0.6, zMax: 1.6, height: 2.05 } as const;

/** Small bathroom opening off the left (north) hallway wall when heading toward the kitchen. */
export const BATHROOM = {
  xMin: 3.62, xMax: 6.55, zMin: -1.62, zMax: HALL.zMin,
  doorMin: 4.35, doorMax: 5.25, doorHeight: 2.08,
  doorway: { x: 4.8, y: 0, z: HALL.zMin },
  paper: { x: 6.28, y: 0.68, z: -0.93 },
  paperApproach: { x: 5.45, y: 0, z: -0.45 },
  cleanup: { x: 4.6, y: 0, z: 1.13 },
} as const;

export const WING = {
  /** West wall's inner face (the wall stands where the hallway's end wall used to). */
  west: 6.74,
  /** The dining room's east wall (the open doorway to the home gym). */
  diningEast: 10.9,
  east: 16.9,
  north: -4.2,
  south: 5.4,
  /** Centre line of the wall between the dining room/sunroom and the great room. */
  divider: 0.45,
  /** Where the kitchen ends and the family room begins (open, marked by a ceiling soffit). */
  kitchenFamily: 11.7,
} as const;

/** Openings through the wing's walls. */
export const OPENINGS = {
  /** Kitchen ↔ dining room, a wide cased opening in the divider. */
  dining: { xMin: 7.35, xMax: 10.25, height: 2.2 },
  /** The bedroom hallway off the family room (a closed door, not playable). */
  bedroomHall: { xMin: 11.85, xMax: 12.75, height: 2.1, depth: 0.4 },
  /** The wide cased doorway from the dining room into the home gym (the old sliding doors, taken out). */
  gymDoorway: { zMin: -2.95, zMax: -0.55, height: 2.2 },
  /** The gym's big sliding glass doors to the backyard, in the east wall: two fixed panes either side of two sliders. */
  backyardDoors: { zMin: -3.95, zMax: 0.05, height: 2.2 },
  /** The interior windows over the sectional, into the home gym. */
  interiorWindows: { xMin: 12.3, xMax: 15.8, sill: 1.0, top: 2.15 },
  /** Family room windows over the beige couch (centres along z). */
  familyWindows: { centers: [2.0, 3.8], width: 1.0, sill: 0.95, height: 1.25 },
  /** Dining room window (centre along x). */
  diningWindow: { center: 8.85, width: 1.3, sill: 0.95, height: 1.2 },
} as const;

export type RoomId = 'livingRoom' | 'hallway' | 'bathroom' | 'kitchen' | 'familyRoom' | 'diningRoom' | 'gym';

export interface RoomArea {
  readonly id: RoomId;
  readonly name: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** The rooms Moke and the human can be in (for "where am I", hints and the human's routine). */
export const ROOMS: readonly RoomArea[] = [
  { id: 'livingRoom', name: 'living room', minX: -3.5, maxX: 3.5, minZ: -3, maxZ: 3 },
  { id: 'hallway', name: 'hallway', minX: 3.5, maxX: WING.west, minZ: HALL.zMin, maxZ: HALL.zMax },
  { id: 'bathroom', name: 'bathroom', minX: BATHROOM.xMin, maxX: BATHROOM.xMax, minZ: BATHROOM.zMin, maxZ: BATHROOM.zMax },
  { id: 'diningRoom', name: 'dining room', minX: WING.west, maxX: WING.diningEast, minZ: WING.north, maxZ: WING.divider },
  { id: 'gym', name: 'home gym', minX: WING.diningEast + WALL, maxX: WING.east, minZ: WING.north, maxZ: WING.divider - WALL / 4 },
  { id: 'kitchen', name: 'kitchen', minX: WING.west, maxX: WING.kitchenFamily, minZ: WING.divider, maxZ: WING.south },
  { id: 'familyRoom', name: 'family room', minX: WING.kitchenFamily, maxX: WING.east, minZ: WING.divider, maxZ: WING.south },
];

/** Which room a floor point is in (the nearest one if it's in a doorway or wall). */
export function roomAt(x: number, z: number): RoomArea {
  let best = ROOMS[0]!;
  let bestDistance = Infinity;
  for (const room of ROOMS) {
    const dx = Math.max(room.minX - x, 0, x - room.maxX);
    const dz = Math.max(room.minZ - z, 0, z - room.maxZ);
    const distance = Math.hypot(dx, dz);
    if (distance < bestDistance) {
      best = room;
      bestDistance = distance;
      if (distance === 0) break;
    }
  }
  return best;
}

/** The whole house's footprint, outer faces of the walls (navigation, shadows, escaped props). */
export const HOME_BOUNDS = { minX: -3.62, maxX: WING.east + WALL, minZ: WING.north - WALL, maxZ: WING.south + WALL + OPENINGS.bedroomHall.depth } as const;

/** The home gym (the old sunroom, x 11.02…16.9, z -4.2…0.39): its equipment and the bird. */
export const GYM = {
  /** The stationary bike along the right-hand (south) wall, facing the backyard doors. */
  bike: { x: 12.75, z: -0.25 },
  /** The dumbbell rack along the same wall. */
  weights: { x: 14.7, z: 0.06 },
  /** The green-cheeked conure's cage: the far left corner, beside the glass doors (its front faces the room, -x). */
  cage: { x: 16.45, z: -3.72 },
} as const;
