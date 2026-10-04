import { FSD } from '../config/autopilot';
import type { Point2 } from '../human/NavGrid';
import type { Vec3Like } from '../physics/CharacterBody';

/**
 * FSD, "Full Self Dog" (Phase 5): an autopilot that plays Moke so you can watch what he gets up to. It's a virtual
 * player: each frame it says which way to go (and whether to run or walk) and which buttons to press (interact,
 * jump, bark, trick, sniff), and the game treats that exactly like a person's input (D27). It knows nothing about
 * meshes, physics or the activities' insides: it sees the interaction prompts the player would see, plans routes on
 * Moke's navigation grid, and works through little routines (fetch a toy, beg for a carrot, answer the door, nap in
 * the sun…) chosen at random, with the urgent ones first (the doorbell, a treat put down for him, the ballgame).
 */

export type FsdPress = 'interact' | 'jump' | 'bark' | 'trick' | 'sniff';

/** An interaction prompt, as the player would see it (InteractionSystem's items). */
export interface FsdTarget {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly position: Vec3Like;
  readonly interactionDistance: number;
}

/** A flat top he can hop onto (a coffee table, a sofa's seat). */
export interface FsdSurface {
  readonly id: string;
  readonly kind: 'table' | 'sofa';
  readonly x: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfZ: number;
  readonly height: number;
}

/** A TV screen (where, and which way it faces into the room). */
export interface FsdScreen {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly facing: number;
}

/** What FSD can see each frame. */
export interface FsdWorld {
  readonly moke: {
    readonly position: Vec3Like;
    readonly heading: number;
    readonly grounded: boolean;
    readonly speed: number;
    /** What's in his mouth (a prop id, 'paper'), or null. */
    readonly carrying: string | null;
    /** Lying down on a nap spot. */
    readonly resting: boolean;
    /** Sitting watching the ballgame. */
    readonly watching: boolean;
    /** Eating, drinking, being petted, in the middle of a trick, tugging or digging: let it finish. */
    readonly busy: boolean;
  };
  /** The household human, or null before they exist. */
  readonly human: {
    readonly position: Vec3Like;
    /** Free for Moke (not in the Sock Heist or another dog activity). */
    readonly available: boolean;
    /** What their current step shows ('prep', 'meal', 'tv'…), and the kind of place they're at. */
    readonly effect: string | null;
    readonly placeKind: string | null;
  } | null;
  readonly heistRunning: boolean;
  /**
   * Where the Sock Heist is (SockHeistController.phase): 'stolen' (they haven't noticed yet), 'chase', 'treat' (gone
   * for a treat), 'trade' (it's on the floor)…; 'waiting' when nothing's going on.
   */
  readonly heistPhase: string;
  readonly doorRinging: boolean;
  /** The World Series special is on, and its home run is still to come. */
  readonly ballgameOn: boolean;
  readonly holdingPaper: boolean;
  readonly interactables: readonly FsdTarget[];
  /** The prompt showing right now (InteractionSystem.current), or null. */
  readonly current: string | null;
  readonly screens: readonly FsdScreen[];
  readonly surfaces: readonly FsdSurface[];
  /** "the kitchen", for the status line. */
  roomName(x: number, z: number): string;
}

/** Moke's navigation grid (NavGrid sized for him). */
export interface FsdNav {
  findPath(from: Point2, to: Point2, out: Point2[]): boolean;
  isWalkable(x: number, z: number): boolean;
  nearestWalkable(x: number, z: number, maxRadius?: number): Point2 | null;
  /** The walkable point nearest `to` that `from` has a way to, or null. */
  nearestReachable(from: Point2, to: Point2, maxRadius?: number): Point2 | null;
}

/** FSD's input for this frame: a direction in world space (length 0..1), run/walk, and the buttons it presses. */
export interface FsdCommand {
  x: number;
  z: number;
  run: boolean;
  walk: boolean;
  readonly presses: Set<FsdPress>;
}

type StepResult = 'running' | 'done' | 'failed';

interface Step {
  /** Shown in the status line while this step runs (else the routine's own). */
  readonly status?: string;
  /** Runs even while he's busy (eating, a trick…): waiting. Other steps hold until he's free. */
  readonly still?: boolean;
  /** Gives up after this long (else `stepTimeout`); waits keep their own time. */
  readonly timeout?: number;
  update(dt: number, w: FsdWorld, cmd: FsdCommand): StepResult;
}

