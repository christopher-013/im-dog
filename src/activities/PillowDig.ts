import type { Object3D } from 'three';
import { MISCHIEF, PILLOW_SOFAS, onSurface, type PillowSofa } from '../config/mischief';
import type { HumanRole, HumanActivityController } from '../human/activities/HumanActivityController';
import { flatDistance, hold, walkTo } from '../human/activities/intentHelpers';
import type { HumanIntent, HumanSenses } from '../human/HumanBrain';
import type { NavGrid } from '../human/NavGrid';
import type { Interactable } from '../interactions/Interactable';
import type { Vec3Like } from '../physics/CharacterBody';
import type { CouchPillows } from '../world/CouchPillows';
import { DogActivity, type DogActivityContext } from './DogActivity';

interface Deps {
  routine: HumanActivityController;
  pillows: CouchPillows;
  hand: Object3D;
  nav: NavGrid;
  grounded(): boolean;
  onDigging(active: boolean): void;
  onFun(): void;
}
type Step = 'dig' | 'walk' | 'pick' | 'return' | 'place' | 'done';

/** An explicit couch action, then one human cleanup errand. Input cannot spawn more pillows or errands. */
export class PillowDig extends DogActivity {
  readonly id = 'pillowDig' as const;
  readonly name = 'Pillow Mischief';
  readonly needsHuman = true;
  readonly interactable: Interactable;
  private nearby: PillowSofa | null = null;
  private sofa: PillowSofa | null = null;
  private requested = false;
  private step: Step = 'done';
  private elapsed = 0;
  private digElapsed = 0;
  private index = 0;
  private transferred = false;
  private approach: Vec3Like = { x: 0, y: 0, z: 0 };
  private restTarget: Vec3Like = { x: 0, y: 0, z: 0 };
  private readonly role: HumanRole = { id: 'pillowCleanup', update: (dt, s, i) => this.drive(dt, s, i), cancel: () => this.cancel() };

  constructor(private readonly deps: Deps) {
    super(MISCHIEF.pillowCooldown);
    const activity = this;
    this.interactable = {
      id: 'couch:dig', type: 'DIG', label: 'Dig & Toss Pillows', interactionDistance: 2,
      requiresFacing: false, requiresClearPath: false, priority: 45,
      get position() { return activity.nearby ? { x: activity.nearby.x, y: activity.nearby.height, z: activity.nearby.z } : { x: 0, y: 0, z: 0 }; },
      get enabled() { return activity.state === 'AVAILABLE' && activity.nearby !== null; },
      interact: () => { if (this.interactable.enabled) this.requested = true; },
    };
  }

  override get objective(): string | null {
    if (!this.running) return null;
    return this.step === 'dig' ? 'Dig, dig… pillows belong on the floor!' : 'Your human is putting the pillows back…';
  }

  override update(dt: number, ctx: DogActivityContext): void {
    this.nearby = !ctx.heistRunning && !ctx.moke.carrying && !ctx.moke.napSpot && this.deps.grounded()
      ? PILLOW_SOFAS.find((s) => (onSurface(ctx.moke.position, s) || s.extraSeats?.some((seat) => onSurface(ctx.moke.position, seat))) && this.deps.pillows.count(s) > 0) ?? null : null;
    if (!this.running && !this.nearby) this.requested = false;
    if (this.running && this.step === 'dig') {
      if (!this.sofa || this.nearby?.id !== this.sofa.id) this.cancel();
      else {
        this.digElapsed += dt;
        if (this.digElapsed >= MISCHIEF.digTime) {
          this.deps.onDigging(false);
          this.deps.pillows.toss(this.sofa);
          this.deps.onFun();
          this.deps.routine.say("Moke don't mess up the pillows!", 'calling');
          this.activate();
          this.preparePick();
        }
      }
    }
    super.update(dt, ctx);
  }

  protected wants(): boolean { return this.requested && !!this.nearby; }
  protected onStart(): void {
    if (!this.deps.routine.claim(this.role)) { this.requested = false; this.enter('AVAILABLE'); return; }
    this.sofa = this.nearby;
    this.requested = false;
    this.index = 0; this.digElapsed = 0;
    this.go('dig');
    this.deps.onDigging(true);
  }
  protected onUpdate(): void {}
  protected onCancel(): void {
    this.deps.onDigging(false);
    if (this.sofa) this.deps.pillows.reset(this.sofa);
    this.requested = false; this.sofa = null; this.go('done');
  }
  resetAll(): void { this.cancel(); this.onCancel(); this.nearby = null; this.enter('AVAILABLE'); }

  private preparePick(): void {
    const floor = this.sofa!.floors[this.index % this.sofa!.floors.length]!;
    const at = this.deps.nav.nearestWalkable(floor.x, floor.z, 0.65);
    if (!at) { this.cancel(); return; }
    this.approach = { ...at, y: 0 };
    this.go('walk');
  }

  private drive(dt: number, s: HumanSenses, i: HumanIntent): boolean {
    this.elapsed += dt;
    if (!this.sofa || !this.running) return false;
    const floor = this.sofa.floors[this.index % this.sofa.floors.length]!;
    switch (this.step) {
      case 'dig': hold(i, 'idle', s.moke, 0, s.moke); return true;
      case 'walk':
      case 'return':
        walkTo(i, this.approach, undefined, 0.12);
        if (s.arrived && flatDistance(s.position, this.approach) < 0.3 && this.elapsed >= MISCHIEF.tossTime) this.go(this.step === 'walk' ? 'pick' : 'place');
        else if (this.elapsed > MISCHIEF.walkTimeout || (s.stuck ?? 0) > MISCHIEF.stuckTimeout) { this.cancel(); return false; }
        return true;
      case 'pick':
        hold(i, 'place', floor, 1, floor); i.reach = floor;
        if (this.elapsed >= MISCHIEF.pickTime) {
          this.deps.pillows.pickUp(this.sofa, this.index, this.deps.hand);
          const rest = this.deps.pillows.restAt(this.sofa, this.index);
          this.restTarget = rest;
          const at = this.deps.nav.nearestWalkable(rest.x - (this.sofa.id === 'window' ? 0.85 : 0), rest.z + (this.sofa.id === 'window' ? 0 : 0.85), 0.65);
          if (!at) { this.cancel(); return false; }
          this.approach = { ...at, y: 0 }; this.go('return');
        }
        return true;
      case 'place': {
        const rest = this.restTarget;
        hold(i, 'place', rest, 0, rest); i.reach = rest;
        if (!this.transferred && this.elapsed >= MISCHIEF.placeTime) {
          this.transferred = true; this.deps.pillows.putBack(this.sofa, this.index);
        }
        if (this.elapsed < MISCHIEF.placeTime + MISCHIEF.returnTime) return true;
        if (++this.index < this.deps.pillows.count(this.sofa)) { this.preparePick(); return this.running; }
        this.go('done'); this.sofa = null; this.succeed();
        return false;
      }
      case 'done': return false;
    }
  }
  private go(step: Step): void { this.step = step; this.elapsed = 0; this.transferred = false; }
}
