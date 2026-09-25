import { describe, expect, it } from 'vitest';
import { HUMAN } from '../config/human';
import { GameEvents, type GameEventName } from '../core/GameEvents';
import type { Vec3Like } from '../physics/CharacterBody';
import { HumanBrain, type HumanPlaces } from './HumanBrain';

const DT = 1 / 60;
const places: HumanPlaces = {
  home: { x: -1.35, y: 0, z: -1.45 },
  basket: { x: -2.0, y: 0, z: -1.85 },
  treatStand: { x: 0.95, y: 0, z: 2.2 },
  treatJar: { x: 0.95, y: 0.56, z: 2.77 },
};

/** A tiny stand-in world: the human walks straight where the brain asks; walls can block sight. */
class World {
  human = { ...places.home };
  heading = Math.atan2(places.basket.x - places.home.x, places.basket.z - places.home.z);
  arrived = true;
  moke = { x: -0.35, y: 0, z: -0.3 };
  carrying = false;
  mokeSpeed = 0;
  under = false;
  barked = false;
  walls = false;
  looseSock: Vec3Like | null = null;
  treatAt: Vec3Like | null = null;
  treatInHand = false;
  socksPutAway = 0;
  readonly events = new GameEvents();
  readonly said: string[] = [];
  readonly emitted: GameEventName[] = [];
  readonly brain: HumanBrain;

  constructor() {
    this.events.on('HUMAN_SAID', (s) => this.said.push(s.text));
    for (const name of ['HUMAN_NOTICED', 'CHASE_STARTED', 'CHASE_LOST', 'GRAB_MISSED', 'CHASE_GAVE_UP', 'TREAT_FETCHED', 'TREAT_OFFERED', 'TREAT_PLACED', 'SOCK_RETURNED', 'SOCK_PICKED_UP'] as const) {
      this.events.on(name, () => this.emitted.push(name));
    }
    this.brain = new HumanBrain(
      places,
      {
        takeTreat: () => (this.treatInHand = true),
        pickUpSock: () => {
          if (!this.looseSock) return false;
          this.looseSock = null;
          return true;
        },
        putSockAway: () => this.socksPutAway++,
        placeTreat: (at) => {
          this.treatAt = { ...at };
          this.treatInHand = false;
        },
      },
      this.events,
      () => 0.5,
    );
  }

  senses() {
    return {
      position: this.human,
      heading: this.heading,
      arrived: this.arrived,
      moke: this.moke,
      mokeCarryingSock: this.carrying,
      mokeSpeed: this.mokeSpeed,
      mokeUnderFurniture: this.under,
      mokeBarked: this.barked,
      looseSock: this.looseSock,
      clear: () => !this.walls,
    };
  }

  run(seconds: number, each?: () => void): void {
    for (let t = 0; t < seconds; t += DT) {
      each?.();
      this.brain.update(DT, this.senses());
      this.barked = false;
      const { goal, speed, stopWithin, face } = this.brain.intent;
      this.arrived = true;
      if (goal) {
        const dx = goal.x - this.human.x;
        const dz = goal.z - this.human.z;
        const d = Math.hypot(dx, dz);
        if (d > stopWithin) {
          const stepLength = Math.min(d - stopWithin, speed * DT);
          this.human.x += (dx / d) * stepLength;
          this.human.z += (dz / d) * stepLength;
          this.heading = Math.atan2(dx, dz);
          this.arrived = false;
        }
      }
      if (this.arrived && face) this.heading = Math.atan2(face.x - this.human.x, face.z - this.human.z);
    }
  }

  /** Run until the brain reaches `state` (or give up after `limit` seconds). */
  until(state: string, limit = 60, each?: () => void): number {
    let t = 0;
    while (this.brain.state !== state && t < limit) {
      this.run(DT, each);
      t += DT;
    }
    return t;
  }
}