interface Routine {
  readonly id: string;
  /** "Answering the door". */
  readonly status: string;
  readonly weight: number;
  /** Urgent routines cut in on whatever he's doing. */
  readonly urgent?: boolean;
  available(w: FsdWorld): boolean;
  plan(w: FsdWorld): Step[];
}

type Tuning = typeof FSD;

const flat = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.z - b.z);

export class FullSelfDog {
  /** What he's doing, for the status line under the FSD button. */
  status = '';
  /** Which routine is running (tests, debug). */
  routineId: string | null = null;
  /** Per routine: how often it started, finished, failed (tests, debug). */
  readonly stats = { started: new Map<string, number>(), done: new Map<string, number>(), failed: new Map<string, number>() };
  private failedNow = false;

  private plan: Step[] = [];
  private stepTime = 0;
  private pause = 0;
  private readonly lastDone = new Map<string, number>();
  private readonly watchSpots = new Map<string, Point2 | null>();
  private now = 0;
  private readonly cmd: FsdCommand = { x: 0, z: 0, run: false, walk: false, presses: new Set() };
  private readonly routines: Routine[];

  constructor(
    private readonly nav: FsdNav,
    private readonly random: () => number = Math.random,
    private readonly tuning: Tuning = FSD,
  ) {
    this.routines = this.buildRoutines();
  }

  /** Starts fresh (turned on again). */
  reset(): void {
    this.plan = [];
    this.routineId = null;
    this.status = '';
    this.pause = 0;
    this.lastDone.clear();
  }

  /** Each rendered frame while playing. The command is reused: read it before the next call. */
  update(dt: number, w: FsdWorld): FsdCommand {
    const cmd = this.cmd;
    cmd.x = cmd.z = 0;
    cmd.run = cmd.walk = false;
    cmd.presses.clear();
    this.now += dt;

    // An urgent routine cuts in (unless that one's already running).
    const urgent = this.routines.find((r) => r.urgent && r.id !== this.routineId && r.available(w) && !this.cooling(r));
    if (urgent && !this.routineIsUrgent()) this.start(urgent, w);

    if (this.plan.length === 0) {
      if (this.pause > 0) {
        this.pause -= dt;
        return cmd;
      }
      const next = urgent ?? this.pick(w);
      if (!next) return cmd;
      this.start(next, w);
      if (this.plan.length === 0) return cmd;
    }

    const step = this.plan[0]!;
    // Let whatever's going on (eating, a trick, being petted) finish before moving on.
    if (w.moke.busy && !step.still) return cmd;
    this.stepTime += dt;
    const result = this.stepTime > (step.timeout ?? this.tuning.stepTimeout) ? 'failed' : step.update(dt, w, cmd);
    if (step.status) this.status = step.status;
    if (result === 'done') {
      this.plan.shift();
      this.stepTime = 0;
    } else if (result === 'failed') {
      this.plan = [];
      this.failedNow = true;
    }
    if (this.plan.length === 0) this.finish();
    return cmd;
  }

  // ------------------------------------------------------------------ choosing

  private start(routine: Routine, w: FsdWorld): void {
    if (this.routineId) this.lastDone.set(this.routineId, this.now);
    count(this.stats.started, routine.id);
    this.routineId = routine.id;
    this.status = routine.status;
    this.stepTime = 0;
    const plan = routine.plan(w);
    // Nothing it can do after all (nowhere to go): counts as failed, and it rests like any other.
    if (plan.length === 0) {
      this.plan = [];
      this.failedNow = true;
      this.finish();
      return;
    }
    // First things first: up out of bed.
    this.plan = w.moke.resting ? [this.press('jump'), this.wait(0.8), ...plan] : plan;
  }

  private finish(): void {
    if (this.routineId) {
      this.lastDone.set(this.routineId, this.now);
      count(this.failedNow ? this.stats.failed : this.stats.done, this.routineId);
    }
    this.failedNow = false;
    this.routineId = null;
    this.pause = this.between(this.tuning.between);
  }

  private routineIsUrgent(): boolean {
    return this.routines.some((r) => r.id === this.routineId && r.urgent);
  }

  private cooling(r: Routine): boolean {
    const done = this.lastDone.get(r.id);
    return done !== undefined && this.now - done < (r.urgent ? 3 : this.tuning.routineCooldown);
  }

