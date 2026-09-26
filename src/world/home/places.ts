import { roomAt, WING, type RoomId } from './layout';

/** A floor point (y is the surface height where it matters). */
export interface Spot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const at = (x: number, z: number, y = 0): Spot => ({ x, y, z });
/** Heading (radians, 0 = +z) that faces from (x0, z0) toward (x1, z1). */
const toward = (x0: number, z0: number, x1: number, z1: number) => Math.atan2(x1 - x0, z1 - z0);
const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const SOUTH = 0;
const NORTH = Math.PI;

/**
 * Where the wing's furniture stands (the Wing builder uses these, and the places below are measured from them).
 * Rotations turn a piece's front (+z) to face: 0 south, π/2 east, -π/2 west, π north.
 */
export const FURNITURE = {
  island: { x: 9.1, z: 2.95, rotation: EAST },
  islandStools: [
    { x: 9.97, z: 2.15, rotation: WEST },
    { x: 9.97, z: 2.95, rotation: WEST },
    { x: 9.97, z: 3.75, rotation: WEST },
  ],
  range: { z: 3.5 },
  diningTable: { x: 8.85, z: -1.75 },
  diningChairs: [
    { x: 8.07, z: -2.65, rotation: EAST, arms: false },
    { x: 8.07, z: -1.75, rotation: EAST, arms: false },
    { x: 8.07, z: -0.85, rotation: EAST, arms: false },
    { x: 9.63, z: -2.65, rotation: WEST, arms: false },
    { x: 9.63, z: -1.75, rotation: WEST, arms: false },
    { x: 9.63, z: -0.85, rotation: WEST, arms: false },
  ],
  sideboard: { z: -1.75 },
  sectional: { x: 14.0, z: 0.995, length: 3.4 },
  windowCouch: { x: 16.415, z: 2.9 },
  fireplace: { x: 14.55 },
  builtIns: { x: 15.9, width: 0.9 },
  coffeeTable: { x: 14.2, z: 2.95 },
  pinkBlanket: { x: 12.72, z: 2.72, rotation: 0.25 },
  bowls: { x: 13.15, z: 5.12 },
  kitchenTreatJar: { x: 6.98, z: 4.6 },
} as const;

/** How someone sits: upright on a chair or sofa, on a tall stool, or lounging with legs up (the chaise). */
export type SeatStyle = 'upright' | 'stool' | 'lounge';

/** What a place is for. The human's activities pick places by kind. */
export type PlaceKind =
  | 'couchSeat'
  | 'readingSeat'
  | 'diningChair'
  | 'stool'
  | 'kitchenCounter'
  | 'stove'
  | 'sink'
  | 'fridge'
  | 'laundry';

/**
 * An interaction point: where the human stands to use something, which way they face, and (for seats) where
 * their hips go and how high. `look` is what they look at while there (the TV), if anything in particular.
 */
export interface HomePlace {
  readonly id: string;
  readonly kind: PlaceKind;
  readonly room: RoomId;
  /** Where the body stands (walkable floor): in front of a seat, or at the counter. */
  readonly stand: Spot;
  readonly facing: number;
  readonly seat?: { readonly x: number; readonly z: number; readonly height: number; readonly style: SeatStyle };
  readonly look?: Spot;
  /** Somewhere on a surface in front of them for a plate or a mug (the table, the counter). */
  readonly surface?: Spot;
}

const LIVING_TV: Spot = at(0.3, 2.77, 1.0);
const FAMILY_TV: Spot = at(FURNITURE.fireplace.x, WING.south - 0.1, 1.9);

function place(id: string, kind: PlaceKind, stand: Spot, facing: number, extra: Partial<HomePlace> = {}): HomePlace {
  return { id, kind, room: roomAt(stand.x, stand.z).id, stand, facing, ...extra };
}

const f = FURNITURE;
const diningEast = f.diningChairs.filter((c) => c.rotation === WEST);

