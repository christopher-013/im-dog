import { describe, expect, it } from 'vitest';
import { DOG_ACTIVITIES } from '../config/dogActivities';
import { HUMAN } from '../config/human';
import { PROPS } from '../config/props';
import { GameEvents } from '../core/GameEvents';
import { DogLogicMemory } from '../heist/DogLogic';
import { Treat } from '../heist/Treat';
import { HumanActivityController } from '../human/activities/HumanActivityController';
import { HumanReactions } from '../human/activities/HumanReactions';
import { Human } from '../human/Human';
import { HumanBrain } from '../human/HumanBrain';
import { HumanController } from '../human/HumanController';
import { NavGrid } from '../human/NavGrid';
import { StylizedHumanVisual } from '../human/StylizedHumanVisual';
import { CharacterBody, type Vec3Like } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PropBody } from '../physics/PropBody';
import { Prop } from '../props/Prop';
import { createPropView } from '../props/propVisuals';
import { mulberry32 } from '../utils/random';
import { Home } from '../world/Home';
import { DogActivity } from './DogActivity';
import { DogActivityDirector, DogLogicBook } from './DogActivityDirector';
import { MakeHumanPlay } from './MakeHumanPlay';
import { PerfectNap } from './PerfectNap';
import { TreatHunt } from './TreatHunt';

const DT = 1 / 60;
const home = new Home();
const nav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.1, agentRadius: HUMAN.body.radius, minY: 0.08, maxY: 1.7 });

/** The context, writable, for driving the activities by hand. */
interface Ctx {
  moke: { position: Vec3Like; speed: number; carrying: string | null; barked: boolean; trick: boolean; sniffing: boolean; napSpot: string | null };
  human: { position: Vec3Like; available: boolean; seesMoke: boolean; engaged: boolean };
  heistRunning: boolean;
}

function context(): Ctx {
  return {
    moke: { position: { x: 0, y: 0, z: 0 }, speed: 0, carrying: null, barked: false, trick: false, sniffing: false, napSpot: null },
    human: { position: { x: 1, y: 0, z: 0 }, available: true, seesMoke: true, engaged: false },
    heistRunning: false,
  };
}

/** The real human (routine, reactions, bodies) in the real house, with Moke as a point we move. */
async function world(seed = 1) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(home.colliders);
  physics.commitStaticGeometry();
  const events = new GameEvents();
  const said: string[] = [];
  events.on('HUMAN_SAID', (s) => said.push(s.text));
  const routine = new HumanActivityController(home.places, events, mulberry32(seed));
  const reactions = new HumanReactions(mulberry32(seed + 5));
  reactions.say = (t, m) => routine.say(t, m);
  routine.reactions = reactions;
  const { laundry, laundryBasket } = home.landmarks;
  const places = { home: laundry, basket: laundryBasket, treatStand: home.landmarks.treatStand, treatJar: home.landmarks.treatJar };
  const brain = new HumanBrain(places, { takeTreat() {}, pickUpSock: () => false, putSockAway() {}, placeTreat() {} }, events, mulberry32(seed + 2));
  brain.driver = routine;
  routine.reset();
  const human = new Human(brain, new HumanController(new CharacterBody(physics, laundry, HUMAN.body), nav, 0), new StylizedHumanVisual());
  const moke = { x: -0.8, y: 0, z: -0.8 };
  const humanWorld = { moke, mokeCarryingSock: false, mokeSpeed: 0, mokeUnderFurniture: false, mokeBarked: false, looseSock: null, clear: () => true, mokeCarrying: null as string | null, mokeTrick: false };
  const ctx = context();
  ctx.moke.position = moke;
  ctx.human.position = human.controller.position;
  const step = (director: DogActivityDirector) => {
    humanWorld.mokeCarrying = ctx.moke.carrying;
    humanWorld.mokeTrick = ctx.moke.trick;
    humanWorld.mokeBarked = ctx.moke.barked;
    human.fixedUpdate(DT, humanWorld);
    ctx.human.available = routine.available;
    ctx.human.seesMoke = brain.seesMoke;
    ctx.human.engaged = reactions.engaged;
    director.update(DT, ctx);
    physics.step();
    ctx.moke.barked = false;
  };
  return { physics, routine, reactions, human, moke, ctx, step, said, events };
}

