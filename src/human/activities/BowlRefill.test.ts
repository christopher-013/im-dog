import { describe, expect, it } from 'vitest';
import { HUMAN } from '../../config/human';
import { GameEvents } from '../../core/GameEvents';
import { CharacterBody } from '../../physics/CharacterBody';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { mulberry32 } from '../../utils/random';
import { DogBowls, type BowlKind } from '../../world/DogBowls';
import { Home } from '../../world/Home';
import { BOWLS, placeById } from '../../world/home/places';
import { StylizedHumanVisual } from '../StylizedHumanVisual';
import { Human } from '../Human';
import { HumanBrain } from '../HumanBrain';
import { HumanController } from '../HumanController';
import { NavGrid } from '../NavGrid';
import { BowlRefill } from './BowlRefill';
import { HumanActivityController } from './HumanActivityController';

const DT = 1 / 60;
const home = new Home();
const nav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.1, agentRadius: HUMAN.body.radius, minY: 0.08, maxY: 1.7 });

/** The human in the whole house with the real body, their routine running, and Moke's bowls. */
async function setup(seed = 3) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(home.colliders);
  physics.commitStaticGeometry();
  const events = new GameEvents();
  const said: string[] = [];
  events.on('HUMAN_SAID', (s) => said.push(s.text));
  const routine = new HumanActivityController(home.places, events, mulberry32(seed));
  const { laundry, laundryBasket } = home.landmarks;
  const places = { home: laundry, basket: laundryBasket, treatStand: home.landmarks.treatStand, treatJar: home.landmarks.treatJar };
  const brain = new HumanBrain(places, { takeTreat() {}, pickUpSock: () => false, putSockAway() {}, placeTreat() {} }, events, mulberry32(seed + 1));
  brain.driver = routine;
  routine.reset();
  const human = new Human(brain, new HumanController(new CharacterBody(physics, laundry, HUMAN.body), nav, 0), new StylizedHumanVisual());
  const world = { moke: { x: 12.4, y: 0, z: 4.6 }, mokeCarryingSock: false, mokeSpeed: 0, mokeUnderFurniture: false, mokeBarked: false, looseSock: null, clear: () => true };
  const bowls = new DogBowls(BOWLS);
  const counter = placeById(BOWLS.sources.food);
  const sink = placeById(BOWLS.sources.water);
  const poured: BowlKind[] = [];
  const refill = new BowlRefill({
    routine,
    bowls,
    stand: BOWLS.stand,
    sources: { food: { stand: counter.stand, facing: counter.facing }, water: { stand: sink.stand, facing: sink.facing } },
    onPour: (kind) => poured.push(kind),
    random: mulberry32(seed + 2),
  });
  bowls.onEmptied = (kind) => refill.request(kind);
  const step = () => {
    refill.update(DT);
    bowls.update(DT);
    human.fixedUpdate(DT, world);
    physics.step();
  };
  return { human, routine, bowls, refill, poured, said, step };
}

describe('BowlRefill (the human tops up his bowls)', () => {
  it('comes to refill an emptied bowl: kibble from the counter, then kneels at the bowls and pours', async () => {
    const { human, routine, bowls, refill, poured, said, step } = await setup();
    for (let i = 0; i < 5 / DT; i++) step();
    bowls.finish('food', 3);
    let fetched = false;
    let carried = false;
    let knelt = false;
    let t = 0;
    // Until it's been poured (the bowl drains for 3 s first, then they come).
    for (; t < 90 && poured.length === 0; t += DT) {
      step();
      if (refill.step === 'fetch') fetched = true;
      if (refill.step === 'toBowls' && human.brain.intent.prop === 'scoop') carried = true;
      if (refill.step === 'pour' && human.brain.intent.crouch === 1) knelt = true;
    }
    expect(bowls.level('food')).toBe(1);
    expect(fetched && carried && knelt).toBe(true);
    expect(poured).toEqual(['food']);
    expect(said.length).toBeGreaterThan(0);
    // Close to the bowls when it filled up, and then back to their own day.
    const p = human.controller.position;
    expect(Math.hypot(p.x - BOWLS.stand.x, p.z - BOWLS.stand.z)).toBeLessThan(0.5);
    for (let i = 0; i < 3 / DT; i++) step();
    expect(refill.busy).toBe(false);
    expect(routine.role).toBeNull();
    expect(routine.stats.gaveUp).toBe(0);
  }, 60_000);

  it('fills both when both are empty, one trip after the other', async () => {
    const { bowls, poured, step } = await setup(5);
    for (let i = 0; i < 3 / DT; i++) step();
    bowls.finish('water', 1);
    bowls.finish('food', 1);
    for (let t = 0; t < 150 && poured.length < 2; t += DT) step();
    expect(bowls.level('food')).toBe(1);
    expect(bowls.level('water')).toBe(1);
    expect([...poured].sort()).toEqual(['food', 'water']);
  }, 60_000);

  it('taken off the errand (the Sock Heist), comes back to it later', async () => {
    const { routine, bowls, refill, step } = await setup(7);
    for (let i = 0; i < 3 / DT; i++) step();
    bowls.finish('water', 1);
    for (let t = 0; t < 20 && refill.step !== 'toBowls'; t += DT) step();
    expect(refill.busy).toBe(true);
    routine.interrupt();
    expect(refill.busy).toBe(false);
    expect(refill.pending).toEqual(['water']);
    routine.resume({ position: { x: 0, y: 0, z: 0 }, heading: 0, arrived: true, seated: false, stuck: 0, moke: { x: 0, y: 0, z: 0 }, mokeCarryingSock: false, mokeSpeed: 0, mokeUnderFurniture: false, mokeBarked: false, looseSock: null, clear: () => true });
    for (let t = 0; t < 90 && bowls.level('water') < 1; t += DT) step();
    expect(bowls.level('water')).toBe(1);
    // Filled mid-pour; once they've finished and stood up, nothing's left waiting.
    for (let i = 0; i < 3 / DT; i++) step();
    expect(refill.pending).toEqual([]);
    expect(refill.busy).toBe(false);
  }, 60_000);
});
