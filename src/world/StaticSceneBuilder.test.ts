import { BoxGeometry, Mesh, MeshStandardMaterial, PlaneGeometry, PointLight } from 'three';
import { describe, expect, it } from 'vitest';
import { StaticSceneBuilder } from './StaticSceneBuilder';

const meshes = (group: ReturnType<StaticSceneBuilder['build']>) => group.children.filter((c): c is Mesh => c instanceof Mesh);

describe('StaticSceneBuilder', () => {
  it('merges parts that share a material into one mesh', () => {
    const b = new StaticSceneBuilder();
    const wood = new MeshStandardMaterial();
    const linen = new MeshStandardMaterial();
    b.add(new BoxGeometry(1, 1, 1), wood, [0, 0, 0]);
    b.add(new BoxGeometry(1, 1, 1), wood, [2, 0, 0]);
    b.add(new BoxGeometry(1, 1, 1), linen, [4, 0, 0]);
    b.add(new BoxGeometry(1, 1, 1), wood, [6, 0, 0], { cast: false }); // different shadow flags → own batch
    const group = b.build('test');
    expect(meshes(group)).toHaveLength(3);
    const merged = meshes(group).find((m) => m.material === wood && m.castShadow)!;
    expect(merged.geometry.getAttribute('position').count).toBe(72); // 2 boxes × 36 vertices (non-indexed)
  });

  it('derives box colliders from solid parts, through nested frames', () => {
    const b = new StaticSceneBuilder();
    b.at([10, 0, 0], Math.PI / 2, () => {
      b.add(new BoxGeometry(2, 1, 0.5), new MeshStandardMaterial(), [0, 0.5, 1], { solid: true });
    });
    const [box] = b.colliders;
    expect(box).toBeDefined();
    // Local (0, 0.5, 1) turned 90° about Y lands at (+1, 0.5, 0) relative to the frame.
    expect(box!.center[0]).toBeCloseTo(11);
    expect(box!.center[1]).toBeCloseTo(0.5);
    expect(box!.center[2]).toBeCloseTo(0);
    expect(box!.halfExtents).toEqual([1, 0.5, 0.25]);
    expect(Math.abs(box!.rotation[1])).toBeCloseTo(Math.SQRT1_2); // quaternion for a 90° Y turn
    expect(box!.blocksCamera).toBe(true);
  });

  it('marks thin parts so the camera ignores them, and adds bare colliders', () => {
    const b = new StaticSceneBuilder();
    b.add(new BoxGeometry(0.05, 0.4, 0.05), new MeshStandardMaterial(), [0, 0.2, 0], { thin: true });
    b.addCollider([1, 0.25, 0], [2, 0.5, 1]);
    expect(b.colliders[0]!.blocksCamera).toBe(false);
    expect(b.colliders[1]).toMatchObject({ center: [1, 0.25, 0], halfExtents: [1, 0.25, 0.5], blocksCamera: true });
  });

  it('keeps non-mergeable objects such as lights, placed in the current frame', () => {
    const b = new StaticSceneBuilder();
    b.at([3, 0, 0], 0, () => b.addObject(new PointLight(), [0, 2, 0]));
    const light = b.build('test').children.find((c) => c instanceof PointLight)!;
    expect(light.position.toArray()).toEqual([3, 2, 0]);
  });

  it('can map floor textures from world X/Z so separate pieces line up', () => {
    const b = new StaticSceneBuilder();
    const floor = new MeshStandardMaterial();
    b.add(new PlaneGeometry(2, 2), floor, [5, 0, 0], { rotation: [-Math.PI / 2, 0, 0], worldUV: 2 });
    const uv = meshes(b.build('test'))[0]!.geometry.getAttribute('uv');
    const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    expect(Math.min(...us)).toBeCloseTo(2); // x = 4 m / 2 m per tile
    expect(Math.max(...us)).toBeCloseTo(3); // x = 6 m
  });
});
