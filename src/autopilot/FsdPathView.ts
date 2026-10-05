import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, ShaderMaterial, Vector3 } from 'three';
import { FSD_PATH } from '../config/autopilot';
import type { Point2 } from '../human/NavGrid';

/**
 * The rainbow path FSD draws on the floor ahead of Moke while it drives (owner request, 2026-10-05: like the path a
 * self-driving car's screen shows): a soft, translucent ribbon from his paws along the route he's about to take,
 * like the rainbow road on a self-driving car's screen: a solid ribbon whose colours run through the rainbow along its
 * length and keep flowing forward, a soft sheen rolling over it, fading out at the far end.
 * Drawing only: it reads FSD's trail (FullSelfDog.trail) and knows nothing else.
 */
export class FsdPathView {
  readonly mesh: Mesh;
  private readonly geometry = new BufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly uvs: Float32Array;
  private readonly points: Vector3[] = [];
  private readonly samples: { x: number; z: number; s: number }[] = [];
  private opacity = 0;
  private time = 0;

  constructor(private readonly tuning = FSD_PATH) {
    const n = tuning.maxSamples;
    this.positions = new Float32Array(n * 2 * 3);
    this.uvs = new Float32Array(n * 2 * 2);
    const index: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry.setIndex(index);
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('uv', new BufferAttribute(this.uvs, 2));
    this.geometry.setDrawRange(0, 0);
    this.material = new ShaderMaterial({
      name: 'fsdPath',
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      uniforms: { time: { value: 0 }, length: { value: 1 }, opacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float time;
        uniform float length;
        uniform float opacity;
        varying vec2 vUv;
        vec3 hsv2rgb(vec3 c) {
          vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
          return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
        }
        void main() {
          float s = vUv.x;                      // metres along, from his paws
          float across = abs(vUv.y - 0.5) * 2.0; // 0 down the middle, 1 at the edges
          // A solid road: crisp edges (just softened), from under him to a fade at the far end.
          float edge = 1.0 - smoothstep(0.82, 1.0, across);
          float ends = smoothstep(0.0, 0.2, s) * (1.0 - smoothstep(length - 1.8, length, s));
          // The rainbow along its length, flowing forward the whole time.
          vec3 col = hsv2rgb(vec3(fract(s * 0.2 - time * 0.4), 0.82, 1.0));
          // A soft sheen rolling forward over it.
          float sheen = 0.5 + 0.5 * sin((s - time * 2.2) * 2.6);
          float a = opacity * ends * edge;
          gl_FragColor = vec4(col * (0.88 + 0.18 * sheen), a);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'FSD path';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  /**
   * Each rendered frame. `from`: where Moke is; `trail`: the route ahead (nearest first), or null when FSD isn't
   * driving. Fades in and out rather than popping.
   */
  update(dt: number, from: { x: number; y: number; z: number } | null, trail: readonly Point2[] | null): void {
    this.time += dt;
    const show = !!from && !!trail && trail.length > 0;
    if (show) this.build(from, trail);
    this.opacity += ((show ? 1 : 0) - this.opacity) * Math.min(1, dt * this.tuning.fadeRate);
    this.mesh.visible = this.opacity > 0.01 && this.geometry.drawRange.count > 0;
    this.material.uniforms.time!.value = this.time;
    this.material.uniforms.opacity!.value = this.opacity * this.tuning.opacity;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  /** The ribbon along Moke → the trail, rounded off at the corners and cut at `maxLength` metres. */
  private build(from: { x: number; y: number; z: number }, trail: readonly Point2[]): void {
    const t = this.tuning;
    // The corner points, his paws first, skipping any right on top of each other.
    const pts = this.points;
    pts.length = 0;
    pts.push(new Vector3(from.x, 0, from.z));
    for (const p of trail) {
      const last = pts[pts.length - 1]!;
      if (Math.hypot(p.x - last.x, p.z - last.z) > 0.05) pts.push(new Vector3(p.x, 0, p.z));
    }
    if (pts.length < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }
    // Sample along it (cutting each corner with a short curve), every `step` m, up to `maxLength`.
    const samples = this.samples;
    samples.length = 0;
    let s = 0;
    const push = (x: number, z: number) => {
      const prev = samples[samples.length - 1];
      const next = prev ? s + Math.hypot(x - prev.x, z - prev.z) : 0;
      // Never longer than `maxLength` (the far end is cut, and fades).
      if (next > t.maxLength || samples.length >= t.maxSamples) return;
      s = next;
      samples.push({ x, z, s });
    };
    push(pts[0]!.x, pts[0]!.z);
    for (let i = 1; i < pts.length && s < t.maxLength && samples.length < t.maxSamples; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const c = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const cut = c ? Math.min(t.cornerCut, len / 2, Math.hypot(c.x - b.x, c.z - b.z) / 2) : 0;
      // Straight along a→b, stopping `cut` short of the corner…
      const straight = len - cut;
      for (let d = t.step; d < straight && s < t.maxLength && samples.length < t.maxSamples; d += t.step) {
        push(a.x + ((b.x - a.x) * d) / len, a.z + ((b.z - a.z) * d) / len);
      }
      if (!c || cut <= 0) {
        push(b.x, b.z);
        continue;
      }
      // …then a quadratic curve round it to `cut` along b→c.
      const lc = Math.hypot(c.x - b.x, c.z - b.z);
      const p0 = { x: b.x - ((b.x - a.x) * cut) / len, z: b.z - ((b.z - a.z) * cut) / len };
      const p2 = { x: b.x + ((c.x - b.x) * cut) / lc, z: b.z + ((c.z - b.z) * cut) / lc };
      for (let k = 1; k <= 4; k++) {
        const u = k / 4;
        const x = (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * b.x + u * u * p2.x;
        const z = (1 - u) * (1 - u) * p0.z + 2 * (1 - u) * u * b.z + u * u * p2.z;
        push(x, z);
      }
      // The next straight starts from the end of the curve.
      pts[i] = new Vector3(p2.x, 0, p2.z);
    }
    // The ribbon: two edges either side of each sample, across its direction there.
    const n = Math.min(samples.length, t.maxSamples);
    const half = t.width / 2;
    for (let i = 0; i < n; i++) {
      const p = samples[i]!;
      const q = samples[Math.min(n - 1, i + 1)]!;
      const o = samples[Math.max(0, i - 1)]!;
      let dx = q.x - o.x;
      let dz = q.z - o.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d;
      dz /= d;
      // Left (−) and right (+) of the way ahead.
      for (const [side, v] of [[-1, 0], [1, 1]] as const) {
        const k = (i * 2 + v) * 3;
        this.positions[k] = p.x + dz * half * side;
        this.positions[k + 1] = t.height;
        this.positions[k + 2] = p.z - dx * half * side;
        const u = (i * 2 + v) * 2;
        this.uvs[u] = p.s;
        this.uvs[u + 1] = v;
      }
    }
    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.uv!.needsUpdate = true;
    this.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
    this.material.uniforms.length!.value = samples[n - 1]!.s;
  }
}
