import { Object3D } from 'three';
import { expect, it } from 'vitest';
import { BATHROOM_ACTIVITY } from '../config/bathroom';
import { HUMAN } from '../config/human';
import { MOKE_BODY } from '../config/movement';
import { GameEvents } from '../core/GameEvents';
import { ToiletPaperMischief } from '../activities/ToiletPaperMischief';
import { DogActivityDirector } from '../activities/DogActivityDirector';
import { HumanActivityController } from '../human/activities/HumanActivityController';
import { Human } from '../human/Human';
import { HumanBrain } from '../human/HumanBrain';
import { HumanController } from '../human/HumanController';
import { NavGrid } from '../human/NavGrid';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MokeController } from '../player/MokeController';
import { mulberry32 } from '../utils/random';
import { BathroomView } from '../world/Bathroom';
import { Home } from '../world/Home';
import { BATHROOM } from '../world/home/layout';
import { FullSelfDog, type FsdWorld } from './FullSelfDog';

const DT = 1 / 60;

it('FSD enters the actual bathroom, pulls paper down the hall, lets the human clean up, and does it again', async () => {
  const home = new Home();
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(home.colliders);
  physics.commitStaticGeometry();
  const grid = (radius: number, cell: number, maxY: number) => new NavGrid(home.colliders,
    { bounds: home.bounds, cell, agentRadius: radius, minY: 0.03, maxY });
  const nav = grid(MOKE_BODY.radius + 0.04, 0.1, 0.38);
  const tight = grid(MOKE_BODY.radius + 0.01, 0.05, 0.38);
  const humanNav = grid(HUMAN.body.radius, 0.1, 1.7);
  const c = new MokeController(new CharacterBody(physics, home.spawn.position, MOKE_BODY), home.spawn.heading);
  const events = new GameEvents();
  const said: string[] = [];
  events.on('HUMAN_SAID', (speech) => said.push(speech.text));
  const routine = new HumanActivityController(home.places, events, mulberry32(5));
  routine.reset();
  const { laundry, laundryBasket, treatStand, treatJar } = home.landmarks;
  const brain = new HumanBrain({ home: laundry, basket: laundryBasket, treatStand, treatJar },
    { takeTreat() {}, pickUpSock: () => false, putSockAway() {}, placeTreat() {} }, events);
  brain.driver = routine;
  const human = new Human(brain, new HumanController(new CharacterBody(physics, laundry, HUMAN.body), humanNav, 0), {
    object: new Object3D(), hands: { left: new Object3D(), right: new Object3D() }, setSeeThrough() {}, apply() {}, dispose() {},
  });
  const view = new BathroomView();
  const mouth = new Object3D();
  const paper = new ToiletPaperMischief({ routine, nav: humanNav, view, mouth: () => mouth, onHoldChange() {}, onLearn() {} });
  const director = new DogActivityDirector([paper]);
  let current: string | null = null;
  const world: FsdWorld = {
    moke: {
      get position() { return c.position; }, get heading() { return c.heading; },
      get grounded() { return c.grounded; }, get speed() { return c.actualSpeed; },
      get carrying() { return paper.holdingPaper ? 'paper' : null; },
      get busy() { return paper.grabbing; }, resting: false, watching: false,
    },
    human: { get position() { return human.controller.position; }, get available() { return routine.available; }, effect: null, placeKind: null },
    heistRunning: false, heistPhase: 'waiting', doorRinging: false, ballgameOn: false,
    get holdingPaper() { return paper.holdingPaper; }, get paperAvailable() { return paper.state === 'AVAILABLE'; },
    course: null, rewardWaiting: false, play: { phase: 'idle' }, screens: [], surfaces: [],
    interactables: [paper.interactable], get current() { return current; }, roomName: (x, z) => home.roomAt(x, z).name,
  };
  // With hunt, paper and explore available, this picks paper. Routing and activity rules remain real.
  const fsd = new FullSelfDog(nav, () => 0.4, undefined, () => tight);
  let pulls = 0;
  let holding = false;
  let longestTrail = 0;
  try {
    expect(paper.interactable.enabled).toBe(false);
    for (let t = 0; t < 160; t += DT) {
      const p = c.position;
      current = paper.interactable.enabled && Math.hypot(p.x - BATHROOM.paper.x, p.z - BATHROOM.paper.z) <= paper.interactable.interactionDistance
        ? paper.interactable.id : null;
      const cmd = fsd.update(DT, world);
      if (cmd.presses.has('interact') && current) paper.interactable.interact();
      if (cmd.presses.has('jump')) c.requestJump();
      if (paper.approachTarget) c.glideTo(DT, paper.approachTarget,
        Math.atan2(BATHROOM.paper.x - p.x, BATHROOM.paper.z - p.z), BATHROOM_ACTIVITY.approachSpeed, BATHROOM_ACTIVITY.approachTurnRate);
      else c.fixedUpdate(DT, { x: paper.grabbing ? 0 : cmd.x, z: paper.grabbing ? 0 : cmd.z, walk: cmd.walk, run: cmd.run });
      view.update(DT, p, human.controller.position);
      human.fixedUpdate(DT, { moke: p, mokeCarryingSock: false, mokeSpeed: c.actualSpeed,
        mokeUnderFurniture: false, mokeBarked: false, looseSock: null, clear: () => true });
      director.update(DT, {
        moke: { position: p, speed: c.actualSpeed, carrying: world.moke.carrying, barked: false, trick: false, sniffing: false, napSpot: null },
        human: { position: human.controller.position, available: routine.available, seesMoke: true, engaged: false }, heistRunning: false,
      });
      physics.step();
      if (paper.holdingPaper && !holding) pulls++;
      holding = paper.holdingPaper;
      longestTrail = Math.max(longestTrail, view.visibleStrips);
      if (paper.successes >= 2) break;
    }
    expect(fsd.stats.started.get('paper') ?? 0).toBeGreaterThanOrEqual(2);
    expect(pulls).toBeGreaterThanOrEqual(2);
    expect(longestTrail).toBeGreaterThan(3);
    expect(paper.successes).toBeGreaterThanOrEqual(2);
    expect(said.filter((line) => line === "No, Moke! Don't make a mess!").length).toBeGreaterThanOrEqual(2);
    expect(fsd.stats.failed.get('paperRun') ?? 0).toBe(0);
  } finally {
    view.dispose();
    physics.world.free();
  }
}, 60_000);
