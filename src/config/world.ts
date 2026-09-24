/**
 * World scale: 1 unit = 1 metre.
 *
 * Moke's numbers are estimates from the reference photos (docs/MOKE_CHARACTER_REFERENCE.md).
 * Replace them once we have real measurements; the camera and furniture are tuned against them.
 */
export const MOKE_SIZE = {
  shoulderHeight: 0.28,
  /** Eye level while standing. The camera pivots around this height. */
  eyeHeight: 0.33,
} as const;

/** Real-world human furniture sizes, so the room towers over Moke the way it should. */
export const HOUSE_SCALE = {
  ceilingHeight: 2.6,
  couchSeatHeight: 0.45,
  couchBackHeight: 0.88,
  coffeeTableHeight: 0.45,
} as const;
