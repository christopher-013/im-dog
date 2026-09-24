import { BufferAttribute, CatmullRomCurve3, IcosahedronGeometry, Vector3, type BufferGeometry } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../utils/random';

export type Vec3Tuple = readonly [number, number, number];

/**
 * Per-vertex normal of the smooth, untufted shape. Toon shading lights fur by it, so each clump
 * shades as one clean form (like anime hair) while the tufts shape the silhouette and outline.
 */
export const SMOOTH_NORMAL = 'smoothNormal';

/** Per-vertex 0..1: how deep in a crease between curls/tufts. Toon shading darkens it a little (soft fur occlusion). */
export const FUR_CAVITY = 'furCavity';

export interface FurClumpOptions {
  /** Radii (x, y, z) of the smooth ellipsoid the tufts grow out of. */
  radii: Vec3Tuple;
  /** Surface resolution: segments per icosahedron edge. ~20 keeps tuft tips crisp. */
  detail: number;
  /** Deterministic seed, so every Moke looks the same. */
  seed: number;
  /** How many tufts are spread over the surface. */
  tufts: number;
  /** Tuft length, as a fraction of the mean radius. */
  length: number;
  /** Angular radius of each tuft's base (radians). */
  width: number;
  /** 0 = soft rounded clumps, 1 = pointed flame-like tips. */
  sharpness?: number;
  /** Random variation of tuft length, 0..1. */
  jitter?: number;
  /** Direction tuft tips sweep toward (e.g. down [0,-1,0]), and how far (fraction of the mean radius). */
  flow?: Vec3Tuple;
  flowAmount?: number;
  /** Per-direction tuft length multiplier (unit direction in), e.g. 0 to keep a face smooth. */
  shape?: (x: number, y: number, z: number) => number;
  /**
   * A second, finer layer of small rounded bumps on top of the tufts: the curly coat. `length` is a
   * fraction of the mean radius, `width` an angular radius; `shape` defaults to the tufts' shape.
   */
  curls?: { count: number; length: number; width: number; shape?: (x: number, y: number, z: number) => number };
}

type Shape = (x: number, y: number, z: number) => number;

/** Height (0..1) of the tallest bump covering unit direction `n`: 1 at a bump's centre, 0 at its edge. */
function bumpHeight(n: Vector3, centres: Vector3[], heights: number[], width: number, sharpness: number): number {
  const cosWidth = Math.cos(width);
  let h = 0;
  for (let t = 0; t < centres.length; t++) {
    const d = n.dot(centres[t]!);
    if (d <= cosWidth) continue;
    const u = Math.acos(Math.min(1, d)) / width; // 0 at the tip, 1 at the base
    const rounded = 1 - u * u;
    const pointed = (1 - u) * (1 - u);
    const bump = (rounded + (pointed - rounded) * sharpness) * heights[t]!;
    if (bump > h) h = bump;
  }
  return h;
}

/** Tuft centres spread evenly over the unit sphere (Fibonacci), nudged about so no pattern shows. */
function tuftCentres(count: number, rand: () => number): Vector3[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const centres: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const c = new Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring);
    c.x += (rand() - 0.5) * 0.25;
    c.y += (rand() - 0.5) * 0.25;
    c.z += (rand() - 0.5) * 0.25;
    centres.push(c.normalize());
  }
  return centres;
}

/**
 * A clump of stylized fur: a smooth ellipsoid covered in soft tufts (rounded, or pointed with
 * `sharpness`) whose tips sweep in the flow direction, optionally with a finer layer of curls on top.
 * Built from a dense icosphere so the silhouette reads as fluff rather than polygons.
 */
