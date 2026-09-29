/** Malibu, the green-cheeked conure in the gym (see world/Conure.ts): its behaviour tuning (seconds, metres, radians). */
export const CONURE = {
  /** Seconds sitting still between moves (min, random extra). */
  sit: [1.2, 3.5] as const,
  /** A hop between perches: its duration and how high it arcs. */
  hopTime: 0.42,
  hopHeight: 0.07,
  /** A side-step along the same perch. */
  stepTime: 0.28,
  /** Moke within this distance: the bird turns to watch him. */
  watchDistance: 3.2,
  /** A bark within this distance startles it up to the top perch. */
  startleDistance: 6,
  /** How far it can turn its head toward something (rad). */
  maxHeadYaw: 1.3,
  /** Playing with Moke: how long, one bounce (up and down) and how high, and a chirp this often. */
  playTime: 2.8,
  bounceTime: 0.3,
  bounceHeight: 0.06,
  chirpEvery: 0.55,
  /** Moke must be at least this close to the cage's middle to start a game (m). */
  playReach: 1.6,
  /** "Play with Malibu" shows when his feet are this close to the cage's front (m). */
  frontReach: 0.85,
  /** Landing on a perch (to play, or fleeing a bark), it keeps at least this far from either end (m). */
  perchEnd: 0.05,
} as const;
