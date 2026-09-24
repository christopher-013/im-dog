import { describe, expect, it } from 'vitest';
import { MoveBasis } from './MoveBasis';

describe('MoveBasis', () => {
  it('follows the camera while no movement key is held', () => {
    const basis = new MoveBasis();
    expect(basis.update(false, 1, 0)).toBe(1);
    expect(basis.update(false, 2, 0)).toBe(2);
  });

  it('holds steady against automatic camera motion while keys are held', () => {
    const basis = new MoveBasis();
    basis.update(true, 1, 0); // key goes down: capture
    expect(basis.update(true, 1.5, 0)).toBe(1); // camera swung by itself
    expect(basis.update(true, 2.5, 0)).toBe(1);
  });

  it("still follows the player's own mouse turns while keys are held", () => {
    const basis = new MoveBasis();
    basis.update(true, 1, 0);
    expect(basis.update(true, 1.2, 0.2)).toBeCloseTo(1.2);
  });

  it('re-syncs to the camera when the keys are released and pressed again', () => {
    const basis = new MoveBasis();
    basis.update(true, 1, 0);
    basis.update(true, 3, 0);
    basis.update(false, 3, 0);
    expect(basis.update(true, 3, 0)).toBe(3);
  });
});
