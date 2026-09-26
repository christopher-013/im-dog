import type { Object3D } from 'three';
import { DOG_ACTIVITIES } from '../config/dogActivities';
import { HUMAN } from '../config/human';
import type { Treat } from '../heist/Treat';
import type { HumanActivityController, HumanRole } from '../human/activities/HumanActivityController';
import { flatDistance, hold, walkTo } from '../human/activities/intentHelpers';
import type { HumanIntent, HumanSenses } from '../human/HumanBrain';
import type { NavGrid } from '../human/NavGrid';
import type { Vec3Like } from '../physics/CharacterBody';
import type { Spot } from '../world/home/places';
import { DogActivity, type DogActivityContext } from './DogActivity';

export interface TreatHuntDeps {
  readonly routine: HumanActivityController;
  /** The human's right hand (the treat rides in it on the way to its hiding place). */
  readonly hand: Object3D;
  readonly treat: Treat;
  readonly scene: Object3D;
  /** The kitchen treat jar and where to stand for it. */
  readonly jar: { readonly jar: Spot; readonly stand: Spot };
  readonly spots: readonly Spot[];
  /** The human's walkable grid (to find somewhere to stand by a hiding spot). */
  readonly nav: NavGrid;
  /** Can Moke see this floor spot from where he is? (They'd rather hide it where he can't.) */
  readonly mokeCanSee: (spot: Vec3Like) => boolean;
  readonly roomName: (at: Vec3Like) => string;
  /** He found it and ate it (after `seconds` of hunting). */
  readonly onFound: (seconds: number, first: boolean) => void;
  readonly random?: () => number;
}

type Tuning = typeof DOG_ACTIVITIES.treatHunt;
type Step = 'toJar' | 'rummage' | 'show' | 'toSpot' | 'hide' | 'toPoint' | 'point' | 'done';

/**
 * Treat Hunt (Phase 4): Moke shows off a trick near the human (or pesters them) → "Ooh, a treat? Let's play
 * find-it!" → they fetch a treat from the kitchen jar (smelly: Moke's interested) → "Sit… stay…" → they hide it
 * somewhere he can't see, tucked under or behind something → "Find it, Moke!" → he sniffs it out: sniff mode shows
 * its wisps, stronger the closer he gets; no arrows → eats it. Forgiving: the human helps if it takes a while
 * ("warmer…", "try the dining room!", and finally points at it). SNIFF = TREAT.
 */
export class TreatHunt extends DogActivity {
  readonly id = 'treatHunt' as const;
  readonly name = 'Treat Hunt';
  readonly needsHuman = true;
  /** Where it's hidden (while ACTIVE). */
  hiddenAt: Spot | null = null;
  private step: Step = 'done';
  private stepTime = 0;
  private stand: Vec3Like | null = null;
  private huntTime = 0;
  private hinted = { warm: false, room: false, point: false };
  private engagedBefore = false;
  private firstFind = true;
  private readonly random: () => number;
  private readonly look: Vec3Like = { x: 0, y: 0, z: 0 };
  /** What the human does for the hunt: fetch, show, hide (and later, maybe, point). */
  private readonly role: HumanRole = {
    id: 'treatHunt',
    update: (dt, s, intent) => this.drive(dt, s, intent),
    cancel: () => this.roleCancelled(),
  };

  constructor(
    private readonly deps: TreatHuntDeps,
    private readonly tuning: Tuning = DOG_ACTIVITIES.treatHunt,
  ) {
    super(tuning.cooldown, tuning.settleTime);
    this.random = deps.random ?? Math.random;
    deps.treat.onEat = () => this.eaten();
  }

  override get objective(): string | null {
    if (this.state === 'ACTIVE' && this.hiddenAt) return 'Find the treat! (Sniff it out)';
    if (this.state === 'STARTING' && this.step !== 'toJar' && this.step !== 'rummage') return 'Treat Hunt: wait for it…';
    return null;
  }

