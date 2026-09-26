import {
  BackSide,
  Bone,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  Object3D,
  Raycaster,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOKE_LOOK } from '../config/mokeLook';
import { createToonMaterial } from '../player/toon/toonMaterials';
import { lerp, smoothstep } from '../utils/math';
import { createHumanPropViews, type HumanPropViews } from './humanProps';
import { HUMAN_JOINTS, HUMAN_SKELETON, JOINT_ORDER, type HumanAnimationState, type HumanJoint } from './HumanRig';

/** The human's look, kept apart from behaviour so a modelled character could replace it (see HumanRig). */
export interface HumanVisual {
  readonly object: Object3D;
  /** Where held items go (the middle of each palm): the sock (left) and the treat or a toy (right). */
  readonly hands: { readonly left: Object3D; readonly right: Object3D };
  /** Fade toward see-through (they're between the camera and Moke) or back to solid. */
  setSeeThrough(on: boolean): void;
  /** Poses the body for this frame (from HumanAnimationController). */
  apply(dt: number, pose: HumanAnimationState): void;
  dispose(): void;
}

/** Display colours (the toon materials skip tone mapping, like Moke's), baked into each part's vertices. */
const COLORS = {
  skin: '#d9a27c',
  lips: '#bf7e6e',
  hair: '#221d1f',
  hairSheen: '#3b3438',
  brow: '#231d1d',
  shirt: '#f7f5f0',
  shirtRib: '#e9e5dd',
  denim: '#557399',
  denimSeam: '#7892b6',
  // The other sock of the pair Moke keeps stealing (see propVisuals: the same charcoal and grey).
  sock: '#34373d',
  sockStripe: '#9ca3ad',
  eyeWhite: '#fbf7f1',
  iris: '#3b2519',
  pupil: '#0f0a09',
  catchLight: '#ffffff',
  lash: '#1c1617',
  mouth: '#6e302c',
  teeth: '#fbf6ef',
};

/** The shaded side of each material, as a tint on its colour (the white shirt shades like Moke's white fur). */
const SHADE = {
  skin: '#dcb3a6',
  face: '#dcc4c0',
  hair: '#c4bac2',
  shirt: MOKE_LOOK.palette.furShade,
  jeans: '#c6c0d0',
  sock: '#c6c0d0',
};
type MaterialName = keyof typeof SHADE;
/** Materials that get Moke's thin silhouette line (the face details sit inside the head's). */
const OUTLINED: readonly MaterialName[] = ['skin', 'hair', 'shirt', 'jeans', 'sock'];

/** Extra bones beyond the rig's joints: the face (moved by `apply`, not by HumanAnimationController joints). */
type FaceBone = 'jaw' | 'eyeL' | 'eyeR' | 'lidL' | 'lidR' | 'lashL' | 'lashR' | 'browL' | 'browR' | 'smile';
type BoneName = HumanJoint | FaceBone;
/** One bone, or a weight function over the vertex position (character space) returning [bone, weight] pairs. */
type Bind = BoneName | ((p: Vector3) => [BoneName, number][]);

/** A piece of the body before merging: geometry in character space (rest pose), its material and colour, how it bends. */
interface Part {
  geometry: BufferGeometry;
  material: MaterialName;
  color: string;
  bind: Bind;
}

/**
 * The human (Phase 4, redesigned in the quality pass): a stylized, animated-film-style adult man built in code
 * (original, no files). Warm tan skin, short black hair with a soft side-swept fringe, a plain white T-shirt, blue
 * jeans, and one striped sock (Moke has the other). Drawn with Moke's own soft toon shading and thin silhouette line.
 *
 * One skinned body on the HumanRig skeleton: every part is built in the rest pose, weighted to its bones (smooth
 * blends at the waist, shoulders, elbows, knees and neck), and merged into one mesh per material with its colours
 * baked into the vertices: six meshes plus five outlines for the whole person. Face bones move the eyes, lids,
 * brows and mouth.
 */
export class StylizedHumanVisual implements HumanVisual {
  readonly object = new Group();
  readonly hands: { left: Object3D; right: Object3D };

