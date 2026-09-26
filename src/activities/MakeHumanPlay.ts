import { Vector3, type Object3D } from 'three';
import { DOG_ACTIVITIES } from '../config/dogActivities';
import { HUMAN } from '../config/human';
import type { HumanActivityController, HumanRole } from '../human/activities/HumanActivityController';
import type { HumanReactions } from '../human/activities/HumanReactions';
import { flatDistance, hold, walkTo } from '../human/activities/intentHelpers';
import type { HumanIntent, HumanSenses } from '../human/HumanBrain';
import type { Vec3Like } from '../physics/CharacterBody';
import type { Prop } from '../props/Prop';
import { DogActivity, type DogActivityContext } from './DogActivity';

export interface MakeHumanPlayDeps {
  readonly routine: HumanActivityController;
  readonly reactions: HumanReactions;
  /** The toys worth playing with (the ball and the rope toy; never the sock). */
  readonly toys: readonly Prop[];
  /** The human's right hand, and the scene to throw back into. */
  readonly hand: Object3D;
  readonly scene: Object3D;
  /** Free distance along a flat direction from a point (walls, furniture), for aiming a throw. */
  readonly clearDistance: (from: Vec3Like, direction: Vec3Like, max: number) => number;
  /** Open floor where a toy can land and be fetched. */
  readonly openFloor: (x: number, z: number) => boolean;
  /** A throw happened (sound; the first one of each toy teaches HUMAN + BALL/TOY = PLAY). */
  readonly onThrow: (toy: Prop, first: boolean) => void;
  readonly random?: () => number;
}

type Tuning = typeof DOG_ACTIVITIES.makeHumanPlay;
type Step = 'getUp' | 'decide' | 'callDrop' | 'callBring' | 'fetchToy' | 'pickUp' | 'windup' | 'throw' | 'watch' | 'chase' | 'laughOff' | 'done';

const GRAVITY = 9.81;

/**
 * Make Human Play (Phase 4): bring a toy to a busy human. They ignore it ("not now, Moke…"). Keep at it: drop it at
 * their feet, bark, do a trick, hang about with it. Eventually they give in ("okay, okay!"), get up and throw it.
 * Then it's up to Moke: bring it back (another throw), drop it nearby, keep it, or run off with it (they give chase
 * for a few laughing steps). Being uncooperative is half the fun. Teaches HUMAN + BALL = PLAY (or TOY).
 */
export class MakeHumanPlay extends DogActivity {
  readonly id = 'makeHumanPlay' as const;
  readonly name = 'Make Human Play';
  readonly needsHuman = true;
  throws = 0;
  asks = 0;
  /** How it ended, for debugging: fetched back, kept, ran off. */
  outcome: 'played' | 'kept' | 'wandered' | null = null;
  private toy: Prop | null = null;
  private need = 3;
  private sinceAsk = Infinity;
  private waitNear = 0;
  private awayFor = 0;
  private wasCarrying: string | null = null;
  private wasNear = false;
  private step: Step = 'done';
  private stepTime = 0;
  private targetThrows = 4;
  private kept = 0;
  private said = new Set<string>();
  private readonly thrown = new Set<string>();
  private readonly aim = new Vector3();
  private readonly handAt = new Vector3();
  private readonly random: () => number;
  private readonly role: HumanRole = {
    id: 'makeHumanPlay',
    update: (dt, s, intent) => this.drive(dt, s, intent),
    cancel: () => this.cancel(),
  };

  constructor(
    private readonly deps: MakeHumanPlayDeps,
    private readonly tuning: Tuning = DOG_ACTIVITIES.makeHumanPlay,
  ) {
    super(tuning.cooldown, tuning.settleTime);
    this.random = deps.random ?? Math.random;
  }

  override get objective(): string | null {
    if (this.state === 'STARTING') return this.asks > 0 ? 'Keep asking! (bark, drop it at their feet, a trick…)' : null;
    return null;
  }

