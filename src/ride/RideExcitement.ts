import { RIDE } from '../config/ride';

/** Happy bark pairs while awaiting the human, stopping at harness preparation. No activity bark events. */
export class RideExcitement {
  private left = 0;
  private beat = 0;

  update(dt: number, waiting: boolean): boolean {
    if (!waiting) { this.left = 0; this.beat = 0; return false; }
    if (dt <= 0) return false;
    this.left -= dt;
    if (this.left > 0) return false;
    this.left = RIDE.excitedBarks[this.beat]!;
    this.beat = (this.beat + 1) % RIDE.excitedBarks.length;
    return true; // never catch up with a burst after a long frame
  }
}
