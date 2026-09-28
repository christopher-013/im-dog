import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { HUMAN } from '../config/human';
import { GameEvents } from '../core/GameEvents';
import { HumanActivityController } from '../human/activities/HumanActivityController';
import { Human } from '../human/Human';
import { HumanBrain } from '../human/HumanBrain';
import { HumanController } from '../human/HumanController';
import { NavGrid } from '../human/NavGrid';
import { StylizedHumanVisual } from '../human/StylizedHumanVisual';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { mulberry32 } from '../utils/random';
import { BathroomView } from '../world/Bathroom';
import { Home } from '../world/Home';
import { BATHROOM } from '../world/home/layout';
import type { DogActivityContext } from './DogActivity';
import { DogActivityDirector } from './DogActivityDirector';
import { ToiletPaperMischief } from './ToiletPaperMischief';

const DT = 1 / 60;

async function setup() {
  const home = new Home();
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(home.colliders); physics.commitStaticGeometry();
  const nav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.1, agentRadius: HUMAN.body.radius, minY: 0.08, maxY: 1.7 });
  const events = new GameEvents();
  const said: string[] = [];
  events.on('HUMAN_SAID', (speech) => said.push(speech.text));
  const routine = new HumanActivityController(home.places, events, mulberry32(5));
  routine.reset();
  const { laundry, laundryBasket, treatStand, treatJar } = home.landmarks;
  const brain = new HumanBrain({ home: laundry, basket: laundryBasket, treatStand, treatJar },
    { takeTreat() {}, pickUpSock: () => false, putSockAway() {}, placeTreat() {} }, events);
  brain.driver = routine;
  const human = new Human(brain, new HumanController(new CharacterBody(physics, { x: 6.1, y: 0, z: 1.1 }, HUMAN.body), nav, 0), new StylizedHumanVisual());
  const view = new BathroomView();
  let allowHuman = true;
  const mouth = new Object3D();
  const moke = { x: 4.8, y: 0, z: 0.95 };
  view.update(DT, moke);
  Object.assign(moke, BATHROOM.paperApproach);
  let learned = 0;
  const held: boolean[] = [];
  const paper = new ToiletPaperMischief({ routine, nav, view, mouth,
    onHoldChange: (holding) => held.push(holding), onLearn: () => learned++ });
  const director = new DogActivityDirector([paper]);
  const ctx: DogActivityContext = {
    moke: { position: moke, speed: 0, carrying: null, barked: false, trick: false, sniffing: false, napSpot: null },
    human: { position: human.controller.position, available: true, seesMoke: true, engaged: false }, heistRunning: false,
  };
  const step = () => {
    human.fixedUpdate(DT, { moke, mokeCarryingSock: false, mokeSpeed: 0, mokeUnderFurniture: false, mokeBarked: false, looseSock: null, clear: () => true });
    (ctx.human as { available: boolean }).available = routine.available && allowHuman;
    director.update(DT, ctx);
    view.update(DT, moke);
    physics.step(); human.update(DT, 1);
  };
  const tick = (seconds: number) => { for (let i = 0; i < seconds / DT; i++) step(); };
  const pullOutside = () => {
    for (const [x, z] of [[5.2, -0.4], [4.9, -0.2], [4.8, 0.15], [4.8, 0.55], [4.8, 1], [4.8, 1.5], [4.8, 1.9], [4.8, 2.3]] as const) {
      Object.assign(moke, { x, z }); step();
    }
  };
  return { home, physics, human, routine, view, paper, director, ctx, moke, mouth, said, held, step, tick, pullOutside,
    setHumanAvailable: (available: boolean) => { allowHuman = available; },
    learned: () => learned, dispose: () => { view.dispose(); human.visual.dispose(); physics.world.free(); } };
}

describe('hall bathroom toilet-paper activity', () => {
  it('lets Moke make a long trail from inside the bathroom, scolds and cleans it, learns once, then repeats', async () => {
    const w = await setup();
    w.tick(0.1);
    // In the bathroom, past the doorway: the door has swung back to ajar.
    expect(w.view.mokeInside).toBe(true);
    expect(w.view.isOpen).toBe(false);
    expect(w.paper.interactable.enabled).toBe(true);
    for (let i = 0; i < 5; i++) w.paper.interactable.interact();
    w.tick(1);
    expect(w.paper.holdingPaper).toBe(true);
    expect(w.held).toContain(true);
    expect(w.mouth.children.some((child) => child.name === 'Paper held in Moke mouth')).toBe(true);
    expect(w.said).not.toContain("No, Moke! Don't make a mess!");
    w.pullOutside();
    expect(w.view.visibleStrips).toBeGreaterThan(3);
    expect(w.view.trailEndsOutside).toBe(true);
    expect(w.paper.holdingPaper).toBe(false);
    expect(w.held).toContain(false);
    expect(w.mouth.children).toHaveLength(0);
    expect(w.view.isOpen).toBe(false);
    expect(w.paper.running).toBe(true);
    w.tick(25);
    expect(w.said).toContain("No, Moke! Don't make a mess!");
    expect(w.view.visibleStrips).toBe(0);
    expect(w.paper.successes).toBe(1);
    expect(w.learned()).toBe(1);
    w.tick(30);
    Object.assign(w.moke, BATHROOM.paperApproach);
    w.tick(0.2);
    expect(w.paper.interactable.enabled).toBe(true);
    w.paper.interactable.interact();
    w.tick(1);
    expect(w.paper.holdingPaper).toBe(true);
    w.pullOutside();
    w.tick(25);
    expect(w.paper.successes).toBe(2);
    expect(w.learned()).toBe(2);
    expect(w.said.filter((s) => s === "No, Moke! Don't make a mess!")).toHaveLength(2);
    w.dispose();
  }, 60_000);

  it('does not offer paper through the wall or during a heist, and removes the mess on interruption', async () => {
    const w = await setup();
    Object.assign(w.moke, { x: BATHROOM.doorway.x, z: 1.1 });
    w.tick(0.1); expect(w.paper.interactable.enabled).toBe(false);
    Object.assign(w.moke, BATHROOM.paperApproach);
    w.tick(0.1); w.paper.interactable.interact(); w.tick(1);
    expect(w.view.visibleStrips).toBeGreaterThan(0);
    (w.ctx as { heistRunning: boolean }).heistRunning = true;
    w.tick(0.1);
    expect(w.paper.running).toBe(false);
    expect(w.view.visibleStrips).toBe(0);
    expect(w.learned()).toBe(0);
    w.paper.resetAll();
    w.view.reset();
    expect(w.view.isOpen).toBe(false);
    w.dispose();
  });

  it('clears the trail and frees replay if the human never becomes available after Moke lets go', async () => {
    const w = await setup();
    w.tick(0.1); w.paper.interactable.interact(); w.tick(1);
    w.setHumanAvailable(false);
    w.pullOutside();
    expect(w.view.visibleStrips).toBeGreaterThan(0);
    w.tick(46);
    expect(w.paper.running).toBe(false);
    expect(w.view.visibleStrips).toBe(0);
    expect(w.learned()).toBe(0);
    w.tick(30);
    Object.assign(w.moke, BATHROOM.paperApproach);
    w.setHumanAvailable(true);
    w.tick(0.2);
    expect(w.paper.interactable.enabled).toBe(true);
    w.dispose();
  });
});
