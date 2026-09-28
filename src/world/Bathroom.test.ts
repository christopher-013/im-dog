import { describe, expect, it } from 'vitest';
import { BATHROOM_DOOR } from '../config/bathroom';
import { BathroomView } from './Bathroom';
import { BATHROOM, HALL } from './home/layout';

const DT = 1 / 60;
const at = (x: number, z: number) => ({ x, y: 0, z });
const HALLWAY = at(BATHROOM.doorway.x, HALL.zMin + 0.55);
const THRESHOLD = at(BATHROOM.doorway.x, HALL.zMin - 0.05);
const INSIDE = at(BATHROOM.paperApproach.x, BATHROOM.paperApproach.z);

/** Runs the door for `seconds` with Moke (and maybe the human) standing where given; returns the door angle. */
function hold(view: BathroomView, seconds: number, moke: ReturnType<typeof at>, human: ReturnType<typeof at> | null = null): number {
  for (let t = 0; t < seconds; t += DT) view.update(DT, moke, human);
  return view.doorAngle;
}

describe('hall bathroom door', () => {
  it('rests ajar, opens while Moke walks through, and swings back to ajar once he is through, either way', () => {
    const view = new BathroomView();
    expect(hold(view, 0.5, HALLWAY)).toBeCloseTo(BATHROOM_DOOR.ajar);
    expect(view.isOpen).toBe(false);

    // Walking in: open at the threshold…
    expect(hold(view, 0.5, THRESHOLD)).toBeCloseTo(BATHROOM_DOOR.open);
    expect(view.isOpen).toBe(true);
    // …and back to ajar once he's inside.
    expect(hold(view, 0.5, INSIDE)).toBeCloseTo(BATHROOM_DOOR.ajar);
    expect(view.mokeInside).toBe(true);

    // Walking out: open again at the threshold, ajar once he's back in the hallway.
    expect(hold(view, 0.5, THRESHOLD)).toBeCloseTo(BATHROOM_DOOR.open);
    expect(hold(view, 0.5, HALLWAY)).toBeCloseTo(BATHROOM_DOOR.ajar);
    expect(view.mokeInside).toBe(false);
  });

  it("doesn't open for Moke trotting along the hallway past it", () => {
    const view = new BathroomView();
    for (let x = HALL.x0 + 0.3; x < HALL.x1 - 0.3; x += 0.05) view.update(DT, at(x, (HALL.zMin + HALL.zMax) / 2));
    expect(view.isOpen).toBe(false);
  });

  it('opens for the human walking through too', () => {
    const view = new BathroomView();
    expect(hold(view, 0.5, HALLWAY, THRESHOLD)).toBeCloseTo(BATHROOM_DOOR.open);
    expect(hold(view, 0.5, HALLWAY, HALLWAY)).toBeCloseTo(BATHROOM_DOOR.ajar);
  });

  it('is ajar again after a reset', () => {
    const view = new BathroomView();
    hold(view, 0.5, THRESHOLD);
    view.reset();
    expect(view.isOpen).toBe(false);
    expect(hold(view, 0, HALLWAY)).toBeCloseTo(BATHROOM_DOOR.ajar);
  });
});