  protected wants(ctx: DogActivityContext): boolean {
    const engaged = ctx.human.engaged && !this.engagedBefore;
    this.engagedBefore = ctx.human.engaged;
    if (!ctx.human.available || ctx.heistRunning || ctx.moke.carrying) return false;
    const d = flatDistance(ctx.moke.position, ctx.human.position);
    // In view, or so close they couldn't miss it.
    if (d > this.tuning.triggerRange || (!ctx.human.seesMoke && d > this.tuning.closeRange)) return false;
    if (ctx.moke.trick) return this.successes === 0 || this.random() < this.tuning.trickChance;
    return engaged && this.random() < this.tuning.engagedChance;
  }

  protected onStart(): void {
    if (!this.deps.routine.claim(this.role)) {
      this.enter('AVAILABLE');
      return;
    }
    this.goStep('toJar');
    this.hiddenAt = null;
    this.huntTime = 0;
    this.hinted = { warm: false, room: false, point: false };
    this.deps.routine.say(pick(this.random, ['Ooh, a treat? Let\'s play find-it!', 'You want a treat? Okay… find-it time!']), 'happy');
  }

  protected onUpdate(dt: number, ctx: DogActivityContext): void {
    if (this.state !== 'ACTIVE' || !this.hiddenAt) return;
    this.huntTime += dt;
    const t = this.tuning;
    const routine = this.deps.routine;
    const near = flatDistance(ctx.moke.position, this.hiddenAt) < t.warmRange;
    if (!this.hinted.warm && this.huntTime > t.warmHintAfter && near && routine.available) {
      this.hinted.warm = true;
      routine.say('Warmer… warmer!', 'happy');
    }
    if (!this.hinted.room && this.huntTime > t.roomHintAfter && !near && routine.available) {
      this.hinted.room = true;
      routine.say(`Try the ${this.deps.roomName(this.hiddenAt)}!`, 'happy');
    }
    if (!this.hinted.point && this.huntTime > t.pointAfter && !ctx.heistRunning && routine.claim(this.role)) {
      this.hinted.point = true;
      this.goStep('toPoint');
    }
  }

  protected onCancel(): void {
    if (this.step !== 'done') this.goStep('done');
    // Still in their hand (or not fetched yet): back in the jar. Already hidden: it stays hidden for later.
    if (this.deps.treat.state === 'held') this.deps.treat.reset();
    if (this.deps.treat.state !== 'placed') this.hiddenAt = null;
  }

  /** A replay (PLAY AGAIN): the treat goes back in the jar, the hunt starts over. */
  resetAll(): void {
    this.cancel();
    this.deps.treat.reset();
    this.hiddenAt = null;
    this.enter('AVAILABLE');
  }

  // ---------------------------------------------------------------- the human's part: fetching and hiding the treat

  private drive(dt: number, s: HumanSenses, intent: HumanIntent): boolean {
    this.stepTime += dt;
    const { jar, treat } = this.deps;
    const t = this.tuning;
    this.look.x = s.moke.x;
    this.look.y = s.moke.y;
    this.look.z = s.moke.z;
    switch (this.step) {
      case 'toJar':
        walkTo(intent, jar.stand, HUMAN.move.walkSpeed * 1.15, 0.15);
        if ((s.arrived && flatDistance(s.position, jar.stand) < 0.35) || this.stepTime > t.walkTimeout) this.goStep('rummage');
        return true;
      case 'rummage':
        hold(intent, 'rummage', jar.jar);
        if (this.stepTime > t.rummageTime) {
          treat.holdIn(this.deps.hand);
          this.goStep('show');
        }
        return true;
      case 'show':
        hold(intent, 'point', s.moke, 0, this.look);
        if (this.stepTime < dt * 1.5) this.deps.routine.say(pick(this.random, ['Sit… stay…', 'Staaay… no peeking!']), 'happy');
        if (this.stepTime > t.showTime) {
          const spot = this.chooseSpot(s);
          if (!spot) {
            this.giveTreat(s);
            return false;
          }
          this.hiddenAt = spot.spot;
          this.stand = spot.stand;
          this.goStep('toSpot');
        }
        return true;
      case 'toSpot':
        walkTo(intent, this.stand!, HUMAN.move.walkSpeed * 1.1, 0.15);
        if ((s.arrived && flatDistance(s.position, this.stand!) < 0.4) || this.stepTime > t.walkTimeout) this.goStep('hide');
        return true;
      case 'hide':
        hold(intent, 'place', this.hiddenAt!, 1);
        if (this.stepTime > t.hideTime) {
          treat.place(this.hiddenAt!, this.deps.scene);
          this.activate();
          this.deps.routine.say(pick(this.random, ['Okay… find it, Moke!', 'Find it! Where\'s the treat?']), 'calling');
          this.goStep('done');
          return false;
        }
        return true;
      case 'toPoint': {
        const at = this.hiddenAt;
        if (!at || treat.state !== 'placed') return this.endRole();
        const stand = this.standNear(at, s.position) ?? at;
        walkTo(intent, stand, HUMAN.move.walkSpeed, 0.5);
        if ((s.arrived && flatDistance(s.position, stand) < 0.7) || this.stepTime > t.walkTimeout) this.goStep('point');
        return true;
      }
      case 'point':
        hold(intent, 'point', this.hiddenAt, 0, this.hiddenAt);
        if (this.stepTime < dt * 1.5) this.deps.routine.say('It\'s right here, silly!', 'happy');
        if (this.stepTime > t.pointTime || treat.state !== 'placed') return this.endRole();
        return true;
      case 'done':
        return false;
    }
  }