class Probe extends DogActivity {
  readonly id = 'perfectNap' as const;
  readonly name = 'probe';
  readonly needsHuman: boolean = false;
  trigger = false;
  cancelled = 0;
  protected wants(): boolean {
    return this.trigger;
  }
  protected onStart(): void {}
  protected onUpdate(): void {
    if (this.stateTime > 1) this.activate();
    if (this.state === 'ACTIVE' && this.stateTime > 1) this.succeed();
  }
  protected onCancel(): void {
    this.cancelled++;
  }
}

class HumanProbe extends Probe {
  override readonly needsHuman = true;
}

describe('DogActivity lifecycle', () => {
  it('goes AVAILABLE → STARTING → ACTIVE → SUCCESS → COOLDOWN → READY_AGAIN → AVAILABLE, and can be replayed', () => {
    const probe = new Probe(3, 0.5);
    const director = new DogActivityDirector([probe]);
    const ctx = context();
    const seen: string[] = [];
    const run = (seconds: number) => {
      for (let i = 0; i < seconds / DT; i++) {
        director.update(DT, ctx);
        if (seen[seen.length - 1] !== probe.state) seen.push(probe.state);
      }
    };
    run(1);
    expect(probe.state).toBe('AVAILABLE');
    probe.trigger = true;
    run(6);
    // (AVAILABLE again is only for an instant here: the trigger is still on, so it starts right away.)
    expect(seen).toEqual(['AVAILABLE', 'STARTING', 'ACTIVE', 'SUCCESS', 'COOLDOWN', 'READY_AGAIN', 'STARTING']);
    expect(probe.successes).toBe(1);
  });

  it('is called off cleanly (CANCELLED, then its cooldown)', () => {
    const probe = new Probe(1, 0.2);
    probe.trigger = true;
    const director = new DogActivityDirector([probe]);
    director.update(DT, context());
    expect(probe.state).toBe('STARTING');
    director.cancelAll();
    expect(probe.state).toBe('CANCELLED');
    expect(probe.cancelled).toBe(1);
    for (let i = 0; i < 20; i++) director.update(DT, context());
    expect(probe.state).toBe('COOLDOWN');
  });

  it('gives Sock Heist priority over a human-dependent activity already in progress', () => {
    const probe = new HumanProbe(3, 0.5);
    const director = new DogActivityDirector([probe]);
    const ctx = context();
    probe.trigger = true;
    director.update(DT, ctx);
    expect(probe.state).toBe('STARTING');
    ctx.heistRunning = true;
    director.update(DT, ctx);
    expect(probe.state).toBe('CANCELLED');
    expect(probe.cancelled).toBe(1);
  });
});

describe('DogLogicBook', () => {
  it('learns once, shows every re-earned moment, or only once a session when asked', () => {
    const storage = new Map<string, string>();
    const memory = new DogLogicMemory({ getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v) });
    const events = new GameEvents();
    const shown: [string, boolean][] = [];
    events.on('DOG_LOGIC_DISCOVERED', ({ id, first }) => shown.push([id, first]));
    const book = new DogLogicBook(memory, events);
    expect(book.discover('bed=nap', true)).toBe(true);
    expect(book.discover('bed=nap', true)).toBe(false);
    book.discover('sniff=treat');
    book.discover('sniff=treat');
    expect(shown).toEqual([
      ['bed=nap', true],
      ['sniff=treat', true],
      ['sniff=treat', false],
    ]);
    // Remembered in this browser.
    expect(new DogLogicMemory({ getItem: (k) => storage.get(k) ?? null, setItem: () => {} }).has('bed=nap')).toBe(true);
  });
});

