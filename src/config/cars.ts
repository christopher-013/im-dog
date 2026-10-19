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
    flux: { size: [0.34, 0.37] as const, position: [0, 0.99, -0.584] as const,
      pulseRate: 0.75, chargeRate: 1.15, brightness: 1.3 },
    hover: {
      wheelDelay: 0.8, wheelSeconds: 2.4, liftDelay: 0.6, liftSeconds: 3.2,
      height: 0.65, bob: 0.03, bobRate: 1.7, wheelOut: 0.10, wheelDrop: 0.17,
      color: '#65cfff', poolOpacity: 0.72, plumeOpacity: 0.62, revealSeconds: 5.5, revealBlend: 1.0,
      camera: { pos: [-4.8, 1.65, 5.8] as const, look: [0, 0.55, 0] as const, fov: 55 },
    },
    passenger: [-0.45, 0.39, 0.10] as const,
    driver: [0.45, 0.27, 0.10] as const,
    window: [-0.91, 1.02, 0.10] as const,
    headOut: { x: -0.34, y: 0.28, z: 0.08, heading: -Math.PI / 2 + 0.25, pitch: -0.2, headPitch: 0.3 },
  },
} as const;
