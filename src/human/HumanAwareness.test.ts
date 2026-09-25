import { describe, expect, it } from 'vitest';
import { HUMAN } from '../config/human';
import { canHear, canSee } from './HumanAwareness';

const origin = { x: 0, y: 0, z: 0 };
const open = () => true;
const wall = () => false;

describe('human awareness', () => {
  it('sees a dog in front of them, in range and in the open', () => {
    expect(canSee(origin, 0, HUMAN.sight.eyeHeight, { x: 0.5, y: 0, z: 3 }, open)).toBe(true);
  });

  it("doesn't see behind them, too far away, or through furniture", () => {
    expect(canSee(origin, 0, HUMAN.sight.eyeHeight, { x: 0, y: 0, z: -3 }, open)).toBe(false);
    expect(canSee(origin, 0, HUMAN.sight.eyeHeight, { x: 0, y: 0, z: HUMAN.sight.range + 1 }, open)).toBe(false);
    expect(canSee(origin, 0, HUMAN.sight.eyeHeight, { x: 0, y: 0, z: 3 }, wall)).toBe(false);
  });

  it('looks where their head points (a glance over the shoulder counts)', () => {
    expect(canSee(origin, Math.PI, HUMAN.sight.eyeHeight, { x: 0, y: 0, z: -3 }, open)).toBe(true);
  });

  it('always notices a dog right against their legs, but not one under a table', () => {
    expect(canSee(origin, 0, HUMAN.sight.eyeHeight, { x: 0, y: 0, z: -0.5 }, wall)).toBe(true);
    expect(canSee(origin, 0, HUMAN.sight.eyeHeight, { x: 0, y: 0, z: -0.5 }, wall, HUMAN.sight, false)).toBe(false);
  });

  it('checks the view from their eyes to his back (crouching lowers the eyes)', () => {
    const heights: number[] = [];
    canSee(origin, 0, HUMAN.sight.crouchEyeHeight, { x: 0, y: 0, z: 2 }, (from, to) => {
      heights.push(from.y, to.y);
      return true;
    });
    expect(heights).toEqual([HUMAN.sight.crouchEyeHeight, HUMAN.sight.targetHeight]);
  });

  it('hears barks across the room', () => {
    expect(canHear(origin, { x: 4, y: 0, z: 4 })).toBe(true);
    expect(canHear(origin, { x: 9, y: 0, z: 0 })).toBe(false);
  });
});
