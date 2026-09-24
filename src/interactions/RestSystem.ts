import { REST } from '../config/interaction';
import type { Vec3Like } from '../physics/CharacterBody';
import { angleDelta } from '../utils/math';
import type { InteractionSystem, InteractorPose } from './InteractionSystem';

/** standing → (E "Lie Down") settling → resting → (E "Get Up" or a move key) rising → standing */
export type RestPhase = 'standing' | 'settling' | 'resting' | 'rising';

/** A place to lie down: its centre and the way he faces once settled. */
export interface RestSpot {
  readonly id: string;
  readonly position: Vec3Like;
  readonly facing: number;
}

type RestTuning = { readonly [K in keyof typeof REST]: number };

/**
 * Lying down in the dog bed. Registers a REST interactable ("Lie Down") at the spot and, while
 * resting, a top-priority "Get Up". While not standing, gameplay must hold Moke still (or glide
 * him to `glideTarget`); the phase drives his lying pose, the camera and the quieter UI.
 * Not the nap mini-game: just lie down and get up.
 */
export class RestSystem {
  private currentPhase: RestPhase = 'standing';
  private phaseTime = 0;

  constructor(
    interactions: InteractionSystem,
    readonly spot: RestSpot,
    private readonly tuning: RestTuning = REST,
  ) {
    const system = this;
    interactions.register({
      id: `rest:${spot.id}`,
      type: 'REST',
      label: 'Lie Down',
      interactionDistance: tuning.reach,
      get enabled() {
        return system.currentPhase === 'standing';
      },
      position: spot.position,
      // He may walk in backwards or sideways; the bed is right under him.
      requiresFacing: false,
      interact: () => this.lieDown(),
    });
    interactions.register({
      id: `rest:${spot.id}:getUp`,
      type: 'REST',
      label: 'Get Up',
      interactionDistance: Infinity,
      get enabled() {
        return system.currentPhase === 'resting' || system.currentPhase === 'settling';
      },
      position: spot.position,
      requiresFacing: false,
      priority: 20,
      interact: () => this.standUp(),
    });
  }

  get phase(): RestPhase {
    return this.currentPhase;
  }

  /** True unless he's standing: movement input must be ignored. */
  get holdsMoke(): boolean {
    return this.currentPhase !== 'standing';
  }

  /** Lying (or lying down): drives the pose, camera and UI. */
  get lying(): boolean {
    return this.currentPhase === 'resting';
  }

  /** Where to shuffle to while settling; null otherwise. */
  get glideTarget(): Vec3Like | null {
    return this.currentPhase === 'settling' ? this.spot.position : null;
  }

  /** While settling: walk in facing where he's going, then turn around to face out, like a real dog. */
  glideHeading(moke: InteractorPose): number {
    const dx = this.spot.position.x - moke.position.x;
    const dz = this.spot.position.z - moke.position.z;
    return Math.hypot(dx, dz) > this.tuning.arriveDistance * 2 ? Math.atan2(dx, dz) : this.spot.facing;
  }

  lieDown(): boolean {
    if (this.currentPhase !== 'standing') return false;
    this.setPhase('settling');
    return true;
  }

  /** E or a movement key. */
  standUp(): boolean {
    if (this.currentPhase !== 'settling' && this.currentPhase !== 'resting') return false;
    this.setPhase('rising');
    return true;
  }

  /** Each fixed step, after Moke has moved. */
  update(dt: number, moke: InteractorPose): void {
    const t = this.tuning;
    this.phaseTime += dt;
    if (this.currentPhase === 'settling') {
      const distance = Math.hypot(this.spot.position.x - moke.position.x, this.spot.position.z - moke.position.z);
      const facingError = Math.abs(angleDelta(moke.heading, this.spot.facing));
      const arrived = distance <= t.arriveDistance && facingError <= t.arriveAngle;
      if (arrived || this.phaseTime >= t.settleTimeout) this.setPhase('resting');
    } else if (this.currentPhase === 'rising' && this.phaseTime >= t.riseTime) {
      this.setPhase('standing');
    }
  }

  private setPhase(phase: RestPhase): void {
    this.currentPhase = phase;
    this.phaseTime = 0;
  }
}
