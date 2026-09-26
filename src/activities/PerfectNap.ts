import { DOG_ACTIVITIES } from '../config/dogActivities';
import type { Vec3Like } from '../physics/CharacterBody';
import type { NapSpot, Spot } from '../world/home/places';
import { DogActivity, type DogActivityContext } from './DogActivity';

/** The five things that make a nap good. */
export const NAP_QUALITIES = ['sunny', 'soft', 'warm', 'quiet', 'nearHuman'] as const;
export type NapQuality = (typeof NAP_QUALITIES)[number];

export interface NapReport {
  readonly spot: NapSpot;
  readonly qualities: Readonly<Record<NapQuality, boolean>>;
  readonly score: number;
  readonly perfect: boolean;
  /** Dog Logic entries this nap teaches (BED = NAP, SUN + SOFT = NAP). */
  readonly learned: readonly string[];
  /** A few words from Moke's point of view: "Sunny… soft… my human's right here." */
  readonly caption: string;
}

export interface PerfectNapDeps {
  readonly spots: readonly NapSpot[];
  readonly fire: { readonly position: Spot; readonly warmRadius: number };
  /** Where something noisy is right now (the TV on, dinner cooking), if anything. */
  readonly noise: () => Vec3Like | null;
  readonly humanPosition: () => Vec3Like;
  /** The nap is judged: show how it felt. */
  readonly onNapped: (report: NapReport) => void;
}

type Tuning = typeof DOG_ACTIVITIES.perfectNap;

/**
 * Perfect Nap (Phase 4): lie down somewhere, drift off, and the nap is judged by how it feels, not by numbers:
 * sunny, soft, warm, quiet, and whether his human is right there. The house has spots that are good in different
 * ways (his bed in the window's sun, the pink blanket by the fire, the sunny couch, the sofas by his human while they
 * watch TV…). Four of the five is a perfect nap. Teaches BED = NAP and SUN + SOFT = NAP.
 */
export class PerfectNap extends DogActivity {
  readonly id = 'perfectNap' as const;
  readonly name = 'Perfect Nap';
  readonly needsHuman = false;
  /** The last nap's verdict (debug, tests). */
  report: NapReport | null = null;
  private lyingOn: string | null = null;
  private judgedThisLie = false;

  constructor(
    private readonly deps: PerfectNapDeps,
    private readonly tuning: Tuning = DOG_ACTIVITIES.perfectNap,
  ) {
    super(tuning.cooldown, tuning.settleTime);
  }

  override get objective(): string | null {
    return this.state === 'STARTING' ? 'Zzz…' : null;
  }

  /** Called every step with where he's lying (null when not): a new lie-down can start a nap. */
  protected wants(ctx: DogActivityContext): boolean {
    return ctx.moke.napSpot !== null && !this.judgedThisLie;
  }

  protected override observe(ctx: DogActivityContext): void {
    this.track(ctx);
  }

  protected onStart(): void {
    this.report = null;
  }

  protected onUpdate(_dt: number, ctx: DogActivityContext): void {
    const spotId = ctx.moke.napSpot;
    if (!spotId) {
      // Up before he dozed off: no nap, and nothing to wait for either.
      this.enter('AVAILABLE');
      return;
    }
    if (this.stateTime >= this.tuning.napTime) {
      const spot = this.deps.spots.find((s) => s.id === spotId);
      if (!spot) {
        this.cancel();
        return;
      }
      this.judgedThisLie = true;
      this.report = this.judge(spot);
      this.deps.onNapped(this.report);
      this.succeed();
    }
  }

  protected onCancel(): void {}

  /** Keeps track of getting up and lying down again (one verdict per nap). */
  private track(ctx: DogActivityContext): void {
    if (ctx.moke.napSpot !== this.lyingOn) {
      this.lyingOn = ctx.moke.napSpot;
      if (!this.lyingOn) this.judgedThisLie = false;
    }
  }

  /** How good a nap here is, right now. */
  judge(spot: NapSpot): NapReport {
    const t = this.tuning;
    const at = spot.position;
    const fire = this.deps.fire;
    const noise = this.deps.noise();
    const human = this.deps.humanPosition();
    const qualities: Record<NapQuality, boolean> = {
      sunny: spot.sunny,
      soft: spot.soft,
      warm: spot.warm || Math.hypot(at.x - fire.position.x, at.z - fire.position.z) <= fire.warmRadius,
      quiet: !noise || Math.hypot(at.x - noise.x, at.z - noise.z) > t.noiseRange,
      nearHuman: Math.hypot(at.x - human.x, at.z - human.z) <= t.nearHuman,
    };
    const score = NAP_QUALITIES.filter((q) => qualities[q]).length;
    const learned: string[] = [];
    if (spot.bed) learned.push('bed=nap');
    if (qualities.sunny && qualities.soft) learned.push('sun+soft=nap');
    return { spot, qualities, score, perfect: score >= t.perfectAt, learned, caption: caption(qualities, score >= t.perfectAt) };
  }
}

const WORDS: Record<NapQuality, string> = {
  sunny: 'sunny',
  soft: 'soft',
  warm: 'warm',
  quiet: 'quiet',
  nearHuman: 'my human’s right here',
};

function caption(q: Record<NapQuality, boolean>, perfect: boolean): string {
  const good = NAP_QUALITIES.filter((k) => q[k]).map((k) => WORDS[k]);
  if (good.length === 0) return 'Hmm. Not much of a nap spot.';
  const text = good.join('… ');
  const tail = perfect ? '. Perfect.' : !q.quiet ? '… (a bit noisy)' : '…';
  return text.charAt(0).toUpperCase() + text.slice(1) + tail;
}
