import {
  BackSide,
  Bone,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  Object3D,
  Raycaster,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Skeleton,
  SRGBColorSpace,
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

/** Display colours shared by every human (the toon materials skip tone mapping, like Moke's): the eyes and mouth. */
const COLORS = {
  eyeWhite: '#fbf7f1',
  pupil: '#0f0a09',
  catchLight: '#ffffff',
  lash: '#1c1617',
  mouth: '#6e302c',
  teeth: '#fbf6ef',
};

/**
 * Who this is: their colouring and clothes. Everything else (the body, rig, face and animation) is shared, so any
 * look moves exactly like the household human.
 */
export interface HumanLook {
  skin: string;
  lips: string;
  hair: string;
  brow: string;
  iris: string;
  shirt: string;
  /** Placket, collar and cuffs/hems. */
  shirtTrim: string;
  shirtButton: string;
  sleeves: 'long' | 'short';
  pants: string;
  pantsSeam: string;
  /** Faded denim down the thighs and over the knees (jeans), or plain (work trousers). */
  pantsFade: boolean;
  /** One striped sock and one bare foot (Moke has the other sock), or a pair of shoes. */
  feet: { kind: 'sockAndBare'; sock: string; stripe: string } | { kind: 'shoes'; shoe: string; sole: string };
  /** A peaked cap over the hair, or none. */
  cap: { crown: string; brim: string } | null;
}

/** The household human: warm tan skin, short black hair, an untucked sage button-down, blue jeans, one striped sock. */
export const HOUSEHOLD_LOOK: HumanLook = {
  skin: '#d9a27c',
  lips: '#bf7e6e',
  hair: '#221d1f',
  brow: '#2a2222',
  iris: '#3b2519',
  shirt: '#cbd9c8',
  shirtTrim: '#b7c8b5',
  shirtButton: '#a99178',
  sleeves: 'long',
  pants: '#557399',
  pantsSeam: '#7892b6',
  pantsFade: true,
  // The other sock of the pair Moke keeps stealing (see propVisuals: the same charcoal and grey).
  feet: { kind: 'sockAndBare', sock: '#34373d', stripe: '#9ca3ad' },
  cap: null,
};

/**
 * The delivery driver: someone else entirely. Deep brown skin, auburn hair under a brown cap, a brown short-sleeved
 * button-down uniform, brown work trousers and black shoes (both of them).
 */
export const COURIER_LOOK: HumanLook = {
  skin: '#8a5a3e',
  lips: '#7a4436',
  hair: '#6b3a26',
  brow: '#3a2219',
  iris: '#4a3222',
  shirt: '#8a5a33',
  shirtTrim: '#6e4526',
  shirtButton: '#e9dcc4',
  sleeves: 'short',
  pants: '#5a3d27',
  pantsSeam: '#46301f',
  pantsFade: false,
  feet: { kind: 'shoes', shoe: '#1b1b1e', sole: '#3a3a3e' },
  cap: { crown: '#6e4526', brim: '#583720' },
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
 * (original, no files), in a `HumanLook`: the household human (warm tan skin, layered short black hair, an untucked
 * sage button-down shirt, blue jeans, one striped sock: Moke has the other) or the delivery driver. Drawn with Moke's own soft toon shading and thin silhouette line.
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
  private readonly props: HumanPropViews;
  private opacity = 1;
  private seeThrough = false;
  private readonly handL = new Vector3();
  private readonly handR = new Vector3();
  private readonly eyes = new Vector3();

  constructor(readonly look: HumanLook = HOUSEHOLD_LOOK) {
    this.object.name = 'Human';
    const root = this.buildSkeleton();
    this.object.add(root);
    root.updateMatrixWorld(true);
    const parts = [...torso(look), ...arms(look), ...legs(look), ...head(look), ...hands(look)];
    this.buildMeshes(parts);
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
      const turn = (side === 'L' ? 1 : -1) * EYE.turn;
      eye.position.set(rest.x + Math.cos(turn) * lookX, rest.y + lookY, rest.z - Math.sin(turn) * lookX);
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
    } else if (pose.prop === 'laundry') {
      this.object.updateMatrixWorld(true);
      this.hands.left.getWorldPosition(this.handL);
      this.hands.right.getWorldPosition(this.handR);
      this.props.holdLaundry(this.handL, this.handR);
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
      const painted = g.getAttribute('color');
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
        colors[i * 3] = painted ? painted.getX(i) : color.r;
        colors[i * 3 + 1] = painted ? painted.getY(i) : color.g;
        colors[i * 3 + 2] = painted ? painted.getZ(i) : color.b;
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

/** One cross-section of a lofted garment (character space, m). */
interface Ring {
  readonly y: number;
  /** Centre across (x) and forward (z). */
  readonly cx?: number;
  readonly fwd?: number;
  /** Half-width toward +x (`out`) and toward -x (`in`, default the same), and depth in front and behind. */
  readonly out: number;
  readonly in?: number;
  readonly front: number;
  readonly back: number;
  /** Roundness of each half: 1 is an ellipse, smaller is squarer. */
  readonly pOut?: number;
  readonly pIn?: number;
  /** Raises points round the ring by angle (0 = the front, π/2 = +x): a shirt's curved tails. */
  readonly lift?: (angle: number) => number;
}

/**
 * A closed, smooth tube lofted through cross-sections (bottom to top), each a rounded rectangle-ish oval that can be
 * lopsided (a trouser leg's flat inner side). `mirror` builds it for the other side of the body (x negated).
 */
function loftRings(rings: readonly Ring[], mirror = false, segments = 32): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const sx = mirror ? -1 : 1;
  for (const r of rings) {
    for (let k = 0; k < segments; k++) {
      const a = (k / segments) * Math.PI * 2;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      const outward = sin >= 0;
      const p = outward ? (r.pOut ?? 0.8) : (r.pIn ?? r.pOut ?? 0.8);
      const half = outward ? r.out : (r.in ?? r.out);
      const x = (r.cx ?? 0) + Math.sign(sin) * half * Math.pow(Math.abs(sin), p);
      const z = (r.fwd ?? 0) + (cos >= 0 ? r.front : r.back) * Math.sign(cos) * Math.pow(Math.abs(cos), p);
      positions.push(sx * x, r.y + (r.lift?.(a) ?? 0), z);
    }
  }
  const tri = (a: number, b: number, c: number) => (mirror ? indices.push(a, c, b) : indices.push(a, b, c));
  const n = rings.length;
  for (let r = 0; r < n - 1; r++) {
    for (let k = 0; k < segments; k++) {
      const a = r * segments + k;
      const b = r * segments + ((k + 1) % segments);
      tri(a, b, a + segments);
      tri(b, b + segments, a + segments);
    }
  }
  const bottom = positions.length / 3;
  const ringCentre = (r: Ring) => [sx * (r.cx ?? 0), r.y + (r.lift ? 0.5 * (r.lift(0) + r.lift(Math.PI / 2)) : 0), r.fwd ?? 0];
  positions.push(...ringCentre(rings[0]!), ...ringCentre(rings[n - 1]!));
  for (let k = 0; k < segments; k++) {
    const k2 = (k + 1) % segments;
    tri(bottom, k2, k);
    tri(bottom + 1, (n - 1) * segments + k, (n - 1) * segments + k2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Colours each vertex of a geometry (after its normals are computed): for fades, sheen, and shading in the fabric. */
function paint(g: BufferGeometry, colour: (p: Vector3, n: Vector3, out: Color) => void): BufferGeometry {
  const position = g.getAttribute('position');
  const normal = g.getAttribute('normal');
  const colors = new Float32Array(position.count * 3);
  const p = new Vector3();
  const n = new Vector3();
  const c = new Color();
  for (let i = 0; i < position.count; i++) {
    colour(p.fromBufferAttribute(position, i), n.fromBufferAttribute(normal, i), c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

const HIPS = jointAt('hips');
const CHEST = jointAt('chest');
const NECK = jointAt('neck');
const HEAD = jointAt('head');

/**
 * The shirt, bottom to top: an untucked, relaxed button-down. Its tails hang over the jeans' waistband and seat,
 * curved like a real shirt's (longer front and back than at the sides), and it stays roomy enough over the hips that
 * the jeans never show through it. Up top: a man's chest and shoulders, sloping to the collar.
 */
const SHIRT_HEM = HIPS.y - 0.115;
const SHIRT: readonly Ring[] = [
  { y: SHIRT_HEM, out: 0.191, front: 0.118, back: 0.124, fwd: 0.004, pOut: 0.74, lift: (a) => 0.034 * Math.sin(a) ** 2 },
  { y: HIPS.y - 0.06, out: 0.19, front: 0.116, back: 0.122, fwd: 0.004, pOut: 0.74 },
  { y: HIPS.y + 0.02, out: 0.187, front: 0.112, back: 0.115, fwd: 0.002, pOut: 0.77 },
  { y: HIPS.y + 0.1, out: 0.179, front: 0.108, back: 0.106, pOut: 0.8 },
  { y: CHEST.y - 0.06, out: 0.178, front: 0.114, back: 0.106 },
  { y: CHEST.y + 0.04, out: 0.182, front: 0.12, back: 0.106, fwd: 0.004 },
  { y: CHEST.y + 0.12, out: 0.186, front: 0.11, back: 0.104 },
  { y: CHEST.y + 0.16, out: 0.198, front: 0.096, back: 0.097, fwd: -0.006 },
  { y: CHEST.y + 0.186, out: 0.184, front: 0.084, back: 0.087, fwd: -0.008 },
  { y: CHEST.y + 0.201, out: 0.14, front: 0.073, back: 0.078, fwd: -0.01 },
  { y: CHEST.y + 0.212, out: 0.076, front: 0.062, back: 0.068, fwd: -0.012 },
];

/** How far forward the shirt's front is at height y, down the middle (for the placket and buttons). */
function shirtFront(y: number): number {
  for (let i = 0; i < SHIRT.length - 1; i++) {
    const a = SHIRT[i]!;
    const b = SHIRT[i + 1]!;
    if (y <= b.y) {
      const t = Math.max(0, (y - a.y) / (b.y - a.y));
      return lerp((a.fwd ?? 0) + a.front, (b.fwd ?? 0) + b.front, t);
    }
  }
  const last = SHIRT[SHIRT.length - 1]!;
  return (last.fwd ?? 0) + last.front;
}

/** The open collar's key points (character space, m): see torso(). */
const COLLAR = {
  /** Half the angle of the stand's opening at the front (rad). */
  gap: 0.5,
  standY: NECK.y - 0.015,
  /** Where the leaves meet the stand (x at the inner, front corner; y along their top edge). */
  innerX: 0.028,
  outerX: 0.07,
  topY: NECK.y + 0.002,
  /** The leaf's point, and the bottom of the V between the leaves. */
  tip: { x: 0.047, y: NECK.y - 0.075 },
  vBottom: NECK.y - 0.07,
};

/** The shirt's surface, for laying things flat on it (collar leaves); built on first use. */
let shirtMesh: Mesh | null = null;
/** How far forward the shirt's surface is at (x, y), character space. */
function shirtZ(x: number, y: number): number {
  shirtMesh ??= new Mesh(loftRings(SHIRT));
  ray.set(new Vector3(x, y, 1), new Vector3(0, 0, -1));
  const hit = ray.intersectObject(shirtMesh, false)[0];
  return hit ? hit.point.z : shirtFront(y);
}

/**
 * A flat piece lying on the shirt's front: the polygon (x, y) with its edges finely subdivided, each vertex pushed
 * onto the shirt's surface plus `lift`, and `thickness` deep (0: a single surface).
 */
function onShirt(outline: readonly (readonly [number, number])[], lift: number, thickness = 0): BufferGeometry {
  const shape = new Shape();
  outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  const g = thickness > 0 ? new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 1, steps: 1 }) : new ShapeGeometry(shape);
  const detailed = subdivide(g);
  const p = detailed.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setZ(i, shirtZ(p.getX(i), p.getY(i)) + lift + p.getZ(i));
  detailed.computeVertexNormals();
  return detailed;
}

/** Splits every triangle into four, twice, so a flat piece can follow a curved surface. */
function subdivide(source: BufferGeometry): BufferGeometry {
  let g = source.index ? source.toNonIndexed() : source;
  for (let pass = 0; pass < 2; pass++) {
    const p = g.getAttribute('position');
    const out: number[] = [];
    const v = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)];
    const mid = (a: number[], b: number[]) => a.map((x, k) => (x + b[k]!) / 2);
    for (let i = 0; i < p.count; i += 3) {
      const a = v(i), b = v(i + 1), c = v(i + 2);
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      out.push(...a, ...ab, ...ca, ...ab, ...b, ...bc, ...ca, ...bc, ...c, ...ab, ...bc, ...ca);
    }
    g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(out), 3));
  }
  return g;
}

/** One collar leaf (sx = 1: his left), folded down from the stand onto the chest, its point toward the placket. */
function collarLeaf(sx: number): BufferGeometry {
  const c = COLLAR;
  const outline: [number, number][] = [
    [sx * c.innerX, c.topY],
    [sx * c.outerX, c.topY - 0.012],
    [sx * (c.tip.x + 0.012), c.tip.y + 0.012],
    [sx * c.tip.x, c.tip.y],
  ];
  // Extruded toward the viewer; wound the same way for both sides so neither leaf is inside out.
  return onShirt(sx > 0 ? outline : outline.reverse(), 0.0015, 0.0035);
}

function torso(look: HumanLook): Part[] {
  const parts: Part[] = [];
  const waist = HIPS.y + 0.1;
  parts.push({
    geometry: loftRings(SHIRT),
    material: 'shirt',
    color: look.shirt,
    bind: (p) => {
      if (p.y < waist) return blendY('hips', 'spine', HIPS.y - 0.02, waist)(p);
      const ax = Math.abs(p.x);
      // The shoulders ride the collarbones, and over the deltoid a little of the arm, so a shrug or a reach lifts
      // the shoulder of the shirt with it.
      if (p.y > CHEST.y + 0.06 && ax > 0.09) {
        const top = Math.min(1, (p.y - CHEST.y - 0.06) / 0.08);
        const clavicle = Math.min(1, (ax - 0.09) / 0.07) * top;
        const arm = smoothstep(0.16, 0.21, ax) * top * 0.4;
        return [
          ['chest', 1 - clavicle],
          [p.x > 0 ? 'clavicleL' : 'clavicleR', clavicle - arm],
          [p.x > 0 ? 'shoulderL' : 'shoulderR', arm],
        ];
      }
      return blendY('spine', 'chest', waist + 0.04, CHEST.y + 0.02)(p);
    },
  });
  // The button placket down the front, following the shirt's surface, and its buttons: from the bottom of the
  // collar's open V down to the hem.
  const top = COLLAR.vBottom + 0.004;
  const strip: number[] = [];
  const stripIndex: number[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const y = lerp(SHIRT_HEM + 0.004, top, i / steps);
    const z = shirtFront(y) + 0.0016;
    strip.push(-0.011, y, z - 0.0006, 0.011, y, z - 0.0006);
    if (i < steps) stripIndex.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const placket = new BufferGeometry();
  placket.setAttribute('position', new BufferAttribute(new Float32Array(strip), 3));
  placket.setIndex(stripIndex);
  placket.computeVertexNormals();
  parts.push({ geometry: placket, material: 'shirt', color: look.shirtTrim, bind: blendY('hips', 'chest', HIPS.y, CHEST.y) });
  for (let i = 0; i < 6; i++) {
    const y = top - 0.035 - i * 0.098;
    const button = new SphereGeometry(0.0058, 10, 6).scale(1, 1, 0.4).translate(0, y, shirtFront(y) + 0.0032);
    parts.push({ geometry: button, material: 'shirt', color: look.shirtButton, bind: blendY('hips', 'chest', HIPS.y, CHEST.y) });
  }
  // An open collar: a stand round the back and sides of the neck (open at the front), two pointed collar leaves
  // folded down onto the chest from its ends, and the V of skin between them where the top button's undone.
  const standProfile = [[0.061, 0.0], [0.068, 0.0], [0.07, 0.02], [0.067, 0.037], [0.062, 0.035], [0.06, 0.004]].map(([r, y]) => new Vector2(r!, y!));
  const stand = new LatheGeometry([...standProfile, standProfile[0]!], 32, COLLAR.gap, Math.PI * 2 - 2 * COLLAR.gap).scale(1, 1, 0.94).rotateX(-0.12);
  parts.push({ geometry: stand.translate(0, COLLAR.standY, -0.013), material: 'shirt', color: look.shirtTrim, bind: 'chest' });
  for (const sx of [1, -1]) parts.push({ geometry: collarLeaf(sx), material: 'shirt', color: look.shirtTrim, bind: 'chest' });
  // (Its top runs up behind the leaves into the neck, so no sliver of shirt shows between them.)
  const vTop = COLLAR.topY + 0.014;
  parts.push({ geometry: onShirt([[-COLLAR.innerX - 0.006, vTop], [COLLAR.innerX + 0.006, vTop], [0, COLLAR.vBottom]], 0.003), material: 'face', color: look.skin, bind: 'chest' });
  // The neck: from inside the collar into the head, following the chest, then the neck, then the head.
  parts.push({
    geometry: new CylinderGeometry(0.057, 0.063, 0.15, 18).scale(1, 1, 0.95).translate(0, NECK.y + 0.035, -0.01),
    material: 'skin',
    color: look.skin,
    bind: (p) => {
      if (p.y < NECK.y + 0.04) return blendY('chest', 'neck', NECK.y - 0.03, NECK.y + 0.02)(p);
      return blendY('neck', 'head', NECK.y + 0.05, HEAD.y + 0.01)(p);
    },
  });
  return parts;
}

function arms(look: HumanLook): Part[] {
  const parts: Part[] = [];
  for (const side of ['L', 'R'] as const) {
    const s = side === 'L' ? 1 : -1;
    const shoulder = jointAt(`shoulder${side}`);
    const elbow = jointAt(`elbow${side}`);
    const wrist = jointAt(`wrist${side}`);
    // The sleeve starts inside the shirt's shoulder (so the shoulder line stays smooth), roomy over the upper arm.
    // A long sleeve eases in to a buttoned cuff at the wrist and bends at the elbow; a short one flares a little and
    // ends above the elbow, the forearm bare below it.
    const short = look.sleeves === 'short';
    const sleeveTop = shoulder.clone().add(new Vector3(-s * 0.004, 0.008, 0));
    const cuffY = short ? elbow.y + 0.075 : wrist.y + 0.035;
    const radii = short
      ? [0.036, 0.053, 0.062, 0.066, 0.068, 0.069]
      : [0.036, 0.052, 0.06, 0.063, 0.063, 0.061, 0.058, 0.055, 0.052, 0.05, 0.047, 0.045, 0.043, 0.042];
    parts.push({
      geometry: limb(sleeveTop, sleeveTop.y - cuffY, radii, 0.96, 18),
      material: 'shirt',
      color: look.shirt,
      bind: (p) => {
        // The very top rides the collarbone a little (it's tucked inside the shirt's shoulder).
        if (p.y > shoulder.y - 0.02) {
          const w = Math.min(1, (p.y - shoulder.y + 0.02) / 0.03) * 0.3;
          return [
            [`shoulder${side}`, 1 - w],
            [`clavicle${side}`, w],
          ];
        }
        return blendY(`elbow${side}`, `shoulder${side}`, elbow.y - 0.05, elbow.y + 0.05)(p);
      },
    });
    if (short) {
      // A turned hem, then the bare forearm from inside the sleeve down to the wrist.
      const hem = new TorusGeometry(0.066, 0.0055, 6, 20).rotateX(Math.PI / 2).scale(1, 1, 0.96);
      parts.push({ geometry: hem.translate(sleeveTop.x, cuffY + 0.004, sleeveTop.z), material: 'shirt', color: look.shirtTrim, bind: `shoulder${side}` });
      const forearmTop = new Vector3(sleeveTop.x, cuffY + 0.03, sleeveTop.z);
      const forearm = limb(forearmTop, forearmTop.y - wrist.y, [0.043, 0.045, 0.044, 0.042, 0.039, 0.035, 0.032, 0.03], 0.92, 14);
      parts.push({ geometry: forearm, material: 'skin', color: look.skin, bind: blendY(`elbow${side}`, `shoulder${side}`, elbow.y - 0.05, elbow.y + 0.05) });
    } else {
      // A buttoned cuff.
      const cuff = new CylinderGeometry(0.043, 0.043, 0.05, 18).scale(1, 1, 0.94).translate(wrist.x, cuffY + 0.002, wrist.z);
      parts.push({ geometry: cuff, material: 'shirt', color: look.shirtTrim, bind: `elbow${side}` });
    }
    // The bit of wrist between the sleeve (or forearm) and the hand.
    const wristSkin = new CylinderGeometry(0.029, 0.032, 0.05, 14).translate(wrist.x, wrist.y + 0.01, wrist.z);
    parts.push({ geometry: wristSkin, material: 'skin', color: look.skin, bind: `elbow${side}` });
  }
  return parts;
}

/**
 * The left leg of the jeans (the right is its mirror), waist to hem. The two legs are one garment: at the top each
 * is half of the pelvis, flat on the inside where it meets the other at the middle, so together they make one seat
 * and waist, with a soft seam down the middle; below the crotch they part into two legs.
 */
const JEANS_LEG: readonly Ring[] = [
  { y: 0.095, cx: 0.1, out: 0.057, front: 0.057, back: 0.057, fwd: -0.009, pOut: 1 },
  { y: 0.2, cx: 0.1, out: 0.057, front: 0.056, back: 0.058, fwd: -0.002, pOut: 1 },
  { y: 0.31, cx: 0.1, out: 0.058, front: 0.057, back: 0.061, fwd: 0.004, pOut: 1 },
  { y: 0.4, cx: 0.1, out: 0.059, front: 0.059, back: 0.06, fwd: 0.009, pOut: 1 },
  { y: 0.47, cx: 0.1, out: 0.06, front: 0.062, back: 0.058, fwd: 0.012, pOut: 1 },
  { y: 0.53, cx: 0.1, out: 0.063, front: 0.065, back: 0.064, fwd: 0.01, pOut: 1 },
  { y: 0.61, cx: 0.1, out: 0.068, in: 0.066, front: 0.071, back: 0.072, fwd: 0.008, pOut: 0.97, pIn: 0.97 },
  { y: 0.69, cx: 0.1, out: 0.073, in: 0.07, front: 0.077, back: 0.078, fwd: 0.006, pOut: 0.93, pIn: 0.9 },
  { y: 0.765, cx: 0.096, out: 0.077, in: 0.074, front: 0.084, back: 0.086, fwd: 0.005, pOut: 0.9, pIn: 0.75 },
  { y: 0.81, cx: 0.09, out: 0.081, in: 0.086, front: 0.09, back: 0.097, fwd: 0.004, pOut: 0.88, pIn: 0.55 },
  { y: 0.865, cx: 0.085, out: 0.086, in: 0.088, front: 0.095, back: 0.106, fwd: 0.002, pOut: 0.85, pIn: 0.42 },
  { y: 0.925, cx: 0.081, out: 0.088, in: 0.085, front: 0.096, back: 0.104, pOut: 0.82, pIn: 0.38 },
  { y: 0.98, cx: 0.077, out: 0.084, in: 0.082, front: 0.092, back: 0.096, pOut: 0.8, pIn: 0.35 },
  { y: 1.012, cx: 0.075, out: 0.08, in: 0.08, front: 0.088, back: 0.09, pOut: 0.8, pIn: 0.35 },
];

function legs(look: HumanLook): Part[] {
  const parts: Part[] = [];
  for (const side of ['L', 'R'] as const) {
    const hip = jointAt(`hip${side}`);
    const knee = jointAt(`knee${side}`);
    const ankle = jointAt(`ankle${side}`);
    const hipBone: BoneName = `hip${side}`;
    const kneeBone: BoneName = `knee${side}`;
    // Denim is a little faded down the front of the thighs and over the knees; work trousers are one plain colour.
    const leg = paint(loftRings(JEANS_LEG, side === 'R'), (p, n, out) => {
      const fade = look.pantsFade
        ? Math.max(0, n.z) ** 2 * (0.55 * smoothstep(0.55, 0.72, p.y) * (1 - smoothstep(0.82, 0.9, p.y)) + 0.45 * Math.exp(-(((p.y - knee.y) / 0.07) ** 2)))
        : 0;
      out.set(look.pants).lerp(DENIM_FADE, fade * 0.7);
    });
    parts.push({
      geometry: leg,
      material: 'jeans',
      color: look.pants,
      bind: (p) => {
        // The pelvis goes with the hips; the thigh with the leg, blending across the seat and the top of the thigh.
        // Behind, the seat stays with the pelvis a little further down, so a bent thigh (sitting, kneeling) doesn't
        // lift it up through the shirt's tail.
        if (p.y > knee.y + 0.13) {
          const lower = p.z < 0 ? 0.07 * Math.min(1, -p.z / 0.06) : 0;
          const w = smoothstep(hip.y + 0.02 - lower, hip.y - 0.17 - lower, p.y);
          return [
            ['hips', 1 - w],
            [hipBone, w],
          ];
        }
        return blendY(kneeBone, hipBone, knee.y - 0.06, knee.y + 0.06)(p);
      },
    });
    // Knee caps keep a bent knee round; a stitched hem.
    parts.push({ geometry: new SphereGeometry(0.052, 12, 8).translate(knee.x, knee.y, knee.z - 0.002), material: 'jeans', color: look.pants, bind: kneeBone });
    const seam = new TorusGeometry(0.057, 0.0045, 5, 20).rotateX(Math.PI / 2);
    parts.push({ geometry: seam.translate(ankle.x, JEANS_LEG[0]!.y + 0.004, ankle.z), material: 'jeans', color: look.pantsSeam, bind: kneeBone });
    // Ankle and foot, the sole flat on the floor at rest.
    const feet = look.feet;
    if (feet.kind === 'shoes') {
      // A plain black work shoe on each foot: the foot's shape a little bigger (about the ankle, so the sole stays on
      // the floor), on a slightly paler sole.
      const bind: Bind = `ankle${side}`;
      const around = (g: BufferGeometry, sx: number, sy: number, sz: number) => g.translate(-ankle.x, 0, -ankle.z).scale(sx, sy, sz).translate(ankle.x, 0, ankle.z);
      parts.push({ geometry: new CylinderGeometry(0.038, 0.042, 0.09, 12).translate(ankle.x, ankle.y + 0.02, ankle.z), material: 'sock', color: feet.shoe, bind });
      parts.push({ geometry: around(foot(ankle), 1.13, 1.18, 1.08), material: 'sock', color: feet.shoe, bind });
      parts.push({ geometry: around(foot(ankle), 1.17, 0.3, 1.11), material: 'sock', color: feet.sole, bind });
      continue;
    }
    // The left in the striped sock, the right bare (Moke has the other sock).
    const socked = side === 'L';
    const material: MaterialName = socked ? 'sock' : 'skin';
    const color = socked ? feet.sock : look.skin;
    parts.push({ geometry: new CylinderGeometry(0.035, 0.039, 0.09, 12).translate(ankle.x, ankle.y + 0.02, ankle.z), material, color, bind: `ankle${side}` });
    parts.push({ geometry: foot(ankle), material, color, bind: `ankle${side}` });
    if (socked) {
      for (const y of [ankle.y + 0.04, ankle.y + 0.012]) {
        const stripe = new TorusGeometry(0.038, 0.0065, 5, 16).rotateX(Math.PI / 2);
        parts.push({ geometry: stripe.translate(ankle.x, y, ankle.z), material: 'sock', color: feet.stripe, bind: `ankle${side}` });
      }
    } else {
      // Toes, the big toe on the inside.
      const inward = -Math.sign(ankle.x);
      for (let k = 0; k < 4; k++) {
        const toe = new SphereGeometry(0.0135 - k * 0.0015, 8, 6);
        parts.push({ geometry: toe.translate(ankle.x + inward * (0.02 - k * 0.019), 0.013, ankle.z + 0.172 - k * 0.008), material: 'skin', color: look.skin, bind: `ankle${side}` });
      }
    }
  }
  return parts;
}
const DENIM_FADE = new Color('#7d97b9');

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
    white: { x: 0.0178, y: 0.0114, z: 0.0072 },
    lid: { x: 0.0194, y: 0.0128, z: 0.0094 },
    iris: 0.0086,
    /** How far each eye turns outward with the face (rad). */
    turn: 0.3,
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

function head(look: HumanLook): Part[] {
  const parts: Part[] = [];
  const skin = (geometry: BufferGeometry, color = look.skin): Part => ({ geometry, material: 'skin', color, bind: 'head' });
  const face = (geometry: BufferGeometry, color: string, bind: Bind = 'head'): Part => ({ geometry, material: 'face', color, bind });
  parts.push(skin(onHead(SKULL.clone(), 0, 0, 0)));
  // Ears (outlined with the head), a soft nose and the lips (drawn without a line, like Moke's muzzle).
  for (const sx of [1, -1]) parts.push(skin(onHead(new SphereGeometry(0.027, 10, 8).scale(0.4, 1.22, 0.74).rotateY(sx * 0.25), sx * 0.094, 0.06, -0.01)));
  parts.push(face(onHead(new SphereGeometry(1, 12, 10).scale(0.0085, 0.019, 0.0075).rotateX(0.3), 0, 0.046, faceZ(0, 0.046) - 0.004), look.skin));
  parts.push(face(onHead(new SphereGeometry(1, 14, 10).scale(0.0128, 0.0092, 0.0082), 0, 0.034, faceZ(0, 0.034) - 0.0015), look.skin));
  parts.push(face(onHead(new SphereGeometry(0.015, 12, 6).scale(1.05, 0.3, 0.4), 0, MOUTH.y - 0.009, faceZ(0, MOUTH.y - 0.01) - 0.003), look.lips));

  // Eyes: the whites on the head, the irises and pupils on the eye bones (they slide), a catch-light that stays put.
  for (const [sx, side] of [
    [1, 'L'],
    [-1, 'R'],
  ] as const) {
    // Each eye turns a little outward with the face, so its outer corner follows the head round instead of poking out.
    const turn = sx * EYE.turn;
    const eye = (g: BufferGeometry, x: number, y: number, z: number) => onHead(g.translate(x, y, z).rotateY(turn), sx * EYE.x, EYE.y, EYE.z);
    const white = EYE.white;
    parts.push(face(eye(new SphereGeometry(1, 20, 14).scale(white.x, white.y, white.z), 0, 0, -0.002), COLORS.eyeWhite));
    const front = white.z - 0.002;
    const iris = new CylinderGeometry(EYE.iris, EYE.iris, 0.0012, 20).rotateX(Math.PI / 2);
    parts.push(face(eye(iris, 0, 0, front - 0.0002), look.iris, `eye${side}`));
    const pupil = new CylinderGeometry(EYE.iris * 0.52, EYE.iris * 0.52, 0.0012, 16).rotateX(Math.PI / 2);
    parts.push(face(eye(pupil, 0, 0, front + 0.0003), COLORS.pupil, `eye${side}`));
    const glint = new CylinderGeometry(0.0021, 0.0021, 0.0008, 10).rotateX(Math.PI / 2);
    parts.push(face(eye(glint, 0.0033, 0.0033, front + 0.0009), COLORS.catchLight, `eye${side}`));
    // The upper lid: skin over the eye, scaled down from the top of the eye by its bone (open … shut).
    parts.push(face(eye(new SphereGeometry(1, 20, 12).scale(EYE.lid.x, EYE.lid.y, EYE.lid.z), 0, 0, -0.002), look.skin, `lid${side}`));
    parts.push(face(eye(lashLine(), 0, EYE.lid.y - LID.open * EYE.lid.y * 2 * 0.92, 0), COLORS.lash, `lash${side}`));
    // Straight, natural brows: a little fuller toward the middle, tapering outward.
    const brow = new CapsuleGeometry(0.0039, 0.028, 4, 8).rotateZ(Math.PI / 2);
    const bp = brow.getAttribute('position');
    for (let i = 0; i < bp.count; i++) {
      const bx = bp.getX(i);
      const taper = 1 - 0.45 * Math.max(0, (bx * sx) / 0.019);
      bp.setY(i, bp.getY(i) * taper + 0.004 * (1 - (bx / 0.019) ** 2));
    }
    brow.rotateZ(sx * -0.04);
    parts.push(face(onHead(brow, sx * (EYE.x + 0.002), EYE.y + BROW_ABOVE_EYE, BROW_Z), look.brow, `brow${side}`));
  }

  // Mouth: a smile line (scales with the smile), and an open mouth the jaw bone opens (scale y).
  const smileLine = new TorusGeometry(0.014, 0.0015, 6, 18, Math.PI).rotateZ(Math.PI);
  parts.push(face(onHead(smileLine, 0, MOUTH.y + 0.004, MOUTH.z + 0.002), COLORS.lash, 'smile'));
  parts.push(face(onHead(new SphereGeometry(0.016, 16, 10).scale(1, 0.9, 0.4), 0, MOUTH.y - 0.002, MOUTH.z - 0.002), COLORS.mouth, 'jaw'));
  parts.push(face(onHead(new BoxGeometry(0.018, 0.004, 0.004), 0, MOUTH.y + 0.009, MOUTH.z + 0.002), COLORS.teeth, 'jaw'));

  // Hair: short, sculpted into soft locks that grow from the crown and sweep forward and to his right, their tips
  // making the hairline, the fringe and the nape (see hairShell). Under a cap it lies flat where the cap covers it,
  // so only the sides above the ears and the back show.
  const capBase = SKULL_CENTER + 0.026;
  const hair = hairShell(look.hair, look.cap ? (capBase - SKULL_CENTER) / SKULL_SIZE.up : null);
  parts.push({ geometry: onHead(hair, 0, 0, 0), material: 'hair', color: look.hair, bind: 'head' });
  if (look.cap) {
    // A peaked cap: a rounded crown over the top of the head, sitting above the ears, a stiff brim curving out over
    // the brow, a button on top.
    const c = look.cap;
    const base = capBase;
    const crown = new SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(SKULL_SIZE.x + 0.01, SKULL_SIZE.up - 0.004, SKULL_SIZE.z + 0.013);
    parts.push({ geometry: onHead(crown, 0, base, -0.002), material: 'hair', color: c.crown, bind: 'head' });
    const band = new CylinderGeometry(SKULL_SIZE.x + 0.015, SKULL_SIZE.x + 0.015, 0.02, 28, 1, true).scale(1, 1, (SKULL_SIZE.z + 0.018) / (SKULL_SIZE.x + 0.015));
    parts.push({ geometry: onHead(band, 0, base + 0.008, -0.002), material: 'hair', color: c.brim, bind: 'head' });
    const brim = new CylinderGeometry(0.098, 0.098, 0.008, 24, 1, false, -Math.PI / 2, Math.PI).scale(0.95, 1, 0.78);
    const bp = brim.getAttribute('position');
    for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) - 0.8 * bp.getX(i) ** 2);
    brim.computeVertexNormals();
    parts.push({ geometry: onHead(brim.rotateX(0.18), 0, base + 0.004, SKULL_SIZE.z + 0.004), material: 'hair', color: c.brim, bind: 'head' });
    parts.push({ geometry: onHead(new SphereGeometry(0.01, 10, 6).scale(1, 0.55, 1), 0, base + SKULL_SIZE.up - 0.004, -0.002), material: 'hair', color: c.brim, bind: 'head' });
  }
  return parts;
}

/** Where the hairline is, as a height on the unit skull (1 = crown), round the head (0 = the middle of the forehead). */
function hairline(around: number): number {
  const base = 0.105 + 0.56 * Math.cos(around) - 0.045 * Math.cos(2 * around);
  // The front dips a little on his right, where it's swept across, and rises at the parting on his left.
  return base - 0.1 * Math.exp(-(((around + 0.35) / 0.32) ** 2)) + 0.05 * Math.exp(-(((around - 0.5) / 0.22) ** 2));
}

/**
 * The hair's shape: how many locks round the crown, how much they twist as they grow (rad per rad), their tips; and
 * its shading from the look's hair colour (sRGB): this much darker between the locks, this far toward white along them.
 */
const HAIR = { locks: 13, twist: -0.55, ridge: 0.0055, tipFront: 0.085, tipSide: 0.03, tipBack: 0.05, deep: 0.6, sheen: 0.17 };
/** The crown whorl the hair grows from (a direction on the unit skull: the back of the top, a little to his right). */
const CROWN = new Vector3(-0.1, 0.8, -0.58).normalize();
const CROWN_E1 = new Vector3(1, 0, 0).addScaledVector(CROWN, -CROWN.x).normalize();
const CROWN_E2 = new Vector3().crossVectors(CROWN, CROWN_E1);
/** Under a cap, the hair lies this close to the scalp (m): well inside the cap's crown. */
const HAIR_UNDER_CAP = 0.003;

/** The hair's two shades from its colour: deep between the locks, a soft sheen down the middle of each. */
function hairShades(hair: string): { deep: Color; sheen: Color } {
  const { r, g, b } = new Color(hair).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  return {
    deep: new Color().setRGB(r * HAIR.deep, g * HAIR.deep, b * HAIR.deep, SRGBColorSpace),
    sheen: new Color().setRGB(lerp(r, 1, HAIR.sheen), lerp(g, 1, HAIR.sheen), lerp(b, 1, HAIR.sheen), SRGBColorSpace),
  };
}

/**
 * The hair as one sculpted shell over the skull: fuller on top and at the front, close at the back and sides, swept
 * to his right. It's divided into locks that radiate from the crown and curve as they go (ridges in the shape, a
 * soft sheen along each lock); where each lock ends it reaches a little past the hairline, so the fringe, sideburns
 * and nape are scalloped by lock tips instead of cut along a line. Below the hairline the shell tucks under the skin.
 * Under a cap (`capAt`: the cap's lower edge, as a height on the unit skull) it lies flat to the scalp above that edge.
 */
function hairShell(color: string, capAt: number | null): BufferGeometry {
  const { deep, sheen } = hairShades(color);
  const g = new SphereGeometry(1, 64, 56);
  const p = g.getAttribute('position');
  const colors = new Float32Array(p.count * 3);
  const d = new Vector3();
  const v = new Vector3();
  const c = new Color();
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i);
    const { x, y, z } = d;
    const around = Math.atan2(x, z);
    // Which lock this is on: the angle round the crown (twisting with distance), as a ridge 0 (between) … 1 (middle).
    const fromCrown = Math.acos(Math.max(-1, Math.min(1, d.dot(CROWN))));
    v.copy(d).addScaledVector(CROWN, -d.dot(CROWN));
    const turn = Math.atan2(v.dot(CROWN_E2), v.dot(CROWN_E1)) + HAIR.twist * fromCrown;
    const phase = (turn / (Math.PI * 2)) * HAIR.locks;
    const lock = 0.5 + 0.5 * Math.cos(phase * Math.PI * 2);
    // The locks only separate once they've grown away from the whorl.
    const grown = smoothstep(0.3, 0.9, fromCrown);
    const front = Math.max(0, Math.cos(around));
    const tip = HAIR.tipSide + (HAIR.tipFront - HAIR.tipSide) * front + (HAIR.tipBack - HAIR.tipSide) * Math.max(0, -Math.cos(around));
    const edge = hairline(around) - tip * lock * grown;
    const inside = smoothstep(edge - 0.01, edge + 0.028, y);
    const top = smoothstep(0.25, 0.95, y);
    // Volume: close at the back and sides, fuller on top and toward the front, a little more on his right (the sweep).
    let thick = 0.007 + 0.02 * top * (0.5 + 0.5 * front) + 0.007 * top * Math.max(0, -Math.sin(around)) * front;
    thick += HAIR.ridge * (lock - 0.5) * grown * inside;
    // The parting: a slight groove on his left.
    thick -= 0.004 * Math.exp(-(((around - 0.5) / 0.1) ** 2)) * smoothstep(0.4, 0.8, y);
    thick = lerp(-0.006, thick, inside);
    // Flattened under the cap, easing in just below its edge, so none of it pokes out through the crown.
    if (capAt !== null) thick = lerp(thick, Math.min(thick, HAIR_UNDER_CAP), smoothstep(capAt - 0.08, capAt, y));
    const jaw = y < 0 ? 1 - 0.17 * Math.pow(-y, 1.7) : 1;
    const ry = y < 0 ? SKULL_SIZE.down : SKULL_SIZE.up;
    const fullness = z > 0 && y < 0.2 ? 0.02 * Math.max(0, 0.2 - y) * z : 0;
    p.setXYZ(i, x * (SKULL_SIZE.x * jaw + thick), SKULL_CENTER + y * (ry + thick), z * (SKULL_SIZE.z * jaw + thick) + fullness);
    // A soft sheen down the middle of each lock, darker between them.
    c.copy(deep).lerp(sheen, (0.15 + 0.85 * lock * lock) * (0.35 + 0.65 * grown) * (0.6 + 0.4 * top));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function hands(look: HumanLook): Part[] {
  const parts: Part[] = [];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const wrist = jointAt(`wrist${side}`);
    const fingers = jointAt(`fingers${side}`);
    const thumb = jointAt(`thumb${side}`);
    // Palm: a soft slab, palm toward the thigh (±x), thumb forward; a man's hand.
    const palm = new RoundedBoxGeometry(0.032, 0.094, 0.082, 3, 0.014);
    parts.push({ geometry: palm.translate(wrist.x, wrist.y - 0.05, wrist.z + 0.005), material: 'skin', color: look.skin, bind: `wrist${side}` });
    parts.push({
      geometry: new CylinderGeometry(0.029, 0.031, 0.03, 12).scale(0.72, 1, 1).translate(wrist.x, wrist.y + 0.003, wrist.z),
      material: 'skin',
      color: look.skin,
      bind: blendY(`wrist${side}`, `elbow${side}`, wrist.y - 0.01, wrist.y + 0.02),
    });
    // Four fingers, curling together from the knuckles.
    for (let k = 0; k < 4; k++) {
      const len = [0.064, 0.072, 0.068, 0.054][k]!;
      const finger = new CapsuleGeometry(0.01, len - 0.02, 4, 8);
      parts.push({ geometry: finger.translate(fingers.x, fingers.y - len / 2 + 0.006, fingers.z + 0.031 - k * 0.0205), material: 'skin', color: look.skin, bind: `fingers${side}` });
    }
    const thumbGeometry = new CapsuleGeometry(0.011, 0.036, 4, 8).rotateX(0.5).rotateZ(sx * 0.2);
    parts.push({ geometry: thumbGeometry.translate(thumb.x - sx * 0.004, thumb.y - 0.026, thumb.z + 0.012), material: 'skin', color: look.skin, bind: `thumb${side}` });
  }
  return parts;
}
