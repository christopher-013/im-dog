import { SkinnedMesh } from 'three';
import { describe, expect, it } from 'vitest';
import { createVisualState, HumanAnimationController } from './HumanAnimationController';
import { StylizedHumanVisual } from './StylizedHumanVisual';

describe('StylizedHumanVisual', () => {
  it('is one skinned body: a mesh per material sharing a single skeleton, a dozen or so draw calls', () => {
    const visual = new StylizedHumanVisual();
    const skinned: SkinnedMesh[] = [];
    visual.object.traverse((o) => {
      if (o instanceof SkinnedMesh) skinned.push(o);
    });
    expect(skinned.length).toBeGreaterThan(8);
    expect(skinned.length).toBeLessThanOrEqual(18);
    const skeleton = skinned[0]!.skeleton;
    for (const mesh of skinned) expect(mesh.skeleton).toBe(skeleton);
    // Outlines share their body mesh's geometry: count each geometry once.
    let triangles = 0;
    for (const geometry of new Set(skinned.map((mesh) => mesh.geometry))) triangles += geometry.getAttribute('position').count / 3;
    expect(triangles).toBeLessThan(25_000);
    visual.dispose();
  });

  it('has hands to hold things, and poses from the animation without errors', () => {
    const visual = new StylizedHumanVisual();
    expect(visual.hands.left.parent).not.toBeNull();
    expect(visual.hands.right.parent).not.toBeNull();
    const animation = new HumanAnimationController();
    const state = { ...createVisualState(), pose: 'read' as const, prop: 'book' as const, sit: 1 };
    for (let i = 0; i < 30; i++) visual.apply(1 / 30, animation.update(1 / 30, state));
    const book = visual.hands.right.getObjectByName('prop:book');
    expect(book?.visible).toBe(true);
    for (let i = 0; i < 5; i++) visual.apply(1 / 30, animation.update(1 / 30, { ...state, prop: null }));
    expect(book?.visible).toBe(false);
    visual.dispose();
  });

  it('fades to see-through and back', () => {
    const visual = new StylizedHumanVisual();
    const animation = new HumanAnimationController();
    const pose = animation.update(0, createVisualState());
    visual.setSeeThrough(true);
    for (let i = 0; i < 60; i++) visual.apply(1 / 60, pose);
    let mesh: SkinnedMesh | undefined;
    visual.object.traverse((o) => {
      if (!mesh && o instanceof SkinnedMesh) mesh = o;
    });
    const material = mesh!.material as { transparent: boolean; opacity: number };
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeLessThan(0.4);
    visual.setSeeThrough(false);
    for (let i = 0; i < 90; i++) visual.apply(1 / 60, pose);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    visual.dispose();
  });
});