/** Every place the human can use, across the house. */
export const HOME_PLACES: readonly HomePlace[] = [
  // Living room: the couch (facing the TV console) and the laundry.
  place('living.couch.left', 'couchSeat', at(-0.6, -1.65), SOUTH, { seat: { x: -0.3, z: -2.38, height: 0.45, style: 'upright' }, look: LIVING_TV }),
  place('living.couch.right', 'couchSeat', at(1.2, -1.65), SOUTH, { seat: { x: 0.9, z: -2.38, height: 0.45, style: 'upright' }, look: LIVING_TV }),
  place('living.laundry', 'laundry', at(-1.35, -1.45), toward(-1.35, -1.45, -2.0, -1.85)),
  // Family room: the sectional (facing the fireplace TV), the chaise, the beige couch under the windows.
  place('family.sectional.middle', 'couchSeat', at(13.75, 1.85), SOUTH, { seat: { x: 13.75, z: 0.98, height: 0.45, style: 'upright' }, look: FAMILY_TV }),
  place('family.sectional.east', 'couchSeat', at(14.8, 1.85), SOUTH, { seat: { x: 14.8, z: 0.98, height: 0.45, style: 'upright' }, look: FAMILY_TV }),
  place('family.chaise', 'readingSeat', at(13.45, 1.85), SOUTH, { seat: { x: 12.72, z: 1.3, height: 0.45, style: 'lounge' }, look: FAMILY_TV }),
  place('family.windowCouch.north', 'readingSeat', at(15.6, 2.45), WEST, { seat: { x: 16.52, z: 2.45, height: 0.45, style: 'upright' } }),
  place('family.windowCouch.south', 'couchSeat', at(15.6, 3.35), WEST, { seat: { x: 16.52, z: 3.35, height: 0.45, style: 'upright' } }),
  // Kitchen.
  place('kitchen.stove', 'stove', at(7.72, f.range.z), WEST, { surface: at(7.0, f.range.z, 0.95) }),
  place('kitchen.counter', 'kitchenCounter', at(7.72, 2.35), WEST, { surface: at(7.05, 2.35, 0.92) }),
  place('kitchen.sink', 'sink', at(8.08, f.island.z), EAST, { surface: at(8.75, f.island.z - 0.5, 0.92) }),
  place('kitchen.fridge', 'fridge', at(10.32, 4.3), SOUTH),
  place('kitchen.stool', 'stool', at(10.45, f.island.z), WEST, { seat: { x: 9.97, z: f.island.z, height: 0.65, style: 'stool' }, surface: at(9.55, f.island.z, 0.92) }),
  // Dining room: the chairs on the slider side of the table.
  ...diningEast.map((c, i) =>
    place(`dining.chair.${i}`, 'diningChair', at(10.2, c.z), WEST, {
      seat: { x: c.x, z: c.z, height: 0.46, style: 'upright' },
      surface: at(9.18, c.z, 0.76),
    }),
  ),
];

export function placeById(id: string): HomePlace {
  const found = HOME_PLACES.find((p) => p.id === id);
  if (!found) throw new Error(`No home place "${id}"`);
  return found;
}

/** Where the kitchen treat jar is, and where the human stands to reach it. */
export const KITCHEN_TREATS = { jar: at(f.kitchenTreatJar.x, f.kitchenTreatJar.z, 0.92), stand: at(7.72, f.kitchenTreatJar.z), facing: WEST } as const;

/**
 * A nap spot's lasting qualities (Perfect Nap). Quiet and "my human is near" change with what's going on, so the
 * game decides those as it happens.
 */
export interface NapSpot {
  readonly id: string;
  readonly label: string;
  /** Where he lies (y = the surface), and the way he ends up facing. */
  readonly position: Spot;
  readonly facing: number;
  readonly soft: boolean;
  readonly sunny: boolean;
  /** By the fire. */
  readonly warm: boolean;
  /** Bed-like (his own bed or blanket): teaches BED = NAP. */
  readonly bed: boolean;
}

export const NAP_SPOTS: readonly NapSpot[] = [
  { id: 'dogBed', label: 'his bed', position: at(-2.25, 0.05), facing: EAST, soft: true, sunny: true, warm: false, bed: true },
  { id: 'pinkBlanket', label: 'the pink blanket', position: at(f.pinkBlanket.x, f.pinkBlanket.z), facing: toward(12.72, 2.72, 14.2, 3.4), soft: true, sunny: false, warm: true, bed: true },
  { id: 'windowCouch', label: 'the sunny couch', position: at(16.38, 2.9, 0.45), facing: WEST, soft: true, sunny: true, warm: false, bed: false },
  { id: 'chaise', label: 'the chaise', position: at(12.72, 1.9, 0.45), facing: SOUTH, soft: true, sunny: false, warm: false, bed: false },
  { id: 'sectional', label: 'the sectional', position: at(14.3, 1.15, 0.45), facing: SOUTH, soft: true, sunny: false, warm: false, bed: false },
  { id: 'livingCouch', label: 'the couch', position: at(0.3, -2.3, 0.45), facing: SOUTH, soft: true, sunny: false, warm: false, bed: false },
  { id: 'hearth', label: 'the hearth', position: at(14.1, 4.92, 0.3), facing: NORTH, soft: false, sunny: false, warm: true, bed: false },
];

/** The fire's warmth reaches this far (m), for nap spots and the Dog Logic "warm" feeling. */
export const FIRE = { position: at(f.fireplace.x, WING.south - 0.4), warmRadius: 3.4 } as const;

/**
 * Where a treat can be hidden (Treat Hunt): floor spots Moke can reach, tucked behind or under things. Each is
 * checked by tests (Moke can get within eating reach; the human can get close enough to put it there).
 */
export const TREAT_HIDING_SPOTS: readonly Spot[] = [
  // Living room.
  at(0.3, -1.15), // under the coffee table
  at(-2.45, -2.4), // behind the laundry basket
  at(2.75, -2.3), // by the potted plant
  at(1.3, 2.3), // at the end of the TV console
  // Hallway.
  at(6.2, 1.35),
  // Dining room.
  at(8.85, -1.75), // under the table
  at(7.35, -0.1), // beside the wine fridge
  at(9.9, WING.north + 0.45), // beside the TV stand
  // Kitchen.
  at(9.66, 3.35), // under the island overhang, between the stools
  at(11.2, 4.45), // at the end of the tall cabinets
  at(7.62, 4.55), // in the corner by the range
  // Family room.
  at(13.2, 3.1), // at the end of the pink blanket
  at(14.2, 2.45), // behind the coffee table
  at(15.75, 1.75), // by the step stool
  at(13.45, 4.6), // by the hearth
  at(12.2, 4.95), // by the bedroom door
];
