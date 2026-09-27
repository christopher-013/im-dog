import { describe, expect, it } from 'vitest';
import { MOKE_REACTIONS } from '../../config/activities';
import { mulberry32 } from '../../utils/random';
import type { HumanIntent, HumanSenses } from '../HumanBrain';
import type { HumanActivityController } from './HumanActivityController';
import { HumanReactions } from './HumanReactions';

const DT = 1 / 60;

/** The bits of the routine reactions read: what they're doing, and how free that leaves them to look about. */
const routine = (attention: number) => ({ available: true, activity: { attention, interruptible: 'always' } }) as unknown as HumanActivityController;

function senses(moke: { x: number; z: number }, seated = false): HumanSenses {
  return {
    position: { x: 0, y: 0, z: 0 },
    heading: 0,
    arrived: true,
    seated,
    stuck: 0,
    moke: { x: moke.x, y: 0, z: moke.z },
    mokeCarryingSock: false,
    mokeSpeed: 0,
    mokeUnderFurniture: false,
    mokeBarked: false,
    looseSock: null,
    clear: () => true,
  };
}

function intent(): HumanIntent {
  return { goal: null, speed: 0, stopWithin: 0.12, face: null, headYaw: 0, crouch: 0, pose: 'watch', seat: null, prop: null, lookAt: null, talking: 0 };
}

describe('HumanReactions (Moke and the human, day to day)', () => {
  it('is not a security camera: watching TV with Moke sitting nearby, a glance when he turns up and only now and then after', () => {
    const reactions = new HumanReactions(mulberry32(4));
    const r = routine(0.3);
    let looks = 0;
    let lookedAtArrival = false;
    for (let i = 0; i < 90 / DT; i++) {
      const i2 = intent();
      const before = reactions.kind;
      reactions.update(DT, senses({ x: 0.4, z: 1.8 }, true), i2, r);
      if (reactions.kind === 'look' && before !== 'look') {
        looks++;
        if (i * DT < 0.5) lookedAtArrival = true;
      }
    }
    expect(lookedAtArrival).toBe(true);
    // 90 s of a dog sitting in view: a handful of glances at most, never a stare.
    expect(looks).toBeLessThanOrEqual(5);
  });

  it('turns only as much of the body as the moment needs: a glance is light, a greeting more, attention is everything', () => {
    const t = MOKE_REACTIONS.weights;
    expect(t.look).toBeLessThan(0.4);
    expect(t.greet).toBeGreaterThan(t.look);
    expect(t.attend).toBe(1);
    const reactions = new HumanReactions(mulberry32(2));
    const i = intent();
    reactions.update(DT, senses({ x: 0.3, z: 1.5 }), i, routine(0.6));
    expect(reactions.kind).toBe('look');
    expect(i.lookWeight).toBeCloseTo(t.look);
  });

  it('walks over to pet a dog a step away, hands free; kneels and pets only once close, and holds still', () => {
    const reactions = new HumanReactions(mulberry32(1));
    const r = routine(0.6);
    reactions.requestPet();
    const far = intent();
    reactions.update(DT, senses({ x: 0.2, z: 1.2 }), far, r);
    expect(reactions.kind).toBe('pet');
    expect(far.goal).not.toBeNull();
    expect(far.crouch).toBe(0);
    expect(far.pose).toBe('idle');
    const close = intent();
    reactions.update(DT, senses({ x: 0.1, z: 0.42 }), close, r);
    expect(close.goal).toBeNull();
    expect(close.crouch).toBe(1);
    expect(close.pose).toBe('pet');
    expect(close.reach).toMatchObject({ x: 0.1, z: 0.42 });
    // A little shuffle from the dog doesn't send them walking again.
    const shuffle = intent();
    reactions.update(DT, senses({ x: 0.1, z: 0.6 }), shuffle, r);
    expect(shuffle.goal).toBeNull();
  });
});
