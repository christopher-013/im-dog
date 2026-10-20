import { RIDE } from '../config/ride';
import type { DriveView } from './CoastDrive';

/** One unhurried pass over the route's quarters, shared by manual and FSD rides. Never loops. */
export class RideCameraTour {
  private index = 0;
  private manualLeft = 0;

  reset(): void {
    this.index = 0;
    this.manualLeft = 0;
  }

  manual(): void {
    this.manualLeft = RIDE.cameraTour.manualHold;
  }

  /** `available`: the car's views (a car with an Inside view tours it in Behind's place). */
  update(dt: number, ready: boolean, progress: number, available: readonly DriveView[] = RIDE.cameraTour.views): DriveView | null {
    if (!ready || dt <= 0) return null;
    this.manualLeft = Math.max(0, this.manualLeft - dt);
    if (this.manualLeft > 0) return null;
    const views = tourViews(available);
    // Route progress adapts to the cars' different takeoff/start times and slower neighborhood travel.
    const index = Math.min(views.length - 1, Math.floor(Math.max(0, progress) * views.length));
    if (index <= this.index) return null;
    this.index = index; // no rapid catch-up sequence after a long frame; hold the last shot through arrival
    return views[this.index]!;
  }
}

/** The tour's shots for a car with these views. */
export function tourViews(available: readonly DriveView[]): readonly DriveView[] {
  return available.includes('cabin') ? RIDE.cameraTour.cabinViews : RIDE.cameraTour.views;
}
