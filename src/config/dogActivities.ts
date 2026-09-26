/**
 * Dog activities (Phase 4): Treat Hunt, Perfect Nap, Make Human Play. Metres and seconds. Each starts naturally
 * (no menu), runs, succeeds or is called off, then rests (cooldown) before it can happen again.
 */
export const DOG_ACTIVITIES = {
  treatHunt: {
    /** Moke within this of the human (and in view) for a trick or pestering to start a hunt. */
    triggerRange: 3.2,
    /** Closer than this they notice him whichever way they face. */
    closeRange: 2,
    /** Chance a trick starts one (after the first, which always does), and that getting their attention does. */
    trickChance: 0.6,
    engagedChance: 0.5,
    cooldown: 90,
    settleTime: 2,
    /** The human's errand: walking (give up after), rummaging in the jar, "stay…", hiding it. */
    walkTimeout: 30,
    rummageTime: 1.3,
    showTime: 1.8,
    hideTime: 1.1,
    /** Hide it at least this far from Moke, and no further than this walk for the human. */
    minFromMoke: 3,
    maxWalk: 10,
    /** Help, if it's taking a while: "warmer" when he's this close after this long; the room; then pointing. */
    warmRange: 2.2,
    warmHintAfter: 30,
    roomHintAfter: 55,
    pointAfter: 100,
    pointTime: 5,
    /** The hidden treat's smell carries further than a treat in the hand. */
    scentRadius: 8,
  },
  perfectNap: {
    /** Lying down this long counts as a nap (then it's judged). */
    napTime: 6,
    /** The human counts as "right here" within this; the TV or cooking within this spoils the quiet. */
    nearHuman: 3.2,
    noiseRange: 4.5,
    /** This many of the five good things (sunny, soft, warm, quiet, my human near) make it perfect. */
    perfectAt: 4,
    cooldown: 30,
    settleTime: 4,
    /** A "z" over him this often while he naps. */
    zzzEvery: 2.2,
  },
  makeHumanPlay: {
    /** Carrying a toy this close to the human counts as asking. */
    askRange: 1.8,
    /** Dropped this close to them counts as putting it at their feet. */
    dropRange: 1.4,
    /** Asks they hold out for (a random number in this range), and how far apart asks must be to count. */
    asks: [2, 4] as const,
    askGap: 2.2,
    /** Hanging about with it this long counts as another ask. */
    waitAsk: 5,
    /** Wandering off this far, this long, while asking: never mind. */
    leaveRange: 5,
    leaveAfter: 10,
    /** Throws per game (random in range), and how far (m). */
    throws: [3, 5] as const,
    throwDistance: [2.4, 4.4] as const,
    throwTime: 0.75,
    /** Reaching for a toy this close; waiting for him to bring it back or drop it (s). */
    reach: 0.75,
    fetchWait: 18,
    /** Keep-away: they chase a few playful steps (at this speed), then give up laughing. */
    keepAwayRange: 3.5,
    chaseSpeed: 1.35,
    chaseTime: 4,
    cooldown: 60,
    settleTime: 2,
  },
} as const;
