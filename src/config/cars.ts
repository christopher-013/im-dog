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
    /**
     * The time circuits (owner, 2026-10-20, the film's times): destination Nov 05 1955 06:00 AM, last time departed
     * Oct 26 1985 01:21 AM; the present row shows the player's own date and time. In the cockpit scene the destination
     * is keyed in from `typeFrom` s over `typeFor` s. Months 1–12, 24-hour clock.
     */
    timeCircuits: {
      destination: { year: 1955, month: 11, day: 5, hour: 6, min: 0 },
      lastDeparted: { year: 1985, month: 10, day: 26, hour: 1, min: 21 },
      typeFrom: 0.5, typeFor: 2.2,
      /** Where the unit sits (car space), and its face's size (m). */
      at: [0.06, 0.66, 0.6] as const, size: [0.4, 0.3] as const,
    },
    /** The Inside view on the road: from between the seats (the flux capacitor behind), over the time circuits. */
    cabinView: { pos: [0, 1.17, -0.32] as const, look: [0.04, 0.72, 0.62] as const, fov: 62 },
    /** The flux capacitor surges (brighter, faster, more arcs) as the cockpit scene reaches it: from, to (s). */
    fluxSurge: [4.6, 6.6] as const,
    /**
     * Pulling out of the driveway (owner, 2026-10-20): the time circuits being set, close up; a pan round past the dog
     * to the flux capacitor behind the seats as it surges; then a cut to the takeoff (`CarIntro`). A slow roll, so it
     * stops at the end of the driveway, the house still behind it for the takeoff shot.
     */
    intro: {
      seconds: 9.4, creep: 1.0, stop: true, blend: 0,
      shots: [
        { at: 0, pos: [0.06, 1.04, 0.06] as const, look: [0.07, 0.68, 0.56] as const, fov: 44 },
        { at: 3.2, pos: [0.05, 1.02, 0.12] as const, look: [0.07, 0.67, 0.56] as const, fov: 40 },
        { at: 4.6, pos: [0, 1.08, 0.3] as const, look: [-0.5, 0.82, 0.05] as const, fov: 50 },
        { at: 5.8, pos: [-0.06, 1.12, 0.4] as const, look: [0, 0.99, -0.58] as const, fov: 44 },
        { at: 8.8, pos: [-0.04, 1.06, 0.18] as const, look: [0, 0.99, -0.58] as const, fov: 38 },
      ],
    },
  },
  /**
   * The black talking car (owner, 2026-10-20: KITT from Knight Rider; D37): a low early-80s T-top coupe, built in code.
   * Metres, car space (+z forward, passenger −x). `doorSwing`: how far (rad) a door swings out on its front hinge.
   */
  kitt: {
    length: 4.73, width: 1.84, height: 1.3,
    /** Its rear plate (owner, 2026-10-20), in the family car's fictional California style. */
    plate: 'KITT',
    wheelRadius: 0.32, wheelWidth: 0.23, frontAxle: 1.06, rearAxle: -1.48,
    doorSwing: 0.7,
    passenger: [-0.4, 0.33, -0.5] as const,
    driver: [0.4, 0.2, -0.5] as const,
    window: [-0.9, 1.0, -0.42] as const,
    headOut: { x: -0.38, y: 0.33, z: 0.08, heading: -Math.PI / 2 + 0.25, pitch: 0, headPitch: 0.3 },
    /**
     * The red scanner in the nose: `segments` lamps across `width` m; the light sweeps across and back once every
     * `period` s, leaving a fading trail (`trail`: how many steps of it, each `trailStep` s behind).
     */
    scanner: { width: 0.84, height: 0.06, segments: 8, period: 1.6, trail: 6, trailStep: 0.06 },
    /** The voice box: talking for `talkFor` s out of every `talkEvery` s (three columns of red bars). */
    voice: { talkEvery: 6, talkFor: 3.4 },
    /** The Inside view: between the two of them, looking down over the console to the dash (car space). */
    cabinView: { pos: [0, 1.08, -0.85] as const, look: [0, 0.46, 0.12] as const, fov: 64 },
    /**
     * Pulling out of the driveway (owner, 2026-10-20): the voice box talking, close up; then over to the yoke and the
     * dash; then back for the road ahead through the windshield, gliding into the drive's views (`CarIntro`).
     */
    intro: {
      seconds: 7.6, creep: 2.4, stop: false, blend: 1.4,
      shots: [
        { at: 0, pos: [-0.02, 0.86, -0.42] as const, look: [0, 0.38, 0.12] as const, fov: 40 },
        { at: 2.8, pos: [0, 0.8, -0.3] as const, look: [0, 0.37, 0.12] as const, fov: 34 },
        { at: 4.4, pos: [-0.08, 1.02, -0.66] as const, look: [0.34, 0.62, 0.1] as const, fov: 50 },
        { at: 7.0, pos: [-0.05, 1.06, -0.76] as const, look: [0.12, 0.68, 0.6] as const, fov: 60 },
      ],
    },
  },
} as const;
