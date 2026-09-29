import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, SkinnedMesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createVisualState, HumanAnimationController } from './HumanAnimationController';
import { COURIER_LOOK, StylizedHumanVisual } from './StylizedHumanVisual';

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

  /** A body mesh's rest-pose geometry (bound with identity bind matrices, so its positions are character space). */
  function meshNamed(visual: StylizedHumanVisual, name: string): SkinnedMesh {
    const mesh = visual.object.getObjectByName(`Human:${name}`);
    if (!(mesh instanceof SkinnedMesh)) throw new Error(`no ${name} mesh`);
    return mesh;
  }

  it('wears the shirt untucked over the jeans: no part of the jeans pokes out through it', () => {
    const visual = new StylizedHumanVisual();
    const shirt = new Mesh(meshNamed(visual, 'shirt').geometry, new MeshBasicMaterial({ side: DoubleSide }));
    const jeans = meshNamed(visual, 'jeans').geometry.getAttribute('position');
    const ray = new Raycaster();
    const p = new Vector3();
    const dir = new Vector3();
    let checked = 0;
    for (let i = 0; i < jeans.count; i++) {
      p.fromBufferAttribute(jeans, i);
      // Everything of the jeans above the shirt's tails, toward the front and back (the sleeves hang at the sides).
      if (p.y < 0.9 || Math.abs(p.x) > Math.abs(p.z) * 1.4) continue;
      dir.set(p.x, 0, p.z).normalize();
      ray.set(new Vector3(0, p.y, 0), dir);
      const hit = ray.intersectObject(shirt, false)[0];
      expect(hit, `a shirt round the jeans at ${p.toArray()}`).toBeDefined();
      expect(Math.hypot(p.x, p.z), `jeans inside the shirt at ${p.toArray()}`).toBeLessThan(hit!.distance - 0.002);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
    visual.dispose();
  });

  it('has jeans that are one garment: the legs meet down the middle of the seat, and nothing sits below the floor', () => {
    const visual = new StylizedHumanVisual();
    const jeans = meshNamed(visual, 'jeans').geometry.getAttribute('position');
    const p = new Vector3();
    let seamAtBack = Infinity;
    for (let i = 0; i < jeans.count; i++) {
      p.fromBufferAttribute(jeans, i);
      if (p.y > 0.86 && p.y < 0.98 && p.z < -0.06) seamAtBack = Math.min(seamAtBack, Math.abs(p.x));
    }
    // The inner sides of the two legs reach the middle: one continuous seat, no gap or separate buttocks.
    expect(seamAtBack).toBeLessThan(0.012);
    visual.object.traverse((o) => {
      if (!(o instanceof SkinnedMesh)) return;
      o.geometry.computeBoundingBox();
      expect(o.geometry.boundingBox!.min.y, o.name).toBeGreaterThan(-0.002);
    });
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
    const laundryState = { ...createVisualState(), pose: 'fold' as const, prop: 'laundry' as const };
    for (let i = 0; i < 30; i++) visual.apply(1 / 30, animation.update(1 / 30, laundryState));
    expect(visual.hands.right.getObjectByName('prop:laundry')?.visible).toBe(true);
    visual.dispose();
  });

  it('colours the hair from the look, and keeps the courier hair on under the cap', () => {
    const household = new StylizedHumanVisual();
    const courier = new StylizedHumanVisual(COURIER_LOOK);
    const hair = (visual: StylizedHumanVisual) => meshNamed(visual, 'hair').geometry;
    const reddest = (visual: StylizedHumanVisual) => {
      const color = hair(visual).getAttribute('color');
      let most = 0;
      for (let i = 0; i < color.count; i++) most = Math.max(most, color.getX(i));
      return most;
    };
    // The cap goes on over the hair, not instead of it.
    expect(hair(courier).getAttribute('position').count).toBeGreaterThan(hair(household).getAttribute('position').count);
    // Black hair stays black; the courier's auburn shows (brighter than any part of the brown cap).
    expect(reddest(household)).toBeLessThan(0.08);
    expect(reddest(courier)).toBeGreaterThan(0.18);
    household.dispose();
    courier.dispose();
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