  private readonly bones = new Map<BoneName, Bone>();
  private readonly rest = new Map<BoneName, Vector3>();
  private readonly materials: MeshToonMaterial[] = [];
  private readonly outlines: ShaderMaterial[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly textures: CanvasTexture[] = [];
  private readonly props: HumanPropViews;
  private opacity = 1;
  private seeThrough = false;
  private readonly handL = new Vector3();
  private readonly handR = new Vector3();
  private readonly eyes = new Vector3();

  constructor() {
    this.object.name = 'Human';
    const root = this.buildSkeleton();
    this.object.add(root);
    root.updateMatrixWorld(true);
    this.buildMeshes([...torso(), ...arms(), ...legs(), ...head(), ...hands()]);
    // The skeleton is bound in the rest pose (lids shut, scale 1); open the eyes to their resting look.
    for (const side of ['L', 'R'] as const) this.bones.get(`lid${side}`)!.scale.y = LID.open;
    this.hands = { left: this.anchor('wristL', 0, -0.075, 0.01), right: this.anchor('wristR', 0, -0.075, 0.01) };
    this.props = createHumanPropViews();
    this.hands.right.add(this.props.right);
    this.hands.left.add(this.props.left);
  }

  apply(dt: number, pose: HumanAnimationState): void {
    for (const joint of HUMAN_JOINTS) {
      const a = pose.joints[joint];
      this.bones.get(joint)!.rotation.set(a.x, a.y, a.z);
    }
    this.bones.get('hips')!.position.set(pose.hipsX, pose.hipsY, pose.hipsZ);

    const f = pose.face;
    const open = Math.max(0.01, f.jawOpen);
    this.bones.get('jaw')!.scale.set((0.75 + f.mouthWide * 0.5) * Math.min(1, open * 4), open, Math.min(1, open * 4));
    const closed = 1 - Math.min(1, f.jawOpen * 3);
    const smile = this.bones.get('smile')!;
    smile.scale.set(0.8 + f.smile * 0.35, (0.2 + f.smile * 0.85) * Math.max(0.15, closed), 1);
    smile.visible = closed > 0.05;
    // The irises slide across the eyes (flat, toon-style eyes); the upper lids come down from the top of each eye.
    const lid = LID.open + f.lids * (1 - LID.open);
    const lookX = Math.max(-1, Math.min(1, f.eyeYaw / 0.3)) * EYE_SHIFT.x;
    const lookY = Math.max(-1, Math.min(1, f.eyePitch / 0.3)) * EYE_SHIFT.y;
    for (const side of ['L', 'R'] as const) {
      const eye = this.bones.get(`eye${side}`)!;
      const rest = this.rest.get(`eye${side}`)!;
      eye.position.set(rest.x + lookX, rest.y + lookY, rest.z);
      this.bones.get(`lid${side}`)!.scale.y = lid;
      const lash = this.bones.get(`lash${side}`)!;
      lash.position.y = this.rest.get(`lash${side}`)!.y - (lid - LID.open) * EYE.lid.y * 2 * 0.92;
      const brow = this.bones.get(`brow${side}`)!;
      brow.position.y = this.rest.get(`brow${side}`)!.y + f.brows * 0.011;
      brow.rotation.z = (side === 'L' ? -1 : 1) * f.brows * 0.14;
    }
    this.props.show(pose.prop);
    if (pose.prop === 'book') {
      this.object.updateMatrixWorld(true);
      this.hands.left.getWorldPosition(this.handL);
      this.hands.right.getWorldPosition(this.handR);
      this.bones.get('head')!.getWorldPosition(this.eyes);
      this.props.holdBook(this.handL, this.handR, this.eyes);
    }
    this.fade(dt);
  }

  setSeeThrough(on: boolean): void {
    this.seeThrough = on;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const m of this.outlines) m.dispose();
    for (const t of this.textures) t.dispose();
    this.props.dispose();
    this.object.removeFromParent();
  }

  private buildSkeleton(): Bone {
    const make = (name: BoneName, parent: Bone | null, at: readonly [number, number, number]) => {
      const bone = new Bone();
      bone.name = name;
      bone.position.set(at[0], at[1], at[2]);
      parent?.add(bone);
      this.bones.set(name, bone);
      this.rest.set(name, bone.position.clone());
      return bone;
    };
    for (const joint of HUMAN_JOINTS) {
      const def = HUMAN_SKELETON[joint];
      const bone = make(joint, def.parent ? this.bones.get(def.parent)! : null, def.at);
      // The same Euler orders the animation and IK use (HumanRig), so the angles mean the same thing here.
      bone.rotation.order = JOINT_ORDER[joint] ?? 'XYZ';
    }
    const head = this.bones.get('head')!;
    make('jaw', head, [0, MOUTH.y - 0.002, MOUTH.z - 0.002]);
    make('smile', head, [0, MOUTH.y + 0.004, MOUTH.z + 0.002]);
    for (const [s, side] of [
      [1, 'L'],
      [-1, 'R'],
    ] as const) {
      make(`eye${side}`, head, [s * EYE.x, EYE.y, EYE.z]);
      // The lid scales down from the top of the eye; the lash line rides its lower edge.
      make(`lid${side}`, head, [s * EYE.x, EYE.y + EYE.lid.y, EYE.z]);
      make(`lash${side}`, head, [s * EYE.x, EYE.y + EYE.lid.y - LID.open * EYE.lid.y * 2 * 0.92, EYE.z]);
      make(`brow${side}`, head, [s * EYE.x, EYE.y + BROW_ABOVE_EYE, BROW_Z]);
    }
    return this.bones.get('hips')!;
  }

