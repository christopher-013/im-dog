import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../config/movement';
import { MokeAnimationController, type MokeMotionSample } from './MokeAnimationController';

const DT = 1 / 60;
const OPEN_SKY = 10;

function simulate(anim: MokeAnimationController, sample: MokeMotionSample, seconds: number) {
  for (let i = 0; i < Math.round(seconds / DT); i++) anim.update(DT, sample);
  return anim.state;
}

/** Deterministic "random" sequence for repeatable idle behaviour. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

describe('MokeAnimationController', () => {
  it('leans into turns, and not at all when stopped', () => {
    const left = simulate(new MokeAnimationController(MOVEMENT), { speed: 3, turnRate: 3, headroom: OPEN_SKY }, 1);
    const right = simulate(new MokeAnimationController(MOVEMENT), { speed: 3, turnRate: -3, headroom: OPEN_SKY }, 1);
    const still = simulate(new MokeAnimationController(MOVEMENT), { speed: 0, turnRate: 3, headroom: OPEN_SKY }, 1);
    expect(left.lean).toBeGreaterThan(0.05);
    expect(right.lean).toBeLessThan(-0.05);
    expect(Math.abs(still.lean)).toBeLessThan(1e-3);
  });

  it('blends from trot to run with speed', () => {
    expect(simulate(new MokeAnimationController(MOVEMENT), { speed: MOVEMENT.trotSpeed, turnRate: 0, headroom: OPEN_SKY }, 1).runBlend).toBeLessThan(0.01);
    expect(simulate(new MokeAnimationController(MOVEMENT), { speed: MOVEMENT.runSpeed, turnRate: 0, headroom: OPEN_SKY }, 1).runBlend).toBeGreaterThan(0.99);
  });

  it('shows signs of life while standing: a head tilt, then a look around', () => {
    // First idle action: 0.1 < tilt chance → tilt; second: 0.9 → look.
    const anim = new MokeAnimationController(MOVEMENT, sequence(0.5, 0.1, 0.9, 0.5, 0.9, 0.95));
    const idle = { speed: 0, turnRate: 0, headroom: OPEN_SKY };
    let maxTilt = 0;
    let maxLook = 0;
    for (let i = 0; i < 12 / DT; i++) {
      const s = anim.update(DT, idle);
      maxTilt = Math.max(maxTilt, Math.abs(s.headTilt));
      maxLook = Math.max(maxLook, Math.abs(s.headYaw));
    }
    expect(maxTilt).toBeGreaterThan(0.2);
    expect(maxLook).toBeGreaterThan(0.2);
  });

  it('drops the idle head tilt once he starts moving', () => {
    const anim = new MokeAnimationController(MOVEMENT, sequence(0, 0.1, 0));
    simulate(anim, { speed: 0, turnRate: 0, headroom: OPEN_SKY }, 2.5);
    expect(Math.abs(anim.state.headTilt)).toBeGreaterThan(0.1);
    const s = simulate(anim, { speed: 1.8, turnRate: 0, headroom: OPEN_SKY }, 1.5);
    expect(Math.abs(s.headTilt)).toBeLessThan(0.01);
  });

  it('ducks under low furniture and stands tall in the open', () => {
    const under = simulate(new MokeAnimationController(MOVEMENT), { speed: 1, turnRate: 0, headroom: 0.39 }, 1);
    const open = simulate(new MokeAnimationController(MOVEMENT), { speed: 1, turnRate: 0, headroom: OPEN_SKY }, 1);
    expect(under.crouch).toBeGreaterThan(0.6);
    expect(open.crouch).toBeLessThan(1e-3);
  });

  it('carries his head up and wags harder while holding something', () => {
    const plain = simulate(new MokeAnimationController(MOVEMENT), { speed: 1.8, turnRate: 0, headroom: OPEN_SKY }, 1);
    const proud = simulate(new MokeAnimationController(MOVEMENT), { speed: 1.8, turnRate: 0, headroom: OPEN_SKY, carrying: true }, 1);
    expect(plain.carry).toBeLessThan(0.01);
    expect(proud.carry).toBeGreaterThan(0.99);
    expect(proud.tailWag).toBeGreaterThan(plain.tailWag);
  });

  it('lies down slowly and gets up quickly', () => {
    const anim = new MokeAnimationController(MOVEMENT);
    const lying = { speed: 0, turnRate: 0, headroom: OPEN_SKY, resting: true };
    expect(simulate(anim, lying, 0.25).rest).toBeLessThan(0.7);
    expect(simulate(anim, lying, 1.5).rest).toBeGreaterThan(0.99);
    expect(simulate(anim, { ...lying, resting: false }, 0.35).rest).toBeLessThan(0.05);
  });
});
