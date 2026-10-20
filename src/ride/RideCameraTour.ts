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

  update(dt: number, ready: boolean, progress: number): DriveView | null {
    if (!ready || dt <= 0) return null;
    this.manualLeft = Math.max(0, this.manualLeft - dt);
    if (this.manualLeft > 0) return null;
    // Route progress adapts to both cars' different takeoff/start times and slower neighborhood travel.
    const index = Math.min(RIDE.cameraTour.views.length - 1, Math.floor(Math.max(0, progress) * RIDE.cameraTour.views.length));
    if (index <= this.index) return null;
    this.index = index; // no rapid catch-up sequence after a long frame; hold the last shot through arrival
    return RIDE.cameraTour.views[this.index]!;
  }
}
