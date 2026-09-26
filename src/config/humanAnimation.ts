/**
 * How the human moves (the animation, not the behaviour). Metres, seconds, radians. See docs/HUMAN_SYSTEM.md.
 */
export const HUMAN_ANIMATION = {
  /** Walking: step length grows with speed (m); the cadence follows from it, so the feet don't slide. */
  walk: { baseStep: 0.45, stepPerSpeed: 0.28, maxStep: 1.0, kneeLift: 0.95, armSwing: 0.85, pelvisTurn: 0.3, chestTurn: 0.45, sway: 0.022, bob: 0.8 },
  /** Turning on the spot or side-stepping: small steps instead of a pivot. */
  step: { minTurnRate: 0.45, minSideSpeed: 0.08, rate: 7, kneeLift: 0.55, turnFoot: 0.35 },
  /** Crossfading between actions (s): how long the new one takes to come in. */
  blend: { default: 0.45, quick: 0.25, slow: 0.7 },
  /** Final smoothing per joint (per second): removes any leftover pops without adding lag. */
  jointSmoothing: 14,
  /**
   * Looking at things: the eyes lead, the head and neck follow, the upper body helps for targets well to the side;
   * never past these limits (rad). Beyond them the body must turn (gameplay does that when it matters).
   */
  look: {
    eyes: { yaw: 0.3, pitch: 0.2 },
    headNeck: { yaw: 1.0, up: 0.35, down: 0.6 },
    torso: { yaw: 0.45, down: 0.35 },
    /** How quickly the gaze moves (rad/s) and how quickly attention comes and goes (per second). */
    headSpeed: 3.2,
    eyeSpeed: 9,
    attentionRate: 2.6,
  },
  /** Reaching for something (petting Moke): the arm stays inside this share of its length; the back bends to help. */
  reach: { comfort: 0.9, maxLean: 1.05 },
  /** Idle life: breathing, and a slow shift of weight every so often. */
  idle: { breathe: 0.014, shiftEvery: [5, 9] as const, shift: 0.02 },
} as const;