  /** Merges the parts per material into skinned meshes sharing one skeleton; each outline shares its body's geometry. */
  private buildMeshes(parts: Part[]): void {
    const order: BoneName[] = [...this.bones.keys()];
    const index = new Map(order.map((name, i) => [name, i]));
    const skeleton = new Skeleton(order.map((name) => this.bones.get(name)!));
    const byMaterial = new Map<MaterialName, BufferGeometry[]>();
    const p = new Vector3();
    const color = new Color();
    for (const part of parts) {
      const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
      if (g !== part.geometry) part.geometry.dispose();
      const position = g.getAttribute('position');
      if (!g.getAttribute('uv')) g.setAttribute('uv', new BufferAttribute(new Float32Array(position.count * 2), 2));
      const skinIndex = new Uint16Array(position.count * 4);
      const skinWeight = new Float32Array(position.count * 4);
      const colors = new Float32Array(position.count * 3);
      color.set(part.color);
      for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position, i);
        const weights = typeof part.bind === 'function' ? part.bind(p) : [[part.bind, 1] as [BoneName, number]];
        const n = Math.min(4, weights.length);
        let total = 0;
        for (let k = 0; k < n; k++) total += weights[k]![1];
        for (let k = 0; k < n; k++) {
          skinIndex[i * 4 + k] = index.get(weights[k]![0])!;
          skinWeight[i * 4 + k] = weights[k]![1] / (total || 1);
        }
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      g.setAttribute('skinIndex', new BufferAttribute(skinIndex, 4));
      g.setAttribute('skinWeight', new BufferAttribute(skinWeight, 4));
      g.setAttribute('color', new BufferAttribute(colors, 3));
      for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name);
      const list = byMaterial.get(part.material) ?? [];
      list.push(g);
      byMaterial.set(part.material, list);
    }
    for (const [name, geometries] of byMaterial) {
      const merged = mergeGeometries(geometries, false);
      if (!merged) throw new Error(`Could not build the human's ${name} mesh`);
      for (const g of geometries) g.dispose();
      this.geometries.push(merged);
      const material = createToonMaterial('#ffffff', SHADE[name]);
      material.vertexColors = true;
      if (name === 'jeans') {
        const denim = denimTexture();
        if (denim) {
          material.map = denim;
          this.textures.push(denim);
        }
      }
      this.materials.push(material);
      const mesh = new SkinnedMesh(merged, material);
      mesh.name = `Human:${name}`;
      mesh.bind(skeleton, new Matrix4());
      mesh.castShadow = name !== 'face';
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.object.add(mesh);
      if (MOKE_LOOK.outline.enabled && OUTLINED.includes(name)) {
        const outline = createSkinnedOutlineMaterial();
        this.outlines.push(outline);
        const line = new SkinnedMesh(merged, outline);
        line.name = `Human:${name}:outline`;
        line.bind(skeleton, new Matrix4());
        line.frustumCulled = false;
        line.onBeforeRender = (renderer: WebGLRenderer) => {
          (outline.uniforms.uResolution!.value as Vector2).copy(renderer.getDrawingBufferSize(drawingBuffer));
        };
        this.object.add(line);
      }
    }
  }

  /** A holding point on a bone (palm centre), for props. */
  private anchor(bone: BoneName, x: number, y: number, z: number): Object3D {
    const anchor = new Group();
    anchor.name = `hand:${bone}`;
    anchor.position.set(x, y, z);
    this.bones.get(bone)!.add(anchor);
    return anchor;
  }

  /** Eases between solid and see-through; only switches materials to transparent while fading. */
  private fade(dt: number): void {
    const target = this.seeThrough ? 0.25 : 1;
    if (this.opacity === target) return;
    this.opacity = Math.abs(this.opacity - target) < 0.01 ? target : this.opacity + (target - this.opacity) * (1 - Math.exp(-10 * dt));
    const solid = this.opacity === 1;
    for (const m of [...this.materials, ...this.outlines]) {
      if (m.transparent === solid) {
        m.transparent = !solid;
        m.depthWrite = solid;
        m.needsUpdate = true;
      }
      m.opacity = this.opacity;
      if (m instanceof ShaderMaterial) m.uniforms.uOpacity!.value = this.opacity;
    }
  }
}

const KEEP = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight', 'color'];
const drawingBuffer = new Vector2();

