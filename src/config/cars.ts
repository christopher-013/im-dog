/** Ride presentation only. Every car runs the same boarding, coast drive and return. */
export const CAR_IDS = ['family', 'delorean', 'kitt'] as const;
export type CarId = (typeof CAR_IDS)[number];
export const CARS = {
  storageKey: 'imdog.cars',
  family: { plate: 'OUTXTIME' },
  delorean: {
    length: 4.4, width: 1.94, height: 1.43,
    wheelRadius: 0.32, wheelWidth: 0.21, frontAxle: 1.26, rearAxle: -1.28,
    doorLift: 1.10,
    flux: { size: [0.34, 0.37] as const, position: [0, 0.99, -0.584] as const,
      pulseRate: 0.75, chargeRate: 1.15, brightness: 1.3 },
    hover: {
      wheelDelay: 0.8, wheelSeconds: 2.4, liftDelay: 0.6, liftSeconds: 3.2,
      height: 0.65, bob: 0.03, bobRate: 1.7, wheelOut: 0.10, wheelDrop: 0.17,
      color: '#65cfff', poolOpacity: 0.72, plumeOpacity: 0.62, revealSeconds: 5.5, revealBlend: 1.0,
      camera: { pos: [-8.8, 3.5, 11] as const, look: [-3, 2, -5] as const, fov: 57 },
    },
    passenger: [-0.45, 0.39, 0.10] as const,
    driver: [0.45, 0.27, 0.10] as const,
    window: [-0.91, 1.02, 0.10] as const,
    headOut: { x: -0.34, y: 0.28, z: 0.08, heading: -Math.PI / 2 + 0.25, pitch: -0.2, headPitch: 0.3 },
  },
  /**
   * The black talking car (owner, 2026-10-20: KITT from Knight Rider; D37): a low early-80s T-top coupe, built in code.
   * Metres, car space (+z forward, passenger −x). `doorSwing`: how far (rad) a door swings out on its front hinge.
   */
  kitt: {
    length: 4.73, width: 1.84, height: 1.3,
    wheelRadius: 0.33, wheelWidth: 0.23, frontAxle: 1.42, rearAxle: -1.14,
    doorSwing: 0.7,
    passenger: [-0.4, 0.33, -0.2] as const,
    driver: [0.4, 0.2, -0.2] as const,
    window: [-0.9, 1.0, -0.1] as const,
    headOut: { x: -0.38, y: 0.33, z: 0.08, heading: -Math.PI / 2 + 0.25, pitch: 0, headPitch: 0.3 },
    /**
     * The red scanner in the nose: `segments` lamps across `width` m; the light sweeps across and back once every
     * `period` s, leaving a fading trail (`trail`: how many steps of it, each `trailStep` s behind).
     */
    scanner: { width: 0.84, height: 0.06, segments: 8, period: 1.6, trail: 6, trailStep: 0.06 },
    /** The voice box: talking for `talkFor` s out of every `talkEvery` s (three columns of red bars). */
    voice: { talkEvery: 6, talkFor: 3.4 },
    /** The Inside view: between the two of them, looking down over the console to the dash (car space). */
    cabinView: { pos: [0, 1.1, -0.55] as const, look: [0, 0.44, 0.42] as const, fov: 64 },
  },
} as const;