describe('HumanBrain (the Sock Heist human)', () => {
  it("doesn't notice a thief behind their back, but does when they glance round", () => {
    const w = new World();
    w.carrying = true;
    w.run(3);
    expect(w.brain.state).toBe('idle');
    const t = w.until('noticed', 20);
    expect(w.brain.state).toBe('noticed');
    expect(t).toBeGreaterThan(3);
    expect(w.emitted).toContain('HUMAN_NOTICED');
    expect(w.said[0]).toMatch(/sock|drop it/i);
  });

  it('notices at once if he barks with the sock in his mouth', () => {
    const w = new World();
    w.carrying = true;
    w.barked = true;
    w.run(DT);
    expect(w.brain.state).toBe('noticed');
  });

  it('ignores Moke without the sock', () => {
    const w = new World();
    w.moke = { x: -1.3, y: 0, z: -2.3 }; // right in front of them
    w.run(15);
    expect(w.brain.state).toBe('idle');
  });

  it('reacts, then chases, then fumbles every grab (no catching, no punishment)', () => {
    const w = new World();
    w.carrying = true;
    w.barked = true;
    w.until('chase', 5);
    expect(w.emitted.filter((e) => e === 'CHASE_STARTED')).toHaveLength(1);
    // Moke just stands there: they reach him and lunge, and fumble.
    w.until('lunge', 10);
    w.until('recover', 5);
    expect(w.emitted).toContain('GRAB_MISSED');
    expect(w.carrying).toBe(true);
    expect(w.brain.frustration).toBeGreaterThan(HUMAN.chase.missPenalty);
    w.until('chase', 5);
    expect(w.emitted.filter((e) => e === 'CHASE_STARTED')).toHaveLength(1); // not re-announced
  });

  it("can't grab him under the coffee table: a standoff, crouched and peering, that wears their patience down faster", () => {
    const w = new World();
    w.carrying = true;
    w.under = true;
    w.barked = true;
    w.walls = true; // the tabletop hides him from standing eyes...
    w.until('chase', 5);
    w.walls = false; // ...but not from a crouch
    w.run(8);
    expect(w.emitted).not.toContain('GRAB_MISSED');
    expect(w.brain.intent.pose).toBe('peek');
    expect(w.said.some((s) => /come out|come on/i.test(s))).toBe(true);
    const t = w.until('giveUp', 40);
    expect(t).toBeLessThan(HUMAN.chase.giveUpAt / HUMAN.chase.standoffRate + 2);
  });

  it("doesn't bother grabbing at a dog sprinting past", () => {
    const w = new World();
    w.carrying = true;
    w.mokeSpeed = 4; // flat out
    w.barked = true;
    w.run(6);
    expect(w.emitted).not.toContain('GRAB_MISSED');
  });

  it('keeps chasing for a while, then changes strategy: the chase never goes on forever', () => {
    const w = new World();
    w.carrying = true;
    w.barked = true;
    // Moke stays just out of reach, in plain view.
    const keepAway = () => {
      const dx = w.moke.x - w.human.x;
      const dz = w.moke.z - w.human.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < 2) {
        w.moke.x = w.human.x + (dx / d) * 2;
        w.moke.z = w.human.z + (dz / d) * 2;
      }
    };
    const t = w.until('giveUp', 90, keepAway);
    expect(w.brain.state).toBe('giveUp');
    expect(t).toBeGreaterThan(20);
    expect(t).toBeLessThan(HUMAN.chase.giveUpAt + 10);
  });

  it('loses him out of sight, searches, then fetches a treat and offers it', () => {
    const w = new World();
    w.carrying = true;
    w.barked = true;
    w.until('chase', 5);
    w.walls = true; // he's gone behind the couch
    w.moke = { x: 2.5, y: 0, z: -2.5 };
    w.until('search', 10);
    expect(w.emitted).toContain('CHASE_LOST');
    w.until('giveUp', 20);
    w.until('getTreat', 5);
    let fetchedAt: { x: number; z: number } | null = null;
    w.events.on('TREAT_FETCHED', () => (fetchedAt = { ...w.human }));
    w.until('offerTreat', 30);
    expect(w.treatInHand).toBe(true);
    expect(w.emitted).toContain('TREAT_FETCHED');
    // They actually walked over to the jar for it (no rummaging from across the room).
    expect(Math.hypot(fetchedAt!.x - places.treatStand.x, fetchedAt!.z - places.treatStand.z)).toBeLessThan(0.3);
    w.walls = false;
    w.until('waitForTrade', 20);
    expect(w.brain.wantsTrade).toBe(true);
    expect(w.emitted).toContain('TREAT_OFFERED');
    // ...and walked over to Moke to kneel with it.
    expect(Math.hypot(w.human.x - w.moke.x, w.human.z - w.moke.z)).toBeLessThan(HUMAN.treat.offerDistance + 0.35);
    w.run(0.1);
    expect(w.brain.intent.crouch).toBe(1);
  });

  /** Gets a world to the point where the human kneels with a treat. */
  const toTrade = () => {
    const w = new World();
    w.carrying = true;
    w.barked = true;
    w.until('chase', 5);
    w.walls = true;
    w.until('waitForTrade', 60);
    w.walls = false;
    return w;
  };

  it('trades: takes the sock, puts the treat down near Moke, and tidies the sock away', () => {
    const w = toTrade();
    w.moke = { x: w.human.x + 0.7, y: 0, z: w.human.z };
    expect(w.brain.receiveSock()).toBe(true);
    expect(w.said.at(-1)).toMatch(/thank|good/i);
    w.until('reward', 5);
    expect(w.treatAt).not.toBeNull();
    expect(Math.hypot(w.treatAt!.x - w.moke.x, w.treatAt!.z - w.moke.z)).toBeLessThan(0.7);
    expect(w.emitted).toContain('TREAT_PLACED');
    w.until('idle', 30);
    expect(w.socksPutAway).toBe(1);
    expect(w.brain.frustration).toBe(0);
  });

  it('counts a sock dropped at their feet as a trade', () => {
    const w = toTrade();
    w.carrying = false;
    w.looseSock = { x: w.human.x + 0.5, y: 0, z: w.human.z };
    w.run(DT);
    expect(w.brain.state).toBe('receiveSock');
    expect(w.said.at(-1)).toMatch(/thank|good/i);
  });

  it('fetches a sock dropped across the room, and still gives the treat', () => {
    const w = toTrade();
    w.carrying = false;
    w.looseSock = { x: w.human.x + 2.5, y: 0, z: w.human.z + 0.5 };
    w.until('receiveSock', 10);
    expect(w.said.at(-1)).toMatch(/close enough|deal/i);
    w.until('reward', 5);
    expect(w.treatAt).not.toBeNull();
  });

  it('never soft-locks: a sock dropped far away, out of sight, is found in the end', () => {
    const w = toTrade();
    w.carrying = false;
    w.walls = true; // out of sight
    w.looseSock = { x: w.human.x - 4, y: 0, z: w.human.z + 3 };
    w.until('fetchSock', 15);
    expect(w.brain.state).toBe('fetchSock');
    w.until('receiveSock', 15);
    expect(w.brain.state).toBe('receiveSock');
  });

  it("says 'sock first' when he comes for the treat without it", () => {
    const w = toTrade();
    w.carrying = false;
    w.moke = { x: w.human.x + 0.5, y: 0, z: w.human.z };
    w.run(0.5);
    expect(w.said.filter((s) => /sock first/i.test(s))).toHaveLength(1);
    expect(w.brain.receiveSock()).toBe(true); // (the game only offers "Give Sock" when he has it)
  });

  it('picks up a sock he drops mid-chase and puts it back (the heist is on again)', () => {
    const w = new World();
    w.carrying = true;
    w.barked = true;
    w.until('chase', 5);
    w.carrying = false;
    w.looseSock = { x: -0.8, y: 0, z: -0.6 };
    w.until('returnSock', 15);
    expect(w.emitted).toContain('SOCK_PICKED_UP');
    w.until('idle', 20);
    expect(w.socksPutAway).toBe(1);
    expect(w.brain.frustration).toBeGreaterThan(0); // they remember
  });

  it('a bark from a hiding place gives him away while they search', () => {
    const w = new World();
    w.carrying = true;
    w.barked = true;
    w.until('chase', 5);
    w.walls = true;
    w.moke = { x: 2.5, y: 0, z: -2.5 };
    w.until('search', 10);
    expect(w.brain.state).toBe('search');
    const before = w.brain.frustration;
    w.moke = { x: 1.2, y: 0, z: 0.4 };
    w.barked = true;
    w.run(0.1);
    expect(w.brain.state).toBe('search');
    expect(w.said.at(-1)).toMatch(/there you are|aha/i);
    expect(w.brain.frustration).toBeGreaterThanOrEqual(before);
  });

  it('resets to folding laundry for a replay', () => {
    const w = toTrade();
    w.brain.reset();
    expect(w.brain.state).toBe('idle');
    expect(w.brain.frustration).toBe(0);
    expect(w.brain.hasTreat).toBe(false);
    expect(w.brain.wantsTrade).toBe(false);
  });
});
