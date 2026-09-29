/**
 * World scale: 1 unit = 1 metre. Moke's own size lives in `config/mokeCharacter.ts` (`MOKE_CHARACTER.size`),
 * the one authoritative character scale.
 */

/** Real-world human furniture sizes, so the room towers over Moke the way it should. */
export const HOUSE_SCALE = {
  ceilingHeight: 2.6,
  couchSeatHeight: 0.45,
  couchBackHeight: 0.88,
  coffeeTableHeight: 0.45,
} as const;

/**
 * GEARBOTS, the cartoon on the TVs (world/RobotCartoon.ts): its picture (px, 16:9 like the screens) and how often a
 * new frame is drawn (fps: a dozen, "on twos" like old cel animation, and cheap to upload).
 */
export const TV_SHOW = { width: 384, height: 216, fps: 12 } as const;
