import { AdditiveAnimationBlendMode, Object3D, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../../config/movement';
import { MokeAnimationController, type MokeAnimationState } from '../MokeAnimationController';
import { CLIP_NAMES } from './clips';
import { GltfMokeVisual } from './GltfMokeVisual';
import { syntheticMoke } from './testing/syntheticMoke';

const DT = 1 / 60;

function pose(over: Partial<MokeAnimationState> = {}): MokeAnimationState {
  return { ...new MokeAnimationController().state, ...over };
}

/** Which way a node's +Z points, as a heading (radians, 0 = +Z). */
function headingOf(node: Object3D): number {
  const forward = new Vector3(0, 0, 1).applyQuaternion(node.getWorldQuaternion(new Quaternion()));
  return Math.atan2(forward.x, forward.z);
}

describe('GltfMokeVisual (a moke.glb that follows the spec)', () => {
  it('builds cleanly from a model that matches the spec', () => {
    const visual = new GltfMokeVisual(syntheticMoke());
    expect(visual.issues).toEqual([]);
    expect(visual.attachments.mouth.name).toBe('socket_mouth');
    expect(visual.attachments.collar?.name).toBe('socket_collar');
    expect(visual.attachments.back?.name).toBe('socket_back');
    visual.dispose();
  });

  it('reports what is missing or wrong instead of failing', () => {
    const visual = new GltfMokeVisual(syntheticMoke({ clips: ['idle', 'dance'], sockets: false, height: 1.2 }));
    const issues = visual.issues.join('\n');
    expect(issues).toMatch(/missing required clips: walk, trot, run/);
    expect(issues).toMatch(/unknown clip "dance"/);
    expect(issues).toMatch(/no "socket_mouth"/);
    expect(issues).toMatch(/standing height is 1\.20 m/);
    expect(visual.issues.length).toBe(4); // the bones and the blink morph are all there
    // Carrying still works through an estimated mouth, and it plays what it has.
    expect(visual.attachments.mouth).toBeTruthy();
    expect(() => visual.update(DT, pose({ speed: MOVEMENT.runSpeed, bark: 1, trick: 'spin', trickBlend: 1 }))).not.toThrow();
    visual.dispose();
  });

  it('refuses a model with no meshes (the game then uses the stand-in)', () => {
    expect(() => new GltfMokeVisual(syntheticMoke({ noMesh: true }))).toThrow(/no meshes/);
  });

  it('works without procedural bones, clips or sockets', () => {
    const visual = new GltfMokeVisual(syntheticMoke({ clips: [], bones: false, sockets: false }));
    expect(visual.issues.length).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) visual.update(DT, pose({ speed: 2, headYaw: 0.5, tailWag: 1, time: i * DT }));
    visual.dispose();
  });

  it("turns his head to glance at things in the model's own frame, whichever way he faces", () => {
    const visual = new GltfMokeVisual(syntheticMoke());
    const head = visual.object.getObjectByName('head')!;
    visual.object.rotation.y = 1; // facing somewhere else in the world
    visual.update(DT, pose({ headYaw: 0.5 }));
    expect(headingOf(head)).toBeCloseTo(1.5, 2);
    visual.dispose();
  });

  it("doesn't pile up procedural turns frame after frame", () => {
    const visual = new GltfMokeVisual(syntheticMoke());
    const head = visual.object.getObjectByName('head')!;
    for (let i = 0; i < 120; i++) visual.update(DT, pose({ headYaw: 0.3 }));
    expect(headingOf(head)).toBeCloseTo(0.3, 3);
    visual.dispose();
  });

  it('crossfades between gaits instead of snapping', () => {
    const visual = new GltfMokeVisual(syntheticMoke());
    const weight = (name: string) => visual['actions'].find((a) => a.name === name)!.weight;
    for (let i = 0; i < 90; i++) visual.update(DT, pose({ speed: 0 }));
    expect(weight('idle')).toBeGreaterThan(0.99);
    visual.update(DT, pose({ speed: MOVEMENT.runSpeed }));
    expect(weight('run')).toBeGreaterThan(0);
    expect(weight('run')).toBeLessThan(0.5); // eased in, not switched on
    for (let i = 0; i < 90; i++) visual.update(DT, pose({ speed: MOVEMENT.runSpeed }));
    expect(weight('run')).toBeGreaterThan(0.99);
    visual.dispose();
  });

  it('says which face controls are missing', () => {
    const issues = new GltfMokeVisual(syntheticMoke({ bones: false })).issues.join('\n');
    for (const missing of [/no "head" bone/, /no tail bones/, /no "jaw" bone/, /no ear bones/, /no "blink" morph/]) expect(issues).toMatch(missing);
  });

  it('ducks under low furniture: an additive duck clip on top of his gait, or a procedural dip without one', () => {
    const withClip = new GltfMokeVisual(syntheticMoke());
    const entry = (name: string) => withClip['actions'].find((a) => a.name === name)!;
    for (let i = 0; i < 90; i++) withClip.update(DT, pose({ speed: MOVEMENT.trotSpeed, crouch: 1 }));
    expect(entry('duck').action.blendMode).toBe(AdditiveAnimationBlendMode);
    expect(entry('duck').weight).toBeGreaterThan(0.99);
    expect(entry('trot').weight).toBeGreaterThan(0.99); // still trotting underneath
    withClip.dispose();

    const noClip = new GltfMokeVisual(syntheticMoke({ clips: CLIP_NAMES.filter((name) => name !== 'duck') }));
    const mouthHeight = (crouch: number): number => {
      noClip.update(DT, pose({ crouch }));
      return noClip.attachments.mouth.getWorldPosition(new Vector3()).y;
    };
    expect(mouthHeight(0) - mouthHeight(1)).toBeGreaterThan(0.02);
    noClip.dispose();
  });

  it('holds his head up a little while carrying something', () => {
    const visual = new GltfMokeVisual(syntheticMoke());
    const mouthHeight = (carry: number): number => {
      visual.update(DT, pose({ carry }));
      return visual.attachments.mouth.getWorldPosition(new Vector3()).y;
    };
    const empty = mouthHeight(0);
    expect(mouthHeight(1) - empty).toBeGreaterThan(0.005);
    visual.dispose();
  });

  it('plays a pickup moment when he picks something up', () => {
    const visual = new GltfMokeVisual(syntheticMoke());
    const weight = (name: string) => visual['actions'].find((a) => a.name === name)!.weight;
    visual.update(DT, pose({ carry: 0 }));
    for (let i = 0; i < 6; i++) visual.update(DT, pose({ carry: 1 }));
    expect(weight('pickup')).toBeGreaterThan(0.3);
    visual.dispose();
  });
});
