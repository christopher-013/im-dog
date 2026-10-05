/**
 * Liam's Obstacle Course (Phase 5, owner request 2026-10-04, after Liam's feedback): a small loop on the backyard
 * lawn, behind the patio furniture. Metres and seconds; angles in radians.
 *
 * The loop is a circle. A point on it at angle `a` is `center + radius · (-cos(a + turn), sin(a + turn))`. `a = 0` is
 * where the start/finish arch is: its south side, where you walk into it from the patio heading away from the house
 * (east). Going round means `a` growing: east, up the back by the fence, along the north side, back past the patio.
 * (Owner, 2026-10-05: wider, the sign at the back and higher, and a START arrow. Then, the same day: no sign at the
 * back, the name on the arch instead, a path in from the patio, and one-press help with each hurdle and weave pole.)
 */
export const COURSE = {
  center: { x: 27.6, z: -0.4 },
  radius: 3.0,
  /** Where `a = 0` is round the circle (a quarter turn from its west end: the south side). */
  turn: Math.PI / 2,
  /** Half the width of the mown lane round the loop. */
  laneHalfWidth: 0.55,
  /**
   * The start/finish arch (its posts this far either side of the lane's middle, the round top that high), and its
   * banner ("Liam's Obstacle Course", START AND FINISH) hung inside the top, facing the way you come in.
   */
  arch: { at: 0, halfWidth: 0.8, height: 1.3, banner: { width: 1.42, height: 0.5, above: 0.28 } },
  /** The START arrow painted on the lane, this far before the arch (rad). */
  startArrow: { before: 0.32, length: 1.1, width: 0.9 },
  /**
   * The way in: a paved path from the patio, straight out towards the middle of the course (along z), then curving
   * to the right onto the lane, which carries it round to the START arrow and the arch. `straight` is where the
   * straight part runs (x from, x to, at z); it joins the lane at angle `joinAt` and ends at `endAt`, where the START
   * arrow begins. `chevrons`: one painted every this many metres, pointing the way.
   */
  entry: { straight: { fromX: 22.4, toX: 23.35, z: -0.4 }, joinAt: -0.92, endAt: -0.5, width: 0.78, step: 0.1, chevrons: 0.7 },
  /** Two low hurdles to hop: where on the loop, the bar's height (its top), and half its length across the lane. */
  hurdles: { at: [0.55, 1.0], height: 0.2, halfWidth: 0.42 },
  /** Weave poles on the lane's middle line: in, out, in, out. */
  weave: { from: 1.65, step: 0.22, count: 5, height: 0.75, radius: 0.025 },
  /**
   * A gentle grassy hill across the lane, straight along the loop's direction there: up a ramp, a short flat top,
   * down the other side. `halfLength` is from its middle to either foot, `flatHalf` half the flat top.
   */
  hill: { at: 3.85, halfLength: 1.2, flatHalf: 0.3, top: 0.28, halfWidth: 0.7 },
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

/**
 * One-press help (owner, 2026-10-05): coming up to the next hurdle or weave pole of a run, the paw (E) offers to do
 * that one for him: run up and hop the hurdle, or round the pole on the right side. Moving yourself takes over.
 */
export const COURSE_ASSIST = {
  /** Offered from this far before the obstacle (m along the loop) up to just past it, and this far off the lane. */
  offerFrom: 2.8,
  offerUntil: 0.15,
  offLane: 0.7,
  /** The prompt shows from this far away (m), so it's there all along the way up to it. */
  reach: 3.2,
  priority: 3,
  /** A hurdle: a run-up point this far before it (m) when he's closer than that or off the line. */
  runUp: 0.8,
  /** A weave pole: round it this far from the middle line (m), from this far before it to this far past (rad). */
  weaveOff: 0.3,
  weaveBefore: 0.12,
  weavePast: 0.08,
  /** Reached a point: within this (m). Given up on a point after this long (s). */
  within: 0.2,
  stepTimeout: 4,
} as const;

/** Where to land past a hurdle (rad past it), and how far from there to jump (m): the same hop for help and FSD. */
export const HURDLE_HOP = { landPast: 0.22, jumpAt: 0.22 * COURSE.radius + 0.45 } as const;

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
  jumpHurdle: 'Jump Hurdle',
  weavePole: (n: number, of: number) => `Weave Pole ${n}/${of}`,
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
