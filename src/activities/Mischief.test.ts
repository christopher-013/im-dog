import { Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { HUMAN } from '../config/human';
import { MISCHIEF, MISCHIEF_TABLES, PILLOW_SOFAS } from '../config/mischief';
import { GameEvents } from '../core/GameEvents';
import { HumanActivityController } from '../human/activities/HumanActivityController';
import { Human } from '../human/Human';
import { HumanBrain } from '../human/HumanBrain';
import { HumanController } from '../human/HumanController';
import { NavGrid } from '../human/NavGrid';
import { StylizedHumanVisual } from '../human/StylizedHumanVisual';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MokeAnimationController } from '../player/MokeAnimationController';
import { ToonMokeVisual } from '../player/ToonMokeVisual';
import { mulberry32 } from '../utils/random';
import { CouchPillows } from '../world/CouchPillows';
import { Home } from '../world/Home';
import type { DogActivityContext } from './DogActivity';
import { DogActivityDirector } from './DogActivityDirector';
import { PillowDig } from './PillowDig';
import { TableManners } from './TableManners';

const DT = 1 / 60;
async function setup() {
  const home = new Home();
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(home.colliders); physics.commitStaticGeometry();
  const nav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.1, agentRadius: HUMAN.body.radius, minY: 0.08, maxY: 1.7 });
  const events = new GameEvents(); const said: string[] = [];
  events.on('HUMAN_SAID', (s) => said.push(s.text));
  const routine = new HumanActivityController(home.places, events, mulberry32(76)); routine.reset();
  const { laundry, laundryBasket, treatStand, treatJar } = home.landmarks;
  const brain = new HumanBrain({ home: laundry, basket: laundryBasket, treatStand, treatJar },
    { takeTreat() {}, pickUpSock: () => false, putSockAway() {}, placeTreat() {} }, events);
  brain.driver = routine;
  const human = new Human(brain, new HumanController(new CharacterBody(physics, laundry, HUMAN.body), nav, 0), new StylizedHumanVisual());
  const moke = { x: 0.3, y: 0.45, z: -2.1 };
  let grounded = true, digging = false, fun = 0;
  const pillows = new CouchPillows(home.object);
  const dig = new PillowDig({ routine, pillows, nav, hand: human.visual.hands.right,
    grounded: () => grounded, onDigging: (on) => { digging = on; }, onFun: () => fun++ });
  const table = new TableManners({ routine, nav, grounded: () => grounded, random: () => 0.5 });
  const ctx: DogActivityContext = { moke: { position: moke, speed: 0, carrying: null, barked: false, trick: false, sniffing: false, napSpot: null },
    human: { position: human.controller.position, available: true, seesMoke: true, engaged: false }, heistRunning: false };
  const director = new DogActivityDirector([dig, table]);
  const step = () => {
    human.fixedUpdate(DT, { moke, mokeCarryingSock: false, mokeSpeed: 0, mokeUnderFurniture: false, mokeBarked: false, looseSock: null, clear: () => true });
    (ctx.human as { available: boolean }).available = routine.available;
    director.update(DT, ctx); pillows.update(DT); physics.step(); human.update(DT, 1);
  };
  const tick = (seconds: number) => { for (let i = 0; i < seconds / DT; i++) step(); };
  const snapshot = () => {
    const list: { object: Object3D; position: Vector3 }[] = [];
    home.object.traverse((o) => { if (o.userData.loosePillow) list.push({ object: o, position: o.position.clone() }); });
    return list;
  };
  return { home, physics, nav, human, routine, ctx, moke, dig, table, pillows, director, said, tick, step, snapshot,
    airborne: (on: boolean) => { grounded = !on; }, counts: () => ({ digging, fun }) };
}