/** Moke's ink line (an inverted hull pushed out in screen space, even width in pixels), for a skinned mesh. */
function createSkinnedOutlineMaterial(): ShaderMaterial {
  const { outline } = MOKE_LOOK;
  return new ShaderMaterial({
    side: BackSide,
    uniforms: {
      uColor: { value: new Color(MOKE_LOOK.palette.line) },
      uWidth: { value: outline.width },
      uScale: { value: new Vector2(outline.referenceDistance, outline.minScale) },
      uResolution: { value: new Vector2(1920, 1080) },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      uniform float uWidth;
      uniform vec2 uScale;
      uniform vec2 uResolution;
      void main() {
        #include <skinbase_vertex>
        #include <beginnormal_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 clip = projectionMatrix * modelViewMatrix * vec4( transformed, 1.0 );
        vec2 dir = ( projectionMatrix * vec4( normalize( normalMatrix * objectNormal ), 0.0 ) ).xy;
        dir *= uResolution;
        float len = length( dir );
        dir = len > 1e-6 ? dir / len : vec2( 0.0 );
        float px = uWidth * uResolution.y * clamp( uScale.x / max( clip.w, 1e-3 ), uScale.y, 1.0 );
        clip.xy += dir * px * 2.0 / uResolution * clip.w;
        gl_Position = clip;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        gl_FragColor = vec4( uColor, uOpacity );
        #include <colorspace_fragment>
      }
    `,
  });
}

// ---------------------------------------------------------------- shapes (character space, rest pose)

/** Character-space position of a joint in the rest pose. */
function jointAt(joint: HumanJoint): Vector3 {
  const p = new Vector3();
  for (let j: HumanJoint | null = joint; j; j = HUMAN_SKELETON[j].parent) {
    const at = HUMAN_SKELETON[j].at;
    p.x += at[0];
    p.y += at[1];
    p.z += at[2];
  }
  return p;
}

/** A smooth blend between two bones along y: `a` below `from`, `b` above `to`. */
function blendY(a: BoneName, b: BoneName, from: number, to: number) {
  return (p: Vector3): [BoneName, number][] => {
    const t = Math.min(1, Math.max(0, (p.y - from) / (to - from)));
    const s = t * t * (3 - 2 * t);
    return [
      [a, 1 - s],
      [b, s],
    ];
  };
}

/** A tapered tube hanging down from `top` (a sleeve, a trouser leg, an arm): radii top to bottom, closed at the ends. */
function limb(top: Vector3, length: number, radii: readonly number[], squashZ = 1, segments = 14): BufferGeometry {
  // Lathe profiles must run bottom to top, or the faces point inward (and the tube renders inside out).
  const points = radii.map((r, i) => new Vector2(r, -(i / (radii.length - 1)) * length)).reverse();
  points.unshift(new Vector2(0.0001, points[0]!.y));
  points.push(new Vector2(0.0001, points[points.length - 1]!.y));
  const g = new LatheGeometry(points, segments);
  g.scale(1, 1, squashZ);
  return g.translate(top.x, top.y, top.z);
}

/**
 * A lofted body section: rings from bottom to top, each [y, half-width, depth in front, depth behind, forward
 * offset], a rounded-rectangle-ish oval, closed top and bottom. Indexed while built so the normals come out smooth.
 */
function loft(rings: readonly (readonly [number, number, number, number, number?])[], segments = 28): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [y, halfWidth, front, back, forward = 0] of rings) {
    for (let k = 0; k < segments; k++) {
      const a = (k / segments) * Math.PI * 2;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      // A little squarer than an ellipse: a chest and shoulders, not a barrel.
      const x = Math.sign(sin) * Math.pow(Math.abs(sin), 0.8);
      const z = Math.sign(cos) * Math.pow(Math.abs(cos), 0.8);
      positions.push(halfWidth * x, y, forward + (cos >= 0 ? front : back) * z);
    }
  }
  const n = rings.length;
  for (let r = 0; r < n - 1; r++) {
    for (let k = 0; k < segments; k++) {
      const a = r * segments + k;
      const b = r * segments + ((k + 1) % segments);
      const c = a + segments;
      const d = b + segments;
      indices.push(a, b, c, b, d, c);
    }
  }
  const bottom = positions.length / 3;
  positions.push(0, rings[0]![0], rings[0]![4] ?? 0);
  positions.push(0, rings[n - 1]![0], rings[n - 1]![4] ?? 0);
  for (let k = 0; k < segments; k++) {
    const k2 = (k + 1) % segments;
    indices.push(bottom, k2, k);
    indices.push(bottom + 1, (n - 1) * segments + k, (n - 1) * segments + k2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

const HIPS = jointAt('hips');
const CHEST = jointAt('chest');
const NECK = jointAt('neck');
const HEAD = jointAt('head');

function torso(): Part[] {
  const parts: Part[] = [];
  const waist = HIPS.y + 0.1;
  // The T-shirt, hem to crew neck: straight at the waist, fuller through the chest, sloping shoulders.
  const shirt = loft([
    [HIPS.y - 0.08, 0.174, 0.108, 0.102, 0.004],
    [HIPS.y - 0.02, 0.17, 0.106, 0.1, 0.004],
    [waist, 0.16, 0.101, 0.096],
    [CHEST.y - 0.06, 0.166, 0.11, 0.1],
    [CHEST.y + 0.04, 0.174, 0.118, 0.102, 0.004],
    [CHEST.y + 0.12, 0.176, 0.108, 0.1],
    [CHEST.y + 0.158, 0.184, 0.094, 0.092, -0.006],
    [CHEST.y + 0.18, 0.17, 0.08, 0.08, -0.008],
    [CHEST.y + 0.198, 0.115, 0.07, 0.074, -0.01],
    [CHEST.y + 0.207, 0.072, 0.06, 0.066, -0.012],
  ]);
  parts.push({
    geometry: shirt,
    material: 'shirt',
    color: COLORS.shirt,
    bind: (p) => {
      if (p.y < waist) return blendY('hips', 'spine', HIPS.y - 0.02, waist)(p);
      // The top corners ride the collarbones, so a shrug or a reach lifts the shoulder of the shirt.
      if (p.y > CHEST.y + 0.08 && Math.abs(p.x) > 0.1) {
        const w = Math.min(1, (Math.abs(p.x) - 0.1) / 0.07) * Math.min(1, (p.y - CHEST.y - 0.08) / 0.07);
        return [
          ['chest', 1 - w],
          [p.x > 0 ? 'clavicleL' : 'clavicleR', w],
        ];
      }
      return blendY('spine', 'chest', waist + 0.04, CHEST.y + 0.02)(p);
    },
  });
  // A ribbed crew neck.
  const collar = new TorusGeometry(0.068, 0.008, 6, 22).rotateX(Math.PI / 2).scale(1.02, 1, 0.92);
  parts.push({ geometry: collar.translate(0, CHEST.y + 0.205, -0.01), material: 'shirt', color: COLORS.shirtRib, bind: 'chest' });
  // The neck: from under the collar into the head, following the chest, then the neck, then the head.
  parts.push({
    geometry: new CylinderGeometry(0.058, 0.064, 0.15, 18).scale(1, 1, 0.95).translate(0, NECK.y + 0.035, -0.008),
    material: 'skin',
    color: COLORS.skin,
    bind: (p) => {
      if (p.y < NECK.y + 0.04) return blendY('chest', 'neck', NECK.y - 0.03, NECK.y + 0.02)(p);
      return blendY('neck', 'head', NECK.y + 0.05, HEAD.y + 0.01)(p);
    },
  });
  return parts;
}

function arms(): Part[] {
  const parts: Part[] = [];
  for (const side of ['L', 'R'] as const) {
    const s = side === 'L' ? 1 : -1;
    const shoulder = jointAt(`shoulder${side}`);
    const elbow = jointAt(`elbow${side}`);
    const wrist = jointAt(`wrist${side}`);
    // The bare arm, shoulder to wrist: a fuller upper arm and forearm, a slimmer elbow and wrist.
    const top = shoulder.clone().add(new Vector3(-s * 0.006, 0.02, 0));
    const radii = [0.022, 0.046, 0.05, 0.048, 0.044, 0.04, 0.041, 0.042, 0.038, 0.033, 0.029];
    parts.push({
      geometry: limb(top, top.y - wrist.y + 0.012, radii, 0.92),
      material: 'skin',
      color: COLORS.skin,
      bind: blendY(`elbow${side}`, `shoulder${side}`, elbow.y - 0.045, elbow.y + 0.045),
    });
    parts.push({ geometry: new SphereGeometry(0.037, 12, 8).scale(1, 1, 0.92).translate(elbow.x, elbow.y, elbow.z), material: 'skin', color: COLORS.skin, bind: `elbow${side}` });
    // The T-shirt sleeve: round over the shoulder, ending loose halfway down the upper arm.
    const sleeveTop = shoulder.clone().add(new Vector3(-s * 0.006, 0.026, 0));
    const sleeve = limb(sleeveTop, 0.17, [0.038, 0.057, 0.061, 0.062, 0.062, 0.062], 0.95, 18);
    parts.push({
      geometry: sleeve,
      material: 'shirt',
      color: COLORS.shirt,
      bind: (p) => {
        const w = Math.min(1, Math.max(0, (p.y - shoulder.y) / 0.05)) * 0.45;
        return [
          [`shoulder${side}`, 1 - w],
          [`clavicle${side}`, w],
        ];
      },
    });
    const hem = new TorusGeometry(0.06, 0.0055, 5, 18).rotateX(Math.PI / 2).scale(1, 1, 0.95);
    parts.push({ geometry: hem.translate(sleeveTop.x, sleeveTop.y - 0.17, sleeveTop.z), material: 'shirt', color: COLORS.shirtRib, bind: `shoulder${side}` });
  }
  return parts;
}

function legs(): Part[] {
  const parts: Part[] = [];
  // The seat of the jeans, from under the shirt down to the crotch.
  const pelvis = loft([
    [HIPS.y - 0.19, 0.05, 0.045, 0.055],
    [HIPS.y - 0.14, 0.148, 0.09, 0.104],
    [HIPS.y - 0.06, 0.166, 0.099, 0.11],
    [HIPS.y + 0.02, 0.156, 0.096, 0.1],
    [HIPS.y + 0.05, 0.146, 0.092, 0.096],
  ]);
  parts.push({ geometry: pelvis, material: 'jeans', color: COLORS.denim, bind: 'hips' });
  for (const side of ['L', 'R'] as const) {
    const hip = jointAt(`hip${side}`);
    const knee = jointAt(`knee${side}`);
    const ankle = jointAt(`ankle${side}`);
    const hemY = ankle.y + 0.035;
    const leg = limb(hip.clone().add(new Vector3(0, 0.04, 0)), hip.y + 0.04 - hemY, [0.088, 0.086, 0.078, 0.07, 0.062, 0.058, 0.058, 0.057, 0.056, 0.057], 0.96, 16);
    parts.push({ geometry: leg, material: 'jeans', color: COLORS.denim, bind: blendY(`knee${side}`, `hip${side}`, knee.y - 0.06, knee.y + 0.06) });
    parts.push({ geometry: new SphereGeometry(0.08, 14, 10).translate(hip.x, hip.y, hip.z), material: 'jeans', color: COLORS.denim, bind: `hip${side}` });
    // Knee caps keep a bent knee round.
    parts.push({ geometry: new SphereGeometry(0.05, 12, 8).translate(knee.x, knee.y, knee.z - 0.004), material: 'jeans', color: COLORS.denim, bind: `knee${side}` });
    const seam = new TorusGeometry(0.057, 0.005, 5, 18).rotateX(Math.PI / 2);
    parts.push({ geometry: seam.translate(ankle.x, hemY + 0.004, ankle.z), material: 'jeans', color: COLORS.denimSeam, bind: `knee${side}` });
    // Ankle and foot, the sole flat on the floor at rest: the left in the striped sock, the right bare.
    const socked = side === 'L';
    const material: MaterialName = socked ? 'sock' : 'skin';
    const color = socked ? COLORS.sock : COLORS.skin;
    parts.push({ geometry: new CylinderGeometry(0.035, 0.039, 0.09, 12).translate(ankle.x, ankle.y + 0.02, ankle.z), material, color, bind: `ankle${side}` });
    parts.push({ geometry: foot(ankle), material, color, bind: `ankle${side}` });
    if (socked) {
      for (const y of [ankle.y + 0.04, ankle.y + 0.012]) {
        const stripe = new TorusGeometry(0.038, 0.0065, 5, 16).rotateX(Math.PI / 2);
        parts.push({ geometry: stripe.translate(ankle.x, y, ankle.z), material: 'sock', color: COLORS.sockStripe, bind: `ankle${side}` });
      }
    } else {
      // Toes, the big toe on the inside.
      const inward = -Math.sign(ankle.x);
      for (let k = 0; k < 4; k++) {
        const toe = new SphereGeometry(0.0135 - k * 0.0015, 8, 6);
        parts.push({ geometry: toe.translate(ankle.x + inward * (0.02 - k * 0.019), 0.013, ankle.z + 0.172 - k * 0.008), material: 'skin', color: COLORS.skin, bind: `ankle${side}` });
      }
    }
  }
  return parts;
}

/** A foot with a flat sole on the floor (y = 0) at rest: the heel just behind the ankle, the toes forward. */
function foot(ankle: Vector3): BufferGeometry {
  const g = new SphereGeometry(1, 18, 12);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    // Wider across the toes than the heel; flat underneath.
    p.setXYZ(i, x * 0.046 * (1 + 0.22 * z), Math.max(y, -0.55) * 0.042, z * 0.124);
  }
  g.computeVertexNormals();
  return g.translate(ankle.x, 0.0231, ankle.z + 0.068);
}

// ---------------------------------------------------------------- the head (head-bone space, then placed on the body)

/** How far above the head joint (the top of the neck) the middle of the skull is, and its radii (m). */
const SKULL_CENTER = 0.08;
const SKULL_SIZE = { x: 0.1, up: 0.123, down: 0.134, z: 0.111 };

/**
 * The skull: a man's head, the jaw a touch square and the chin firm, a little forward fullness in the lower face so
 * the mouth sits on it. Features are placed on its surface.
 */
const SKULL = (() => {
  const g = new SphereGeometry(1, 32, 24);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const jaw = y < 0 ? 1 - 0.17 * Math.pow(-y, 1.7) : 1;
    const front = z > 0 && y < 0.2 ? 0.02 * Math.max(0, 0.2 - y) * z : 0;
    p.setXYZ(i, x * SKULL_SIZE.x * jaw, SKULL_CENTER + y * (y < 0 ? SKULL_SIZE.down : SKULL_SIZE.up), z * SKULL_SIZE.z * jaw + front);
  }
  g.computeVertexNormals();
  return g;
})();
const skullMesh = new Mesh(SKULL);
const ray = new Raycaster();
/** How far forward the face's surface is at (x, y), head-bone space. */
function faceZ(x: number, y: number): number {
  ray.set(new Vector3(x, y, 1), new Vector3(0, 0, -1));
  const hit = ray.intersectObject(skullMesh, false)[0];
  return hit ? hit.point.z : 0.08;
}

/**
 * The left eye (head-bone space; the right is mirrored): a flat, almond-ish eye set just proud of the skin, its
 * size an animated film's but not an anime's. `white` is the eye's half-size, `lid` the upper lid's (a touch bigger,
 * so it covers the eye when it closes).
 */
const EYE = (() => {
  const x = 0.035;
  const y = 0.072;
  return {
    x,
    y,
    z: faceZ(x, y) - 0.003,
    white: { x: 0.0185, y: 0.0132, z: 0.0074 },
    lid: { x: 0.0202, y: 0.0146, z: 0.0096 },
    iris: 0.0089,
  };
})();
/** How far the irises slide at the eyes' limits (m). */
const EYE_SHIFT = { x: 0.0055, y: 0.0035 };
const MOUTH = { y: 0.006, z: faceZ(0, 0.006) };
const BROW_ABOVE_EYE = 0.027;
const BROW_Z = faceZ(EYE.x, EYE.y + BROW_ABOVE_EYE) + 0.0015;
/** How far the upper lid comes down at rest (a share of the eye's height): calm, just touching the irises. */
const LID = { open: 0.2 };

/** Head-bone space → character space. */
function onHead(g: BufferGeometry, x: number, y: number, z: number): BufferGeometry {
  return g.translate(HEAD.x + x, HEAD.y + y, HEAD.z + z);
}

/** The lash line: a thin arc along the lid's lower edge, following the eye's curve (head-bone space, at the lash bone). */
function lashLine(): BufferGeometry {
  const points: Vector3[] = [];
  for (let k = 0; k <= 12; k++) {
    const u = k / 12;
    const x = (u * 2 - 1) * EYE.lid.x * 0.98;
    const across = Math.max(0, 1 - (x / EYE.lid.x) ** 2);
    points.push(new Vector3(x, -0.0014 * across + 0.0008 * (1 - across), -0.002 + EYE.lid.z * Math.sqrt(across) * 0.92));
  }
  return new TubeGeometry(new CatmullRomCurve3(points), 16, 0.001, 5, false);
}

function head(): Part[] {
  const parts: Part[] = [];
  const skin = (geometry: BufferGeometry, color = COLORS.skin): Part => ({ geometry, material: 'skin', color, bind: 'head' });
  const face = (geometry: BufferGeometry, color: string, bind: Bind = 'head'): Part => ({ geometry, material: 'face', color, bind });
  parts.push(skin(onHead(SKULL.clone(), 0, 0, 0)));
  // Ears (outlined with the head), a soft nose and the lips (drawn without a line, like Moke's muzzle).
  for (const sx of [1, -1]) parts.push(skin(onHead(new SphereGeometry(0.027, 10, 8).scale(0.4, 1.22, 0.74).rotateY(sx * 0.25), sx * 0.094, 0.06, -0.01)));
  parts.push(face(onHead(new SphereGeometry(1, 12, 10).scale(0.0085, 0.019, 0.0075).rotateX(0.3), 0, 0.046, faceZ(0, 0.046) - 0.004), COLORS.skin));
  parts.push(face(onHead(new SphereGeometry(1, 14, 10).scale(0.0135, 0.0095, 0.0092), 0, 0.034, faceZ(0, 0.034) - 0.0015), COLORS.skin));
  parts.push(face(onHead(new SphereGeometry(0.015, 12, 6).scale(1.05, 0.3, 0.4), 0, MOUTH.y - 0.009, faceZ(0, MOUTH.y - 0.01) - 0.003), COLORS.lips));

  // Eyes: the whites on the head, the irises and pupils on the eye bones (they slide), a catch-light that stays put.
  for (const [sx, side] of [
    [1, 'L'],
    [-1, 'R'],
  ] as const) {
    const cx = sx * EYE.x;
    const cz = EYE.z - 0.002;
    parts.push(face(onHead(new SphereGeometry(1, 20, 14).scale(EYE.white.x, EYE.white.y, EYE.white.z), cx, EYE.y, cz), COLORS.eyeWhite));
    const front = cz + EYE.white.z;
    const iris = new CylinderGeometry(EYE.iris, EYE.iris, 0.0012, 20).rotateX(Math.PI / 2);
    parts.push(face(onHead(iris, cx, EYE.y, front - 0.0002), COLORS.iris, `eye${side}`));
    const pupil = new CylinderGeometry(EYE.iris * 0.52, EYE.iris * 0.52, 0.0012, 16).rotateX(Math.PI / 2);
    parts.push(face(onHead(pupil, cx, EYE.y, front + 0.0003), COLORS.pupil, `eye${side}`));
    const glint = new CylinderGeometry(0.0022, 0.0022, 0.0008, 10).rotateX(Math.PI / 2);
    parts.push(face(onHead(glint, cx + 0.0035, EYE.y + 0.0035, front + 0.0009), COLORS.catchLight, `eye${side}`));
    // The upper lid: skin over the eye, scaled down from the top of the eye by its bone (open … shut).
    parts.push(face(onHead(new SphereGeometry(1, 20, 12).scale(EYE.lid.x, EYE.lid.y, EYE.lid.z), cx, EYE.y, cz), COLORS.skin, `lid${side}`));
    parts.push(face(onHead(lashLine(), cx, EYE.y + EYE.lid.y - LID.open * EYE.lid.y * 2 * 0.92, cz + 0.002), COLORS.lash, `lash${side}`));
    // Straight, natural brows: a little fuller toward the middle, tapering outward.
    const brow = new CapsuleGeometry(0.0046, 0.028, 4, 8).rotateZ(Math.PI / 2);
    const bp = brow.getAttribute('position');
    for (let i = 0; i < bp.count; i++) {
      const bx = bp.getX(i);
      const taper = 1 - 0.45 * Math.max(0, (bx * sx) / 0.019);
      bp.setY(i, bp.getY(i) * taper + 0.004 * (1 - (bx / 0.019) ** 2));
    }
    brow.rotateZ(sx * -0.04);
    parts.push(face(onHead(brow, sx * (EYE.x + 0.002), EYE.y + BROW_ABOVE_EYE, BROW_Z), COLORS.brow, `brow${side}`));
  }

  // Mouth: a smile line (scales with the smile), and an open mouth the jaw bone opens (scale y).
  const smileLine = new TorusGeometry(0.014, 0.0015, 6, 18, Math.PI).rotateZ(Math.PI);
  parts.push(face(onHead(smileLine, 0, MOUTH.y + 0.004, MOUTH.z + 0.002), COLORS.lash, 'smile'));
  parts.push(face(onHead(new SphereGeometry(0.016, 16, 10).scale(1, 0.9, 0.4), 0, MOUTH.y - 0.002, MOUTH.z - 0.002), COLORS.mouth, 'jaw'));
  parts.push(face(onHead(new BoxGeometry(0.018, 0.004, 0.004), 0, MOUTH.y + 0.009, MOUTH.z + 0.002), COLORS.teeth, 'jaw'));

  // Hair: short and black, close at the back and sides, fuller on top, a soft side part on his left and the front
  // swept across to his right. One shell shrink-wrapped over the skull (see hairShell), so there are no loose pieces.
  parts.push({ geometry: onHead(hairShell(), 0, 0, 0), material: 'hair', color: COLORS.hair, bind: 'head' });
  return parts;
}

/** Where the hairline is, as a height on the unit skull (1 = crown), round the head (0 = the middle of the forehead). */
function hairline(around: number): number {
  const base = 0.105 + 0.56 * Math.cos(around) - 0.045 * Math.cos(2 * around);
  // The front dips a little on his right, where it's swept across, and rises at the parting on his left.
  return base - 0.12 * Math.exp(-(((around + 0.35) / 0.32) ** 2)) + 0.05 * Math.exp(-(((around - 0.5) / 0.22) ** 2));
}

/**
 * The hair as one shell: the skull's own shape, a little bigger, thicker on top and toward the front, sweeping to his
 * right; below the hairline it tucks under the skin, so the edge follows the hairline cleanly (and so does the ink line).
 */
function hairShell(): BufferGeometry {
  const g = new SphereGeometry(1, 44, 30);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const around = Math.atan2(x, z);
    const edge = hairline(around);
    const inside = smoothstep(edge - 0.02, edge + 0.07, y);
    const top = smoothstep(0.25, 0.95, y);
    const front = Math.max(0, Math.cos(around));
    // Volume: close at the back and sides, fuller on top and toward the front, a little more on his right (the sweep).
    let thick = 0.007 + 0.011 * top * (0.55 + 0.45 * front) + 0.004 * top * Math.max(0, -Math.sin(around)) * front;
    // The parting: a slight groove on his left.
    thick -= 0.004 * Math.exp(-(((around - 0.5) / 0.1) ** 2)) * smoothstep(0.4, 0.8, y);
    thick = lerp(-0.004, thick, inside);
    const jaw = y < 0 ? 1 - 0.17 * Math.pow(-y, 1.7) : 1;
    const ry = y < 0 ? SKULL_SIZE.down : SKULL_SIZE.up;
    const fullness = z > 0 && y < 0.2 ? 0.02 * Math.max(0, 0.2 - y) * z : 0;
    p.setXYZ(i, x * (SKULL_SIZE.x * jaw + thick), SKULL_CENTER + y * (ry + thick), z * (SKULL_SIZE.z * jaw + thick) + fullness);
  }
  g.computeVertexNormals();
  return g;
}

function hands(): Part[] {
  const parts: Part[] = [];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const wrist = jointAt(`wrist${side}`);
    const fingers = jointAt(`fingers${side}`);
    const thumb = jointAt(`thumb${side}`);
    // Palm: a soft slab, palm toward the thigh (±x), thumb forward; a man's hand.
    const palm = new RoundedBoxGeometry(0.032, 0.094, 0.082, 3, 0.014);
    parts.push({ geometry: palm.translate(wrist.x, wrist.y - 0.05, wrist.z + 0.005), material: 'skin', color: COLORS.skin, bind: `wrist${side}` });
    parts.push({
      geometry: new CylinderGeometry(0.029, 0.031, 0.03, 12).scale(0.72, 1, 1).translate(wrist.x, wrist.y + 0.003, wrist.z),
      material: 'skin',
      color: COLORS.skin,
      bind: blendY(`wrist${side}`, `elbow${side}`, wrist.y - 0.01, wrist.y + 0.02),
    });
    // Four fingers, curling together from the knuckles.
    for (let k = 0; k < 4; k++) {
      const len = [0.064, 0.072, 0.068, 0.054][k]!;
      const finger = new CapsuleGeometry(0.01, len - 0.02, 4, 8);
      parts.push({ geometry: finger.translate(fingers.x, fingers.y - len / 2 + 0.006, fingers.z + 0.031 - k * 0.0205), material: 'skin', color: COLORS.skin, bind: `fingers${side}` });
    }
    const thumbGeometry = new CapsuleGeometry(0.011, 0.036, 4, 8).rotateX(0.5).rotateZ(sx * 0.2);
    parts.push({ geometry: thumbGeometry.translate(thumb.x - sx * 0.004, thumb.y - 0.026, thumb.z + 0.012), material: 'skin', color: COLORS.skin, bind: `thumb${side}` });
  }
  return parts;
}

// ---------------------------------------------------------------- textures

/** Denim twill: fine light diagonals on near-white (the blue is the jeans' vertex colour). */
function denimTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#e4e8ee';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1;
  for (let i = -64; i < 128; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 64);
    ctx.stroke();
  }
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}
