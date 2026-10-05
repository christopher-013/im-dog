import { HOME_ACTIVITIES } from '../config/homeActivities';
import type { Interactable } from '../interactions/Interactable';
import type { Vec3Like } from '../physics/CharacterBody';
import type { TvScreenSpot } from '../world/home/places';
import { DogActivity, type DogActivityContext } from './DogActivity';

interface WatchDeps {
  /** Is the World Series special on the TVs? (TvChannels) */
  readonly tv: { readonly specialOn: boolean };
  readonly screens: readonly TvScreenSpot[];
  /** He sits down facing `screen` to watch, or (null) he's done watching. */
  onWatch(screen: TvScreenSpot | null): void;
  /** The home run, while he's watching: up on his hind legs, spinning for joy. */
  onCelebrate(): void;
}
type Tuning = typeof HOME_ACTIVITIES.watchGame;

/**
 * Watching the ballgame (the easter egg): while the World Series special is on every TV, Moke can sit in front of
 * one and watch. When the Padres hit their walk-off home run he jumps up on his hind legs and spins round, thrilled.
 * Moving off stops watching; so does the broadcast ending.
 */
export class WatchTheGame extends DogActivity {
  readonly id = 'watchTheGame' as const;
  readonly name = 'Watch the Game';
  readonly needsHuman = false;
  readonly interactable: Interactable;
  /** The TV he's watching (while it runs), or null. */
  watchingScreen: TvScreenSpot | null = null;
  private nearby: TvScreenSpot | null = null;
  private requested = false;

  constructor(private readonly deps: WatchDeps, private readonly tuning: Tuning = HOME_ACTIVITIES.watchGame) {
    super(tuning.cooldown, 1);
    const activity = this;
    this.interactable = {
      id: 'tv:watch', type: 'REST', label: 'Watch the Game', interactionDistance: tuning.reach,
      // The TV is up on the wall; being in front of it is judged below.
      priority: 30, requiresFacing: false, requiresClearPath: false,
      get position() { return activity.nearby ?? deps.screens[0]!; },
      get enabled() { return activity.state === 'AVAILABLE' && activity.nearby !== null; },
      interact: () => {
        activity.requested = true;
      },
    };
  }

  override get objective(): string | null {
    return this.running ? 'Watching the World Series… come on, Padres!' : null;
  }

  /** The broadcast's big moment (TvChannels.onHomeRun): watching, he celebrates. */
  homeRun(): void {
    if (!this.running) return;
    this.stopWatching();
    this.deps.onCelebrate();
    this.succeed();
  }

  /** He's off somewhere (the player's moving him): no more watching. */
  stop(): void {
    this.cancel();
  }

  override update(dt: number, ctx: DogActivityContext): void {
    this.nearby = this.deps.tv.specialOn && !ctx.moke.carrying && !ctx.moke.napSpot ? this.screenInFront(ctx.moke.position) : null;
    if (!this.nearby && !this.running) this.requested = false;
    super.update(dt, ctx);
  }

  protected wants(): boolean {
    return this.requested && this.nearby !== null;
  }

  protected onStart(): void {
    this.requested = false;
    this.watchingScreen = this.nearby;
    this.deps.onWatch(this.watchingScreen);
    this.activate();
  }

  protected onUpdate(): void {
    // The broadcast's over (he tuned in after the home run): back to normal.
    if (!this.deps.tv.specialOn) {
      this.stopWatching();
      this.succeed();
    }
  }

  protected onCancel(): void {
    this.requested = false;
    this.stopWatching();
  }

  private stopWatching(): void {
    if (!this.watchingScreen) return;
    this.watchingScreen = null;
    this.deps.onWatch(null);
  }

  private screenInFront(p: Vec3Like): TvScreenSpot | null {
    return screenInFront(this.deps.screens, p, this.tuning);
  }
}

/** The nearest TV `p` is in front of: close enough to see, not right underneath, and not off to the side. */
export function screenInFront(
  screens: readonly TvScreenSpot[],
  p: Vec3Like,
  t: { readonly near: number; readonly reach: number; readonly halfAngle: number } = HOME_ACTIVITIES.watchGame,
): TvScreenSpot | null {
  let best: TvScreenSpot | null = null;
  let bestD = Infinity;
  for (const screen of screens) {
    const dx = p.x - screen.x;
    const dz = p.z - screen.z;
    const d = Math.hypot(dx, dz);
    if (d < t.near || d > t.reach || d >= bestD) continue;
    const ahead = (dx * Math.sin(screen.facing) + dz * Math.cos(screen.facing)) / d;
    if (ahead < Math.cos(t.halfAngle)) continue;
    best = screen;
    bestD = d;
  }
  return best;
}
