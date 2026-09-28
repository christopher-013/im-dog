import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
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
  it('rests ajar, opens as Moke comes in, stays open while he is inside, and goes back to ajar once he leaves', () => {
    const view = new BathroomView();
    expect(hold(view, 0.5, HALLWAY)).toBeCloseTo(BATHROOM_DOOR.ajar);
    expect(view.isOpen).toBe(false);

    expect(hold(view, 0.5, THRESHOLD)).toBeCloseTo(BATHROOM_DOOR.open);
    // Inside, anywhere in the room: it stays open.
    expect(hold(view, 1, INSIDE)).toBeCloseTo(BATHROOM_DOOR.open);
    expect(view.mokeInside).toBe(true);
    expect(view.isOpen).toBe(true);

    // Out again: back to ajar.
    expect(hold(view, 0.5, THRESHOLD)).toBeCloseTo(BATHROOM_DOOR.open);
    expect(hold(view, 0.5, HALLWAY)).toBeCloseTo(BATHROOM_DOOR.ajar);
    expect(view.mokeInside).toBe(false);
  });

  it('stays open while his toilet-paper trail runs out through it, and goes back to ajar once it is cleaned up', () => {
    const view = new BathroomView();
    const mouth = new Object3D();
    hold(view, 0.5, INSIDE);
    view.startPull(mouth, INSIDE);
    // He pulls the paper out into the hallway, and lets go there.
    for (const [x, z] of [[5.2, -0.4], [4.9, -0.2], [4.8, 0.15], [4.8, 0.55], [4.8, 1.0], [4.8, 1.4]] as const) {
      view.extendTrail(at(x, z));
      hold(view, 0.1, at(x, z));
    }
    view.releasePaper();
    expect(view.trailEndsOutside).toBe(true);
    expect(hold(view, 2, at(3.9, 1.1))).toBeCloseTo(BATHROOM_DOOR.open);
    // The human cleans it up bit by bit: still open until it's all gone.
    view.setCleanup(0.6);
    expect(hold(view, 1, at(3.9, 1.1))).toBeCloseTo(BATHROOM_DOOR.open);
    view.setCleanup(1);
    expect(hold(view, 1, at(3.9, 1.1))).toBeCloseTo(BATHROOM_DOOR.ajar);
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
