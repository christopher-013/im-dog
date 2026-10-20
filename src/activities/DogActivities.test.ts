import { Object3D } from 'three';
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
import { DoorDelivery } from './DoorDelivery';
import { RideOffer } from './RideOffer';
import { RIDE } from '../config/ride';
import { RideExcitement } from '../ride/RideExcitement';
import { KitchenBeg } from './KitchenBeg';
import { DinnerBeg } from './DinnerBeg';
import { CourseReward } from './CourseReward';
import { COURSE_REWARD } from '../config/obstacleCourse';
import { roomAt } from '../world/home/layout';
import { HUMAN_ACTIVITIES } from '../config/activities';
import { placeById } from '../world/home/places';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import { MOKE_BODY } from '../config/movement';

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

/** The real human (routine, reactions, bodies) in the whole house, with Moke as a point we move. */
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

class GameProbe extends HumanProbe {
  override readonly yieldsHuman = true;
}

class UrgentProbe extends HumanProbe {
  override readonly urgent = true;
}

/** Running, but not using the human just now (a Treat Hunt he's searching on his own). */
class SearchProbe extends HumanProbe {
  override get holdsHuman(): boolean { return false; }
}

describe('Door delivery (the whole house and the household human)', () => {
  async function deliveryWorld(seed = 41, random: () => number = () => 0, halloween = false) {
    const w = await world(seed);
    let rings = 0, rewards = 0, exchanges = 0, opens = 0, cancels = 0;
    const voices: string[] = [];
    const visitors: string[] = [];
    const candy: boolean[] = [];
    const biscuit = new Treat('pumpkin', 3, 'pumpkin');
    const scene = new Object3D();
    const delivery = new DoorDelivery({
      routine: w.routine, hand: w.human.visual.hands.right,
      view: {
        arrive(visit) { visitors.push(visit); }, acknowledge() {}, open(on) { if (on) opens++; }, takePackage() { exchanges++; },
        holdCandy(hand) { candy.push(hand !== null); }, finish() {}, cancel() { cancels++; },
      },
      onRing: () => rings++, onBark: () => { voices.push('bark'); delivery.noteBark(w.moke); },
      onGuardVoice: (kind) => voices.push(kind), onDefended: () => rewards++, random,
      halloween: () => halloween,
      biscuit: { treat: biscuit, scene, openFloor: () => true },
    });
    const director = new DogActivityDirector([delivery]);
    const tick = (seconds: number) => { for (let i = 0; i < seconds / DT; i++) w.step(director); };
    const waitForRing = (maxSeconds = 160) => {
      for (let i = 0; i < maxSeconds / DT && !delivery.ringing; i++) w.step(director);
      expect(delivery.ringing).toBe(true);
    };
    return { ...w, delivery, director, tick, waitForRing, voices, visitors, candy, biscuit, counts: () => ({ rings, rewards, exchanges, opens, cancels }) };
  }

  it('rings until a bark at the door, accepts one package, resumes the routine, and repeats', async () => {
    const w = await deliveryWorld();
    w.tick(31);
    expect(w.delivery.ringing).toBe(true);
    expect(w.counts().rings).toBeGreaterThanOrEqual(3);
    expect(w.routine.available).toBe(true); // ringing doesn't monopolize the human
    w.delivery.noteBark({ x: 0, y: 0, z: 0 });
    expect(w.delivery.ringing).toBe(true);
    Object.assign(w.moke, { ...HOME_ACTIVITIES.delivery.stand, x: -2.2 });
    w.delivery.interactable.interact();
    expect(w.delivery.ringing).toBe(false);
    const rings = w.counts().rings;
    w.tick(6.5);
    expect(w.voices).toEqual(['bark', 'growl', 'bark', 'growl', 'bark', 'growl']);
    expect(w.delivery.guarding).toBe(true);
    expect(w.counts().opens).toBe(0);
    expect(w.counts().exchanges).toBe(0);
    w.tick(43.5);
    expect(w.counts().rings).toBe(rings);
    expect(w.counts().exchanges).toBe(1);
    expect(w.counts().rewards).toBe(1);
    expect(w.counts().opens).toBeGreaterThan(0);
    expect(w.routine.available).toBe(true);
    w.tick(540); // Even with the handoff already finished, no successful repeat before ten minutes.
    expect(w.delivery.ringing).toBe(false);
    expect(w.counts().rings).toBe(rings);
    w.waitForRing(350);
    expect(w.delivery.ringing).toBe(true);
    w.delivery.noteBark(w.moke);
    w.tick(50);
    expect(w.counts().exchanges).toBe(2);
    expect(w.counts().rewards).toBe(2);
  }, 60_000);

  it('once he has barked, the human sets off for the door straight away at a brisk pace, and the visit counts as in progress until it is done', async () => {
    const w = await deliveryWorld(50);
    w.waitForRing();
    expect(w.delivery.inProgress).toBe(false);
    Object.assign(w.moke, { ...HOME_ACTIVITIES.delivery.stand, x: -2.2 });
    w.delivery.noteBark(w.moke);
    expect(w.delivery.inProgress).toBe(true);
    let fastest = 0, opened = -1;
    for (let i = 0; i < 40 / DT && opened < 0; i++) {
      w.step(w.director);
      fastest = Math.max(fastest, w.human.controller.speed);
      if (w.counts().opens > 0) opened = i * DT;
    }
    // No waiting out his guard barks first: up and walking within the first second.
    expect(w.said).toContain('Coming, Moke! I’ll get the door.');
    expect(fastest).toBeGreaterThan(HUMAN.move.walkSpeed + 0.3);
    expect(fastest).toBeLessThanOrEqual(HOME_ACTIVITIES.delivery.answerSpeed + 1e-6);
    expect(opened).toBeGreaterThan(0);
    expect(w.delivery.inProgress).toBe(true);
    w.tick(20);
    expect(w.counts().exchanges).toBe(1);
    expect(w.delivery.inProgress).toBe(false);
  }, 60_000);

  it('Halloween: trick-or-treaters instead of the courier; candy at the door, then the human brings him a pumpkin biscuit', async () => {
    const w = await deliveryWorld(51, () => 0, true);
    w.waitForRing();
    expect(w.visitors).toEqual(['trickOrTreat']);
    expect(w.delivery.objective).toMatch(/Trick-or-treaters/);
    Object.assign(w.moke, { ...HOME_ACTIVITIES.delivery.stand, x: -2.2, z: 1.2 });
    w.delivery.noteBark(w.moke);
    let opened = false;
    for (let i = 0; i < 30 / DT && w.delivery.inProgress && w.biscuit.state === 'stored'; i++) {
      w.step(w.director);
      opened ||= w.counts().opens > 0;
    }
    expect(opened).toBe(true);
    expect(w.counts().exchanges).toBe(0); // no parcel
    expect(w.candy[0]).toBe(true); // the bowl held out at the door…
    expect(w.candy).toContain(false); // …and back on its shelf
    expect(w.said).toContain('“Trick or treat!” Happy Halloween, kids! Love the costumes!');
    // Biscuit in hand, they come to him (he stays put) and hand it over.
    expect(w.biscuit.state).toBe('held');
    let eaten = false;
    w.biscuit.onEat = () => { eaten = true; };
    for (let i = 0; i < 30 / DT && !eaten; i++) w.step(w.director);
    expect(eaten).toBe(true);
    expect(w.biscuit.state).toBe('eaten');
    expect(w.counts().rewards).toBe(1);
    expect(w.delivery.inProgress).toBe(false);
  }, 60_000);

  it("Halloween: if he won't come for the biscuit, it goes down on the floor for him", async () => {
    const w = await deliveryWorld(52, () => 0, true);
    w.waitForRing();
    Object.assign(w.moke, { ...HOME_ACTIVITIES.delivery.stand, x: -2.2, z: 1.2 });
    w.delivery.noteBark(w.moke);
    for (let i = 0; i < 30 / DT && w.biscuit.state !== 'held'; i++) w.step(w.director);
    expect(w.biscuit.state).toBe('held');
    // He keeps away: across the room and moving on whenever they get near.
    for (let i = 0; i < 40 / DT && w.biscuit.state === 'held'; i++) {
      const h = w.human.controller.position;
      if (Math.hypot(h.x - w.moke.x, h.z - w.moke.z) < 1.5) Object.assign(w.moke, w.moke.x > 0 ? { x: -2.4, z: -2 } : { x: 2.4, z: -2 });
      w.step(w.director);
    }
    expect(w.biscuit.state).toBe('placed');
    expect(w.counts().rewards).toBe(1);
    expect(w.delivery.inProgress).toBe(false);
  }, 60_000);

  it('outside Halloween the courier comes as always', async () => {
    const w = await deliveryWorld(53, () => 0, false);
    w.waitForRing();
    expect(w.visitors).toEqual(['courier']);
  });

  it('queues a bark while the human is busy and cleans up an interrupted handoff without a false reward', async () => {
    const w = await deliveryWorld(42);
    w.waitForRing();
    Object.assign(w.moke, { ...HOME_ACTIVITIES.delivery.stand, x: -2.2 });
    w.ctx.human.available = false;
    w.delivery.noteBark(w.moke);
    w.director.update(DT, w.ctx);
    expect(w.delivery.state).toBe('AVAILABLE');
    w.tick(0.2);
    expect(w.delivery.running).toBe(true);
    w.ctx.heistRunning = true;
    w.tick(2);
    expect(w.delivery.running).toBe(false);
    expect(w.counts().rewards).toBe(0);
    expect(w.counts().cancels).toBeGreaterThan(0);
    w.delivery.resetAll();
    expect(w.delivery.ringing).toBe(false);
    expect(w.delivery.interactable.enabled).toBe(false);
  });

  it('after Moke answers the door, waits ten minutes before the next visit, even when the handoff is cut short', async () => {
    const w = await deliveryWorld(43);
    w.waitForRing();
    Object.assign(w.moke, { ...HOME_ACTIVITIES.delivery.stand, x: -2.2 });
    w.delivery.noteBark(w.moke);
    w.tick(0.5);
    expect(w.delivery.running).toBe(true);
    w.ctx.heistRunning = true; // a Sock Heist takes the human away before they reach the door
    w.tick(2);
    expect(w.delivery.running).toBe(false);
    expect(w.counts().rewards).toBe(0);
    w.ctx.heistRunning = false;
    const rings = w.counts().rings;
    w.tick(595);
    expect(w.counts().rings).toBe(rings);
    w.waitForRing(320);
  }, 60_000);

  it('can answer even when Moke occupies the preferred human approach point', async () => {
    const w = await deliveryWorld(44);
    w.waitForRing();
    Object.assign(w.moke, HOME_ACTIVITIES.delivery.stand);
    const body = new CharacterBody(w.physics, w.moke, MOKE_BODY);
    body.move({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    w.delivery.noteBark(w.moke);
    for (let i = 0; i < 10; i++) w.delivery.noteBark(w.moke);
    w.tick(50);
    expect(w.counts().exchanges).toBe(1);
    expect(w.counts().rewards).toBe(1);
  });

  it('rings every two seconds, leaves after thirty unanswered seconds, then visits again a few minutes later without rewards', async () => {
    const w = await deliveryWorld(45);
    w.waitForRing();
    w.tick(29.8);
    expect(w.delivery.ringing).toBe(true);
    expect(w.counts().rings).toBe(15);
    w.tick(0.25);
    expect(w.delivery.ringing).toBe(false);
    expect(w.delivery.objective).toBe(null);
    expect(w.delivery.interactable.enabled).toBe(false);
    expect(w.counts().rewards).toBe(0);
    expect(w.counts().exchanges).toBe(0);
    expect(w.routine.available).toBe(true);
    w.tick(119); // a few minutes before the courier tries again
    expect(w.counts().rings).toBe(15);
    w.waitForRing();
    expect(w.counts().rings).toBe(16);
    w.tick(30.1);
    expect(w.delivery.ringing).toBe(false);
    expect(w.counts().rewards).toBe(0);
  });

  it('still accepts Moke answering just before the longer ring deadline', async () => {
    const w = await deliveryWorld(49);
    w.waitForRing();
    w.tick(29.7);
    Object.assign(w.moke, { ...HOME_ACTIVITIES.delivery.stand, x: -2.2 });
    w.delivery.noteBark(w.moke);
    expect(w.delivery.ringing).toBe(false);
    w.tick(50);
    expect(w.counts().exchanges).toBe(1);
    expect(w.counts().rewards).toBe(1);
  });

  it('randomizes the initial visit and repeat delay, rather than relying on a fixed cooldown', async () => {
    const w = await deliveryWorld(46, () => 1);
    w.tick(44.8); expect(w.delivery.ringing).toBe(false);
    w.waitForRing(); // initial delay at the long end: 45 s
    w.tick(30.1); expect(w.delivery.ringing).toBe(false);
    w.tick(109); expect(w.delivery.ringing).toBe(false);
    w.waitForRing(); // repeat delay at the long end: 110 s
    expect(w.counts().rings).toBe(16);
  });

  it('pauses its ringing and guard timers and cannot restart the guard performance by spamming barks', async () => {
    const w = await deliveryWorld(47);
    w.waitForRing();
    const rings = w.counts().rings;
    for (let i = 0; i < 100; i++) w.director.update(0, w.ctx);
    expect(w.counts().rings).toBe(rings);
    Object.assign(w.moke, { ...HOME_ACTIVITIES.delivery.stand, x: -2.2 });
    w.delivery.noteBark(w.moke);
    w.tick(2.6);
    const heard = [...w.voices];
    for (let i = 0; i < 100; i++) { w.director.update(0, w.ctx); w.delivery.noteBark(w.moke); }
    expect(w.voices).toEqual(heard);
    w.tick(5.1);
    expect(w.voices).toEqual(['growl', 'bark', 'growl', 'bark', 'growl']);
    expect(w.delivery.guarding).toBe(false);
    expect(w.counts().rewards).toBe(0); // hasn't exchanged the package yet
  });

  it('randomizes successful repeat visits between ten and fifteen minutes, with pause not consuming the delay', async () => {
    const w = await deliveryWorld(48, () => 1);
    w.waitForRing();
    Object.assign(w.moke, { ...HOME_ACTIVITIES.delivery.stand, x: -2.2 });
    w.delivery.noteBark(w.moke);
    for (let i = 0; i < 60 / DT && w.counts().rewards === 0; i++) w.step(w.director);
    expect(w.counts().rewards).toBe(1);
    const rings = w.counts().rings;
    // Advance only the independent event clock: the handoff is finished and the human is free.
    w.director.update(2, w.ctx); w.director.update(DT, w.ctx); w.director.update(DT, w.ctx);
    for (let i = 0; i < 1000; i++) w.director.update(0, w.ctx);
    w.director.update(899, w.ctx);
    expect(w.delivery.ringing).toBe(false); expect(w.counts().rings).toBe(rings);
    w.director.update(1, w.ctx);
    expect(w.delivery.ringing).toBe(true); expect(w.counts().rings).toBe(rings + 1);
  });
});

describe('Kitchen begging (real island and household human)', () => {
  async function kitchenWorld() {
    const w = await world(50);
    const place = placeById('kitchen.islandPrep');
    w.human.controller.teleport(place.stand, place.facing);
    w.routine.activity = HUMAN_ACTIVITIES.find((a) => a.id === 'mealPrep')!;
    w.routine.place = place; w.routine.phase = 'doing'; w.routine.stepIndex = 0; w.routine.stepLeft = 55;
    Object.assign(w.moke, { x: 8.08, y: 0, z: 4.35 });
    let begs = 0, fed = 0;
    const treat = new Treat('kitchen-test', 3, 'carrot');
    const beg = new KitchenBeg({ routine: w.routine, hand: w.human.visual.hands.right,
      humanPosition: () => w.human.controller.position, treat, scene: home.object,
      openFloor: (x, z) => nav.isWalkable(x, z),
      clearPath: (from, to) => w.physics.lineOfSight({ x: from.x, y: 0.2, z: from.z }, { x: to.x, y: 0.2, z: to.z }),
      onBeg: () => begs++, onFed: () => fed++ });
    const director = new DogActivityDirector([beg]);
    const tick = (seconds: number) => { for (let i = 0; i < seconds / DT; i++) w.step(director); };
    return { ...w, beg, treat, director, tick, counts: () => ({ begs, fed }) };
  }

  it('requires waiting AND an explicit beg, takes a carrot from the board, feeds once, and can replay', async () => {
    const w = await kitchenWorld();
    expect(w.beg.requestBeg()).toBe(false);
    w.tick(3);
    expect(w.beg.canBeg).toBe(false);
    w.tick(2);
    expect(w.beg.canBeg).toBe(true);
    expect(w.counts().fed).toBe(0);
    for (let i = 0; i < 10; i++) w.beg.interactable.interact();
    w.tick(1.4);
    expect(w.treat.state).toBe('held');
    w.tick(2);
    expect(w.counts()).toEqual({ begs: 1, fed: 1 });
    w.treat.feed(); w.treat.eat();
    expect(w.counts().fed).toBe(1);
    expect(w.routine.available).toBe(true);
    expect(w.routine.activity?.id).toBe('mealPrep');
    // Still the same prep session, but cooldown plus another explicit action is required.
    w.routine.stepLeft = 55;
    w.tick(39);
    expect(w.beg.canBeg).toBe(true);
    w.beg.requestBeg(); w.tick(4);
    expect(w.counts()).toEqual({ begs: 2, fed: 2 });
  });

  it('clears waiting when Moke leaves, runs or carries something', async () => {
    const w = await kitchenWorld();
    w.tick(3);
    w.moke.z = 5.3; w.tick(0.1); w.moke.z = 4.35; w.tick(2);
    expect(w.beg.canBeg).toBe(false);
    w.ctx.moke.speed = 1; w.tick(2); w.ctx.moke.speed = 0;
    w.tick(3); expect(w.beg.canBeg).toBe(false);
    w.ctx.moke.carrying = 'toy'; w.tick(2); w.ctx.moke.carrying = null;
    w.tick(3); expect(w.beg.canBeg).toBe(false);
    w.tick(2); expect(w.beg.canBeg).toBe(true);
  });

  it('leaves a single reachable bite if Moke wanders off and cancels it for Sock Heist', async () => {
    const w = await kitchenWorld();
    w.tick(5); w.beg.requestBeg(); w.tick(1.5);
    Object.assign(w.moke, { x: 14, z: 3 });
    w.tick(12);
    expect(w.treat.state).toBe('placed');
    expect(nav.isWalkable(w.treat.position.x, w.treat.position.z)).toBe(true);
    expect(w.counts().fed).toBe(0);
    expect(w.routine.available).toBe(true);
    w.ctx.heistRunning = true; w.tick(0.1);
    expect(w.treat.state).toBe('stored');
    w.treat.eat(); expect(w.counts().fed).toBe(0);
  });

  it('does not soft-lock on an uneaten floor reward or a replay', async () => {
    const w = await kitchenWorld();
    w.tick(5); w.beg.requestBeg(); w.tick(1.5); w.moke.x = 14;
    w.tick(74);
    expect(w.treat.state).toBe('stored');
    expect(w.beg.running).toBe(false);
    w.beg.resetAll();
    expect(w.beg.state).toBe('AVAILABLE');
    expect(w.counts().fed).toBe(0);
  });

  it('cannot beg or receive food through the island, even with the Trick action', async () => {
    const w = await kitchenWorld();
    Object.assign(w.moke, { x: 9.15, z: 3.6 });
    w.tick(5);
    expect(w.beg.canBeg).toBe(false);
    expect(w.beg.requestBeg()).toBe(false);
    expect(w.counts()).toEqual({ begs: 0, fed: 0 });
  });
});

describe('Going for a ride: the offer (real house and household human)', () => {
  async function rideWorld(seed = 61) {
    const w = await world(seed);
    let harness: boolean[] = [], atDoor = 0;
    const offer = new RideOffer({ routine: w.routine, onHarness: (on) => harness.push(on), onAtDoor: () => atDoor++, random: () => 0.5 });
    const director = new DogActivityDirector([offer]);
    const tick = (seconds: number, each?: () => void) => {
      for (let i = 0; i < seconds / DT; i++) {
        w.step(director);
        each?.();
      }
    };
    return { ...w, offer, director, tick, harness: () => harness, atDoor: () => atDoor, reset: () => { harness = []; atDoor = 0; } };
  }

  it('every 5–10 minutes the human comes over and asks; Go for a Ride! is a yes: harness, the leash to the Garage door, the ride', async () => {
    const w = await rideWorld();
    Object.assign(w.moke, { x: 0.3, z: -0.8 });
    // Halfway through 5–10 minutes (random 0.5): nothing at 7 minutes 20, the offer by 7 minutes 40.
    w.tick(440);
    expect(w.offer.running).toBe(false);
    let t = 0;
    for (; t < 60 && !w.offer.asking; t += DT) w.step(w.director);
    expect(w.offer.asking).toBe(true);
    expect(w.said).toContain(RIDE.lines.ask);
    expect(w.offer.interactable.enabled).toBe(true);
    w.offer.interactable.interact();
    // He stays put; they kneel and put the harness on, then lead him to the door (he's at heel: here, carried along).
    for (let i = 0; i < 20 / DT && !w.offer.leading; i++) w.step(w.director);
    expect(w.harness()).toEqual([true]);
    expect(w.said).toContain(RIDE.lines.yes);
    const heel = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 40 / DT && w.atDoor() === 0; i++) {
      w.step(w.director);
      Object.assign(w.moke, w.offer.heel(heel));
    }
    expect(w.atDoor()).toBe(1);
    expect(w.offer.away).toBe(true);
    const h = w.human.controller.position;
    expect(Math.hypot(h.x - RIDE.doorStand.x, h.z - RIDE.doorStand.z)).toBeLessThan(0.5);
    // The ride is the game's; when it's over the human's free again, and the next offer is 5–10 minutes off.
    w.offer.home();
    w.tick(3);
    expect(w.routine.available).toBe(true);
    expect(w.offer.running).toBe(false);
    w.tick(250);
    expect(w.offer.running).toBe(false);
  }, 60_000);

  it('Go On A Drive commits once, holds the dog immediately and goes straight to harness/boarding without an answer', async () => {
    const w = await rideWorld(63);
    let requested = 0, boarded = 0;
    const harness: boolean[] = [];
    const offer = new RideOffer({ routine: w.routine, onHarness: (on) => harness.push(on), onAtDoor: () => boarded++, onGarageRequest: () => requested++, random: () => 0.5 });
    const director = new DogActivityDirector([offer]);
    const at = RIDE.askAt;
    Object.assign(w.moke, { x: at.x, z: at.z });
    w.step(director);
    expect(offer.garageRide.enabled).toBe(true);
    expect(offer.garageRide.label).toBe('Go On A Drive');
    expect(offer.garageRide.type).toBe('RIDE');
    offer.garageRide.interact();
    offer.garageRide.interact();
    expect(requested).toBe(1);
    expect(offer.requested).toBe(true);
    expect(offer.holdsDog).toBe(true);
    expect(offer.waitingForHuman).toBe(true);
    expect(offer.garageRide.enabled).toBe(false);
    let hurried = false, quietForHarness = false, barks = 0;
    const excitement = new RideExcitement();
    expect(offer.anticipatingRide).toBe(true);
    for (let i = 0; i < 40 / DT && boarded === 0; i++) {
      w.step(director);
      const bark = excitement.update(DT, offer.anticipatingRide);
      if (bark) barks++;
      // Already quiet while held for the harness, BEFORE its completion callback, not just once in the car.
      if (offer.running && offer.waitingForHuman && !offer.anticipatingRide && harness.length === 0) quietForHarness = true;
      if (quietForHarness) expect(bark).toBe(false);
      hurried ||= w.human.brain.intent.speed === RIDE.requestSpeed;
      expect(offer.asking).toBe(false);
      expect(offer.interactable.enabled).toBe(false);
    }
    expect(boarded).toBe(1);
    expect(hurried).toBe(true);
    expect(barks).toBeGreaterThan(0);
    expect(quietForHarness).toBe(true);
    expect(offer.anticipatingRide).toBe(false);
    for (let i = 0; i < 10 / DT; i++) expect(excitement.update(DT, offer.anticipatingRide)).toBe(false);
    expect(harness).toEqual([true]);
    expect(w.said).toContain(RIDE.lines.asked);
    expect(w.said).not.toContain(RIDE.lines.ask);
    offer.home();
    for (let i = 0; i < 3 / DT; i++) w.step(director);
    expect(offer.holdsDog).toBe(false);
    expect(offer.anticipatingRide).toBe(false);
    expect(offer.garageRide.enabled).toBe(true);
    // A plain bark there asks too; a bark anywhere else doesn't.
    offer.noteBark({ x: -2, y: 0, z: -2 });
    expect(offer.requested).toBe(false);
    offer.noteBark({ x: at.x + 0.3, y: 0, z: at.z });
    expect(offer.requested).toBe(true);
    offer.cancel();
    expect(offer.holdsDog).toBe(false);
  }, 60_000);

  it('releases pending requests on interruption or timeout, and refuses them while the human is busy', async () => {
    const w = await rideWorld(64);
    const { offer } = w;
    offer.request();
    expect(offer.holdsDog).toBe(true);
    offer.update(DT, { ...w.ctx, heistRunning: true });
    expect(offer.holdsDog).toBe(false);
    offer.request();
    expect(offer.holdsDog).toBe(true);
    // No director step to claim the human: this pending request must expire, not hold the dog forever.
    offer.update(RIDE.requestWait + DT, w.ctx);
    expect(offer.holdsDog).toBe(false);
    w.routine.claim({ id: 'busy-test', update: () => true, cancel() {} });
    expect(offer.garageRide.enabled).toBe(false);
    offer.request();
    expect(offer.requested).toBe(false);
  });

  it('a bark is a yes too; walking off (or ignoring them) is a no: "Okay, maybe later."', async () => {
    const w = await rideWorld(62);
    Object.assign(w.moke, { x: 0.3, z: -0.8 });
    w.offer.offerIn(0);
    for (let i = 0; i < 60 / DT && !w.offer.asking; i++) w.step(w.director);
    w.offer.noteBark(w.moke);
    w.tick(0.1);
    expect(w.offer.asking).toBe(false);
    expect(w.offer.running).toBe(true); // harness next
    w.offer.cancel();
    w.tick(3);
    w.reset();
    // Next time: he wanders off while they ask.
    w.offer.offerIn(0);
    for (let i = 0; i < 60 / DT && !w.offer.asking; i++) w.step(w.director);
    expect(w.offer.asking).toBe(true);
    Object.assign(w.moke, { x: -3, z: -2.6 });
    const h = w.human.controller.position;
    if (Math.hypot(h.x + 3, h.z + 2.6) < RIDE.walkAwayAt + 0.5) Object.assign(w.moke, { x: 6, z: 1.1 });
    w.tick(1);
    expect(w.said).toContain(RIDE.lines.no);
    expect(w.offer.running).toBe(false);
    expect(w.harness()).toEqual([]);
    // Ignored: no after 15 s.
    Object.assign(w.moke, { x: 0.3, z: -0.8 });
    w.offer.offerIn(0);
    for (let i = 0; i < 60 / DT && !w.offer.asking; i++) w.step(w.director);
    w.tick(RIDE.answerWithin + 0.5);
    expect(w.offer.running).toBe(false);
  }, 60_000);
});

describe("The obstacle course's reward (real house and household human)", () => {
  async function rewardWorld() {
    const w = await world(61);
    let fed = 0;
    const treat = new Treat('patty-test', 4, 'patty');
    const reward = new CourseReward({ routine: w.routine, hand: w.human.visual.hands.right, treat, scene: home.object,
      inside: (p) => roomAt(p.x, p.z).id !== 'backyard', openFloor: (x, z) => nav.isWalkable(x, z), onFed: () => fed++ });
    const director = new DogActivityDirector([reward]);
    const tick = (seconds: number, until?: () => boolean) => {
      for (let i = 0; i < seconds / DT && !until?.(); i++) w.step(director);
    };
    // Moke is out on the lawn, by the course.
    Object.assign(w.moke, { x: 24, y: 0, z: -0.6 });
    return { ...w, reward, treat, director, tick, fed: () => fed };
  }

  it('they go and wait by the open slider with a hamburger patty, and give it to him when he comes back in', async () => {
    const w = await rewardWorld();
    w.tick(1);
    expect(w.reward.state).toBe('AVAILABLE');
    w.reward.earn();
    w.tick(30, () => w.treat.state === 'held');
    expect(w.treat.state).toBe('held');
    const at = w.human.controller.position;
    expect(Math.hypot(at.x - COURSE_REWARD.waitAt.x, at.z - COURSE_REWARD.waitAt.z)).toBeLessThan(0.45);
    expect(w.said).toContain(COURSE_REWARD.lines.waiting);
    // Still outside: they wait, holding it out.
    w.tick(5);
    expect(w.fed()).toBe(0);
    expect(w.reward.objective).toMatch(/Head back inside/);
    // In he comes.
    Object.assign(w.moke, { x: at.x - 0.6, y: 0, z: at.z });
    w.tick(3);
    expect(w.fed()).toBe(1);
    expect(w.said).toContain(COURSE_REWARD.lines.give);
    expect(w.reward.pending).toBe(false);
    w.tick(10);
    expect(w.routine.available).toBe(true);
  }, 60_000);

  it("if he stays out, it goes down on the floor for him: never a soft-lock", async () => {
    const w = await rewardWorld();
    w.reward.earn();
    w.tick(30, () => w.treat.state === 'held');
    w.tick(COURSE_REWARD.waitTimeout + 1);
    expect(w.treat.state).toBe('placed');
    expect(w.routine.available).toBe(true);
    w.treat.eat();
    expect(w.fed()).toBe(1);
    expect(w.reward.pending).toBe(false);
  }, 60_000);

  it('the Sock Heist calls it off, and the patty waits for later', async () => {
    const w = await rewardWorld();
    w.reward.earn();
    w.tick(30, () => w.treat.state === 'held');
    w.ctx.heistRunning = true;
    w.tick(0.2);
    expect(w.treat.state).toBe('stored');
    expect(w.reward.pending).toBe(true);
    w.ctx.heistRunning = false;
    w.tick(COURSE_REWARD.cooldown + 4 + 30, () => w.treat.state === 'held');
    expect(w.treat.state).toBe('held');
  }, 60_000);
});

describe('Begging at dinner (real dining chair and household human)', () => {
  const T = HOME_ACTIVITIES.dinner;
  async function dinnerWorld(options: { withHunt?: boolean } = {}) {
    const w = await world(51);
    const place = placeById('dining.chair.1');
    w.human.controller.teleport(place.stand, place.facing);
    // Straight into dinner at that chair (the routine's own start: they sit down, then eat).
    const eat = HUMAN_ACTIVITIES.find((a) => a.id === 'eatMeal')!;
    (w.routine as unknown as { start(a: typeof eat, p: typeof place, phase: string): void }).start(eat, place, 'settling');
    Object.assign(w.moke, { x: 12, y: 0, z: -2 });
    let begs = 0, fed = 0;
    const treat = new Treat('dinner-test', 2, 'meatball');
    // Moke's beg is a trick, and it's still showing the moment he's fed.
    const beg = new DinnerBeg({ routine: w.routine, hands: w.human.visual.hands, treat, onBeg: () => { begs++; w.ctx.moke.trick = true; }, onFed: () => fed++ });
    const hunt = new TreatHunt({ routine: w.routine, hand: w.human.visual.hands.right, treat: new Treat('hunt-test'), scene: home.object,
      jar: home.kitchenTreats, spots: home.treatHidingSpots, nav, mokeCanSee: () => true, roomName: (at) => home.roomAt(at.x, at.z).name,
      onFound: () => {}, random: () => 0 });
    const director = new DogActivityDirector(options.withHunt ? [beg, hunt] : [beg]);
    const tick = (seconds: number, each?: () => void) => { for (let i = 0; i < seconds / DT; i++) { w.step(director); each?.(); } };
    tick(8);
    expect(w.human.controller.seated).toBe(true);
    expect(w.routine.effect).toBe('meal');
    w.routine.stepLeft = 90;
    // Beside the chair, on their left (in the gap toward the next chair).
    const seat = place.seat!;
    const beside = { x: seat.x, y: 0, z: seat.z + 0.5 };
    return { ...w, place, beg, hunt, treat, director, tick, beside, counts: () => ({ begs, fed }) };
  }

  it('sit beside them, beg: "no begging at the table", a sigh, then a meatball from the plate, all without getting up', async () => {
    const w = await dinnerWorld();
    Object.assign(w.moke, w.beside);
    expect(w.beg.requestBeg()).toBe(false);
    w.tick(1);
    expect(w.beg.canBeg).toBe(false); // sit a moment first
    w.tick(0.7);
    expect(w.beg.canBeg).toBe(true);
    expect(w.beg.objective).toMatch(/beg/i);
    for (let i = 0; i < 10; i++) w.beg.interactable.interact(); // no duplicates
    let stoodUp = false;
    const seated = () => { if (!w.human.controller.seated) stoodUp = true; };
    w.tick(0.2, seated);
    expect(w.said.at(-1)).toBe(T.lines.refuse);
    expect(w.counts().begs).toBe(1);
    w.tick(T.refuseTime + T.sighTime, seated);
    expect(w.said.at(-1)).toBe(T.lines.giveIn);
    expect(w.treat.state).toBe('stored');
    w.tick(T.takeTime + 0.1, seated);
    // In the hand on his side (their left), and he sits up for it again.
    expect(w.treat.state).toBe('held');
    expect(w.treat.view.parent).toBe(w.human.visual.hands.left);
    expect(w.counts().begs).toBe(2);
    w.tick(T.offerTime + 0.2, seated);
    expect(w.counts()).toEqual({ begs: 2, fed: 1 });
    expect(w.treat.state).toBe('eaten');
    expect(w.beg.state).toBe('SUCCESS');
    // Then straight back to dinner, never having left the chair.
    w.tick(1, seated);
    expect(stoodUp).toBe(false);
    expect(w.routine.available).toBe(true);
    expect(w.routine.activity?.id).toBe('eatMeal');
    expect(w.routine.effect).toBe('meal');
    // Once is enough for a while.
    expect(w.beg.canBeg).toBe(false);
    w.routine.stepLeft = 90;
    w.tick(T.cooldown + 3);
    expect(w.beg.canBeg).toBe(true);
  }, 20_000);

  it("doesn't set off a Treat Hunt: the beg he was asked for isn't a trick to show off", async () => {
    const w = await dinnerWorld({ withHunt: true });
    Object.assign(w.moke, w.beside);
    w.tick(T.wait + 0.1);
    expect(w.beg.requestBeg()).toBe(true);
    let stoodUp = false;
    w.tick(T.refuseTime + T.sighTime + T.takeTime + T.offerTime + 0.5, () => { if (!w.human.controller.seated) stoodUp = true; });
    expect(w.counts().fed).toBe(1);
    w.tick(2, () => { if (!w.human.controller.seated) stoodUp = true; });
    expect(w.hunt.state).toBe('AVAILABLE');
    expect(stoodUp).toBe(false);
    expect(w.routine.activity?.id).toBe('eatMeal');
    // A trick he does to show off, with them free to watch, still starts one.
    w.ctx.moke.trick = false;
    w.tick(0.1);
    w.ctx.moke.trick = true;
    w.tick(0.1);
    expect(w.hunt.running).toBe(true);
  }, 20_000);

  it("only works on the floor beside their chair, while they're eating", async () => {
    const w = await dinnerWorld();
    const seat = w.place.seat!;
    // Behind the chair (where they stood to sit down), on the table, or just passing through: no.
    for (const at of [{ x: w.place.stand.x, y: 0, z: w.place.stand.z }, { x: 8.85, y: 0.77, z: seat.z }]) {
      Object.assign(w.moke, at);
      w.tick(3);
      expect(w.beg.canBeg, JSON.stringify(at)).toBe(false);
    }
    Object.assign(w.moke, w.beside);
    w.ctx.moke.speed = 1;
    w.tick(3);
    expect(w.beg.canBeg).toBe(false);
    w.ctx.moke.speed = 0;
    // Under the table by their knees, or on their right: yes.
    for (const at of [{ x: seat.x - 0.55, y: 0, z: seat.z }, { x: seat.x, y: 0, z: seat.z - 0.5 }]) {
      Object.assign(w.moke, at);
      w.tick(0.1);
      w.tick(T.wait + 0.1);
      expect(w.beg.canBeg, JSON.stringify(at)).toBe(true);
    }
    // Not when dinner's over.
    w.routine.stepLeft = 0;
    w.tick(2);
    expect(w.routine.effect).not.toBe('meal');
    expect(w.beg.canBeg).toBe(false);
  }, 20_000);

  it('wanders off before taking it: "more for me", the meatball goes back, and dinner carries on', async () => {
    const w = await dinnerWorld();
    Object.assign(w.moke, w.beside);
    w.tick(T.wait + 0.1);
    w.beg.requestBeg();
    w.tick(T.refuseTime + T.sighTime + T.takeTime + 0.3);
    expect(w.treat.state).toBe('held');
    Object.assign(w.moke, { x: 12, y: 0, z: -2 });
    w.tick(T.offerTimeout);
    expect(w.said.at(-1)).toBe(T.lines.keep);
    expect(w.treat.state).toBe('stored');
    expect(w.counts().fed).toBe(0);
    expect(w.beg.running).toBe(false);
    w.tick(1);
    expect(w.human.controller.seated).toBe(true);
    expect(w.routine.activity?.id).toBe('eatMeal');
  }, 20_000);

  it('the Sock Heist calls it off, with no meatball left anywhere', async () => {
    const w = await dinnerWorld();
    Object.assign(w.moke, w.beside);
    w.tick(T.wait + 0.1);
    w.beg.requestBeg();
    w.tick(T.refuseTime + T.sighTime + T.takeTime + 0.3);
    expect(w.treat.state).toBe('held');
    w.ctx.heistRunning = true;
    w.tick(0.1);
    expect(w.beg.running).toBe(false);
    expect(w.treat.state).toBe('stored');
    w.treat.feed();
    expect(w.counts().fed).toBe(0);
  }, 20_000);
});

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

  it('lets something urgent (the door) call off a game with the human, but never a chore, and nothing else cuts in', () => {
    const game = new GameProbe(3, 0.5), chore = new HumanProbe(3, 0.5), urgent = new UrgentProbe(3, 0.5), other = new HumanProbe(3, 0.5);
    const ctx = context();
    const director = new DogActivityDirector([game, other, urgent]);
    game.trigger = true;
    director.update(DT, ctx);
    expect(game.running).toBe(true);
    (ctx.human as { available: boolean }).available = false; // the game has them
    other.trigger = true;
    director.update(DT, ctx);
    expect(other.state).toBe('AVAILABLE');
    urgent.trigger = true;
    director.update(DT, ctx);
    expect(urgent.running).toBe(true);
    expect(game.state).toBe('CANCELLED');
    expect(other.state).toBe('AVAILABLE');
    // A chore isn't put down.
    const ctx2 = context();
    const urgent2 = new UrgentProbe(3, 0.5);
    const director2 = new DogActivityDirector([chore, urgent2]);
    chore.trigger = true;
    director2.update(DT, ctx2);
    (ctx2.human as { available: boolean }).available = false;
    urgent2.trigger = true;
    director2.update(DT, ctx2);
    expect(chore.running).toBe(true);
    expect(urgent2.state).toBe('AVAILABLE');
  });

  it("lets something urgent start beside an activity that isn't using the human just now, but nothing else", () => {
    const search = new SearchProbe(3, 0.5), urgent = new UrgentProbe(3, 0.5), other = new HumanProbe(3, 0.5);
    const ctx = context();
    const director = new DogActivityDirector([search, other, urgent]);
    search.trigger = true;
    director.update(DT, ctx);
    expect(search.running).toBe(true);
    other.trigger = urgent.trigger = true;
    director.update(DT, ctx);
    expect(other.state).toBe('AVAILABLE');
    expect(urgent.running).toBe(true);
    expect(search.running).toBe(true);
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
    ctx.moke.napSpot = 'pinkBed';
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

describe('MakeHumanPlay (in the house, with the real human and real toys)', () => {
  async function setup(seed = 8, propId: 'ball' | 'toy' = 'ball') {
    const w = await world(seed);
    const def = PROPS[propId];
    const ball = new Prop(def, new PropBody(w.physics, def.physics, { x: -0.5, y: def.restHeight, z: -0.3 }, 0), createPropView(propId), { x: -0.5, y: 0, z: -0.3 }, 0, home.bounds);
    const throws: boolean[] = [];
    const tugChanges: boolean[] = [];
    const tugWins: boolean[] = [];
    let tugGrowls = 0;
    const play = new MakeHumanPlay({
      routine: w.routine,
      reactions: w.reactions,
      toys: [ball],
      hand: w.human.visual.hands.right,
      scene: w.human.visual.object,
      clearDistance: (from, direction, max) => w.physics.sweepWorldSphere(from, direction, 0.08, max),
      openFloor: (x, z) => nav.isWalkable(x, z),
      onThrow: (_toy, first) => throws.push(first),
      onTugChange: (active) => tugChanges.push(active),
      onTugGrowl: () => tugGrowls++,
      onTugWin: (_toy, first) => tugWins.push(first),
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
      w.ctx.moke.carrying = propId;
    };
    /** He lets go of it at (x, z). */
    const drop = (x: number, z: number) => {
      ball.drop({ x, y: 0.1, z }, 0, { x: 0, y: 0, z: 0 });
      w.ctx.moke.carrying = null;
    };
    return { ...w, ball, play, director, tick, grab, drop, throws, tugChanges, tugWins, tugGrowls: () => tugGrowls };
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

  it('turns the rope into replayable tug-of-war, growls while pulling, and always lets Moke win with the rope still in his mouth', async () => {
    const { ctx, tick, play, grab, drop, tugChanges, tugWins, tugGrowls, said } = await setup(10, 'toy');
    grab();
    ctx.moke.position.x = -1;
    ctx.moke.position.z = -0.9;
    tick();
    expect(play.state).toBe('STARTING');
    for (let i = 0; i < 20 / DT && play.running; i++) tick();
    expect(play.outcome).toBe('tugWin');
    expect(play.successes).toBe(1);
    expect(play.throws).toBe(0);
    expect(ctx.moke.carrying).toBe('toy');
    expect(tugChanges).toEqual([true, false]);
    expect(tugGrowls()).toBeGreaterThanOrEqual(3);
    expect(tugWins).toEqual([true]);
    expect(said.some((line) => /you win|too strong|strongest dog/i.test(line))).toBe(true);

    // Standing beside the human with the rope must not immediately loop into another game.
    for (let i = 0; i < 6 / DT; i++) tick();
    expect(play.successes).toBe(1);
    expect(play.state).toBe('AVAILABLE');

    // Dropping and presenting the rope again re-arms it, with the short rope-specific cooldown already elapsed.
    drop(ctx.moke.position.x, ctx.moke.position.z);
    tick();
    grab();
    tick();
    expect(play.running).toBe(true);
    for (let i = 0; i < 20 / DT && play.running; i++) tick();
    expect(play.successes).toBe(2);
    expect(ctx.moke.carrying).toBe('toy');
    expect(tugChanges).toEqual([true, false, true, false]);
    expect(tugWins).toEqual([true, false]);
  }, 60_000);
});
