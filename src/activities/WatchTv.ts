import { HOME_ACTIVITIES } from '../config/homeActivities';
import type { Interactable } from '../interactions/Interactable';
import type { Vec3Like } from '../physics/CharacterBody';
import type { TvScreenSpot } from '../world/home/places';
import { screenInFront } from './WatchTheGame';

export interface WatchTvDeps {
  readonly screens: readonly TvScreenSpot[];
  /** The World Series special is on (then it's Watch the Game instead, with its own close-up). */
  readonly specialOn: () => boolean;
  /** Turned on (the screen) or off (null): the game shows that TV full screen, Moke sits and watches. */
  readonly onWatch: (screen: TvScreenSpot | null) => void;
}

/**
 * Watch TV (Phase 5, owner request 2026-10-05): in front of any TV, "Watch TV" puts whatever's on it full screen while
 * Moke sits and watches; any button (or a tap) and he's done. No human needed, nothing to win, and it doesn't stop the
 * house: the shows run on their own clocks, so it's whatever's on right then. During the World Series special it's
 * Watch the Game instead.
 */
export class WatchTv {
  /** The TV he's in front of, if any. */
  nearby: TvScreenSpot | null = null;
  /** The TV he's watching full screen, or null. */
  watching: TvScreenSpot | null = null;
  readonly interactable: Interactable;

  constructor(private readonly deps: WatchTvDeps) {
    const tv = this;
    this.interactable = {
      id: 'tv:show', type: 'REST', label: 'Watch TV', interactionDistance: HOME_ACTIVITIES.watchTv.reach + 0.3,
      priority: 25, requiresFacing: false, requiresClearPath: false,
      get position() { return tv.nearby ?? deps.screens[0]!; },
      get enabled() { return tv.nearby !== null && tv.watching === null && !deps.specialOn(); },
      interact: () => this.start(),
    };
  }

  /**
   * Each fixed step: is he stopped, close in front of a TV and facing it (on the floor, nothing in his mouth, not
   * napping)? `heading`: the way he faces (radians, 0 = +z).
   */
  update(moke: { readonly position: Vec3Like; readonly heading: number; readonly speed: number; readonly carrying: string | null; readonly napping: boolean }): void {
    const t = HOME_ACTIVITIES.watchTv;
    const p = moke.position;
    const screen = !moke.carrying && !moke.napping && moke.speed <= t.stillSpeed ? screenInFront(this.deps.screens, p, t) : null;
    const toward = screen ? Math.atan2(screen.x - p.x, screen.z - p.z) : 0;
    const off = Math.abs(Math.atan2(Math.sin(toward - moke.heading), Math.cos(toward - moke.heading)));
    this.nearby = screen && off <= t.facing ? screen : null;
    // The special cutting in: off to Watch the Game instead.
    if (this.watching && this.deps.specialOn()) this.stop();
  }

  start(): boolean {
    if (!this.nearby || this.watching || this.deps.specialOn()) return false;
    this.watching = this.nearby;
    this.deps.onWatch(this.watching);
    return true;
  }

  /** Done watching (any button, a pause, the special). */
  stop(): void {
    if (!this.watching) return;
    this.watching = null;
    this.deps.onWatch(null);
  }
}