describe('PerfectNap', () => {
  const nap = (noise: Vec3Like | null, human: Vec3Like) =>
    new PerfectNap({ spots: home.napSpots, fire: home.fire, noise: () => noise, humanPosition: () => human, onNapped: () => {} });

  it('judges a nap by how it feels: his sunny bed with his human folding laundry nearby is perfect', () => {
    const bed = home.napSpots.find((s) => s.id === 'dogBed')!;
    const report = nap(null, home.landmarks.laundry).judge(bed);
    expect(report.qualities).toEqual({ sunny: true, soft: true, warm: false, quiet: true, nearHuman: true });
    expect(report.perfect).toBe(true);
    expect(report.learned).toEqual(['bed=nap', 'sun+soft=nap']);
  });

  it('knows the hearth is warm but hard, the TV is noisy, and an empty house is lonely', () => {
    const hearth = home.napSpots.find((s) => s.id === 'hearth')!;
    const report = nap(null, { x: -1, y: 0, z: -1 }).judge(hearth);
    expect(report.qualities.warm).toBe(true);
    expect(report.qualities.soft).toBe(false);
    expect(report.qualities.nearHuman).toBe(false);
    const sectional = home.napSpots.find((s) => s.id === 'sectional')!;
    const tv = home.places.find((p) => p.id === 'family.sectional.middle')!.look!;
    expect(nap(tv, { x: 13.75, y: 0, z: 1.85 }).judge(sectional).qualities.quiet).toBe(false);
    expect(nap(null, { x: 13.75, y: 0, z: 1.85 }).judge(sectional).qualities.nearHuman).toBe(true);
  });

  it('needs him to lie there a while; getting up early is no nap; one verdict per lie-down', () => {
    const napped: string[] = [];
    const activity = new PerfectNap({ spots: home.napSpots, fire: home.fire, noise: () => null, humanPosition: () => home.landmarks.laundry, onNapped: (r) => napped.push(r.spot.id) });
    const director = new DogActivityDirector([activity]);
    const ctx = context();
    const run = (seconds: number) => {
      for (let i = 0; i < seconds / DT; i++) director.update(DT, ctx);
    };
    ctx.moke.napSpot = 'pinkBlanket';
    run(2);
    ctx.moke.napSpot = null;
    run(1);
    expect(activity.state).not.toBe('SUCCESS');
    expect(napped).toEqual([]);
    ctx.moke.napSpot = 'dogBed';
    run(DOG_ACTIVITIES.perfectNap.napTime + 1);
    expect(napped).toEqual(['dogBed']);
    run(DOG_ACTIVITIES.perfectNap.cooldown + 10);
    expect(napped).toEqual(['dogBed']); // still lying there: no second verdict
    ctx.moke.napSpot = null;
    run(1);
    ctx.moke.napSpot = 'windowCouch';
    run(DOG_ACTIVITIES.perfectNap.napTime + 1);
    expect(napped).toEqual(['dogBed', 'windowCouch']);
  });
});