  protected wants(ctx: DogActivityContext): boolean {
    if (!ctx.human.available || ctx.heistRunning) return false;
    const toy = this.toyCarried(ctx);
    return !!toy && flatDistance(ctx.moke.position, ctx.human.position) <= this.tuning.askRange;
  }

  protected onStart(ctx: DogActivityContext): void {
    this.toy = this.toyCarried(ctx);
    const [min, max] = this.tuning.asks;
    this.need = min + Math.floor(this.random() * (max - min + 1));
    this.asks = 0;
    this.throws = 0;
    this.outcome = null;
    this.sinceAsk = Infinity;
    this.waitNear = 0;
    this.awayFor = 0;
    this.said.clear();
    this.ask(); // bringing it over is the first ask
  }

  protected override observe(ctx: DogActivityContext): void {
    this.sinceAsk += 1 / 60;
    if (this.state !== 'STARTING') {
      this.wasCarrying = ctx.moke.carrying;
      return;
    }
    const t = this.tuning;
    const d = flatDistance(ctx.moke.position, ctx.human.position);
    const toy = this.toy;
    // Dropped it right at their feet.
    if (this.wasCarrying && !ctx.moke.carrying && toy && flatDistance(toy.position, ctx.human.position) <= t.dropRange) this.ask();
    // Came back over with it.
    const near = !!ctx.moke.carrying && d <= t.askRange;
    if (near && !this.wasNear) this.ask();
    this.wasNear = near;
    if ((ctx.moke.barked || ctx.moke.trick) && d < 3) this.ask();
    this.waitNear = near ? this.waitNear + 1 / 60 : 0;
    if (this.waitNear > t.waitAsk) {
      this.waitNear = 0;
      this.ask();
    }
    this.wasCarrying = ctx.moke.carrying;
  }

  protected onUpdate(dt: number, ctx: DogActivityContext): void {
    if (this.state === 'STARTING') {
      if (ctx.heistRunning || !this.toy) {
        this.cancel();
        return;
      }
      // Wandered off and left them be: never mind.
      const d = flatDistance(ctx.moke.position, ctx.human.position);
      const toyNear = flatDistance(this.toy.position, ctx.human.position) < this.tuning.dropRange;
      this.awayFor = d > this.tuning.leaveRange && !toyNear ? this.awayFor + dt : 0;
      if (this.awayFor > this.tuning.leaveAfter) {
        this.outcome = 'wandered';
        this.cancel();
        return;
      }
      if (this.asks >= this.need && this.deps.routine.claim(this.role)) {
        const [min, max] = this.tuning.throws;
        this.targetThrows = min + Math.floor(this.random() * (max - min + 1));
        this.kept = 0;
        this.goStep('getUp');
        this.deps.routine.say(pick(this.random, ['Okay, okay! You win.', 'Fine… one throw!', 'Alright, you pest. Come here!']), 'happy');
        this.activate();
      }
    }
  }

  protected onCancel(): void {
    // If it's in their hand, it goes back down at their feet.
    const toy = this.toy;
    if (toy && this.step !== 'done' && toy.carried && toy.view.parent === this.deps.hand) this.letGo(toy, 0, null);
    this.goStep('done');
  }

  /** One more ask. Until they give in, they wave it off. */
  private ask(): void {
    if (this.sinceAsk < this.tuning.askGap) return;
    this.sinceAsk = 0;
    this.asks++;
    if (this.asks >= this.need) return;
    const lines = this.asks === 1 ? ['Not now, Moke…', 'Mm-hm. In a minute.'] : ['I\'m busy, buddy.', 'Moke… I said later.', 'Okay, okay, I see it.'];
    this.deps.reactions.perform('shoo', 1.6, pick(this.random, lines));
  }

  private toyCarried(ctx: DogActivityContext): Prop | null {
    return this.deps.toys.find((t) => t.id === ctx.moke.carrying) ?? null;
  }

  // ---------------------------------------------------------------- the human's part: playing

