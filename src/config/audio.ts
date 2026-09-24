/** Audio levels (0..1). All Phase 1 sounds are synthesized in code (src/audio/synth.ts). */
export const AUDIO = {
  master: 0.8,
  bark: 0.55,
  sniff: 0.35,
  pickup: 0.3,
  drop: 0.35,
  /** Random pitch variation (±fraction), so repeated sounds don't feel canned. */
  pitchVariation: 0.08,
} as const;
