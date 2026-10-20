import type { Group, Vector3 } from 'three';
import type { CarId, CARS } from '../config/cars';
import type { RIDE } from '../config/ride';

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
  readonly cabinView?: { readonly pos: readonly [number, number, number]; readonly look: readonly [number, number, number]; readonly fov: number };
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