describe('TreatHunt (in the house, with the real human)', () => {
  async function setup() {
    const w = await world(3);
    const treat = new Treat('hunt', 8);
    const found: number[] = [];
    const hunt = new TreatHunt({
      routine: w.routine,
      hand: w.human.visual.hands.right,
      treat,
      scene: w.human.visual.object.parent ?? w.human.visual.object,
      jar: home.kitchenTreats,
      spots: home.treatHidingSpots,
      nav,
      mokeCanSee: (spot) => w.physics.lineOfSight({ x: w.moke.x, y: 0.33, z: w.moke.z }, { x: spot.x, y: 0.08, z: spot.z }),
      roomName: (at) => home.roomAt(at.x, at.z).name,
      onFound: (seconds) => found.push(seconds),
      random: mulberry32(4),
    });
    const director = new DogActivityDirector([hunt]);
    return { ...w, treat, hunt, director, found };
  }

  it('a trick near the human → they fetch a treat from the kitchen, hide it away from Moke → he finds and eats it', async () => {
    const { ctx, step, hunt, director, treat, found, said, routine } = await setup();
    ctx.moke.trick = true;
    step(director);
    ctx.moke.trick = false;
    expect(hunt.state).toBe('STARTING');
    expect(routine.role).not.toBeNull();
    let held = false;
    for (let i = 0; i < 90 / DT && hunt.state === 'STARTING'; i++) {
      step(director);
      held ||= treat.state === 'held';
    }
    expect(held).toBe(true);
    expect(hunt.state).toBe('ACTIVE');
    expect(treat.state).toBe('placed');
    const at = hunt.hiddenAt!;
    expect(Math.hypot(at.x - ctx.moke.position.x, at.z - ctx.moke.position.z)).toBeGreaterThanOrEqual(DOG_ACTIVITIES.treatHunt.minFromMoke);
    expect(home.treatHidingSpots).toContain(at);
    expect(said.some((line) => /find/i.test(line))).toBe(true);
    // The routine carries on while he hunts.
    for (let i = 0; i < 2 / DT; i++) step(director);
    expect(routine.role).toBeNull();
    treat.eat();
    expect(hunt.state).toBe('SUCCESS');
    expect(found.length).toBe(1);
  }, 60_000);

  it('helps if it takes a while: a hint about the room, then pointing it out', async () => {
    const { ctx, step, hunt, director, said } = await setup();
    ctx.moke.trick = true;
    step(director);
    ctx.moke.trick = false;
    for (let i = 0; i < 90 / DT && hunt.state === 'STARTING'; i++) step(director);
    for (let i = 0; i < (DOG_ACTIVITIES.treatHunt.pointAfter + 30) / DT; i++) step(director);
    expect(said.some((line) => line.startsWith('Try the'))).toBe(true);
    expect(said).toContain('It\'s right here, silly!');
  }, 90_000);

  it('the Sock Heist taking the human mid-errand calls it off, and the treat goes back in the jar', async () => {
    const { ctx, step, hunt, director, treat, routine } = await setup();
    ctx.moke.trick = true;
    step(director);
    ctx.moke.trick = false;
    for (let i = 0; i < 90 / DT && treat.state !== 'held'; i++) step(director);
    expect(treat.state).toBe('held');
    routine.interrupt(); // what HumanBrain does when it notices the sock
    expect(hunt.state).toBe('CANCELLED');
    expect(treat.state).toBe('stored');
  }, 60_000);

  it('the Sock Heist also cancels a hunt after the treat is hidden, leaving no second treat active', async () => {
    const { ctx, step, hunt, director, treat } = await setup();
    ctx.moke.trick = true;
    step(director);
    ctx.moke.trick = false;
    for (let i = 0; i < 90 / DT && hunt.state === 'STARTING'; i++) step(director);
    expect(hunt.state).toBe('ACTIVE');
    expect(treat.state).toBe('placed');
    ctx.heistRunning = true;
    step(director);
    expect(hunt.state).toBe('CANCELLED');
    expect(hunt.hiddenAt).toBeNull();
    expect(treat.state).toBe('stored');
  }, 60_000);
});

describe('Human reactions', () => {
  it('clears a queued human gesture when an interruption resets reactions', async () => {
    const { reactions, routine, step, said } = await world(12);
    const director = new DogActivityDirector([]);
    reactions.perform('shoo', 1.6, 'Not now, Moke…');
    routine.interrupt();
    step(director);
    expect(reactions.kind).not.toBe('gesture');
    expect(said).not.toContain('Not now, Moke…');
  });
});

