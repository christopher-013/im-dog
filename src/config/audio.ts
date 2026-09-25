/** Audio levels (0..1). Every sound is synthesized in code (src/audio/synth.ts). */
export const AUDIO = {
  master: 0.8,
  bark: 0.55,
  growl: 0.32,
  sniff: 0.35,
  pickup: 0.3,
  drop: 0.35,
  // Sock Heist.
  surprise: 0.3,
  whoosh: 0.28,
  treatBag: 0.3,
  crunch: 0.4,
  discovery: 0.35,
  /** Random pitch variation (±fraction), so repeated sounds don't feel canned. */
  pitchVariation: 0.08,
} as const;
