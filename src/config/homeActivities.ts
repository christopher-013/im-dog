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
} as const;
