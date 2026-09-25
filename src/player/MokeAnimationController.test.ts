import { MOKE_ANIMATION } from '../config/animation';
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

  it('holds a playful growl pose briefly and then releases it', () => {
    const anim = new MokeAnimationController(MOVEMENT);
    const idle = { speed: 0, turnRate: 0, headroom: OPEN_SKY };
    anim.growl();
    expect(simulate(anim, idle, 0.15).growl).toBeGreaterThan(0.7);
    expect(simulate(anim, idle, 1.2).growl).toBe(0);
  });

  it('sits down after standing still a while, and hops straight up when he moves', () => {
    const anim = new MokeAnimationController(MOVEMENT, () => 0.99); // no stretch first
    const idle = { speed: 0, turnRate: 0, headroom: OPEN_SKY };
    expect(simulate(anim, idle, MOKE_ANIMATION.idleSitAfter - 1).sit).toBeLessThan(0.01);
    expect(simulate(anim, idle, 3).sit).toBeGreaterThan(0.9);
    expect(simulate(anim, { ...idle, speed: 1 }, 0.25).sit).toBeLessThan(0.05);
  });

  it('sometimes stretches (a play bow) before sitting', () => {
    const anim = new MokeAnimationController(MOVEMENT, () => 0); // always stretch
    const idle = { speed: 0, turnRate: 0, headroom: OPEN_SKY };
    simulate(anim, idle, MOKE_ANIMATION.idleSitAfter + MOKE_ANIMATION.stretchDuration / 2);
    expect(anim.state.stretch).toBeGreaterThan(0.8);
    expect(simulate(anim, idle, MOKE_ANIMATION.stretchDuration + 2).sit).toBeGreaterThan(0.9);
  });

  it("doesn't sit while sniffing, resting or doing a trick", () => {
    for (const busy of [{ sniffing: true }, { resting: true }]) {
      const anim = new MokeAnimationController(MOVEMENT, () => 0.99);
      const sample = { speed: 0, turnRate: 0, headroom: OPEN_SKY, ...busy };
      expect(simulate(anim, sample, MOKE_ANIMATION.idleSitAfter + 3).sit).toBeLessThan(0.01);
    }
    const tricky = new MokeAnimationController(MOVEMENT, () => 0.99);
    tricky.trick('spin');
    expect(simulate(tricky, { speed: 0, turnRate: 0, headroom: OPEN_SKY }, 1).sit).toBeLessThan(0.01);
  });

  it('turns his head toward something interesting, within a natural range', () => {
    const anim = new MokeAnimationController(MOVEMENT, () => 0.5); // idle looks go straight ahead, no tilts
    const s = simulate(anim, { speed: 0, turnRate: 0, headroom: OPEN_SKY, look: { yaw: 0.4, pitch: -0.2 } }, 1.5);
    expect(s.headYaw).toBeCloseTo(0.4, 1);
    expect(s.headPitch).toBeCloseTo(-0.2, 1);
    expect(s.attention).toBeGreaterThan(0.9);
    const far = simulate(new MokeAnimationController(MOVEMENT), { speed: 0, turnRate: 0, headroom: OPEN_SKY, look: { yaw: 3, pitch: 2 } }, 2);
    expect(far.headYaw).toBeLessThanOrEqual(MOKE_ANIMATION.maxHeadYaw + 1e-6);
    expect(far.headPitch).toBeLessThanOrEqual(MOKE_ANIMATION.lookMaxPitch + 1e-6);
    // Done looking: back to facing forward.
    expect(Math.abs(simulate(anim, { speed: 0, turnRate: 0, headroom: OPEN_SKY }, 1.5).headYaw)).toBeLessThan(0.05);
  });
});