describe('Pillow mischief and table manners (the whole house and the human)', () => {
  it('offers digging only on the couch, throws its real pillows, cleans them up and allows another explicit dig', async () => {
    const w = await setup(); const original = w.snapshot();
    w.tick(0.1); expect(w.dig.interactable.enabled).toBe(true);
    for (let i = 0; i < 10; i++) w.dig.interactable.interact();
    w.tick(1); expect(w.counts()).toEqual({ digging: true, fun: 0 });
    w.tick(2.4); expect(w.counts()).toEqual({ digging: false, fun: 1 });
    expect(w.said).toContain("Moke don't mess up the pillows!");
    expect(original.some((p) => p.object.position.distanceTo(p.position) > 0.5)).toBe(true);
    w.tick(90);
    expect(w.dig.successes).toBe(1); expect(w.routine.available).toBe(true);
    for (const p of original) expect(p.object.position.distanceTo(p.position)).toBeLessThan(1e-6);
    w.dig.interactable.interact(); w.tick(95);
    expect(w.dig.successes).toBe(2); expect(w.counts().fun).toBe(2);
    Object.assign(w.moke, { y: 0 }); w.tick(0.1); expect(w.dig.interactable.enabled).toBe(false);
    w.physics.world.free(); w.human.visual.dispose();
  }, 60_000);

  it('cleans up interruption/reset, freezes on pause, and never tosses pillows when merely flying past a couch', async () => {
    const w = await setup(); const original = w.snapshot();
    w.airborne(true); w.tick(0.1); expect(w.dig.interactable.enabled).toBe(false);
    w.airborne(false); w.tick(0.1); w.dig.interactable.interact(); w.tick(1);
    for (let i = 0; i < 100; i++) w.director.update(0, w.ctx);
    expect(w.counts().fun).toBe(0);
    w.airborne(true); w.tick(0.1); expect(w.counts().digging).toBe(false); expect(w.counts().fun).toBe(0);
    w.airborne(false); w.dig.resetAll(); w.tick(0.1); w.dig.interactable.interact(); w.tick(3.4);
    (w.ctx as { heistRunning: boolean }).heistRunning = true; w.tick(0.1);
    expect(w.dig.running).toBe(false); expect(w.counts().digging).toBe(false);
    for (const p of original) expect(p.object.position.distanceTo(p.position)).toBeLessThan(1e-6);
    w.dig.resetAll(); w.pillows.reset(); expect(w.dig.state).toBe('AVAILABLE');
    w.physics.world.free(); w.human.visual.dispose();
  });

  it('ignores floor/airborne Moke, repeats varied 4–5-second scolds while standing on hips, then stops when he leaves', async () => {
    const w = await setup(); Object.assign(w.moke, { x: 0.3, y: 0, z: -1.15 });
    w.tick(3); expect(w.table.running).toBe(false);
    w.moke.y = 0.45; w.airborne(true); w.tick(2); expect(w.table.running).toBe(false);
    w.airborne(false); w.tick(20);
    expect(w.table.running).toBe(true); expect(w.human.brain.intent.pose).toBe('handsOnHips');
    const reminders = () => w.said.filter((s) => MISCHIEF.tableReminders.includes(s as typeof MISCHIEF.tableReminders[number]));
    expect(reminders()[0]).toBe('Moke, get down!');
    expect(reminders().length).toBeGreaterThan(1);
    expect(new Set(reminders()).size).toBeGreaterThan(1);
    const times: number[] = [];
    let heard = reminders().length;
    for (let i = 0; i < 60 / DT; i++) {
      w.step();
      if (reminders().length > heard) { times.push(w.routine.now); heard = reminders().length; }
    }
    expect(times.length).toBeGreaterThan(10);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(4 - DT);
      expect(times[i]! - times[i - 1]!).toBeLessThanOrEqual(5 + DT);
    }
    expect(w.human.brain.intent.pose).toBe('handsOnHips'); expect(w.table.successes).toBe(0);
    w.airborne(true); w.moke.y = 0.5; w.tick(0.2); expect(w.table.running).toBe(true); // hopping in place isn't getting down
    Object.assign(w.moke, { x: -0.8, y: 0, z: -0.6 }); w.airborne(false); w.tick(5);
    expect(w.table.successes).toBe(1); expect(w.routine.available).toBe(true);
    const stopped = reminders().length;
    w.tick(6); expect(reminders()).toHaveLength(stopped);
    Object.assign(w.moke, { x: 0.3, y: 0.45, z: -1.15 }); w.tick(20);
    expect(w.human.brain.intent.pose).toBe('handsOnHips');
    expect(reminders()[stopped]).toBe('Moke, get down!');
    (w.ctx as { heistRunning: boolean }).heistRunning = true; w.tick(0.1);
    expect(w.table.running).toBe(false); w.table.resetAll(); expect(w.table.state).toBe('AVAILABLE');
    w.physics.world.free(); w.human.visual.dispose();
  });

  it('keeps floor landing spots and every reachable table approach navigable', async () => {
    const w = await setup();
    for (const sofa of PILLOW_SOFAS) {
      expect(w.pillows.count(sofa)).toBe(3);
      for (const p of sofa.floors) expect(w.nav.nearestWalkable(p.x, p.z, 0.65)).not.toBeNull();
    }
    for (const t of MISCHIEF_TABLES.slice(0, 2)) {
      Object.assign(w.moke, { x: t.x, y: t.height, z: t.z });
      w.table.resetAll(); w.tick(40);
      expect(w.table.state, t.id).toBe('ACTIVE'); expect(w.human.brain.intent.pose).toBe('handsOnHips');
      Object.assign(w.moke, { x: 0, y: 0, z: 0 }); w.tick(5);
    }
    w.physics.world.free(); w.human.visual.dispose();
  });

  it('animates alternating front paws without idle sitting and releases the pose afterwards', () => {
    const animation = new MokeAnimationController(); const visual = new ToonMokeVisual();
    animation.dig(true);
    for (let i = 0; i < 60; i++) animation.update(DT, { speed: 0, turnRate: 0, headroom: Infinity });
    const pose = animation.state; expect(pose.dig).toBeGreaterThan(0.95); expect(pose.sit).toBeLessThan(0.01);
    visual.update(DT, { ...pose, time: Math.PI / (2 * MISCHIEF.digAnimation.rate) });
    const left = visual.object.getObjectByName('hip_front_L')!, right = visual.object.getObjectByName('hip_front_R')!;
    expect(Math.abs(left.rotation.x - right.rotation.x)).toBeGreaterThan(0.8);
    animation.dig(false);
    for (let i = 0; i < 60; i++) animation.update(DT, { speed: 0, turnRate: 0, headroom: Infinity });
    expect(animation.state.dig).toBeLessThan(0.01); expect(animation.digging).toBe(false);
    visual.dispose();
  });

  it('cleans up pillows on both family-room sofas, including a cancelled hand-held pillow', async () => {
    const w = await setup(); const original = w.snapshot();
    for (const [index, at] of [{ x: 14.3, y: 0.45, z: 1.1 }, { x: 16.3, y: 0.45, z: 2.9 }, { x: 12.7, y: 0.45, z: 1.95 }].entries()) {
      Object.assign(w.moke, at); w.dig.resetAll(); w.tick(0.1);
      expect(w.dig.interactable.enabled).toBe(true);
      w.dig.interactable.interact(); w.tick(100);
      expect(w.dig.successes).toBe(index + 1);
      for (const p of original) expect(p.object.position.distanceTo(p.position)).toBeLessThan(1e-6);
    }
    const sofa = PILLOW_SOFAS[2]!;
    w.pillows.toss(sofa); w.pillows.update(MISCHIEF.tossTime);
    w.pillows.pickUp(sofa, 0, w.human.visual.hands.right);
    expect(w.human.visual.hands.right.children.some((o) => o.userData.loosePillow)).toBe(true);
    w.pillows.reset();
    expect(w.human.visual.hands.right.children.some((o) => o.userData.loosePillow)).toBe(false);
    for (const p of original) expect(p.object.position.distanceTo(p.position)).toBeLessThan(1e-6);
    w.physics.world.free(); w.human.visual.dispose();
  }, 60_000);
});
