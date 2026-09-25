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
  /**
   * Mid-range layers for the two low sounds, so they survive a phone's small speaker (which plays almost nothing
   * below ~400 Hz): the growl's throaty rasp (gain of a 1.15 kHz band) and a soft "tock" on the drop (peak; 0 = none).
   * Measured through a phone-speaker filter (two 400 Hz high-passes): growl −36.7 → −29.0 dB, drop −42 → −32.4 dB
   * (the bark is −26.4); on full-range speakers both change by under 0.5 dB.
   */
  speakerPresence: { growlRasp: 2.5, dropTap: 0.45 },
  /** Random pitch variation (±fraction), so repeated sounds don't feel canned. */
  pitchVariation: 0.08,
  /**
   * iPhone audio session (Safari's Audio Session API). 'playback' is heard even with the ringer switch on silent,
   * like a video, and pauses other apps' music while the game plays sound. 'ambient' would respect the silent
   * switch and mix with music instead.
   */
  iosSession: 'playback',
} as const;
