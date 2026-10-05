/**
 * Liam's Obstacle Course (Phase 5, owner request 2026-10-04, after Liam's feedback): a small loop on the backyard
 * lawn, behind the patio furniture. Metres and seconds; angles in radians.
 *
 * The loop is a circle. A point on it at angle `a` is `center + radius · (-cos a, sin a)`: `a = 0` is its west end
 * (nearest the house, where the arch is), and going round means `a` growing (south, east, north, back to the arch).
 */
export const COURSE = {
  center: { x: 26.4, z: -0.6 },
  radius: 2.1,
  /** Half the width of the mown lane round the loop. */
  laneHalfWidth: 0.55,
  /** The start/finish arch (its posts this far either side of the lane's middle). */
  arch: { at: 0, halfWidth: 0.62, height: 1.25 },
  /** The sign beside the arch, facing the house: "Liam's Obstacle Course". */
  sign: { x: 23.75, z: -1.55, width: 1.1, height: 0.55, postHeight: 0.62 },
  /** Two low hurdles to hop: where on the loop, the bar's height (its top), and half its length across the lane. */
  hurdles: { at: [0.55, 1.0], height: 0.2, halfWidth: 0.42 },
  /** Weave poles on the lane's middle line: in, out, in, out. */
  weave: { from: 1.65, step: 0.3, count: 5, height: 0.75, radius: 0.025 },
  /**
   * A gentle grassy hill across the lane, straight along the loop's direction there: up a ramp, a short flat top,
   * down the other side. `halfLength` is from its middle to either foot, `flatHalf` half the flat top.
   */
  hill: { at: 3.85, halfLength: 1.0, flatHalf: 0.25, top: 0.28, halfWidth: 0.7 },
} as const;

export const COURSE_RULES = {
  /** Crossing a hurdle counts as a jump with his feet at least this high, or while he's in the air. */
  jumpClear: 0.1,
  /** A weave pole passed counts when he's this close to the lane's middle (m), on one side or the other. */
  weaveReach: 0.8,
  /** Up on the hill: his feet within this of its top. */
  hillTopSlack: 0.08,
  /** Near enough the course to be told about it (m beyond the loop). */
  nearBy: 2.6,
  /** The fireworks card ("Moke is tired!") stays this long (s). */
  celebrateFor: 5.5,
} as const;

export const COURSE_TEXT = {
  name: "Liam's Obstacle Course",
  start: "Liam's Obstacle Course! Start at the arch.",
  hurdles: (n: number, of: number) => `Jump the hurdles! (${n}/${of})`,
  weave: (n: number, of: number) => `Weave in and out of the poles! (${n}/${of})`,
  weaveOops: 'Oops! In and out, one pole at a time.',
  hill: 'Run up and over the hill!',
  finish: 'Back through the arch to finish!',
  tired: 'Moke is tired!',
  tiredDetail: (seconds: number) => `Liam's Obstacle Course complete in ${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.`,
  goInside: 'All done! Head inside: someone is waiting with something good…',
} as const;

/** The reward: back inside, the human is waiting by the patio doors with a hamburger patty. */
export const COURSE_REWARD = {
  /** Where they wait, inside the gym by the open slider, and how close he comes for it (m). */
  waitAt: { x: 15.75, y: 0, z: -1.45 },
  reach: 1.1,
  /** Giving it: holding it out this long once he's close (s). */
  offerTime: 0.8,
  /** Waiting this long for him (s); then it goes down on the floor for him, never a soft-lock. */
  waitTimeout: 120,
  /** Walking there gives up after this long (s). */
  walkTimeout: 30,
  /** Down on the floor and not eaten after this long, it's tidied away (s). */
  foodTimeout: 90,
  cooldown: 5,
  lines: {
    waiting: 'Moke! Look what I made you!',
    give: 'You did it! A hamburger patty for my champion!',
    fed: 'Obstacle course + hamburger = best day ever!',
  },
} as const;
