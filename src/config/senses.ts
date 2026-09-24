/**
 * Sniff mode (Q): tuning and the look of scent wisps. Units: metres, seconds.
 */
export const SNIFF = {
  /** How long one press of Q lasts, including the fades. */
  duration: 4,
  fadeIn: 0.35,
  fadeOut: 0.9,
  /** Pause after sniff mode ends before Q works again. */
  cooldown: 0.4,
  /** At most this many sources show at once (the nearest/strongest). */
  maxSources: 6,
  /** Nose position relative to Moke's feet: ahead and up (m). */
  noseForward: 0.2,
  noseHeight: 0.3,
} as const;

export const SCENT_WISPS = {
  /** Particles per shown source, plus one soft "pulse" glow at its base. Total budget = maxSources × (this + 1). */
  particlesPerSource: 22,
  /** Seconds for one particle to drift from the source and fade. */
  life: 2.4,
  /** How high a wisp rises (m) and how far it leans toward Moke's nose (0..1 of the way). */
  rise: 0.55,
  leanToNose: 0.35,
  /** Sideways wobble (m). */
  wobble: 0.06,
  /** Particle size (m at 1 m from the camera). */
  size: 0.06,
  pulseSize: 0.3,
  maxAlpha: 0.9,
} as const;

/** Soft, warm colours per scent category (hex). */
export const SCENT_COLORS = {
  FOOD: '#f2a65a',
  TREAT: '#f6c453',
  OWNER: '#b89cf0',
  FAMILY: '#f09cc0',
  SOCK: '#a98bff',
  TOY: '#2fbf94',
  OUTSIDE: '#8fce6a',
  INTERESTING: '#ffad3b',
} as const;
