/** Ride presentation only. Both cars run the same boarding, coast drive and return. */
export const CAR_IDS = ['family', 'delorean'] as const;
export type CarId = (typeof CAR_IDS)[number];
export const CARS = {
  storageKey: 'imdog.cars',
  family: { plate: 'OUTXTIME' },
  delorean: {
    length: 4.4, width: 1.94, height: 1.43,
    wheelRadius: 0.32, wheelWidth: 0.21, frontAxle: 1.26, rearAxle: -1.28,
    doorLift: 1.10,
    passenger: [-0.45, 0.39, 0.10] as const,
    driver: [0.45, 0.27, 0.10] as const,
    window: [-0.91, 1.02, 0.10] as const,
    headOut: { x: -0.34, y: 0.28, z: 0.08, heading: -Math.PI / 2 + 0.25, pitch: -0.2, headPitch: 0.3 },
  },
} as const;
