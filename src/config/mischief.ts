import { HOUSE_SCALE } from './world';
import { FURNITURE } from '../world/home/places';

/** Furniture footprints, floor landing spots and reaction timing for household mischief. */
export interface MischiefSurface {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfZ: number;
  readonly height: number;
}
export interface PillowSofa extends MischiefSurface {
  readonly extraSeats?: readonly MischiefSurface[];
  readonly floors: readonly { readonly x: number; readonly y: number; readonly z: number }[];
}
export const PILLOW_SOFAS: readonly PillowSofa[] = [
  { id: 'living', x: 0.3, z: -2.465, halfX: 0.95, halfZ: 0.49, height: HOUSE_SCALE.couchSeatHeight,
    floors: [{ x: -0.95, y: 0.075, z: -1.6 }, { x: -0.95, y: 0.075, z: -0.95 }, { x: 1.55, y: 0.075, z: -1.65 }] },
  { id: 'sectional', x: FURNITURE.sectional.x, z: FURNITURE.sectional.z, halfX: 1.6, halfZ: 0.49, height: 0.45,
    extraSeats: [{ id: 'chaise', x: FURNITURE.sectional.x - 1.275, z: FURNITURE.sectional.z + 0.375, halfX: 0.425, halfZ: 0.85, height: 0.45 }],
    floors: [{ x: 13.45, y: 0.075, z: 2.0 }, { x: 15.4, y: 0.075, z: 2.05 }, { x: 12.7, y: 0.075, z: 2.4 }] },
  { id: 'window', x: FURNITURE.windowCouch.x, z: FURNITURE.windowCouch.z, halfX: 0.49, halfZ: 0.95, height: 0.45,
    floors: [{ x: 15.5, y: 0.075, z: 2.05 }, { x: 15.5, y: 0.075, z: 2.9 }, { x: 15.5, y: 0.075, z: 3.6 }] },
];
export const MISCHIEF_TABLES: readonly MischiefSurface[] = [
  { id: 'livingCoffee', x: 0.3, z: -1.15, halfX: 0.575, halfZ: 0.31, height: HOUSE_SCALE.coffeeTableHeight },
  { id: 'familyCoffee', ...FURNITURE.coffeeTable, halfX: 0.65, halfZ: 0.35, height: 0.45 },
  // The height cap still prevents reaching the dining tabletop. This does not increase Moke's jump.
  { id: 'dining', ...FURNITURE.diningTable, halfX: 0.5, halfZ: 1.3, height: 0.76 },
];
export const MISCHIEF = {
  surfaceTolerance: 0.09,
  edgeTolerance: 0.06,
  digTime: 2.2,
  tossTime: 0.8,
  tossArc: 0.5,
  pickTime: 1.1,
  placeTime: 1.2,
  returnTime: 0.7,
  pillowCooldown: 8,
  tableCooldown: 2,
  tableReminderEvery: [4, 5] as const,
  tableReminders: ['Moke, get down!', 'Off the table, Moke.', 'Come on, Moke, feet on the floor.', 'Moke, that is not your spot!'] as const,
  walkTimeout: 45,
  stuckTimeout: 4,
  approachGap: 0.55,
  digAnimation: { rate: 17, pawSwing: 0.65, headDip: 0.3, bodyPitch: 0.08 },
  hipsPose: { handX: 0.19, handY: 0.04, handZ: 0.06 },
} as const;

/** Feet must be ON the furniture, not on the floor under it or flying past it. */
export function onSurface(at: { x: number; y: number; z: number }, surface: MischiefSurface): boolean {
  return Math.abs(at.x - surface.x) <= surface.halfX && Math.abs(at.z - surface.z) <= surface.halfZ
    && Math.abs(at.y - surface.height) <= MISCHIEF.surfaceTolerance;
}
