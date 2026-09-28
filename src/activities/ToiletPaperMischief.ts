import type { Object3D } from 'three';
import { BATHROOM_ACTIVITY } from '../config/bathroom';
import { BATHROOM } from '../world/home/layout';
import type { BathroomView } from '../world/Bathroom';
import type { HumanActivityController, HumanRole } from '../human/activities/HumanActivityController';
import { flatDistance, hold, walkTo } from '../human/activities/intentHelpers';
import type { HumanIntent, HumanSenses } from '../human/HumanBrain';
import type { NavGrid } from '../human/NavGrid';
import type { Interactable } from '../interactions/Interactable';
import type { Vec3Like } from '../physics/CharacterBody';
import { DogActivity, type DogActivityContext } from './DogActivity';

interface Deps {
  readonly routine: HumanActivityController;
  readonly nav: NavGrid;
  readonly view: BathroomView;
  readonly mouth: Object3D;
  readonly onHoldChange: (holding: boolean) => void;
  readonly onLearn: () => void;
}

type Step = 'idle' | 'approach' | 'bite' | 'trail' | 'waitingHuman' | 'notice' | 'clean';

/** A repeatable bathroom discovery. The human borrows their normal role and resumes their routine afterward. */
export class ToiletPaperMischief extends DogActivity {
  readonly id = 'toiletPaper' as const;
  readonly name = 'Toilet Paper Mischief';
  readonly needsHuman = true;
  readonly interactable: Interactable;
  private nearby = false;
  private requested = false;
  private step: Step = 'idle';
  private elapsed = 0;
  private walkElapsed = 0;
  private outsideDistance = 0;
  private readonly lastOutside: Vec3Like = { x: 0, y: 0, z: 0 };
  private hasOutside = false;
  private target: Vec3Like = BATHROOM.cleanup;
  private readonly role: HumanRole = {
    id: 'toiletPaperCleanup',
    update: (dt, senses, intent) => this.drive(dt, senses, intent),
    cancel: () => this.cancel(),
  };

  constructor(private readonly deps: Deps) {
    super(BATHROOM_ACTIVITY.cooldown);
    const activity = this;
    this.interactable = {
      id: 'bathroom:paper', type: 'PULL', label: 'Pull Toilet Paper', interactionDistance: 1.15,
      requiresFacing: false, requiresClearPath: false, priority: 45,
      position: BATHROOM.paper,
      get enabled() { return activity.state === 'AVAILABLE' && activity.nearby; },
      interact: () => { if (this.interactable.enabled) this.requested = true; },
    };
  }

  override get objective(): string | null {
    if (!this.running) return null;
    if (this.step === 'approach' || this.step === 'bite') return 'Moke is grabbing the end of the paper…';
    if (this.step === 'trail') return this.hasOutside ? 'Keep pulling the paper down the hall!' : 'Back out of the bathroom with the paper!';
    return 'Oops… your human is cleaning up the trail.';
  }

  /** Game glides Moke only during the short reach; normal controls take over once he has the paper. */
  get approachTarget(): Vec3Like | null { return this.step === 'approach' ? BATHROOM.paperApproach : null; }
  get grabbing(): boolean { return this.step === 'approach' || this.step === 'bite'; }
  get holdingPaper(): boolean { return this.step === 'trail'; }

  override update(dt: number, ctx: DogActivityContext): void {
    this.nearby = this.deps.view.mokeInside && !ctx.heistRunning && !ctx.moke.carrying && !ctx.moke.napSpot
      && ctx.moke.position.x > BATHROOM.xMin && ctx.moke.position.x < BATHROOM.xMax
      && ctx.moke.position.z < BATHROOM.zMax
      && flatDistance(ctx.moke.position, BATHROOM.paper) <= 1.15;
    if (!this.nearby && !this.running) this.requested = false;
    super.update(dt, ctx);
  }

  protected wants(): boolean { return this.requested && this.nearby; }