  /** A weighted random pick among what he could do now (anything off cooldown; if nothing is, anything at all). */
  private pick(w: FsdWorld): Routine | null {
    const open = this.routines.filter((r) => !r.urgent && r.available(w));
    const fresh = open.filter((r) => !this.cooling(r));
    const choices = fresh.length ? fresh : open;
    let total = choices.reduce((s, r) => s + r.weight, 0);
    if (total <= 0) return null;
    let roll = this.random() * total;
    for (const r of choices) {
      roll -= r.weight;
      if (roll <= 0) return r;
    }
    return choices[choices.length - 1]!;
  }

  private between([min, max]: readonly [number, number]): number {
    return min + this.random() * (max - min);
  }

  // ------------------------------------------------------------------ the routines

  private buildRoutines(): Routine[] {
    const target = (w: FsdWorld, id: string) => w.interactables.find((t) => t.id === id) ?? null;
    const enabled = (w: FsdWorld, id: string) => target(w, id)?.enabled === true;
    const free = (w: FsdWorld) => !w.heistRunning && !w.holdingPaper;
    const emptyMouth = (w: FsdWorld): Step[] => (w.moke.carrying && w.moke.carrying !== 'paper' ? [this.interact('pickup:drop')] : []);
    const offFurniture = (w: FsdWorld): Step[] => (w.moke.position.y > 0.2 ? [this.hopOff()] : []);
    const humanFree = (w: FsdWorld) => !!w.human && w.human.available && free(w);
    const toys = [
      ['ball', 'Playing with the tennis ball'],
      ['toy', 'Playing with the rope toy'],
      ['fish', 'Chewing the squeaky fish'],
    ] as const;

    const routines: Routine[] = [
      // ---- Urgent: things that won't wait.
      {
        id: 'door', status: 'Answering the door!', weight: 0, urgent: true,
        available: (w) => w.doorRinging && enabled(w, 'door:bark'),
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.interact('door:bark'), this.wait(8)],
      },
      {
        id: 'giveSock', status: 'Trading the sock for a treat', weight: 0, urgent: true,
        available: (w) => enabled(w, 'heist:give'),
        plan: () => [this.interact('heist:give'), this.wait(1)],
      },
      {
        id: 'eatTreat', status: 'Eating a treat!', weight: 0, urgent: true,
        available: (w) => w.interactables.some((t) => t.id.startsWith('eat:') && t.enabled) && !w.moke.watching,
        plan: (w) => {
          const t = w.interactables.find((x) => x.id.startsWith('eat:') && x.enabled)!;
          // The hidden treat: nose down first, like a real hunt.
          const sniff = t.id === 'eat:hunt' ? [this.press('sniff'), this.wait(1.2)] : [];
          return [...emptyMouth(w), ...sniff, this.interact(t.id), this.wait(2)];
        },
      },
      {
        id: 'watchGame', status: 'Watching the Padres game!', weight: 0, urgent: true,
        available: (w) => w.ballgameOn && !w.moke.watching && free(w) && !w.doorRinging && w.screens.length > 0,
        plan: (w) => {
          const spot = this.watchSpot(w);
          if (!spot) return [];
          // The prompt only comes up once he's in front of a TV with nothing in his mouth.
          return [...emptyMouth(w), ...offFurniture(w), this.go(spot, 0.3), this.waitUntil((x) => enabled(x, 'tv:watch'), 2),
            this.interact('tv:watch'), this.waitUntil((x) => !x.moke.watching, 60, 'Watching the Padres game!')];
        },
      },
      {
        id: 'keepWatching', status: 'Watching the Padres game!', weight: 0, urgent: true,
        available: (w) => w.moke.watching,
        plan: () => [this.waitUntil((x) => !x.moke.watching, 40)],
      },
      {
        id: 'paperRun', status: 'Running off with the toilet paper!', weight: 0, urgent: true,
        available: (w) => w.holdingPaper,
        plan: () => [this.go(this.tuning.paperRunTo, 0.4, true), this.waitUntil((w) => !w.holdingPaper, 6)],
      },
      // The Sock Heist, from the sock in his mouth to the treat: show it off until they notice, keep away while they
      // chase, then wait for the treat and trade (giveSock, eatTreat above).
      {
        id: 'tease', status: 'Showing off the sock…', weight: 0, urgent: true,
        available: (w) => w.heistPhase === 'stolen' && w.moke.carrying === 'sock' && !!w.human,
        plan: (w) => [...offFurniture(w), this.goToHuman(2.2), this.press('bark'),
          this.waitUntil((x) => x.heistPhase !== 'stolen', 2.5), this.press('bark'), this.waitUntil((x) => x.heistPhase !== 'stolen', 4)],
      },
      {
        id: 'flee', status: 'Running off with the sock!', weight: 0, urgent: true,
        available: (w) => w.heistPhase === 'chase' && w.moke.carrying === 'sock',
        plan: () => [this.keepAway((x) => x.heistPhase !== 'chase' || x.moke.carrying !== 'sock', 60)],
      },
      {
        id: 'awaitTreat', status: 'Is that… a treat?', weight: 0, urgent: true,
        available: (w) => w.heistPhase === 'treat' && w.moke.carrying === 'sock' && !enabled(w, 'heist:give'),
        plan: () => [this.waitUntil((x) => x.heistPhase !== 'treat' || x.moke.carrying !== 'sock' || enabled(x, 'heist:give'), 30)],
      },

      // ---- Everyday dog life, at random.
      ...toys.map(([id, status]): Routine => ({
        id: `toy:${id}`, status, weight: id === 'fish' ? 2 : 1.4,
        available: (w) => free(w) && enabled(w, `pickup:${id}`),
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.interact(`pickup:${id}`),
          id === 'fish' ? this.wait(this.between(this.tuning.chewFor), 'Chomp, squeak, chomp!') : this.go(this.randomSpot(w, 3), 0.5, true),
          this.wait(this.between(this.tuning.carryFor) / 2), this.interact('pickup:drop')],
      })),
      {
        id: 'fetch', status: 'Asking for a game of fetch', weight: 1.6,
        available: (w) => humanFree(w) && enabled(w, 'pickup:ball'),
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.interact('pickup:ball'), this.goToHuman(1.1),
          this.interact('pickup:drop'), this.wait(0.8), this.press('bark'), this.wait(1.4), this.press('trick'), this.wait(5)],
      },
      {
        id: 'sock', status: 'Stealing a sock…', weight: 1.4,
        available: (w) => humanFree(w) && enabled(w, 'pickup:sock'),
        // Then `tease` takes over.
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.interact('pickup:sock')],
      },
      {
        id: 'carrot', status: 'Begging for a carrot', weight: 3,
        available: (w) => humanFree(w) && w.human!.effect === 'prep' && !!target(w, 'kitchen:beg'),
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.goToHuman(0.8), ...this.beg('kitchen:beg', 'Sitting nicely by the chopping board…')],
      },
      {
        id: 'dinner', status: 'Begging at the dinner table', weight: 3,
        available: (w) => humanFree(w) && w.human!.effect === 'meal' && !!target(w, 'dinner:beg'),
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.goTo((x) => target(x, 'dinner:beg')?.position ?? null, 0.3),
          ...this.beg('dinner:beg', 'Big eyes at the dinner table…')],
      },
      {
        id: 'hunt', status: 'Doing a trick for a treat', weight: 1.4,
        available: humanFree,
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.goToHuman(1.4), this.press('trick'), this.wait(4)],
      },
      {
        id: 'pets', status: 'Asking for pets', weight: 1.4,
        available: (w) => enabled(w, 'human:pet'),
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.interact('human:pet'), this.wait(4)],
      },
      {
        id: 'food', status: 'Having a snack', weight: 1,
        available: (w) => free(w) && enabled(w, 'bowl:food'),
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.interact('bowl:food'), this.wait(3)],
      },
      {
        id: 'water', status: 'Having a drink', weight: 1,
        available: (w) => free(w) && enabled(w, 'bowl:water'),
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.interact('bowl:water'), this.wait(3)],
      },
      {
        id: 'malibu', status: 'Playing with Malibu', weight: 1.6,
        available: (w) => free(w) && !!target(w, 'bird:play'),
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.goTo((x) => target(x, 'bird:play')?.position ?? null, 0.7),
          this.interact('bird:play'), this.wait(3.5)],
      },
      {
        id: 'nap', status: 'Looking for a nap spot', weight: 1.4,
        available: (w) => free(w) && w.interactables.some((t) => t.id.startsWith('rest:') && !t.id.endsWith(':getUp')),
        plan: (w) => {
          const spots = w.interactables.filter((t) => t.id.startsWith('rest:') && !t.id.endsWith(':getUp'));
          const spot = spots[Math.floor(this.random() * spots.length)]!;
          const up = spot.position.y > 0.15 ? [this.hopOn({ x: spot.position.x, z: spot.position.z, height: spot.position.y })] : [];
          return [...emptyMouth(w), ...offFurniture(w), ...up, this.interact(spot.id),
            this.wait(this.between(this.tuning.napFor), 'Zzz… a perfect nap'), this.press('jump'), this.wait(0.8)];
        },
      },
      {
        id: 'table', status: 'Getting up on the coffee table', weight: 1.4,
        available: (w) => free(w) && w.surfaces.some((s) => s.kind === 'table' && s.height <= 0.5),
        plan: (w) => {
          const tables = w.surfaces.filter((s) => s.kind === 'table' && s.height <= 0.5);
          const t = this.nearest(w, tables);
          return [...emptyMouth(w), ...offFurniture(w), this.hopOn(t), this.wait(this.between(this.tuning.tableFor), 'Up on the table! (Don\'t tell anyone)'), this.hopOff()];
        },
      },
      {
        id: 'pillows', status: 'Digging in the couch pillows', weight: 1.4,
        available: (w) => humanFree(w) && w.surfaces.some((s) => s.kind === 'sofa'),
        plan: (w) => {
          const sofa = this.nearest(w, w.surfaces.filter((s) => s.kind === 'sofa'));
          return [...emptyMouth(w), ...offFurniture(w), this.hopOn(sofa), this.waitUntil((x) => enabled(x, 'couch:dig'), 2),
            this.interact('couch:dig', 2), this.wait(this.between(this.tuning.digFor)), this.hopOff()];
        },
      },
      {
        id: 'paper', status: 'Sneaking into the bathroom…', weight: 1.2,
        available: (w) => humanFree(w) && enabled(w, 'bathroom:paper'),
        plan: (w) => [...emptyMouth(w), ...offFurniture(w), this.interact('bathroom:paper'), this.waitUntil((x) => x.holdingPaper, 5)],
      },
      {
        id: 'explore', status: 'Exploring', weight: 2.2,
        available: () => true,
        plan: (w) => {
          const spot = this.randomSpot(w, 6);
          const flourish: FsdPress = (['trick', 'bark', 'sniff', 'jump'] as const)[Math.floor(this.random() * 4)]!;
          return [...offFurniture(w), this.go(spot, 0.4, this.random() < 0.5, `Exploring ${w.roomName(spot.x, spot.z)}`),
            this.press(flourish), this.wait(this.between([1.5, 3]))];
        },
      },
    ];
    return routines;
  }

  // ------------------------------------------------------------------ steps

  private press(action: FsdPress): Step {
    return { update: (_dt, _w, cmd) => { cmd.presses.add(action); return 'done'; } };
  }

  /** Stands still for `seconds` (letting whatever's going on, eating, a trick, play out). */
  private wait(seconds: number, status?: string): Step {
    let left = seconds;
    return { status, still: true, timeout: Infinity, update: (dt) => ((left -= dt) <= 0 ? 'done' : 'running') };
  }

  /** Stands still until `until` (or gives up after `timeout`, which still counts as done). */
  private waitUntil(until: (w: FsdWorld) => boolean, timeout: number, status?: string): Step {
    let left = timeout;
    return { status, still: true, timeout: Infinity, update: (dt, w) => (until(w) || (left -= dt) <= 0 ? 'done' : 'running') };
  }

  /** Keeps away from the human (the Sock Heist chase), a new spot every so often, until `until` (or `timeout`). */
  private keepAway(until: (w: FsdWorld) => boolean, timeout: number): Step {
    const route = new Route(this.nav, this.tuning);
    let spot: Point2 | null = null;
    let since = 0;
    let left = timeout;
    return {
      timeout: Infinity,
      update: (dt, w, cmd) => {
        if (until(w) || (left -= dt) <= 0) return 'done';
        since += dt;
        if (!spot || since > this.tuning.fleeEvery || flat(w.moke.position, spot) < 0.5) {
          spot = this.awayFrom(w);
          since = 0;
          route.replan();
        }
        // Cornered (no way there, or stuck): somewhere else next frame.
        if (!route.steer(dt, w, { x: spot.x, y: 0, z: spot.z }, cmd, true)) spot = null;
        return 'running';
      },
    };
  }

  /** Begging: sit still beside them until the prompt comes up, then beg, then wait for the treat. */
  private beg(id: string, status: string): Step[] {
    return [
      this.waitUntil((w) => w.interactables.some((t) => t.id === id && t.enabled), this.tuning.begWait, status),
      this.interact(id, 2),
      this.wait(3),
    ];
  }

  /** Off to a spot on the floor (along a planned route). */
  private go(to: Point2, within: number, run = false, status?: string): Step {
    return this.goTo(() => ({ x: to.x, y: 0, z: to.z }), within, run, status);
  }

  /** Up to the human (who may be moving). */
  private goToHuman(within: number): Step {
    return this.goTo((w) => w.human?.position ?? null, within);
  }

  /** Off to wherever `where` says (re-read each frame). Done within `within`; fails if there's no way there. */
  private goTo(where: (w: FsdWorld) => Vec3Like | null, within: number, run = false, status?: string): Step {
    const route = new Route(this.nav, this.tuning);
    return {
      status,
      update: (dt, w, cmd) => {
        const to = where(w);
        if (!to) return 'failed';
        if (flat(w.moke.position, to) <= within) return 'done';
        return route.steer(dt, w, to, cmd, run) ? 'running' : 'failed';
      },
    };
  }

  /**
   * Up to `id`'s prompt and press interact once it's the one showing. Waits up to `wait` seconds in range for it to
   * come up (another prompt can win for a moment). Fails if it's gone.
   */
  private interact(id: string, wait = 3): Step {
    const route = new Route(this.nav, this.tuning);
    let inRange = 0;
    return {
      update: (dt, w, cmd) => {
        const t = w.interactables.find((x) => x.id === id);
        if (!t || (!t.enabled && id !== 'pickup:drop')) return 'failed';
        if (w.current === id) {
          cmd.presses.add('interact');
          return 'done';
        }
        if (id === 'pickup:drop') return w.moke.carrying ? 'running' : 'done';
        const d = flat(w.moke.position, t.position);
        if (d > t.interactionDistance * 0.85) {
          inRange = 0;
          return route.steer(dt, w, t.position, cmd, false) ? 'running' : 'failed';
        }
        // In reach but not the prompt yet: face it with a gentle nudge.
        inRange += dt;
        if (inRange > wait) return 'failed';
        aim(w.moke.position, t.position, cmd, d > 0.25 ? 0.35 : 0.12);
        cmd.walk = true;
        return 'running';
      },
    };
  }

  /**
   * Hops up onto a surface the way a dog does it: from open floor a run-up away (outside the footprint: he can walk
   * under a coffee table), trot straight at its middle, jump just before the edge and push on until he's up. A few
   * tries; between them, back to the start of the run-up.
   */
  private hopOn(surface: { x: number; z: number; height: number; halfX?: number; halfZ?: number }): Step {
    const route = new Route(this.nav, this.tuning);
    let runUp: { from: Point2; jumpAt: number } | null = null;
    let phase: 'approach' | 'runUp' | 'air' = 'approach';
    let phaseTime = 0;
    let tries = 0;
    const center = { x: surface.x, y: surface.height, z: surface.z };
    return {
      update: (dt, w, cmd) => {
        const p = w.moke.position;
        phaseTime += dt;
        if (p.y >= surface.height - 0.12 && w.moke.grounded && flat(p, center) < 1.6) return 'done';
        runUp ??= this.runUpFor(surface, p);
        if (!runUp) return 'failed';
        if (phase === 'approach') {
          if (flat(p, runUp.from) > 0.25) return route.steer(dt, w, { x: runUp.from.x, y: 0, z: runUp.from.z }, cmd, false) ? 'running' : 'failed';
          phase = 'runUp';
          phaseTime = 0;
        }
        aim(p, center, cmd, 1);
        if (phase === 'runUp') {
          if (flat(p, center) <= runUp.jumpAt && w.moke.grounded) {
            cmd.presses.add('jump');
            phase = 'air';
            phaseTime = 0;
          } else if (phaseTime > 2.5) phase = 'approach';
          return 'running';
        }
        // In the air, pushing on; landed short (or underneath), another go.
        if (phaseTime > this.tuning.hopPush && w.moke.grounded) {
          if (++tries >= this.tuning.hopTries) return 'failed';
          phase = 'approach';
          phaseTime = 0;
        }
        return 'running';
      },
    };
  }

  /** Down off whatever he's on: walk off toward open floor a body-length or so away (not the floor under a table). */
  private hopOff(): Step {
    let floor: Point2 | null = null;
    return {
      update: (_dt, w, cmd) => {
        const p = w.moke.position;
        if (p.y < 0.08 && w.moke.grounded) return 'done';
        floor ??= this.floorAround(p);
        if (!floor) return 'failed';
        aim(p, floor, cmd, 0.8);
        return 'running';
      },
    };
  }

  // ------------------------------------------------------------------ places

  /**
   * Where a hop starts: open floor a run-up (`hopRunUp`) out from the middle of a long side (else a short side), and
   * how close to the middle he jumps. A spot with no footprint (a nap spot on a sofa): open floor that far out, toward
   * where he is.
   */
  private runUpFor(s: { x: number; z: number; halfX?: number; halfZ?: number }, from: Point2): { from: Point2; jumpAt: number } | null {
    const out = this.tuning.hopRunUp;
    if (s.halfX === undefined || s.halfZ === undefined) {
      const d = Math.max(1e-3, flat(from, s));
      const toward = { x: s.x + ((from.x - s.x) / d) * (out + 0.5), z: s.z + ((from.z - s.z) / d) * (out + 0.5) };
      const at = this.nav.nearestWalkable(toward.x, toward.z, 1.2) ?? this.nav.nearestWalkable(s.x, s.z, 2.5);
      return at ? { from: at, jumpAt: 0.7 } : null;
    }
    const alongZ = s.halfX >= s.halfZ;
    const sides = [
      ...(alongZ ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]),
      ...(alongZ ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]]),
    ] as const;
    let best: { from: Point2; jumpAt: number } | null = null;
    for (const [i, [dx, dz]] of sides.entries()) {
      const half = dx !== 0 ? s.halfX : s.halfZ;
      const q = { x: s.x + dx * (half + out), z: s.z + dz * (half + out) };
      if (!this.nav.isWalkable(q.x, q.z)) continue;
      const option = { from: q, jumpAt: half + this.tuning.hopJumpBeyond };
      // The long sides first; between two open ones, the nearer.
      if (!best || (i < 2 && flat(q, from) < flat(best.from, from))) best = option;
      if (i === 1 && best) break;
    }
    return best;
  }

  /** Open floor around `p`, about a metre off (nearest first). */
  private floorAround(p: Point2): Point2 | null {
    let best: Point2 | null = null;
    for (const r of [0.8, 1.1, 1.5]) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const q = { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r };
        if (this.nav.isWalkable(q.x, q.z) && (!best || flat(q, p) < flat(best, p))) best = q;
      }
      if (best) return best;
    }
    return this.nav.nearestWalkable(p.x, p.z, 2);
  }

  /**
   * Where to sit to watch the game: open floor in front of a TV (straight on first, then a little off to the side,
   * nearer or further), that he can get to from here; the nearest TV that has one. Remembered per TV (the house
   * doesn't move), so the search runs once.
   */
  private watchSpot(w: FsdWorld): Point2 | null {
    const screens = [...w.screens].sort((a, b) => flat(w.moke.position, a) - flat(w.moke.position, b));
    for (const s of screens) {
      if (!this.watchSpots.has(s.id)) this.watchSpots.set(s.id, this.findWatchSpot(w, s));
      const spot = this.watchSpots.get(s.id);
      if (spot) return spot;
    }
    return null;
  }

  private findWatchSpot(w: FsdWorld, s: FsdScreen): Point2 | null {
    const base = this.tuning.watchDistance;
    for (const d of [base, base + 0.5, base - 0.4, base + 1]) {
      for (const a of [0, 0.35, -0.35, 0.7, -0.7]) {
        const q = { x: s.x + Math.sin(s.facing + a) * d, z: s.z + Math.cos(s.facing + a) * d };
        if (!this.nav.isWalkable(q.x, q.z)) continue;
        if (this.nav.nearestReachable(w.moke.position, q, 0.05)) return q;
      }
    }
    return null;
  }

  private nearest<T extends Point2>(w: FsdWorld, list: readonly T[]): T {
    return list.reduce((best, s) => (flat(w.moke.position, s) < flat(w.moke.position, best) ? s : best), list[0]!);
  }

  /** A random walkable spot at least `minDistance` away (or wherever, if none turns up). */
  private randomSpot(w: FsdWorld, minDistance: number): Point2 {
    const p = w.moke.position;
    for (let i = 0; i < 40; i++) {
      const a = this.random() * Math.PI * 2;
      const r = minDistance + this.random() * 6;
      const at = this.nav.nearestWalkable(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r, 1);
      if (at && flat(at, p) >= minDistance * 0.6) return at;
    }
    return this.nav.nearestWalkable(p.x, p.z) ?? { x: p.x, z: p.z };
  }

  /** Somewhere well away from the human (the sock heist chase). */
  private awayFrom(w: FsdWorld): Point2 {
    const h = w.human?.position ?? w.moke.position;
    let best: Point2 = { x: w.moke.position.x, z: w.moke.position.z };
    let bestD = -1;
    for (let i = 0; i < 12; i++) {
      const spot = this.randomSpot(w, this.tuning.fleeDistance * 0.5);
      const d = flat(spot, h);
      if (d > bestD) { best = spot; bestD = d; }
    }
    return best;
  }
}