  private drive(dt: number, s: HumanSenses, intent: HumanIntent): boolean {
    this.stepTime += dt;
    const t = this.tuning;
    const toy = this.toy!;
    const moke = s.moke;
    const mokeHasIt = s.mokeCarrying === toy.id;
    const dMoke = flatDistance(s.position, moke);
    switch (this.step) {
      case 'getUp':
        hold(intent, 'idle', moke, 0, moke);
        if (!s.seated && this.stepTime > 0.4) this.goStep('decide');
        return true;
      case 'decide':
        hold(intent, 'idle', moke, 0, moke);
        if (this.throws >= this.targetThrows) return this.finish('played', pick(this.random, ['Okay, that\'s enough for now. Good boy!', 'Phew. Good game, buddy.']));
        if (mokeHasIt) this.goStep(dMoke > t.keepAwayRange ? 'chase' : 'callDrop');
        else if (flatDistance(toy.position, s.position) < 3.2) this.goStep('fetchToy');
        else this.goStep('callBring');
        return true;
      case 'callDrop':
        hold(intent, 'call', moke, 0, moke);
        this.once('drop', ['Drop it!', 'Drop it, Moke!', 'Give!'], intent);
        if (!mokeHasIt) this.goStep('decide');
        else if (dMoke > t.keepAwayRange) this.goStep('chase');
        else if (this.stepTime > t.fetchWait) return this.keepIt();
        return true;
      case 'callBring':
        hold(intent, 'call', moke, 0, moke);
        this.once('bring', ['Bring it here, buddy!', 'Moke! Bring it!'], intent);
        if (mokeHasIt || flatDistance(toy.position, s.position) < 3.2) this.goStep('decide');
        else if (this.stepTime > t.fetchWait) return this.keepIt();
        return true;
      case 'fetchToy':
        walkTo(intent, toy.position, HUMAN.move.walkSpeed, t.reach * 0.8);
        intent.lookAt = toy.position;
        if (mokeHasIt) this.goStep('decide');
        else if (flatDistance(toy.position, s.position) <= t.reach + 0.1) this.goStep('pickUp');
        else if (this.stepTime > 8) this.goStep('callBring');
        return true;
      case 'pickUp':
        hold(intent, 'place', toy.position, 1, toy.position);
        if (mokeHasIt) this.goStep('decide');
        else if (this.stepTime > 0.5) {
          if (toy.carried || flatDistance(toy.position, s.position) > t.reach + 0.3) this.goStep('decide');
          else {
            toy.holdInHand(this.deps.hand);
            this.goStep('windup');
          }
        }
        return true;
      case 'windup': {
        const target = this.chooseTarget(s);
        hold(intent, 'windup', target, 0, target);
        this.once('ready', ['Ready…?', 'Ready? Ready?!'], intent);
        if (this.stepTime > 0.75) {
          this.goStep('throw');
        }
        return true;
      }
      case 'throw':
        hold(intent, 'throw', this.aim, 0, this.aim);
        if (this.stepTime >= 0.12 && toy.carried && toy.view.parent === this.deps.hand) {
          this.letGo(toy, s.heading, this.aim);
          this.throws++;
          const first = !this.thrown.has(toy.id);
          this.thrown.add(toy.id);
          this.deps.onThrow(toy, first);
          this.said.delete('drop');
          this.said.delete('bring');
          this.deps.routine.say(pick(this.random, ['Go get it!', 'Fetch!', 'Get it, Moke!']), 'happy');
        }
        if (this.stepTime > 0.7) this.goStep('watch');
        return true;
      case 'watch':
        hold(intent, 'idle', toy.position, 0, mokeHasIt ? moke : toy.position);
        if (mokeHasIt || this.stepTime > 2.5) this.goStep('decide');
        return true;
      case 'chase':
        // Keep-away: a few playful steps after him, laughing, then they stop.
        walkTo(intent, moke, t.chaseSpeed, 1.2);
        intent.pose = 'laugh';
        intent.lookAt = moke;
        this.once('chase', ['Hey! Come back here, you!', 'Moke! That\'s not how fetch works!'], intent);
        if (!mokeHasIt) this.goStep('decide');
        else if (this.stepTime > t.chaseTime) this.goStep('laughOff');
        return true;
      case 'laughOff':
        hold(intent, 'laugh', moke, 0, moke);
        this.once('rascal', ['You little rascal.', 'Ha! Okay, you win.'], intent);
        if (!mokeHasIt) this.goStep('decide');
        else if (this.stepTime > 2.5) {
          this.kept++;
          if (this.kept >= 2) return this.keepIt();
          this.goStep('callDrop');
        }
        return true;
      case 'done':
        return false;
    }
  }

