import { BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial, type PerspectiveCamera } from 'three';
import { SCENT_COLORS, SCENT_WISPS, SNIFF } from '../config/senses';
import type { Vec3Like } from '../physics/CharacterBody';
import type { ScentSystem } from './ScentSystem';

const VERTEX = /* glsl */ `
  attribute vec3 color;
  attribute float alpha;
  attribute float size;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uScale / max(0.05, -mv.z);
    vColor = color;
    // Fade out right in front of the lens, where a soft dot would fill the screen.
    vAlpha = alpha * smoothstep(0.35, 0.9, -mv.z);
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.0, 1.0, d);
    if (vAlpha * a < 0.004) discard;
    // A soft dot with a lighter heart, so it reads on both cream walls and dark wood.
    vec3 color = mix(vColor, vec3(1.0), (1.0 - d) * 0.35);
    gl_FragColor = vec4(color, vAlpha * a);
  }
`;

/** Cheap deterministic 0..1 hash, so each particle has its own fixed personality. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The look of sniff mode: soft, warm scent wisps curling up from each noticed source and leaning
 * toward Moke's nose, plus a gentle glow pulsing at the source. Stylized, not a scanner.
 *
 * One Points draw with a fixed particle budget. Every particle's position is a pure function of
 * time and its index, written straight into preallocated arrays: nothing is allocated per frame.
 * Depth-tested, so wisps never paint over Moke; they rise high enough to show above furniture.
 */
export class ScentWisps {
  readonly object: Points;
  private readonly material: ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly alphas: Float32Array;
  private readonly sizes: Float32Array;
  private readonly geometry = new BufferGeometry();
  private readonly perSource: number;
  private readonly color = new Color();
  private time = 0;

  constructor() {
    this.perSource = SCENT_WISPS.particlesPerSource + 1;
    const count = SNIFF.maxSources * this.perSource;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.alphas = new Float32Array(count);
    this.sizes = new Float32Array(count);
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('alpha', new BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute('size', new BufferAttribute(this.sizes, 1));
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
    });
    this.object = new Points(this.geometry, this.material);
    this.object.name = 'ScentWisps';
    this.object.frustumCulled = false;
    this.object.renderOrder = 10;
    this.object.visible = false;
  }

  /** Each rendered frame. `viewportHeight` is the drawing buffer height in pixels. */
  update(dt: number, scent: ScentSystem, nose: Vec3Like, camera: PerspectiveCamera, viewportHeight: number): void {
    this.time += dt;
    const shown = scent.hitsLength;
    this.object.visible = shown > 0;
    if (!this.object.visible) return;
    // World size → pixels: half the viewport height over tan(fov / 2).
    this.material.uniforms.uScale!.value = (viewportHeight * 0.5) / Math.tan((camera.fov * Math.PI) / 360);

    const w = SCENT_WISPS;
    const per = this.perSource;
    for (let h = 0; h < SNIFF.maxSources; h++) {
      const base = h * per;
      if (h >= shown) {
        this.alphas.fill(0, base, base + per);
        continue;
      }
      const hit = scent.hitAt(h);
      const src = hit.source.position;
      this.color.set(SCENT_COLORS[hit.source.category]);
      const strength = hit.intensity;
      const tx = (nose.x - src.x) * w.leanToNose;
      const tz = (nose.z - src.z) * w.leanToNose;
      const seedBase = hashId(hit.source.id);

      // The pulse: a big soft glow at the source that breathes.
      this.write(base, src.x, src.y + 0.04, src.z, w.pulseSize * (0.8 + 0.2 * Math.sin(this.time * 3 + seedBase)), strength * 0.35);

      for (let i = 1; i < per; i++) {
        const seed = seedBase + i * 7.31;
        const life = (this.time / w.life + hash(seed)) % 1;
        const swirl = this.time * (0.8 + hash(seed + 1)) + hash(seed + 2) * 6.28;
        const spread = 0.03 + 0.05 * hash(seed + 3);
        const ease = life * life * (3 - 2 * life);
        const x = src.x + Math.cos(swirl) * spread + tx * ease + Math.sin(life * 9 + seed) * w.wobble * life;
        const z = src.z + Math.sin(swirl) * spread + tz * ease + Math.cos(life * 7 + seed) * w.wobble * life;
        const y = src.y + 0.02 + life * w.rise * (0.6 + 0.4 * hash(seed + 4));
        // Fade in quickly, out slowly.
        const fade = Math.min(1, life * 6) * (1 - life) * (1 - life);
        this.write(base + i, x, y, z, w.size * (0.7 + 0.6 * hash(seed + 5)) * (1 + life), strength * fade * w.maxAlpha);
      }
    }
    for (const name of ['position', 'color', 'alpha', 'size'] as const) this.geometry.getAttribute(name).needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.object.removeFromParent();
  }

  private write(i: number, x: number, y: number, z: number, size: number, alpha: number): void {
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.colors[i * 3] = this.color.r;
    this.colors[i * 3 + 1] = this.color.g;
    this.colors[i * 3 + 2] = this.color.b;
    this.alphas[i] = alpha;
    this.sizes[i] = size;
  }
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return h;
}
