import { RIDE } from '../config/ride';
import type { DriveView } from './CoastDrive';

/**
 * One unhurried pass over every view the car has, shared by manual and FSD rides. Never loops. Each view gets an
 * equal share of the time on the road (owner, 2026-10-20: "evenly times each view so all are shown before the drive
 * ends"): the share so far is the time the tour has run against that plus the drive's own estimate of what's left.
 */
export class RideCameraTour {
  private index = 0;
  private manualLeft = 0;
  /** Seconds the tour's been running (not paused, not in the cockpit scene or a takeoff). */
  private elapsed = 0;

  reset(): void {
    this.index = 0;
    this.manualLeft = 0;
    this.elapsed = 0;
  }

  manual(): void {
    this.manualLeft = RIDE.cameraTour.manualHold;
  }

  /** `remaining`: about how many seconds of the drive are left; `available`: the car's views. */
  update(dt: number, ready: boolean, remaining: number, available: readonly DriveView[] = RIDE.cameraTour.views): DriveView | null {
    if (!ready || dt <= 0) return null;
    this.elapsed += dt;
    this.manualLeft = Math.max(0, this.manualLeft - dt);
    if (this.manualLeft > 0) return null;
    const views = tourViews(available);
    const share = this.elapsed / (this.elapsed + Math.max(0, remaining));
    const index = Math.min(views.length - 1, Math.floor(share * views.length));
    if (index <= this.index) return null;
    this.index = index; // no rapid catch-up sequence after a long frame; hold the last shot through arrival
    return views[this.index]!;
  }
}

/** The tour's shots for a car with these views (all of them, in order). */
export function tourViews(available: readonly DriveView[]): readonly DriveView[] {
  return RIDE.cameraTour.views.filter((v) => available.includes(v));
}
