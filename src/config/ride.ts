/**
 * Going for a ride (Phase 6, D33): the human's offer, the harness and leash, the walk to the Garage, and the drive.
 * Seconds and metres; game coordinates (x east, z south). Where the Garage and the car are: `GARAGE` (layout.ts).
 */
export const RIDE = {
  /** The human offers a ride every 5–10 minutes of play (owner), timed from the last one (taken or declined). */
  offerEvery: [300, 600] as const,
  /** They come over to him and ask from about this close. */
  askFrom: 1.5,
  /** He says yes (the prompt, or a bark) within this long and this close; walking off this far is a no. */
  answerWithin: 15,
  answerReach: 1.9,
  walkAwayAt: 5,
  /** Kneeling to put his harness on. */
  harnessTime: 1.6,
  /** Walking him to the Garage door: he keeps within this of them (the leash); they wait up to this long for him. */
  leash: 1.0,
  /** At heel (beside and a little behind them), he stands still once he's this close to his spot. */
  heel: 0.35,
  waitForHim: 12,
  /** Where the human stands to open the Garage door (in the living room, in front of it). */
  doorStand: { x: 2.45, z: 2.45 },
  /** They set off but can't get to him or the door: give up after this long. */
  walkTimeout: 40,
  /**
   * His pose in the car on the road (in the passenger seat's space, its cushion top): standing up on the seat turned
   * to the window, head and shoulders out; or sitting back facing forward ("head in").
   */
  dogInCar: {
    headOut: { x: -0.43, y: 0.33, z: 0.08, heading: -Math.PI / 2 + 0.25 },
    headIn: { x: 0.0, y: 0.0, z: 0.02, heading: 0 },
  },
  lines: {
    ask: 'Moke, want to go for a ride?',
    yes: 'Yes? Let’s go! Harness on…',
    no: 'Okay, maybe later.',
    home: 'Best ride ever, Moke!',
  },
} as const;
