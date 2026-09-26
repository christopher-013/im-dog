import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../utils/random';
import { createVisualState, HumanAnimationController } from './HumanAnimationController';
import { HIP_ABOVE_SEAT, HIP_HEIGHT, HUMAN_JOINTS, type HumanPose } from './HumanRig';

const POSES: HumanPose[] = [
  'fold', 'idle', 'surprised', 'chase', 'lunge', 'stumble', 'shrug', 'search', 'peek', 'rummage', 'offer', 'take', 'place', 'tidy',
  'read', 'phone', 'watch', 'relax', 'sip', 'cook', 'prep', 'eat', 'fridge', 'pet', 'call', 'shoo', 'laugh', 'windup', 'throw', 'point', 'cheer',
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

  it('holds what the activity asks for', () => {
    const a = new HumanAnimationController();
    expect(run(a, { ...createVisualState(), pose: 'read', prop: 'book' }, 0.1).prop).toBe('book');
    expect(run(a, { ...createVisualState(), prop: null }, 0.1).prop).toBeNull();
  });
});
