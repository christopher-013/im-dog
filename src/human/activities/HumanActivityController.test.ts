import { describe, expect, it } from 'vitest';
import { HUMAN_ACTIVITIES, type HumanActivityId } from '../../config/activities';
import { HUMAN } from '../../config/human';
import { GameEvents } from '../../core/GameEvents';
import { CharacterBody, type Vec3Like } from '../../physics/CharacterBody';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { mulberry32 } from '../../utils/random';
import { Home } from '../../world/Home';
import { roomAt } from '../../world/home/layout';
import { StylizedHumanVisual } from '../StylizedHumanVisual';
import { Human } from '../Human';
import { HumanBrain } from '../HumanBrain';
import { HumanController } from '../HumanController';
import { NavGrid } from '../NavGrid';
import { ActivityScheduler } from './ActivityScheduler';
import { HumanActivityController } from './HumanActivityController';

// The routine in the real house with the real bodies: the human walks between rooms, sits and stands, does a range
// of things, and never gets lost or stuck for long.
const DT = 1 / 60;
const home = new Home();
const nav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.1, agentRadius: HUMAN.body.radius, minY: 0.08, maxY: 1.7 });

async function setup(seed = 1, moke: Vec3Like = { x: 5.2, y: 0, z: 1.1 }) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(home.colliders);
  physics.commitStaticGeometry();
  const events = new GameEvents();
  const said: string[] = [];
  events.on('HUMAN_SAID', (s) => said.push(s.text));
  const routine = new HumanActivityController(home.places, events, mulberry32(seed));
  const { laundry, laundryBasket } = home.landmarks;
  const places = { home: laundry, basket: laundryBasket, treatStand: home.landmarks.treatStand, treatJar: home.landmarks.treatJar };
  const hands = { takeTreat() {}, pickUpSock: () => false, putSockAway() {}, placeTreat() {} };
  const brain = new HumanBrain(places, hands, events, mulberry32(seed + 1));
  brain.driver = routine;
  routine.reset();
  const body = new CharacterBody(physics, laundry, HUMAN.body);
  const human = new Human(brain, new HumanController(body, nav, Math.atan2(laundryBasket.x - laundry.x, laundryBasket.z - laundry.z)), new StylizedHumanVisual());
  const world = { moke, mokeCarryingSock: false, mokeSpeed: 0, mokeUnderFurniture: false, mokeBarked: false, looseSock: null, clear: () => true };
  const step = () => {
    human.fixedUpdate(DT, world);
    physics.step();
  };
  return { human, routine, brain, world, said, step };
}

describe('HumanActivityController (the daily routine)', () => {
  it('starts at the laundry, folding (where the Sock Heist expects them)', async () => {
    const { routine, human, step } = await setup();
    for (let i = 0; i < 60; i++) step();
    expect(routine.activity?.id).toBe('foldLaundry');
    expect(routine.phase).toBe('doing');
    expect(human.brain.intent.pose).toBe('fold');
  });

  it('lives a believable twenty minutes: many activities, several rooms, sitting and standing, never stuck', async () => {
    const { routine, human, step } = await setup(7);
    const done = new Set<HumanActivityId>();
    const rooms = new Set<string>();
    let seatedSeconds = 0;
    let worstStuck = 0;
    let switches = 0;
    let last: string | null = null;
    for (let i = 0; i < (20 * 60) / DT; i++) {
      step();
      const p = human.controller.position;
      expect(p.x).toBeGreaterThan(home.bounds.minX);
      expect(p.x).toBeLessThan(home.bounds.maxX);
      expect(p.z).toBeGreaterThan(home.bounds.minZ);
      expect(p.z).toBeLessThan(home.bounds.maxZ);
      if (routine.activity) done.add(routine.activity.id);
      if (routine.activity?.id !== last && routine.activity) {
        switches++;
        last = routine.activity.id;
      }
      rooms.add(roomAt(p.x, p.z).id);
      if (human.controller.seated) seatedSeconds += DT;
      worstStuck = Math.max(worstStuck, human.controller.stuckFor);
    }
    expect(done.size).toBeGreaterThanOrEqual(6);
    expect(rooms.size).toBeGreaterThanOrEqual(4);
    expect(seatedSeconds).toBeGreaterThan(120);
    expect(worstStuck).toBeLessThan(5);
    expect(routine.stats.gaveUp).toBe(0);
    // Believable pacing: activities last, rather than flitting (≈ a minute each, not seconds).
    expect(switches).toBeLessThan(30);
    expect(routine.stats.finished).toBeGreaterThan(8);
  }, 60_000);

  it('cooks, then usually eats', async () => {
    const scheduler = new ActivityScheduler(home.places, HUMAN_ACTIVITIES, mulberry32(3));
    let eatAfter = 0;
    for (let k = 0; k < 50; k++) {
      const choice = scheduler.choose({ position: { x: 7.7, y: 0, z: 3.5 }, room: 'kitchen', now: 1000, last: 'prepareDinner', isFree: () => true });
      if (choice?.activity.id === 'eatMeal') eatAfter++;
    }
    expect(eatAfter).toBeGreaterThan(35);
  });

  it('respects cooldowns and prefers the room they are in', () => {
    const scheduler = new ActivityScheduler(home.places, HUMAN_ACTIVITIES, mulberry32(9));
    const counts = new Map<string, number>();
    for (let k = 0; k < 400; k++) {
      const choice = scheduler.choose({ position: { x: 14, y: 0, z: 2.5 }, room: 'familyRoom', now: 0, last: null, isFree: () => true })!;
      counts.set(choice.place.room, (counts.get(choice.place.room) ?? 0) + 1);
    }
    expect(counts.get('familyRoom')!).toBeGreaterThan(counts.get('diningRoom') ?? 0);
    scheduler.markDone('watchTV', 0);
    for (let k = 0; k < 100; k++) {
      expect(scheduler.choose({ position: { x: 14, y: 0, z: 2.5 }, room: 'familyRoom', now: 10, last: null, isFree: () => true })!.activity.id).not.toBe('watchTV');
    }
  });

  it('picks up where it left off after an interruption (the Sock Heist)', async () => {
    const { routine, human, step } = await setup(11);
    // Run until they're settled into something away from the laundry.
    for (let i = 0; i < (6 * 60) / DT && !(routine.phase === 'doing' && routine.activity?.id !== 'foldLaundry'); i++) step();
    expect(routine.phase).toBe('doing');
    const activity = routine.activity!.id;
    routine.interrupt();
    expect(routine.driving).toBe(false);
    routine.resume({ ...human['senses'], position: human.controller.position });
    expect(routine.activity?.id).toBe(activity);
    expect(routine.stats.resumed).toBe(1);
  }, 30_000);

  it('finds another seat when Moke is lying in theirs', async () => {
    // Moke on the sectional's middle seat.
    const { routine, step } = await setup(5, { x: 13.75, y: 0.45, z: 0.98 });
    for (let i = 0; i < (15 * 60) / DT; i++) {
      step();
      if (routine.phase === 'doing' && routine.place?.id === 'family.sectional.middle') throw new Error('sat on Moke');
    }
  }, 40_000);
});
