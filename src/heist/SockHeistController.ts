import type { Object3D } from 'three';
import { HEIST } from '../config/heist';
import { HUMAN } from '../config/human';
import type { GameEvents } from '../core/GameEvents';
import type { Interactable } from '../interactions/Interactable';
import type { InteractionSystem } from '../interactions/InteractionSystem';
import type { Vec3Like } from '../physics/CharacterBody';
import type { HumanHands } from '../human/HumanBrain';
import type { DogLogicMemory } from './DogLogic';
import { Treat } from './Treat';

/** Where the heist is. `waiting` = armed: the sock is loose and nobody's cross (yet). */
export type HeistPhase = 'waiting' | 'stolen' | 'chase' | 'treat' | 'trade' | 'eating' | 'discovery' | 'complete';

/** The sock, as the heist needs it (Prop satisfies this). */
export interface HeistSock {
  readonly carried: boolean;
  readonly position: Vec3Like;
  pickUp(): void;
  drop(at: Vec3Like, heading: number, velocity: Vec3Like): void;
  holdIn(socket: Object3D): void;
  release(parent: Object3D): void;
  reset(parent: Object3D): void;
}

/** The human, as the heist needs them (Human satisfies this). */
export interface HeistHuman {
  readonly brain: { readonly wantsTrade: boolean; receiveSock(): boolean };
  readonly controller: { readonly position: Vec3Like };
  readonly visual: { readonly hands: { readonly left: Object3D; readonly right: Object3D } };
  reset(home: Vec3Like, facing: Vec3Like): void;
}

export interface HeistPlaces {
  readonly humanHome: Vec3Like;
  readonly basket: Vec3Like;
  /** Where the human tosses a retrieved sock (beside the basket). */
  readonly sockReturn: Vec3Like;
}

export interface HeistDeps {
  readonly events: GameEvents;
  readonly interactions: InteractionSystem;
  /** Moke's mouth (PickupSystem): what he carries, and letting go into a hand. */
  readonly pickup: { readonly carried: unknown; handOver(): unknown };
  readonly sock: HeistSock;
  /** Moke eats (MokeAnimationController). */
  readonly eat: () => void;
  readonly scene: Object3D;
  readonly places: HeistPlaces;
  readonly memory: DogLogicMemory;
  /** Builds the human, given the hands this heist lends them. */
  readonly createHuman: (hands: HumanHands) => HeistHuman;
}

const ZERO: Vec3Like = { x: 0, y: 0, z: 0 };

/**
 * Sock Heist, start to finish: Moke steals the sock → the human notices and chases → gives up and fetches a
 * treat → the trade → Moke eats → SOCK = TREAT → "Sock Heist Complete" → replay.
 *
 * The orchestration layer only: it tracks the phase, owns the treat and the trade, lends the human their hands,
 * and resets everything for a replay. The human decides how to behave (HumanBrain); Moke, the sock and the
 * treat look after themselves; UI and audio listen to GameEvents. A pattern for future mini-games.
 */
export class SockHeistController implements HumanHands {
  phase: HeistPhase = 'waiting';
  /** Seconds since the sock was first stolen this round. */
  elapsed = 0;
  readonly treat = new Treat();
  readonly human: HeistHuman;
  private phaseTime = 0;
  private readonly give: Interactable;

  constructor(private readonly deps: HeistDeps) {
    const { events, interactions } = deps;
    this.human = deps.createHuman(this);
    const heist = this;
    this.give = {
      id: 'heist:give',
      type: 'GIVE',
      label: 'Give Sock',
      interactionDistance: HUMAN.treat.tradeDistance + 0.2,
      get enabled() {
        return heist.human.brain.wantsTrade && heist.deps.pickup.carried === heist.deps.sock;
      },
      get position() {
        return heist.human.controller.position;
      },
      requiresClearPath: false,
      priority: 30,
      interact: () => this.trade(),
    };
    interactions.register(this.give);
    interactions.register(this.treat.interactable);
    this.treat.onEat = () => this.startEating();

    events.on('SOCK_PICKED_UP', ({ by }) => {
      if (by === 'moke' && this.phase === 'waiting') this.enter('stolen');
    });
    // Put down again before anyone noticed: nothing happened (the clock restarts on the next grab).
    events.on('SOCK_DROPPED', () => {
      if (this.phase === 'stolen') this.enter('waiting');
    });
    events.on('HUMAN_NOTICED', () => {
      if (this.phase === 'stolen' || this.phase === 'waiting') this.enter('chase');
    });
    events.on('CHASE_GAVE_UP', () => {
      if (this.phase === 'chase') this.enter('treat');
    });
    events.on('TREAT_PLACED', () => this.enter('trade'));
    // The human got the sock back without a trade: the heist is armed again (they'll remember, though).
    events.on('SOCK_RETURNED', () => {
      if (this.phase === 'stolen' || this.phase === 'chase') this.enter('waiting');
    });
  }