  private keepIt(): boolean {
    return this.finish('kept', pick(this.random, ['Fine, keep it.', 'Okay, it\'s yours. Enjoy.']));
  }

  private finish(outcome: 'played' | 'kept', line: string): boolean {
    this.outcome = outcome;
    this.deps.routine.say(line, 'happy');
    this.goStep('done');
    if (this.throws > 0) this.succeed();
    else this.cancel();
    return false;
  }

  private once(key: string, lines: readonly string[], intent: HumanIntent): void {
    if (this.said.has(key)) return;
    this.said.add(key);
    intent.talking = 1.3;
    this.deps.routine.say(pick(this.random, lines), key === 'bring' || key === 'drop' ? 'calling' : 'happy');
  }

  private goStep(step: Step): void {
    this.step = step;
    this.stepTime = 0;
  }

  /** Where to throw: open floor 2.4–4.4 m away, roughly the way they face, with nothing in between. */
  private chooseTarget(s: HumanSenses): Vec3Like {
    if (this.stepTime > 0.05) return this.aim;
    const t = this.tuning;
    const [near, far] = t.throwDistance;
    const from = { x: s.position.x, y: 0.5, z: s.position.z };
    let best: { x: number; z: number; d: number } | null = null;
    for (let k = 0; k < 16; k++) {
      const a = s.heading + (this.random() * 2 - 1) * Math.PI * (k < 8 ? 0.5 : 1);
      const dir = { x: Math.sin(a), y: 0, z: Math.cos(a) };
      const want = near + this.random() * (far - near);
      const free = this.deps.clearDistance(from, dir, want + 0.4);
      const d = Math.min(want, free - 0.4);
      if (d < near * 0.75) continue;
      const x = s.position.x + dir.x * d;
      const z = s.position.z + dir.z * d;
      if (!this.deps.openFloor(x, z)) continue;
      if (!best || d > best.d) best = { x, z, d };
      if (d >= want - 0.05) break;
    }
    const target = best ?? { x: s.position.x + Math.sin(s.heading) * 1.5, z: s.position.z + Math.cos(s.heading) * 1.5 };
    this.aim.set(target.x, 0, target.z);
    return this.aim;
  }

  /** Lets go of the toy: a throw toward `aim`, or dropped at their feet. */
  private letGo(toy: Prop, heading: number, aim: Vec3Like | null): void {
    const hand = this.deps.hand;
    hand.getWorldPosition(this.handAt);
    toy.release(this.deps.scene);
    if (!aim) {
      toy.drop({ x: this.handAt.x, y: 0.15, z: this.handAt.z }, heading, { x: 0, y: 0, z: 0 });
      return;
    }
    const dx = aim.x - this.handAt.x;
    const dz = aim.z - this.handAt.z;
    const d = Math.max(0.3, Math.hypot(dx, dz));
    const time = this.tuning.throwTime;
    const vy = (0.08 - this.handAt.y + 0.5 * GRAVITY * time * time) / time;
    toy.drop({ x: this.handAt.x, y: Math.max(0.3, this.handAt.y), z: this.handAt.z }, Math.atan2(dx, dz), { x: (dx / d) * (d / time), y: vy, z: (dz / d) * (d / time) });
  }
}

function pick<T>(random: () => number, options: readonly T[]): T {
  return options[Math.floor(random() * options.length)]!;
}