  protected onStart(): void {
    const target = this.deps.nav.nearestWalkable(BATHROOM.cleanup.x, BATHROOM.cleanup.z, 0.75);
    if (!target) {
      this.requested = false;
      this.enter('AVAILABLE');
      return;
    }
    this.target = { ...target, y: 0 };
    this.requested = false;
    this.walkElapsed = 0;
    this.outsideDistance = 0;
    this.hasOutside = false;
    this.go('approach');
    this.deps.view.clearPaper();
  }

  protected onUpdate(dt: number, ctx: DogActivityContext): void {
    switch (this.step) {
      case 'approach':
        this.elapsed += dt;
        if (flatDistance(ctx.moke.position, BATHROOM.paperApproach) < BATHROOM_ACTIVITY.approachTolerance) this.go('bite');
        else if (this.elapsed >= BATHROOM_ACTIVITY.approachTimeout) this.cancel();
        break;
      case 'bite':
        this.elapsed += dt;
        if (this.elapsed >= BATHROOM_ACTIVITY.biteTime) {
          this.deps.view.startPull(this.deps.mouth, ctx.moke.position);
          this.deps.onHoldChange(true);
          this.activate();
          this.go('trail');
        }
        break;
      case 'trail': {
        this.deps.view.extendTrail(ctx.moke.position);
        const outside = ctx.moke.position.z > BATHROOM.zMax + 0.08;
        if (!outside) {
          this.hasOutside = false;
          this.outsideDistance = 0;
        } else {
          if (this.hasOutside) this.outsideDistance += flatDistance(this.lastOutside, ctx.moke.position);
          this.lastOutside.x = ctx.moke.position.x;
          this.lastOutside.z = ctx.moke.position.z;
          this.hasOutside = true;
        }
        if (outside && this.outsideDistance >= BATHROOM_ACTIVITY.outsideTrailDistance) {
          this.deps.view.releasePaper();
          this.deps.onHoldChange(false);
          this.go('waitingHuman');
        }
        break;
      }
      case 'waitingHuman':
        this.elapsed += dt;
        if (this.elapsed >= BATHROOM_ACTIVITY.humanWaitTimeout) this.cancel();
        else if (ctx.human.available && this.deps.routine.claim(this.role)) {
          this.walkElapsed = 0;
          this.go('notice');
        }
        break;
      case 'notice':
      case 'clean':
        this.walkElapsed += dt;
        if (this.walkElapsed > BATHROOM_ACTIVITY.walkTimeout) this.cancel();
        break;
      case 'idle': break;
    }
  }

  protected onCancel(): void {
    this.requested = this.nearby = false;
    this.hasOutside = false;
    this.outsideDistance = 0;
    this.go('idle');
    this.deps.view.clearPaper();
    this.deps.onHoldChange(false);
  }

  resetAll(): void {
    this.cancel();
    this.onCancel();
    this.enter('AVAILABLE');
  }

  private drive(dt: number, senses: HumanSenses, intent: HumanIntent): boolean {
    if (!this.running) return false;
    if (this.step === 'notice') {
      walkTo(intent, this.target, undefined, 0.3);
      if (flatDistance(senses.position, this.target) < 0.4) {
        this.deps.routine.say("No, Moke! Don't make a mess!", 'calling', intent);
        this.go('clean');
      } else if ((senses.stuck ?? 0) > 7) this.cancel();
      return this.running;
    }
    if (this.step === 'clean') {
      hold(intent, 'place', BATHROOM.doorway, 0.45, BATHROOM.doorway);
      intent.reach = BATHROOM.doorway;
      this.elapsed += dt;
      this.deps.view.setCleanup(this.elapsed / BATHROOM_ACTIVITY.cleanupTime);
      if (this.elapsed >= BATHROOM_ACTIVITY.cleanupTime) {
        this.deps.view.clearPaper();
        this.deps.onLearn();
        this.go('idle');
        this.succeed();
        return false;
      }
      return true;
    }
    return false;
  }

  private go(step: Step): void { this.step = step; this.elapsed = 0; }
}
