import { BufferAttribute, Color, Vector3, type BufferGeometry } from 'three';
import type { CoatPatch, CoatRegion } from '../../config/dogLooks';
import { smoothstep } from '../../utils/math';
import { SMOOTH_NORMAL } from './furGeometry';

const HEIGHT_SOFT = 0.012;
const FRONT_SOFT = 0.15;

/**
 * Paints a coat region onto a fur geometry as vertex colours (the toon material multiplies its lit/shade colours by
 * them): the base colour, then each patch over it, with soft edges. Positions are in the part's own space, and the
 * direction of each vertex is its smooth (untufted) normal, so a patch covers whole curls rather than speckling.
 */
export function paintCoat(geometry: BufferGeometry, region: CoatRegion): BufferGeometry {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute(SMOOTH_NORMAL) ?? geometry.getAttribute('normal');
  const base = new Color(region.base);
  const patches = (region.patches ?? []).map((patch) => ({
    patch,
    color: new Color(patch.color),
    dir: patch.dir ? new Vector3(...patch.dir).normalize() : null,
    mirrored: patch.dir && patch.mirror ? new Vector3(-patch.dir[0], patch.dir[1], patch.dir[2]).normalize() : null,
  }));
  const colors = new Float32Array(positions.count * 3);
  const n = new Vector3();
  const c = new Color();
  for (let i = 0; i < positions.count; i++) {
    n.fromBufferAttribute(normals, i).normalize();
    const y = positions.getY(i);
    c.copy(base);
    for (const p of patches) {
      const w = patchWeight(p.patch, p.dir, p.mirrored, n, y);
      if (w > 0) c.lerp(p.color, w);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

/** 0..1: how much of `patch` covers a vertex facing `n` at height `y`. */
export function patchWeight(patch: CoatPatch, dir: Vector3 | null, mirrored: Vector3 | null, n: Vector3, y: number): number {
  let w = 1;
  if (dir) {
    const radius = patch.radius ?? 0.3;
    const soft = patch.soft ?? 0.08;
    const angle = Math.acos(Math.min(1, Math.max(-1, n.dot(dir))));
    let cover = 1 - smoothstep(radius - soft, radius + soft, angle);
    if (mirrored) {
      const other = Math.acos(Math.min(1, Math.max(-1, n.dot(mirrored))));
      cover = Math.max(cover, 1 - smoothstep(radius - soft, radius + soft, other));
    }
    w *= cover;
  }
  if (patch.below !== undefined) w *= 1 - smoothstep(patch.below - HEIGHT_SOFT, patch.below + HEIGHT_SOFT, y);
  if (patch.above !== undefined) w *= smoothstep(patch.above - HEIGHT_SOFT, patch.above + HEIGHT_SOFT, y);
  if (patch.front !== undefined) w *= smoothstep(patch.front - FRONT_SOFT, patch.front + FRONT_SOFT, n.z);
  return w;
}
