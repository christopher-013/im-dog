import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { HEIST } from '../config/heist';
import { GameEvents, type GameEventName } from '../core/GameEvents';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { DogLogicMemory } from './DogLogic';
import { SockHeistController, type HeistHuman, type HeistSock } from './SockHeistController';

const DT = 1 / 60;

function setup() {
  const events = new GameEvents();
  const emitted: GameEventName[] = [];
  for (const name of ['SOCK_TRADED', 'TREAT_EATEN', 'DOG_LOGIC_DISCOVERED', 'HEIST_COMPLETE', 'HEIST_RESET'] as const) {
    events.on(name, () => emitted.push(name));
  }
  const discoveries: boolean[] = [];
  events.on('DOG_LOGIC_DISCOVERED', ({ first }) => discoveries.push(first));
  const seconds: number[] = [];
  events.on('HEIST_COMPLETE', (e) => seconds.push(e.seconds));

  const scene = new Object3D();
  type FakeSock = { -readonly [K in keyof HeistSock]: HeistSock[K] } & { heldBy: Object3D | null; resets: number };
  const sock: FakeSock = {
    carried: false,
    position: { x: 0, y: 0, z: 0 },
    heldBy: null,
    resets: 0,
    pickUp() {
      this.carried = true;
    },
    drop(at) {
      this.carried = false;
      Object.assign(this.position, at);
    },
    holdIn(socket) {
      this.heldBy = socket;
    },
    release() {
      this.heldBy = null;
    },
    reset() {
      this.carried = false;
      this.heldBy = null;
      this.resets++;
    },
  };
  const brain = { wantsTrade: false, received: 0, receiveSock() { this.received++; return true; } };
  const humanResets: unknown[] = [];
  const human: HeistHuman = {
    brain,
    controller: { position: { x: 1, y: 0, z: 0 } },
    visual: { hands: { left: new Object3D(), right: new Object3D() } },
    reset: (home) => humanResets.push(home),
  };
  const pickup = { carried: null as unknown, handOvers: 0, handOver() { this.handOvers++; const item = this.carried; this.carried = null; return item; } };
  const interactions = new InteractionSystem();
  let ate = 0;
  const saved = new Map<string, string>();
  const storage = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => void saved.set(k, v) };
  const heist = new SockHeistController({
    events,
    interactions,
    pickup,
    sock,
    eat: () => ate++,
    scene,
    places: { humanHome: { x: -1, y: 0, z: -1 }, basket: { x: -2, y: 0, z: -2 }, sockReturn: { x: -2.3, y: 0, z: -1.3 } },
    memory: new DogLogicMemory(storage),
    createHuman: () => human,
  });
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += DT) heist.fixedUpdate(DT);
  };
  const moke = { position: { x: 1.6, y: 0, z: 0 }, heading: -Math.PI / 2 };
  const steal = () => {
    pickup.carried = sock;
    sock.carried = true;
    events.emit('SOCK_PICKED_UP', { by: 'moke' });
  };
  return { events, emitted, discoveries, seconds, heist, sock, brain, human, humanResets, pickup, interactions, moke, run, steal, ate: () => ate };
}

