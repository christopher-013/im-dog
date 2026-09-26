import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FOREARM_TO_PALM, HIP_HEIGHT, HUMAN_JOINTS, UPPER_ARM } from './HumanRig';
import { jointMatrix, jointPosition, solveArm, type JointAngles } from './humanIK';

const zero = (): JointAngles => Object.fromEntries(HUMAN_JOINTS.map((j) => [j, { x: 0, y: 0, z: 0 }])) as JointAngles;
const hips = { x: 0, y: HIP_HEIGHT, z: 0 };

/** The middle of the palm for these angles (along the forearm from the elbow). */
function palm(angles: JointAngles, side: 'L' | 'R'): Vector3 {
  const m = jointMatrix(angles, hips, side === 'L' ? 'elbowL' : 'elbowR', new Matrix4());
  return new Vector3(0, -FOREARM_TO_PALM, 0).applyMatrix4(m);
}

describe('human IK', () => {
  it('puts the palm on a reachable target, elbow bent toward the pole', () => {
    for (const side of ['L', 'R'] as const) {
      const s = side === 'L' ? 1 : -1;
      for (const target of [new Vector3(s * 0.12, 1.15, 0.35), new Vector3(s * 0.3, 0.9, 0.25), new Vector3(0, 1.3, 0.3), new Vector3(s * 0.22, 0.95, 0.25)]) {
        const angles = zero();
        const miss = solveArm(angles, hips, side, target, new Vector3(s * 0.5, -0.6, -0.5));
        expect(miss).toBeLessThan(1e-6);
        expect(palm(angles, side).distanceTo(target), `${side} ${target.toArray()}`).toBeLessThan(0.005);
        // The elbow bends forward (never backward) and sits below and out from the reach line.
        expect(angles[side === 'L' ? 'elbowL' : 'elbowR'].x).toBeLessThanOrEqual(0);
        const elbow = jointPosition(angles, hips, side === 'L' ? 'elbowL' : 'elbowR', new Vector3());
        expect(elbow.x * s).toBeGreaterThan(0.05);
      }
    }
  });

  it('never stretches the arm: an out-of-reach target gets a straight arm pointing at it', () => {
    const angles = zero();
    const target = new Vector3(0.2, 0.3, 1.5);
    const miss = solveArm(angles, hips, 'L', target, new Vector3(0.5, -0.5, -0.5));
    expect(miss).toBeGreaterThan(0.5);
    expect(Math.abs(angles.elbowL.x)).toBeLessThan(0.15);
    const shoulder = jointPosition(angles, hips, 'shoulderL', new Vector3());
    expect(palm(angles, 'L').distanceTo(shoulder)).toBeCloseTo((UPPER_ARM + FOREARM_TO_PALM) * 0.998, 3);
  });
});