  /** A short line for the HUD: what's going on, for anyone new to it. Null when nothing needs saying. */
  get objective(): string | null {
    switch (this.phase) {
      case 'chase':
        return 'Keep away!';
      case 'treat':
        return this.human.brain.wantsTrade ? 'A treat! Trade the sock for it' : 'Keep away!';
      case 'trade':
        return 'Eat the treat!';
      default:
        return null;
    }
  }

  get running(): boolean {
    return this.phase !== 'waiting' && this.phase !== 'complete';
  }

  /** The fixed step: timers for eating and the discovery. */
  fixedUpdate(dt: number): void {
    this.phaseTime += dt;
    if (this.running) this.elapsed += dt;
    if (this.phase === 'eating' && this.phaseTime >= HEIST.eatTime) {
      this.deps.events.emit('TREAT_EATEN');
      const first = this.deps.memory.learn(HEIST.dogLogicId);
      this.deps.events.emit('DOG_LOGIC_DISCOVERED', { id: HEIST.dogLogicId, first });
      this.enter('discovery');
    } else if (this.phase === 'discovery' && this.phaseTime >= HEIST.discoveryTime) {
      this.enter('complete');
      this.deps.events.emit('HEIST_COMPLETE', { seconds: this.elapsed });
    }
  }

  /** Each frame: the treat follows the human's hand. */
  update(): void {
    this.treat.update();
  }

  /** PLAY AGAIN: sock back on the rug, human back at the laundry, treat back in the jar. Moke stays where he is. */
  reset(): void {
    if (this.deps.pickup.carried === this.deps.sock) this.deps.pickup.handOver();
    this.deps.sock.reset(this.deps.scene);
    this.treat.reset();
    this.human.reset(this.deps.places.humanHome, this.deps.places.basket);
    this.elapsed = 0;
    this.enter('waiting');
    this.deps.events.emit('HEIST_RESET');
  }

  /** KEEP EXPLORING: carry on; the next steal starts a new heist (the human tidies the sock away first). */
  keepExploring(): void {
    if (this.phase === 'complete') {
      this.elapsed = 0;
      this.enter('waiting');
    }
  }

  // ---- HumanHands: what the human's hands do in the world.

  takeTreat(): void {
    this.treat.holdIn(this.human.visual.hands.right);
  }

  pickUpSock(): boolean {
    const sock = this.deps.sock;
    if (sock.carried) return false;
    sock.pickUp();
    sock.holdIn(this.human.visual.hands.left);
    return true;
  }

  putSockAway(): void {
    const at = this.deps.places.sockReturn;
    const sock = this.deps.sock;
    sock.release(this.deps.scene);
    sock.drop({ x: at.x, y: at.y + 0.05, z: at.z }, 0.4, ZERO);
  }

  placeTreat(at: Vec3Like): void {
    this.treat.place(at, this.deps.scene);
  }

  // ---- the heist's own moments

  /** "Give Sock": out of Moke's mouth and into the human's hand. */
  private trade(): void {
    if (!this.human.brain.wantsTrade || this.deps.pickup.carried !== this.deps.sock) return;
    this.deps.pickup.handOver();
    this.deps.sock.holdIn(this.human.visual.hands.left);
    this.human.brain.receiveSock();
    this.deps.events.emit('SOCK_TRADED');
  }

  private startEating(): void {
    this.deps.eat();
    this.enter('eating');
  }

  private enter(phase: HeistPhase): void {
    if (phase === 'stolen') this.elapsed = 0;
    this.phase = phase;
    this.phaseTime = 0;
  }
}
