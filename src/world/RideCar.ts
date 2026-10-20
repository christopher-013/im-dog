import type { Group, Vector3 } from 'three';
import type { CarId, CARS } from '../config/cars';
import type { RIDE } from '../config/ride';

type Vec3 = readonly [number, number, number];

/**
 * A car's cockpit scene as the drive begins (owner, 2026-10-20): while it rolls slowly out of the driveway (`creep`,
 * m/s; `stop`: easing to a halt by the end, before a takeoff), the camera moves through `shots` (car space; `at`: s
 * from the start), then glides over `blend` s into the road's views (0: cuts).
 */
export interface CarIntro {
  readonly seconds: number;
  readonly creep: number;
  readonly stop: boolean;
  readonly blend: number;
  readonly shots: readonly { readonly at: number; readonly pos: Vec3; readonly look: Vec3; readonly fov: number }[];
}

/** The ride depends on attachment points and animations, never on a particular car's mesh. */
export interface RideCar {
  readonly id: CarId;
  readonly object: Group;
  readonly seats: { readonly passenger: Vector3; readonly driver: Vector3 };
  readonly window: Vector3;
  readonly headOut: Readonly<Record<keyof typeof RIDE.dogInCar.headOut, number>>;
  /** Optional presentation capability; the shared drive never needs to branch on car id. */
  readonly hover?: typeof CARS.delorean.hover;
  setHover?(amount: number, time: number): void;
  /** Optional Inside view on the road (car space: camera, what it looks at, vertical FOV): a car with a cabin to see. */
  readonly cabinView?: { readonly pos: Vec3; readonly look: Vec3; readonly fov: number };
  /** Optional cockpit scene as the drive begins (see `CarIntro`). */
  readonly intro?: CarIntro;
  /** The intro's own effects, `t` s into it (or null: it's over, or never was). */
  setIntro?(t: number | null): void;
  /** Absolute simulation time, frozen by pause. Optional model-only effects. */
  updatePresentation?(time: number): void;
  setPassengerDoor(open: number): void;
  setDriverDoor(open: number): void;
  setPassengerWindow(down: number): void;
  /** Both roof doors greeting the passengers; single hinges on the DeLorean, double hinges on the SUV. */
  setFalconDoors(open: number): void;
  readonly passengerDoorOpen: number;
  readonly driverDoorOpen: number;
  readonly passengerWindowDown: number;
  readonly falconDoorsOpen: number;
  roll(distance: number): void;
  dispose(): void;
}