function count(map: Map<string, number>, id: string): void {
  map.set(id, (map.get(id) ?? 0) + 1);
}

/** Points the command at `to` (flat), at `strength` (0..1). */
function aim(from: Point2, to: Point2, cmd: FsdCommand, strength: number): void {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return;
  cmd.x = (dx / d) * strength;
  cmd.z = (dz / d) * strength;
}

/** Following a planned route to a (possibly moving) target, with re-planning and getting unstuck. */
class Route {
  private readonly path: Point2[] = [];
  private index = 0;
  private sincePlan = Infinity;
  private stuck = 0;
  private hopped = false;
  /** Getting out of a pocket of floor first (see steer). */
  private escape: Point2 | null = null;

  constructor(private readonly nav: FsdNav, private readonly tuning: Tuning) {}

  /** Somewhere new: plan afresh next time (and forget being stuck). */
  replan(): void {
    this.sincePlan = Infinity;
    this.stuck = 0;
    this.hopped = false;
  }

  /** Steers toward `to`; false if there's no way there or he's hopelessly stuck. */
  steer(dt: number, w: FsdWorld, to: Vec3Like, cmd: FsdCommand, run: boolean): boolean {
    const p = w.moke.position;
    this.sincePlan += dt;
    if (this.sincePlan >= this.tuning.replanEvery || this.index >= this.path.length) {
      this.sincePlan = 0;
      this.index = 0;
      // Head for the nearest floor he can actually get to (a treat tucked in a tight spot): cheap, where a search for
      // a cut-off goal would comb the whole house first.
      const goal = this.nav.nearestReachable(p, to);
      if (goal) {
        if (!this.nav.findPath(p, goal, this.path)) return false;
        this.escape = null;
      } else {
        // He's squeezed into a pocket the grid thinks is closed off (he got in, so he can get out): straight to the
        // nearest floor that does connect to where he's going, then plan from there.
        this.escape = this.nav.nearestReachable(to, p, 1.5);
        if (!this.escape) return false;
        this.path.length = 0;
        this.path.push(this.escape);
      }
      // The first point is where he stands.
      if (this.path.length > 1 && flat(this.path[0]!, p) < this.tuning.waypointReach) this.index = 1;
    }
    if (this.escape && flat(this.escape, p) < this.tuning.waypointReach) {
      this.escape = null;
      this.sincePlan = Infinity;
    }
    while (this.index < this.path.length - 1 && flat(this.path[this.index]!, p) < this.tuning.waypointReach) this.index++;
    const waypoint = this.path[Math.min(this.index, this.path.length - 1)] ?? to;
    const remaining = flat(p, to);
    // The end of the floor he can reach and still short of it: the last bit straight at it (a squeeze; stuck, he
    // gives up as usual).
    const atEnd = !this.escape && this.index >= this.path.length - 1 && flat(p, waypoint) < this.tuning.waypointReach;
    aim(p, atEnd ? to : waypoint, cmd, 1);
    cmd.run = run || remaining > this.tuning.runBeyond;
    cmd.walk = !cmd.run && remaining < this.tuning.walkWithin;

    // Barely moving while pushing: hop (a bolster, a toy underfoot), then re-plan; then give up.
    if (w.moke.grounded && w.moke.speed < this.tuning.stuckSpeed) this.stuck += dt;
    else this.stuck = Math.max(0, this.stuck - dt * 2);
    if (this.stuck > this.tuning.stuckHopAfter && !this.hopped) {
      this.hopped = true;
      cmd.presses.add('jump');
      this.sincePlan = Infinity;
    }
    if (this.stuck > this.tuning.stuckGiveUpAfter) return false;
    if (this.stuck === 0) this.hopped = false;
    return true;
  }
}
