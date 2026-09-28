import { HUMAN_ACTIVITIES, ROUTINE, type HumanActivityDef, type HumanActivityId } from '../../config/activities';
import type { Vec3Like } from '../../physics/CharacterBody';
import type { RoomId } from '../../world/home/layout';
import type { HomePlace, PlaceKind } from '../../world/home/places';

/** Where the human is and what just happened, for choosing what to do next. */
export interface ScheduleContext {
  readonly position: Vec3Like;
  readonly room: RoomId;
  /** Seconds of play so far (cooldowns count in these). */
  readonly now: number;
  /** The activity just finished (or null). */
  readonly last: HumanActivityId | null;
  /** Where they just were: somewhere else is preferred, when there is somewhere else (no getting up to sit back down). */
  readonly lastPlace?: HomePlace | null;
  /** Is this place free right now (Moke isn't lying in it)? */
  readonly isFree: (place: HomePlace) => boolean;
}

export interface Choice {
  readonly activity: HumanActivityDef;
  readonly place: HomePlace;
}

type Tuning = typeof ROUTINE;

const distance = (a: Vec3Like, b: Vec3Like) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Picks the human's next activity: a weighted random choice among those off cooldown that have a free place,
 * favouring the room they're in and nearby places (location-aware), and what naturally comes next (dinner after
 * cooking). Runs only when an activity ends, never every frame. Pure logic: the random source is injected.
 */
export class ActivityScheduler {
  private readonly lastDone = new Map<HumanActivityId, number>();
  private prepAt = 0;

  constructor(
    private readonly places: readonly HomePlace[],
    private readonly activities: readonly HumanActivityDef[] = HUMAN_ACTIVITIES,
    private readonly random: () => number = Math.random,
    private readonly tuning: Tuning = ROUTINE,
  ) { this.reset(); }

  reset(): void {
    this.lastDone.clear();
    const [min, max] = this.tuning.prepFirst;
    this.prepAt = min + this.random() * (max - min);
  }

  /** Start the shared cooldown only when chopping actually begins, not while walking or on a failed errand. */
  prepStarted(now: number): void {
    const [min, max] = this.tuning.prepRepeat;
    this.prepAt = now + min + this.random() * (max - min);
  }

  /** Starts an activity's cooldown (call when it ends, or is given up). */
  markDone(id: HumanActivityId, now: number): void {
    this.lastDone.set(id, now);
  }

  /** Off cooldown? */
  ready(activity: HumanActivityDef, now: number): boolean {
    const done = this.lastDone.get(activity.id);
    return done === undefined || now - done >= activity.cooldown;
  }

  /** What to do next, and where; null if nothing is possible right now (try again after a pause). */
  choose(ctx: ScheduleContext): Choice | null {
    const options: { activity: HumanActivityDef; place: HomePlace; weight: number }[] = [];
    let total = 0;
    for (const activity of this.activities) {
      if (this.hasPrep(activity) && ctx.now < this.prepAt) continue;
      if (!this.ready(activity, ctx.now)) continue;
      if (activity.requires) {
        const done = this.lastDone.get(activity.requires.after);
        if (done === undefined || ctx.now - done > activity.requires.within) continue;
      }
      const kinds = activity.steps[0]!.places;
      const place = this.nearestPlace(kinds, ctx.position, ctx.isFree, ctx.lastPlace ?? undefined) ?? this.nearestPlace(kinds, ctx.position, ctx.isFree);
      if (!place) continue;
      const d = distance(place.stand, ctx.position);
      let weight = activity.weight / (1 + d / this.tuning.distanceFalloff);
      if (place.room === ctx.room) weight *= this.tuning.sameRoomBonus;
      if (activity.follows && activity.follows.after === ctx.last) weight *= activity.follows.bonus;
      if (activity.id === ctx.last) weight *= 0.05;
      options.push({ activity, place, weight });
      total += weight;
    }
    if (options.length === 0) return null;
    // Due prep takes the next available routine slot; other human roles still retain priority.
    const prep = options.filter((option) => this.hasPrep(option.activity));
    const choices = prep.length ? prep : options;
    if (prep.length) total = prep.reduce((sum, option) => sum + option.weight, 0);
    let roll = this.random() * total;
    for (const option of choices) {
      roll -= option.weight;
      if (roll <= 0) return option;
    }
    return choices[choices.length - 1]!;
  }

  private hasPrep(activity: HumanActivityDef): boolean {
    return activity.steps.some((step) => step.effect === 'prep');
  }

  /**
   * The best free place of these kinds from `from`: the nearest, with a little variety (one of the two nearest,
   * weighted toward the closer).
   */
  nearestPlace(kinds: readonly PlaceKind[], from: Vec3Like, isFree: (place: HomePlace) => boolean, except?: HomePlace): HomePlace | null {
    let best: HomePlace | null = null;
    let second: HomePlace | null = null;
    let bestD = Infinity;
    let secondD = Infinity;
    for (const place of this.places) {
      if (!kinds.includes(place.kind) || place === except || !isFree(place)) continue;
      const d = distance(place.stand, from);
      if (d < bestD) {
        second = best;
        secondD = bestD;
        best = place;
        bestD = d;
      } else if (d < secondD) {
        second = place;
        secondD = d;
      }
    }
    if (best && second && secondD < bestD + 2.5 && this.random() < 0.3) return second;
    return best;
  }
}