export function furClump(options: FurClumpOptions): BufferGeometry {
  const {
    radii,
    detail,
    seed,
    tufts,
    length,
    width,
    sharpness = 0.5,
    jitter = 0.35,
    flow,
    flowAmount = 0,
    shape,
    curls,
  } = options;
  const rand = mulberry32(seed);
  const centres = tuftCentres(tufts, rand);
  const lengths = centres.map(() => 1 - jitter * rand());
  const curlCentres = curls ? tuftCentres(curls.count, rand) : [];
  const curlHeights = curlCentres.map(() => 1 - 0.4 * rand());
  const curlShape: Shape | undefined = curls?.shape ?? shape;
  const meanRadius = (radii[0] + radii[1] + radii[2]) / 3;
  const flowDir = flow ? new Vector3(...flow).normalize() : null;

  const base = new IcosahedronGeometry(1, detail);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const geometry = mergeVertices(base);
  base.dispose();

  const positions = geometry.getAttribute('position');
  const smoothNormals = new Float32Array(positions.count * 3);
  const cavity = new Float32Array(positions.count);
  const n = new Vector3();
  const normal = new Vector3();
  const tangent = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    n.fromBufferAttribute(positions, i).normalize();

    // The tallest tuft covering this direction wins, so neighbours meet in soft creases.
    const tuftShape = shape ? Math.max(0, shape(n.x, n.y, n.z)) : 1;
    const tuft = bumpHeight(n, centres, lengths, width, sharpness);
    const h = tuft * tuftShape;
    let c = 0;
    // Creases: low between tufts and curls, none where the fur is kept short (e.g. the face).
    let crease = 0.35 * (1 - tuft) * Math.min(1, tuftShape);
    if (curls) {
      const curlShapeHere = curlShape ? Math.max(0, curlShape(n.x, n.y, n.z)) : 1;
      const curl = bumpHeight(n, curlCentres, curlHeights, curls.width, 0);
      c = curl * curls.length * curlShapeHere;
      crease += 0.65 * (1 - curl) * Math.min(1, curlShapeHere);
    }
    cavity[i] = Math.min(1, crease);

    // Surface point on the ellipsoid, pushed out along its normal; tips curl toward the flow.
    const px = n.x * radii[0];
    const py = n.y * radii[1];
    const pz = n.z * radii[2];
    normal.set(px / (radii[0] * radii[0]), py / (radii[1] * radii[1]), pz / (radii[2] * radii[2])).normalize();
    const lift = (h * length + c) * meanRadius;
    let fx = 0;
    let fy = 0;
    let fz = 0;
    if (flowDir) {
      tangent.copy(flowDir).addScaledVector(normal, -flowDir.dot(normal));
      const curl = h * h * flowAmount * meanRadius;
      fx = tangent.x * curl;
      fy = tangent.y * curl;
      fz = tangent.z * curl;
    }
    positions.setXYZ(i, px + normal.x * lift + fx, py + normal.y * lift + fy, pz + normal.z * lift + fz);
    normal.toArray(smoothNormals, i * 3);
  }
  geometry.computeVertexNormals();
  geometry.setAttribute(SMOOTH_NORMAL, new BufferAttribute(smoothNormals, 3));
  geometry.setAttribute(FUR_CAVITY, new BufferAttribute(cavity, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Where a direction from the centre meets a clump's untufted ellipsoid (the same mapping
 * `furClump` uses), and the surface normal there. For placing eyes, nose and blush on smooth fur.
 */
export function ellipsoidSurface(
  radii: Vec3Tuple,
  direction: Vec3Tuple,
  point = new Vector3(),
  normal = new Vector3(),
): { point: Vector3; normal: Vector3 } {
  const d = new Vector3(...direction).normalize();
  point.set(d.x * radii[0], d.y * radii[1], d.z * radii[2]);
  normal.set(point.x / (radii[0] * radii[0]), point.y / (radii[1] * radii[1]), point.z / (radii[2] * radii[2])).normalize();
  return { point, normal };
}

/**
 * Bends a fur clump built along the y axis (radii [r, halfLength, r]) onto a curve in the YZ plane: local y runs
 * along the curve from its first point to its last, and x/z become the cross-section, scaled by `thickness(t)`
 * (t = 0 at the start, 1 at the end). One continuous mesh, so a tail can't come apart. Fur that sticks out past
 * either end carries on along the end tangent. Smooth normals are bent too.
 */
export function bendAlongCurve(
  geometry: BufferGeometry,
  halfLength: number,
  points: readonly Vec3Tuple[],
  thickness: (t: number) => number,
): BufferGeometry {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  const length = curve.getLength();
  const binormal = new Vector3(1, 0, 0);
  const point = new Vector3();
  const tangent = new Vector3();
  const normal = new Vector3();
  const frame = (t: number) => {
    const u = Math.min(1, Math.max(0, t));
    curve.getPointAt(u, point);
    curve.getTangentAt(u, tangent);
    if (t !== u) point.addScaledVector(tangent, (t - u) * length);
    normal.crossVectors(binormal, tangent).normalize();
    return thickness(u);
  };

  const positions = geometry.getAttribute('position');
  const smooth = geometry.getAttribute(SMOOTH_NORMAL);
  const v = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    v.fromBufferAttribute(positions, i);
    const scale = frame((v.y + halfLength) / (2 * halfLength));
    positions.setXYZ(
      i,
      point.x + binormal.x * v.x * scale + normal.x * v.z * scale,
      point.y + binormal.y * v.x * scale + normal.y * v.z * scale,
      point.z + binormal.z * v.x * scale + normal.z * v.z * scale,
    );
    if (smooth) {
      v.fromBufferAttribute(smooth, i);
      const n = new Vector3().addScaledVector(binormal, v.x).addScaledVector(tangent, v.y).addScaledVector(normal, v.z).normalize();
      smooth.setXYZ(i, n.x, n.y, n.z);
    }
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
