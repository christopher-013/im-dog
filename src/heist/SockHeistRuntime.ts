import { Vector3, type Camera, type Object3D } from 'three';
import type { AudioManager } from '../audio/AudioManager';
import { HEIST } from '../config/heist';
import { HUMAN } from '../config/human';
import type { GameEvents } from '../core/GameEvents';
import { Human } from '../human/Human';
import { HumanBrain, type HumanIdleDriver, type HumanPlaces } from '../human/HumanBrain';
import { HumanController } from '../human/HumanController';
import { NavGrid } from '../human/NavGrid';
import { StylizedHumanVisual } from '../human/StylizedHumanVisual';
import type { InteractionSystem } from '../interactions/InteractionSystem';
import type { PickupSystem } from '../interactions/PickupSystem';
import { CharacterBody, type Vec3Like } from '../physics/CharacterBody';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { AttentionSystem } from '../player/AttentionSystem';
import type { Moke } from '../player/Moke';
import type { Prop } from '../props/Prop';
import type { ScentSystem } from '../senses/ScentSystem';
import type { UIManager } from '../ui/UIManager';
import type { Home } from '../world/Home';
import { DogLogicMemory } from './DogLogic';
import { SockHeistController } from './SockHeistController';

export interface HeistRuntimeDeps {
  readonly scene: Object3D;
  readonly physics: PhysicsWorld;
  readonly room: Pick<Home, 'landmarks' | 'colliders' | 'bounds'>;
  readonly events: GameEvents;
  readonly interactions: InteractionSystem;
  readonly pickup: PickupSystem<Prop>;
  readonly sock: Prop;
  readonly moke: Moke;
  readonly scent: ScentSystem;
  readonly attention: AttentionSystem;
  readonly ui: UIManager;
  readonly audio: AudioManager;
  /** Pops a little word over Moke ("Nom!"). */
  readonly mokeSays: (text: string) => void;
  /** The human's daily routine (what they do when the heist doesn't need them). */
  readonly routine?: HumanIdleDriver;
  /** The human's walkable grid over the whole house (built once, shared with the dog activities). */
  readonly nav?: NavGrid;
  /** What Moke has figured out (shared with the other Dog Logic moments). */
  readonly memory?: DogLogicMemory;
}

/** Under something this low (m of headroom), he's out of the human's reach. */
const UNDER_FURNITURE = 1.0;

/**
 * Sets up Sock Heist in the living room and connects it to the rest of the game: builds the human (nav grid,
 * body, brain, look), registers the treat's smell and eye-appeal, turns heist events into speech bubbles,
 * sounds and HUD, and feeds the human what they perceive each fixed step. Keeps Game.ts to a few calls.
 */
export class SockHeistRuntime {
  readonly heist: SockHeistController;
  readonly human: Human;
  private barked = false;
  private readonly head = new Vector3();
  private readonly sockHome: Vec3Like;
  private readonly world: {
    moke: Vec3Like;
    mokeCarryingSock: boolean;
    mokeSpeed: number;
    mokeUnderFurniture: boolean;
    mokeBarked: boolean;
    looseSock: Vec3Like | null;
    clear: (from: Vec3Like, to: Vec3Like) => boolean;
    mokeCarrying: string | null;
    mokeTrick: boolean;
    mokeLying: boolean;
  };

  constructor(private readonly deps: HeistRuntimeDeps) {
    const { room, physics, events, scene, ui, audio } = deps;
    const marks = room.landmarks;
    this.sockHome = marks.sock;
    const places: HumanPlaces = { home: marks.laundry, basket: marks.laundryBasket, treatStand: marks.treatStand, treatJar: marks.treatJar };
    const nav =
      deps.nav ??
      new NavGrid(room.colliders, {
        bounds: room.bounds,
        cell: 0.1,
        agentRadius: HUMAN.body.radius,
        minY: 0.08,
        maxY: 1.7,
      });

    this.heist = new SockHeistController({
      events,
      interactions: deps.interactions,
      pickup: deps.pickup,
      sock: deps.sock,
      eat: () => {
        deps.moke.animation.eat();
        audio.play('crunch');
        deps.mokeSays('Nom nom!');
      },
      scene,
      places: { humanHome: marks.laundry, basket: marks.laundryBasket, sockReturn: marks.sockReturn },
      memory: deps.memory ?? new DogLogicMemory(),
      // The human puts the treat down toward Moke. If he's up on the couch or table, that line runs into the
      // furniture: stop short of it, on open floor he can reach.
      treatSpot: (from, to) => {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 1e-3) return to;
        const origin = { x: from.x, y: HEIST.treatSweep.height, z: from.z };
        const direction = { x: dx / distance, y: 0, z: dz / distance };
        const free = physics.sweepWorldSphere(origin, direction, HEIST.treatSweep.radius, distance);
        if (free >= distance) return to;
        const k = Math.max(0, free - HEIST.treatSweep.margin) / distance;
        return { x: from.x + dx * k, y: 0, z: from.z + dz * k };
      },
      createHuman: (hands) => {
        const heading = Math.atan2(marks.laundryBasket.x - marks.laundry.x, marks.laundryBasket.z - marks.laundry.z);
        const body = new CharacterBody(physics, marks.laundry, HUMAN.body);
        const brain = new HumanBrain(places, hands, events);
        if (deps.routine) {
          brain.driver = deps.routine;
          deps.routine.reset();
        }
        const human = new Human(brain, new HumanController(body, nav, heading), new StylizedHumanVisual());
        scene.add(human.visual.object);
        return human;
      },
    });
    this.human = this.heist.human as Human;

