/** Paper-heist timing and distances (metres/seconds). Input devices share the same activity. */
export const BATHROOM_ACTIVITY = {
  approachSpeed: 0.75,
  approachTurnRate: 5,
  approachTolerance: 0.14,
  approachTimeout: 5,
  biteTime: 0.55,
  outsideTrailDistance: 1.1,
  trailSampleDistance: 0.12,
  maxTrailPoints: 160,
  cleanupTime: 3.5,
  humanWaitTimeout: 45,
  walkTimeout: 45,
  cooldown: 25,
} as const;
