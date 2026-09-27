import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { mulberry32 } from '../utils/random';
import { jointMatrix, jointPosition } from './humanIK';
import { createVisualState, HumanAnimationController } from './HumanAnimationController';
import { FOREARM_TO_PALM, HIP_ABOVE_SEAT, HIP_HEIGHT, HUMAN_JOINTS, type HumanPose } from './HumanRig';

const POSES: HumanPose[] = [
  'fold', 'idle', 'surprised', 'chase', 'lunge', 'stumble', 'shrug', 'search', 'peek', 'rummage', 'offer', 'take', 'place', 'tidy',
  'read', 'phone', 'watch', 'relax', 'sip', 'cook', 'prep', 'eat', 'fridge', 'pet', 'call', 'shoo', 'laugh', 'tug', 'windup', 'throw', 'point', 'cheer',
];

function run(animation: HumanAnimationController, state = createVisualState(), seconds = 1) {
  for (let i = 0; i < seconds * 60; i++) animation.update(1 / 60, state);
  return animation.state;
}

describe('HumanAnimationController', () => {
  it('gives every pose finite joint angles, standing and sitting', () => {
    for (const pose of POSES) {
      for (const sit of [0, 1]) {
        const a = new HumanAnimationController(mulberry32(1));
        const s = { ...createVisualState(), pose, sit };
        const out = run(a, s, 0.5);
        for (const j of HUMAN_JOINTS) {
          const r = out.joints[j];
          expect(Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.z), `${pose} ${sit} ${j}`).toBe(true);
        }
        expect(Number.isFinite(out.hipsY)).toBe(true);
      }
    }
  });

  it('lowers the hips onto the seat when sitting, and onto a knee when crouching', () => {
    const seated = run(new HumanAnimationController(), { ...createVisualState(), sit: 1, seatHeight: 0.46 }, 2);
    expect(seated.hipsY).toBeCloseTo(0.46 + HIP_ABOVE_SEAT, 2);
    expect(seated.joints.hipL.x).toBeLessThan(-1.3); // thighs forward
    expect(seated.joints.kneeL.x).toBeGreaterThan(1.2); // shins down
    const kneeling = run(new HumanAnimationController(), { ...createVisualState(), crouch: 1 }, 2);
    expect(kneeling.hipsY).toBeLessThan(HIP_HEIGHT - 0.35);
    const standing = run(new HumanAnimationController(), createVisualState(), 2);
    expect(standing.hipsY).toBeCloseTo(HIP_HEIGHT, 1);
  });

  it('swings the legs while walking and not while standing', () => {
    const a = new HumanAnimationController();
    const walking = { ...createVisualState(), speed: 1.05 };
    let most = 0;
    for (let i = 0; i < 120; i++) most = Math.max(most, Math.abs(a.update(1 / 60, walking).joints.hipL.x));
    expect(most).toBeGreaterThan(0.25);
    const still = run(new HumanAnimationController(), createVisualState(), 1);
    expect(Math.abs(still.joints.hipL.x)).toBeLessThan(0.05);
  });

  it('blinks every few seconds, opens the jaw to talk, and gasps when surprised', () => {
    const a = new HumanAnimationController(mulberry32(3));
    const s = createVisualState();
    let shut = 0;
    for (let i = 0; i < 7 * 60; i++) shut = Math.max(shut, a.update(1 / 60, s).face.lids);
    expect(shut).toBeGreaterThan(0.8);
    let open = 0;
    for (let i = 0; i < 60; i++) open = Math.max(open, a.update(1 / 60, { ...s, talking: true }).face.jawOpen);
    expect(open).toBeGreaterThan(0.2);
    const surprised = run(new HumanAnimationController(), { ...s, pose: 'surprised' }, 1);
    expect(surprised.face.jawOpen).toBeGreaterThan(0.5);
    expect(surprised.face.brows).toBeGreaterThan(0.8);
  });

  it('looks at things with the eyes first, the head helping', () => {
    const a = new HumanAnimationController();
    // A point 2 m away, 0.4 rad to their left and well below eye level (character space).
    const look = { x: Math.sin(0.4) * 2, y: 1.64 - Math.tan(0.3) * 2, z: Math.cos(0.4) * 2 };
    const out = run(a, { ...createVisualState(), look, lookWeight: 1 }, 1);
    expect(out.face.eyeYaw).toBeGreaterThan(0.1);
    expect(out.face.eyePitch).toBeLessThan(-0.05);
    expect(out.joints.neck.y + out.joints.head.y).toBeGreaterThan(0.05);
  });

  it('turns eyes, then head and neck, then upper body, with how much attention the moment has; never past the limits', () => {
    // Something well round to their left (1.5 rad), at eye height.
    const look = { x: Math.sin(1.5) * 2, y: 1.6, z: Math.cos(1.5) * 2 };
    const glance = run(new HumanAnimationController(mulberry32(3)), { ...createVisualState(), look, lookWeight: 0.3 }, 2);
    const full = run(new HumanAnimationController(mulberry32(3)), { ...createVisualState(), look, lookWeight: 1 }, 2);
    const headTurn = (s: typeof full) => s.joints.neck.y + s.joints.head.y;
    const torsoTurn = (s: typeof full) => s.joints.chest.y + s.joints.spine.y;
    // A glance: the eyes go all the way, the head some, the shoulders stay square to what they're doing.
    expect(glance.face.eyeYaw).toBeGreaterThan(0.2);
    expect(headTurn(glance)).toBeGreaterThan(0.2);
    expect(Math.abs(torsoTurn(glance))).toBeLessThan(0.02);
    // Full attention: more of the head, and the upper body helps.
    expect(headTurn(full)).toBeGreaterThan(headTurn(glance) + 0.3);
    expect(torsoTurn(full)).toBeGreaterThan(0.15);
    // Never an owl: the head and neck together stay within a human's reach, whatever the weight.
    for (const s of [glance, full]) expect(Math.abs(headTurn(s))).toBeLessThanOrEqual(1.0 + 0.1);
  });

  it('pets a small dog on his back from a kneel, with the hand on his side; the free arm never swings round behind', () => {
    for (const reach of [
      { x: 0.15, y: 0.3, z: 0.42 },
      { x: -0.2, y: 0.3, z: 0.4 },
    ]) {
      const out = run(new HumanAnimationController(mulberry32(5)), { ...createVisualState(), pose: 'pet', crouch: 1, reach }, 2);
      const hips = { x: out.hipsX, y: out.hipsY, z: out.hipsZ };
      const left = reach.x > 0;
      // The palm (a hand-length past the wrist) is on his back, patting: not hovering, not stretched.
      const palm = new Vector3(0, -FOREARM_TO_PALM, 0).applyMatrix4(jointMatrix(out.joints, hips, left ? 'elbowL' : 'elbowR', new Matrix4()));
      expect(palm.distanceTo(new Vector3(reach.x, reach.y, reach.z)), `palm at ${reach.x}`).toBeLessThan(0.08);
      // The free hand rests in front of the body, below the shoulder.
      const wrist = jointPosition(out.joints, hips, left ? 'wristR' : 'wristL', new Vector3());
      const shoulder = jointPosition(out.joints, hips, left ? 'shoulderR' : 'shoulderL', new Vector3());
      expect(wrist.z, `free hand in front at ${reach.x}`).toBeGreaterThan(hips.z + 0.05);
      expect(wrist.y).toBeLessThan(shoulder.y);
      // No arm wound round the long way (the far set of Euler angles would blend through nonsense).
      for (const j of [out.joints.shoulderL, out.joints.shoulderR]) expect(Math.max(Math.abs(j.y), Math.abs(j.z))).toBeLessThan(Math.PI * 0.75);
    }
  });

  it('holds what the activity asks for', () => {
    const a = new HumanAnimationController();
    expect(run(a, { ...createVisualState(), pose: 'read', prop: 'book' }, 0.1).prop).toBe('book');
    expect(run(a, { ...createVisualState(), prop: null }, 0.1).prop).toBeNull();
  });

  it('leans into tug-of-war with a low staggered stance and a visible pulling rhythm', () => {
    const a = new HumanAnimationController();
    const tug = { ...createVisualState(), pose: 'tug' as const, reach: { x: 0, y: 0.32, z: 0.58 } };
    let minHipsZ = Infinity;
    let maxHipsZ = -Infinity;
    let out = a.state;
    for (let i = 0; i < 2 / (1 / 60); i++) {
      out = a.update(1 / 60, tug);
      if (i > 30) {
        minHipsZ = Math.min(minHipsZ, out.hipsZ);
        maxHipsZ = Math.max(maxHipsZ, out.hipsZ);
      }
    }
    expect(out.joints.spine.x + out.joints.chest.x).toBeGreaterThan(0.4);
    expect(out.hipsY).toBeLessThan(HIP_HEIGHT - 0.02);
    expect(out.joints.hipL.x).toBeLessThan(-0.3);
    expect(out.joints.kneeL.x).toBeGreaterThan(0.35);
    expect(maxHipsZ - minHipsZ).toBeGreaterThan(0.015);
  });
});
