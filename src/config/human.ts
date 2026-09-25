/**
 * The human in the living room (Phase 3, Sock Heist). Metres, seconds, radians.
 * They're meant to lose: slower and clumsier than Moke, never able to squeeze where he can.
 */
export const HUMAN = {
  body: {
    /** Collision capsule: wide enough that dog-sized gaps (under the coffee table) stay dog-only. */
    radius: 0.24,
    halfHeight: 0.58,
    skin: 0.02,
    mass: 70,
    maxSlopeClimb: Math.PI / 4,
    snapToGround: 0.1,
  },
  move: {
    /** Walking about the house, and hurrying after Moke (he trots at 1.8 and runs at 4.0). */
    walkSpeed: 1.05,
    hurrySpeed: 2.05,
    acceleration: 3.2,
    braking: 5,
    /** Turn rate (rad/s): people pivot slowly compared with a small dog. */
    turnRate: 4.2,
    /** Close enough to a target point (m). */
    arriveDistance: 0.12,
    /** Re-plan a path at least this often (s) while the goal moves. */
    replanEvery: 0.45,
    /** If the body makes less than this much progress (m) over `stuckTime` (s), re-plan or skip a waypoint. */
    stuckProgress: 0.05,
    stuckTime: 0.8,
  },
  sight: {
    /** How far they can make out a small dog, and the half-angle of their view (60° either side). */
    range: 6,
    halfAngle: 1.05,
    eyeHeight: 1.5,
    /** Kneeling (offering a treat). */
    crouchEyeHeight: 0.62,
    /** Bent right down to peek under the furniture while searching. */
    peekEyeHeight: 0.34,
    /** They always notice a dog this close, whatever they're looking at. */
    feelRange: 0.9,
    /** Aim at Moke's back rather than his feet. */
    targetHeight: 0.28,
    /** Barks carry this far. */
    hearingRange: 7,
  },
  /** Folding laundry: every so often they look round at the room for a moment. */
  glance: { every: [5.5, 3.5] as const, duration: 2.2, angle: 2.2 },
  /** Seen for this long (s) before it registers: a fair beat to get away with it. */
  noticeDelay: 0.35,
  /** The "!" moment before the chase. */
  reactTime: 1.1,
  chase: {
    /** A grab starts inside this distance (feet to feet, m), at a dog in front of them (± this angle)... */
    grabReach: 0.62,
    grabAngle: 0.9,
    /** Only at a dog slower than this (m/s): one sprinting past is gone before they can try. */
    grabBelowSpeed: 2.6,
    /** ...winds up for this long, then always fumbles (no punishment, just comedy)... */
    lungeTime: 0.45,
    /** ...and they need this long to recover, and this long before trying again. */
    recoverTime: 1.3,
    grabCooldown: 3,
    /** He's under the furniture within this (m): a standoff, peering at him. Patience runs out this much faster. */
    standoffRange: 1.4,
    standoffRate: 2,
    /** Out of sight this long (s) and they go looking. */
    loseAfter: 1.6,
    /** How long they look around the last place they saw him. */
    searchTime: 4.5,
    /** Frustration: chasing adds 1 per second; each fumble and each time Moke gets away adds more. */
    missPenalty: 4,
    lostPenalty: 5,
    /** At this much frustration, chasing stops working and they change strategy (a treat). */
    giveUpAt: 48,
    /** "Okay… new plan." */
    giveUpTime: 1.6,
  },
  treat: {
    /** Rummaging in the treat jar. */
    rummageTime: 1.4,
    /** How near Moke to kneel with the treat (m), and how close he must come to trade. */
    offerDistance: 1.35,
    tradeDistance: 0.95,
    /** Calling "Moke!" again, and walking closer if he stays away this long. */
    callEvery: 6,
    repositionAfter: 18,
    /** A dropped sock within this of them counts as handed over. */
    closeEnoughDrop: 1.3,
  },
  /** Taking the sock, then putting the treat down for him. */
  exchangeTime: 1.1,
  /** Putting the sock back in the basket. */
  tidyTime: 0.9,
} as const;
