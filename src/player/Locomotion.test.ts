import { describe, expect, it } from 'vitest';
import { MOVEMENT, type MovementTuning } from '../config/movement';
import { createLocomotionState, gaitForSpeed, stepLocomotion, type LocomotionState, type MoveIntent } from './Locomotion';

const DT = 1 / 60;
// A snapshot, so live tweaks to MOVEMENT can't change test results.
const tuning: MovementTuning = { ...MOVEMENT };

const move = (x: number, z: number, gait: Partial<Pick<MoveIntent, 'walk' | 'run'>> = {}): MoveIntent => ({
  x,
  z,
  walk: false,
  run: false,
  ...gait,
});
const FORWARD = move(0, 1); // heading 0 faces +z
const NONE = move(0, 0);

function run(state: LocomotionState, intent: MoveIntent, seconds: number, t: MovementTuning = tuning): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepLocomotion(state, intent, t, DT);
}

describe('stepLocomotion: speeding up and slowing down', () => {
  it('eases up to trot speed instead of starting instantly', () => {
    const s = createLocomotionState(0);
    stepLocomotion(s, FORWARD, tuning, DT);
    expect(s.speed).toBeGreaterThan(0);
    expect(s.speed).toBeLessThan(tuning.trotSpeed * 0.2);
    run(s, FORWARD, 1);
    expect(s.speed).toBeCloseTo(tuning.trotSpeed, 5);
  });

  it('has three distinct gaits: walk < trot < run', () => {
    const speeds = [move(0, 1, { walk: true }), FORWARD, move(0, 1, { run: true })].map((intent) => {
      const s = createLocomotionState(0);
      run(s, intent, 2);
      return s.speed;
    });
    expect(speeds).toEqual([tuning.walkSpeed, tuning.trotSpeed, tuning.runSpeed]);
  });

  it('eases to a stop after the keys are released, not instantly', () => {
    const s = createLocomotionState(0);
    run(s, move(0, 1, { run: true }), 2);
    stepLocomotion(s, NONE, tuning, DT);
    expect(s.speed).toBeGreaterThan(tuning.runSpeed * 0.9);
    run(s, NONE, 1);
    expect(s.speed).toBe(0);
  });

  it('stays put with no input', () => {
    const s = createLocomotionState(1);
    run(s, NONE, 1);
    expect(s.speed).toBe(0);
    expect(s.heading).toBe(1);
  });

  it('scales speed with analog input strength (for gamepads later)', () => {
    const s = createLocomotionState(0);
    run(s, move(0, 0.5), 2);
    expect(s.speed).toBeCloseTo(tuning.trotSpeed * 0.5, 5);
  });

  it('lower ground friction makes him slower to get going', () => {
    const grippy = createLocomotionState(0);
    const slippery = createLocomotionState(0);
    run(grippy, FORWARD, 0.1);
    run(slippery, FORWARD, 0.1, { ...tuning, groundFriction: 0.5 });
    expect(slippery.speed).toBeLessThan(grippy.speed);
  });
});

describe('stepLocomotion: turning', () => {
  it('never snaps around: the heading changes by a limited amount per step', () => {
    const s = createLocomotionState(0);
    stepLocomotion(s, move(0, -1), tuning, DT);
    expect(Math.abs(s.heading)).toBeLessThanOrEqual(tuning.turnSpeedStanding * DT + 1e-9);
  });

  it('pivots quickly when slow and carves wider arcs at a run', () => {
    const standing = createLocomotionState(0);
    stepLocomotion(standing, move(1, 0), tuning, DT);

    const running = createLocomotionState(0);
    run(running, move(0, 1, { run: true }), 2);
    const before = running.heading;
    stepLocomotion(running, move(1, 0, { run: true }), tuning, DT);

    expect(Math.abs(standing.heading)).toBeGreaterThan(Math.abs(running.heading - before));
  });

  it('keeps full speed through gentle curves', () => {
    const s = createLocomotionState(0);
    run(s, move(0, 1, { run: true }), 2);
    stepLocomotion(s, move(Math.sin(0.3), Math.cos(0.3), { run: true }), tuning, DT);
    expect(s.targetSpeed).toBeCloseTo(tuning.runSpeed, 5);
  });

  it('reverses by braking, pivoting and going, never sliding backwards', () => {
    const s = createLocomotionState(0);
    run(s, FORWARD, 1);

    let minSpeed = Infinity;
    let acceleratedWhileFacingAway = false;
    for (let i = 0; i < 90; i++) {
      const before = s.speed;
      stepLocomotion(s, move(0, -1), tuning, DT);
      expect(s.speed).toBeGreaterThanOrEqual(0);
      minSpeed = Math.min(minSpeed, s.speed);
      // Still mostly facing the old direction (+z) but speeding up would mean charging the wrong way.
      if (Math.cos(s.heading) > 0.3 && s.speed > before + 1e-9) acceleratedWhileFacingAway = true;
    }
    expect(acceleratedWhileFacingAway).toBe(false);
    expect(minSpeed).toBeLessThan(tuning.trotSpeed * 0.3);
    expect(Math.abs(Math.abs(s.heading) - Math.PI)).toBeLessThan(1e-6);
    expect(s.speed).toBeCloseTo(tuning.trotSpeed, 5);
  });

  it('reports turn direction: positive when turning left', () => {
    const s = createLocomotionState(0);
    stepLocomotion(s, move(1, 1), tuning, DT); // toward +x = Moke's left when facing +z
    expect(s.turnRate).toBeGreaterThan(0);
  });
});

describe('gaitForSpeed', () => {
  it('classifies speeds into gaits', () => {
    expect(gaitForSpeed(0, tuning)).toBe('idle');
    expect(gaitForSpeed(tuning.walkSpeed, tuning)).toBe('walk');
    expect(gaitForSpeed(tuning.trotSpeed, tuning)).toBe('trot');
    expect(gaitForSpeed(tuning.runSpeed, tuning)).toBe('run');
  });
});
