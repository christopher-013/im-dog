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
  /**
   * The dog can ask too (owner, 2026-10-17): **Bark at the Garage Door** from about here (or any bark this close to
   * it), and the human comes over and offers a ride. He looks at the door while he barks (`lookAt`, s).
   */
  askAt: { x: 2.45, z: 2.55, reach: 1.0, lookAt: { x: 2.45, y: 1.0, z: 3.0 }, lookFor: 2.5 },
  /** They set off but can't get to him or the door: give up after this long. */
  walkTimeout: 40,
  /**
   * His pose in the car on the road (in the passenger seat's space, its cushion top): up at the window, inside the
   * car, with just his head and neck out over the sill in the wind (the default; owner, 2026-10-17: riding in the car,
   * not floating outside the window, and no paws through the door). `pitch` tips him nose-up a little (rad) and
   * `headPitch` lifts his head; or sitting back facing forward ("head in").
   */
  dogInCar: {
    headOut: { x: -0.37, y: 0.24, z: 0.08, heading: -Math.PI / 2 + 0.25, pitch: -0.2, headPitch: 0.3 },
    headIn: { x: 0.0, y: 0.0, z: 0.02, heading: 0, pitch: 0, headPitch: 0 },
  },
  /**
   * The Garage door glows (owner, 2026-10-17: "pulse with blue light when the dog looks or passes by the door to
   * indicate that there is an adventure close by"): while a ride can be asked for, the door pulses blue when he's
   * within `near` (m) of it, or within `lookRange` and facing it (within `lookAngle`, rad, of straight at it). It
   * fades in over `fadeIn` s and out over `fadeOut` s, pulsing `pulse` times a second, at most `strength` opaque.
   */
  doorGlow: { near: 2.2, lookRange: 6.5, lookAngle: 0.4, fadeIn: 0.5, fadeOut: 1.2, pulse: 0.8, color: '#7cc8ff', strength: 0.9 },
  /**
   * With his head out on the road he pants now and then (owner, 2026-10-17: the tongue out only a few times, at
   * random, not the whole way): a pant starts every `every` s (random in the range) and lasts `lasts` s.
   */
  pant: { every: [6, 13] as const, lasts: [1.4, 2.8] as const },
  /**
   * Looking around on the road (look input turns his head; owner, 2026-10-17): how far (radians: yaw + to his left,
   * toward the front of the car; pitch + up), how quickly his head follows, and after how long left alone he looks
   * about by himself (at the beach and the sea, a new look every few seconds).
   */
  look: {
    yaw: [-1.0, 1.1] as const,
    pitch: [-0.35, 0.45] as const,
    ease: 7,
    idle: 4,
    wander: { yaw: [-0.55, 0.85] as const, pitch: [-0.15, 0.2] as const, every: [2.5, 5.5] as const },
  },
  lines: {
    ask: 'Moke, want to go for a ride?',
    /** When he's asked by barking at the Garage door. */
    asked: 'Barking at the Garage, Moke? Do you want to go for a ride?',
    yes: 'Yes? Let’s go! Harness on…',
    no: 'Okay, maybe later.',
    home: 'Best ride ever, Moke!',
  },
} as const;
