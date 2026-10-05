/** Owner-requested household moments. Distances in metres; timers use paused game time. */
export const HOME_ACTIVITIES = {
  delivery: {
    firstDelay: [25, 45] as const,
    /** Nobody answered (no bark at the door): the courier comes back in a few minutes. */
    interval: [120, 240] as const,
    /**
     * Moke answered the door (barked at it): a good long while before the next delivery, whether the human took the
     * package or something cut the visit short (a Sock Heist, the human couldn't get there).
     */
    successfulInterval: [600, 900] as const,
    ringEvery: 2,
    unansweredTimeout: 30,
    glowCyclesPerSecond: 1.25,
    guardVoices: ['bark', 'growl', 'bark', 'growl', 'bark', 'growl'] as const,
    guardEvery: 1.25,
    reach: 1.25,
    walkTimeout: 45,
    openTime: 1.1,
    exchangeTime: 2.2,
    closeTime: 1.1,
    cooldown: 0,
    // Left of the window when looking at the west/exterior wall from inside the room.
    door: { x: -3.5, y: 0, z: 2.1, width: 1.05, height: 2.05 },
    stand: { x: -2.85, y: 0, z: 2.1 },
    alternateStand: { x: -2.85, y: 0, z: 1.65 },
    handle: { x: -3.44, y: 1, z: 1.7 },
  },
  kitchen: {
    wait: 4,
    reach: 1.15,
    stillSpeed: 0.25,
    takeTime: 1.2,
    offerTime: 1.2,
    offerTimeout: 10,
    foodTimeout: 60,
    cooldown: 35,
  },
  /** Watching the ballgame on TV (WatchTheGame, only while the World Series special is on). */
  watchGame: {
    /** In front of a TV: this near and far (m, flat), and within this angle of straight on (rad). */
    near: 0.6,
    reach: 3.6,
    halfAngle: 1.1,
    /** Turning to face the screen as he sits (rad/s). */
    turnRate: 5,
    cooldown: 0,
    cheer: 'HOME RUN! GO PADRES!',
  },
  /**
   * Watch TV (WatchTv, any show full screen): only when he's stopped, close, in front and facing it (owner,
   * 2026-10-05: it was offered too far round a TV). Metres, radians, m/s.
   */
  watchTv: {
    near: 0.6,
    reach: 2.1,
    /** In front: within this of straight out from the screen. */
    halfAngle: 0.75,
    /** Facing it: his heading within this of the way to the screen. */
    facing: 0.6,
    /** Stopped: slower than this. */
    stillSpeed: 0.12,
  },
  /** Begging at the dinner table (DinnerBeg): the human sat eating at the dining table, Moke beside their chair. */
  dinner: {
    /** Moke's feet within this of their seat (m), on the floor (feet this low), and no further back than this (m). */
    reach: 0.95,
    floor: 0.15,
    behind: 0.2,
    stillSpeed: 0.25,
    /** Sitting there quietly this long before begging works (s). */
    wait: 1.5,
    /** Saying no (s), then a sigh before they give in. */
    refuseTime: 2.4,
    sighTime: 1.4,
    /** Picking a meatball off the plate, then holding it down to him until he takes it (or gives up waiting). */
    takeTime: 1.1,
    offerTime: 1.1,
    offerTimeout: 8,
    /** How high over his feet they hold it (m): just above his nose as he sits up. */
    offerHeight: 0.5,
    cooldown: 45,
    lines: {
      refuse: 'Moke… no begging at the table.',
      giveIn: 'Oh, alright. Just one bite.',
      keep: 'Suit yourself. More for me!',
    },
  },
} as const;