describe('MakeHumanPlay (in the house, with the real human and a real ball)', () => {
  async function setup(seed = 8) {
    const w = await world(seed);
    const def = PROPS.ball;
    const ball = new Prop(def, new PropBody(w.physics, def.physics, { x: -0.5, y: def.restHeight, z: -0.3 }, 0), createPropView('ball'), { x: -0.5, y: 0, z: -0.3 }, 0, home.bounds);
    const throws: boolean[] = [];
    const play = new MakeHumanPlay({
      routine: w.routine,
      reactions: w.reactions,
      toys: [ball],
      hand: w.human.visual.hands.right,
      scene: w.human.visual.object,
      clearDistance: (from, direction, max) => w.physics.sweepWorldSphere(from, direction, 0.08, max),
      openFloor: (x, z) => nav.isWalkable(x, z),
      onThrow: (_toy, first) => throws.push(first),
      random: mulberry32(seed),
    });
    const director = new DogActivityDirector([play]);
    const tick = () => {
      w.step(director);
      ball.afterStep();
    };
    /** Moke has it in his mouth (as the pickup system would). */
    const grab = () => {
      ball.pickUp();
      w.ctx.moke.carrying = 'ball';
    };
    /** He lets go of it at (x, z). */
    const drop = (x: number, z: number) => {
      ball.drop({ x, y: 0.1, z }, 0, { x: 0, y: 0, z: 0 });
      w.ctx.moke.carrying = null;
    };
    return { ...w, ball, play, director, tick, grab, drop, throws };
  }

  it('ignored at first, then (after pestering) they give in, get up and throw it, and teach HUMAN + BALL = PLAY', async () => {
    const { ctx, tick, play, grab, drop, ball, throws, said, human } = await setup();
    grab();
    ctx.moke.position.x = -1.0;
    ctx.moke.position.z = -0.9;
    tick();
    expect(play.state).toBe('STARTING');
    // Keep asking: bark now and then until they give in.
    for (let i = 0; i < 30 / DT && play.state === 'STARTING'; i++) {
      if (i % 150 === 0) ctx.moke.barked = true;
      tick();
    }
    expect(play.state).toBe('ACTIVE');
    expect(said.some((l) => /not now|busy|minute|later/i.test(l))).toBe(true);
    // "Drop it!" — he does, at their feet.
    for (let i = 0; i < 2 / DT; i++) tick();
    drop(human.controller.position.x + 0.4, human.controller.position.z + 0.3);
    const from = { ...human.controller.position };
    let flew = 0;
    for (let i = 0; i < 12 / DT && play.throws === 0; i++) tick();
    for (let i = 0; i < 3 / DT; i++) {
      tick();
      flew = Math.max(flew, Math.hypot(ball.position.x - from.x, ball.position.z - from.z));
    }
    expect(play.throws).toBe(1);
    expect(throws).toEqual([true]);
    expect(flew).toBeGreaterThan(1.8);
    expect(nav.isWalkable(ball.position.x, ball.position.z) || !ball.carried).toBe(true);
  }, 60_000);

  it('keep-away: run off with it and they give chase for a few steps, laughing, then let him keep it', async () => {
    const { ctx, tick, play, grab, said } = await setup(9);
    grab();
    ctx.moke.position.x = -1.0;
    ctx.moke.position.z = -0.9;
    tick();
    for (let i = 0; i < 30 / DT && play.state === 'STARTING'; i++) {
      if (i % 150 === 0) ctx.moke.barked = true;
      tick();
    }
    expect(play.state).toBe('ACTIVE');
    // Off he goes across the room with it.
    ctx.moke.position.x = 2.5;
    ctx.moke.position.z = 1.5;
    for (let i = 0; i < 60 / DT && play.running; i++) tick();
    expect(said.some((l) => /come back|not how fetch/i.test(l))).toBe(true);
    expect(said.some((l) => /keep it|yours/i.test(l))).toBe(true);
    expect(play.running).toBe(false);
  }, 90_000);
});