describe('SockHeistController', () => {
  it('follows the heist from the steal to the chase to the treat', () => {
    const { events, heist, steal, brain, run } = setup();
    expect(heist.phase).toBe('waiting');
    steal();
    expect(heist.phase).toBe('stolen');
    run(2);
    events.emit('HUMAN_NOTICED');
    expect(heist.phase).toBe('chase');
    expect(heist.objective).toBe('Keep away!');
    events.emit('CHASE_GAVE_UP');
    expect(heist.phase).toBe('treat');
    brain.wantsTrade = true;
    expect(heist.objective).toMatch(/treat/i);
  });

  it('offers "Give Sock" only when the human wants to trade and Moke has the sock', () => {
    const { interactions, heist, steal, brain, moke, events } = setup();
    steal();
    events.emit('HUMAN_NOTICED');
    events.emit('CHASE_GAVE_UP');
    expect(interactions.update(moke)?.id).not.toBe('heist:give');
    brain.wantsTrade = true;
    expect(interactions.update(moke)?.id).toBe('heist:give');
    expect(interactions.update(moke)?.label).toBe('Give Sock');
    void heist;
  });

  it('trades: the sock goes from his mouth to their hand, then the treat, eating, SOCK = TREAT and completion', () => {
    const { interactions, heist, steal, brain, moke, events, emitted, pickup, sock, human, run, discoveries, seconds, ate } = setup();
    steal();
    events.emit('HUMAN_NOTICED');
    run(40);
    events.emit('CHASE_GAVE_UP');
    brain.wantsTrade = true;
    interactions.update(moke);
    interactions.interact();
    expect(pickup.handOvers).toBe(1);
    expect(sock.heldBy).toBe(human.visual.hands.left);
    expect(brain.received).toBe(1);
    expect(emitted).toContain('SOCK_TRADED');

    // The human puts the treat down near Moke (their brain calls the hands), then TREAT_PLACED.
    heist.placeTreat({ x: 1.3, y: 0, z: 0 });
    events.emit('TREAT_PLACED');
    expect(heist.phase).toBe('trade');
    expect(heist.objective).toMatch(/eat/i);
    brain.wantsTrade = false;
    expect(interactions.update(moke)?.label).toBe('Eat Treat');
    interactions.interact();
    expect(ate()).toBe(1);
    expect(heist.phase).toBe('eating');
    run(HEIST.eatTime + 0.1);
    expect(emitted).toContain('TREAT_EATEN');
    expect(discoveries).toEqual([true]);
    expect(heist.phase).toBe('discovery');
    run(HEIST.discoveryTime + 0.1);
    expect(heist.phase).toBe('complete');
    expect(seconds[0]).toBeGreaterThan(40);
  });

  it('re-arms if the human gets the sock back without a trade', () => {
    const { heist, steal, events } = setup();
    steal();
    events.emit('HUMAN_NOTICED');
    events.emit('SOCK_RETURNED');
    expect(heist.phase).toBe('waiting');
    steal();
    expect(heist.phase).toBe('stolen');
  });

  it('the human picks up a loose sock with their hands, and tosses it back by the basket', () => {
    const { heist, sock, human } = setup();
    expect(heist.pickUpSock()).toBe(true);
    expect(sock.carried).toBe(true);
    expect(sock.heldBy).toBe(human.visual.hands.left);
    expect(heist.pickUpSock()).toBe(false); // already held
    heist.putSockAway();
    expect(sock.carried).toBe(false);
    expect(sock.position.x).toBeCloseTo(-2.3);
  });

  it('replays without a refresh: PLAY AGAIN resets the sock, the human and the treat, even mid-heist', () => {
    const { heist, steal, events, pickup, sock, humanResets, emitted } = setup();
    steal();
    events.emit('HUMAN_NOTICED');
    heist.takeTreat();
    heist.reset();
    expect(heist.phase).toBe('waiting');
    expect(pickup.handOvers).toBe(1); // out of Moke's mouth first
    expect(sock.resets).toBe(1);
    expect(heist.treat.state).toBe('stored');
    expect(humanResets).toHaveLength(1);
    expect(emitted).toContain('HEIST_RESET');
    expect(heist.elapsed).toBe(0);
  });

  it('remembers SOCK = TREAT: "new" the first time only', () => {
    const { heist, steal, events, run, discoveries } = setup();
    for (let round = 0; round < 2; round++) {
      steal();
      events.emit('HUMAN_NOTICED');
      heist.placeTreat({ x: 1, y: 0, z: 0 });
      events.emit('TREAT_PLACED');
      heist.treat.eat();
      run(HEIST.eatTime + HEIST.discoveryTime + 0.3);
      expect(heist.phase).toBe('complete');
      heist.keepExploring();
      expect(heist.phase).toBe('waiting');
      heist.reset();
    }
    expect(discoveries).toEqual([true, false]);
  });
});