    const treat = this.heist.treat;
    deps.scent.register(treat.scent);
    deps.attention.register(treat.attention);
    // Moke looks up at the human now and then (at their knees: he's small).
    const human = this.human;
    deps.attention.register({
      id: 'human',
      kind: 'human',
      interest: 0.9,
      position: { get x() { return human.renderPosition.x; }, y: 0.6, get z() { return human.renderPosition.z; } },
    });

    this.world = {
      moke: deps.moke.controller.position,
      mokeCarryingSock: false,
      mokeSpeed: 0,
      mokeUnderFurniture: false,
      mokeBarked: false,
      looseSock: null,
      clear: (from, to) => physics.lineOfSight(from, to),
      mokeCarrying: null,
      mokeTrick: false,
      mokeLying: false,
    };

    events.on('HUMAN_SAID', ({ text, mood }) => {
      ui.say(text, mood);
      if (mood === 'calling') audio.play('treatBag');
    });
    events.on('HUMAN_NOTICED', () => audio.play('surprise'));
    events.on('GRAB_MISSED', () => audio.play('whoosh'));
    events.on('TREAT_FETCHED', () => audio.play('treatBag'));
    events.on('HEIST_RESET', () => ui.clearHeist());
  }

  /** Moke barked (the human might hear where he is). */
  noteBark(): void {
    this.barked = true;
  }

  /** Is he busy with the heist in a way that should hold him still (eating)? */
  get holdsMoke(): boolean {
    return this.deps.moke.animation.eating;
  }

  /** The fixed step: the human perceives, decides and moves; the heist's timers run. */
  fixedUpdate(step: number): void {
    const { moke, pickup, sock } = this.deps;
    const w = this.world;
    w.moke = moke.controller.position;
    w.mokeCarryingSock = pickup.carried === sock;
    w.mokeSpeed = moke.controller.actualSpeed;
    w.mokeUnderFurniture = moke.controller.headroom < UNDER_FURNITURE;
    w.mokeBarked = this.barked;
    w.looseSock = !sock.carried && pickup.carried !== sock ? sock.position : null;
    w.mokeCarrying = pickup.carried?.id ?? null;
    w.mokeTrick = moke.animation.performingTrick;
    w.mokeLying = moke.resting;
    this.human.fixedUpdate(step, w);
    this.barked = false;
    this.heist.fixedUpdate(step);
  }

  /**
   * Each frame: draw the human, keep the speech bubble over their head, update the objective line (the heist's, or
   * `otherObjective` when the heist has nothing to say).
   */
  update(dt: number, alpha: number, camera: Camera, canvas: HTMLCanvasElement, playing: boolean, otherObjective: string | null = null): void {
    this.human.visual.setSeeThrough(this.blocksView(camera.position));
    this.human.update(dt, alpha);
    this.heist.update();
    const ui = this.deps.ui;
    ui.setObjective(playing ? (this.heist.objective ?? otherObjective) : null);
    if (!ui.speaking) return;
    const p = this.human.headPosition(this.head).project(camera);
    // Behind the camera: pin it to the side they're on, near the top.
    const behind = p.z > 1;
    const x = behind ? (p.x > 0 ? 0 : 1) : (p.x + 1) / 2;
    const y = behind ? 0 : (1 - p.y) / 2;
    ui.placeSpeech(x * canvas.clientWidth, y * canvas.clientHeight);
  }

  /**
   * Is the human standing between the camera and Moke (or right against the camera)? The camera ignores
   * characters on purpose (no jitter), so instead the human fades to see-through while in the way.
   */
  private blocksView(eye: Vec3Like): boolean {
    const h = this.human.visualPosition;
    const m = this.deps.moke.renderPosition;
    const radius = HUMAN.body.radius + 0.12;
    if (Math.hypot(eye.x - h.x, eye.z - h.z) < radius + 0.15 && eye.y < 1.7) return true;
    // Closest point on the camera→Moke line (flat) to the human's axis.
    const dx = m.x - eye.x;
    const dz = m.z - eye.z;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq < 1e-6) return false;
    const t = ((h.x - eye.x) * dx + (h.z - eye.z) * dz) / lengthSq;
    if (t <= 0 || t >= 1) return false;
    return Math.hypot(eye.x + dx * t - h.x, eye.z + dz * t - h.z) < radius;
  }

  /** Where the sock starts (debug). */
  get sockStart(): Vec3Like {
    return this.sockHome;
  }
}
