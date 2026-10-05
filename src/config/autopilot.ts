/**
 * FSD, "Full Self Dog" (Phase 5): the autopilot that plays Moke for you (src/autopilot/FullSelfDog.ts). Seconds and
 * metres; (min, max) pairs are random ranges.
 */
export const FSD = {
  /** Following a route: a waypoint counts as reached this close; re-plan this often. */
  waypointReach: 0.22,
  replanEvery: 2.5,
  /** Further than this from where he's going, he runs; closer than this, he walks (to stop on the spot). */
  runBeyond: 4,
  walkWithin: 0.5,
  /** Pushing but barely moving this long counts as stuck: he hops, then re-plans; stuck this long, he gives up. */
  stuckSpeed: 0.06,
  stuckHopAfter: 0.8,
  stuckGiveUpAfter: 3.2,
  /** Any one step gives up after this long (a door that never rang, a prompt that never came). */
  stepTimeout: 22,
  /** After he's done a routine, he leaves it alone this long (so he goes round the house, not round in circles). */
  routineCooldown: 50,
  /** A pause between routines (a sniff, a look round). */
  between: [0.6, 1.6] as const,
  /**
   * Hopping up onto furniture, like the player does it: a run-up from this far out from its edge, the jump this far
   * beyond the edge (from the middle: half its depth plus this), then pushing on this long; a few tries.
   */
  hopRunUp: 0.9,
  hopJumpBeyond: 0.28,
  hopPush: 1.1,
  hopTries: 3,
  /** How long he stays: napping, on a table, digging the pillows, with a toy, between a trick and the next. */
  napFor: [9, 15] as const,
  tableFor: [6, 9] as const,
  digFor: [6, 8] as const,
  carryFor: [4, 7] as const,
  chewFor: [9, 13] as const,
  /** Waiting for a "beg" prompt (sitting still beside the human) at most this long. */
  begWait: 9,
  /** Watching a show full screen (Watch TV), how long (s) before he presses a button to stop. */
  tvFor: [8, 14] as const,
  /** …from a spot this close to the screen (Watch TV is only offered close up, m). */
  tvWithin: 1.8,
  /** Liam's Obstacle Course: not in FSD's first couple of minutes, then at most this often (s). */
  courseFirstAfter: 120,
  courseEvery: 300,
  /**
   * Fetch with the human: a bark or a trick this often while asking (they need a few asks), drop it this close to
   * them, chase it once it's this far from them (a throw, not a drop at their feet), and play at most this long.
   */
  fetchAskEvery: 2.6,
  fetchDropAt: 0.9,
  fetchChaseBeyond: 1.6,
  fetchFor: 75,
  /** The fine grid (for squeezes) is only used within this of where he's going, or to get out of a pocket (m). */
  tightWithin: 4,
  /** Getting down off something: this long trying one way before another (s). */
  hopOffTry: 1.6,
  /** Watching the ballgame: how far in front of the TV he sits (m). */
  watchDistance: 1.6,
  /** Running off with the sock: how far from the human he heads (m), and how often he picks a new spot (s). */
  fleeDistance: 4,
  fleeEvery: 3.5,
  /** Dragging the toilet paper: where he heads, out in the hall (game coordinates). */
  paperRunTo: { x: 2.4, z: 1.1 },
} as const;

/** The rainbow path drawn on the floor ahead of Moke while FSD drives (autopilot/FsdPathView.ts). Metres, seconds. */
export const FSD_PATH = {
  /** How wide the ribbon is, how far ahead it reaches, and how high over the floor (clear of the rugs). */
  width: 0.46,
  maxLength: 7,
  height: 0.018,
  /** A sample every this far along it, at most this many; corners rounded off this far each side. */
  step: 0.08,
  maxSamples: 110,
  cornerCut: 0.35,
  /** How see-through at most (0..1), and how fast it fades in and out (1/s). */
  opacity: 0.88,
  fadeRate: 6,
} as const;