  /** The Sock Heist took the human mid-errand: pointing can simply stop; fetching or hiding calls the hunt off. */
  private roleCancelled(): void {
    if (this.step === 'toPoint' || this.step === 'point') {
      this.goStep('done');
      return;
    }
    this.cancel();
  }

  private endRole(): boolean {
    this.goStep('done');
    return false;
  }

  private goStep(step: Step): void {
    this.step = step;
    this.stepTime = 0;
  }

  /** Nowhere to hide it (can't happen in this house, but never soft-lock): just give it to him. */
  private giveTreat(s: HumanSenses): void {
    const at = { x: s.position.x + (s.moke.x - s.position.x) * 0.5, y: 0, z: s.position.z + (s.moke.z - s.position.z) * 0.5 };
    this.deps.treat.place(at, this.deps.scene);
    this.hiddenAt = at;
    this.activate();
    this.goStep('done');
  }

  private eaten(): void {
    if (this.state !== 'ACTIVE') return;
    const routine = this.deps.routine;
    if (routine.available) routine.say(pick(this.random, ['Good find, Moke!', 'You found it!', 'What a nose!']), 'happy');
    const first = this.firstFind;
    this.firstFind = false;
    this.deps.onFound(this.huntTime, first);
    this.hiddenAt = null;
    this.succeed();
  }

  /** A hiding spot well away from Moke, ideally out of his sight, that the human can get close to. */
  private chooseSpot(s: HumanSenses): { spot: Spot; stand: Vec3Like } | null {
    const t = this.tuning;
    const scored = this.deps.spots
      .map((spot) => {
        const fromMoke = flatDistance(spot, s.moke);
        const fromHuman = flatDistance(spot, s.position);
        if (fromMoke < t.minFromMoke || fromHuman > t.maxWalk) return null;
        const hidden = !this.deps.mokeCanSee(spot);
        return { spot, score: (hidden ? 2 : 1) + this.random() * 1.5 };
      })
      .filter((x): x is { spot: Spot; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);
    for (const { spot } of scored) {
      const stand = this.standNear(spot, s.position);
      if (stand) return { spot, stand };
    }
    return null;
  }

  /** Somewhere walkable within reach of `spot` that the human can get to from `from`. */
  private standNear(spot: Vec3Like, from: Vec3Like): Vec3Like | null {
    const nav = this.deps.nav;
    const path: { x: number; z: number }[] = [];
    for (let ring = 0.3; ring <= 1.3; ring += 0.2) {
      const offset = this.random() * Math.PI * 2;
      for (let k = 0; k < 12; k++) {
        const a = offset + (k / 12) * Math.PI * 2;
        const x = spot.x + Math.sin(a) * ring;
        const z = spot.z + Math.cos(a) * ring;
        if (nav.isWalkable(x, z) && nav.findPath(from, { x, z }, path)) return { x, y: 0, z };
      }
    }
    return null;
  }
}

function pick<T>(random: () => number, options: readonly T[]): T {
  return options[Math.floor(random() * options.length)]!;
}
