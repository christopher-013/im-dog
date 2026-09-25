import { AnimationClip, Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, QuaternionKeyframeTrack, type Object3D as Node } from 'three';
import { MOKE_CHARACTER } from '../../../config/mokeCharacter';
import { CLIP_NAMES, type MokeClipName } from '../clips';

export interface SyntheticMokeOptions {
  /** Which clips to include (default: all the game knows). */
  clips?: readonly string[];
  /** Include the socket nodes (default true). */
  sockets?: boolean;
  /** Include the procedural bones (head, neck, jaw, ears, tail). Default true. */
  bones?: boolean;
  /** Standing height (m). Default: the spec's head-top height. */
  height?: number;
  /** Leave out the mesh (an unusable model). */
  noMesh?: boolean;
}

/**
 * TEST ONLY: a tiny stand-in for a real `moke.glb`, built the way the spec says (metres, +Y up, +Z forward, origin
 * on the floor, named bones and sockets, named clips), so the model path can be tested without an asset file.
 */
export function syntheticMoke(options: SyntheticMokeOptions = {}): { scene: Group; animations: AnimationClip[] } {
  const { clips = CLIP_NAMES, sockets = true, bones = true, height = MOKE_CHARACTER.size.headTop, noMesh = false } = options;
  const scene = new Group();
  scene.name = 'Scene';
  const bone = (name: string, parent: Node, position: [number, number, number]): Bone => {
    const b = new Bone();
    b.name = name;
    b.position.set(...position);
    parent.add(b);
    return b;
  };
  const b = MOKE_CHARACTER.bones;
  const root = bone(b.root, scene, [0, 0, 0]);
  const pelvis = bone('pelvis', root, [0, 0.2, -0.1]);
  const spine = bone('spine_01', pelvis, [0, 0.01, 0.1]);
  const chest = bone('spine_02', spine, [0, 0.02, 0.08]);
  if (bones) {
    const neck = bone(b.neck, chest, [0, 0.06, 0.04]);
    const head = bone(b.head, neck, [0, 0.06, 0.02]);
    const jaw = bone(b.jaw, head, [0, -0.03, 0.05]);
    bone(b.earLeft, head, [0.07, 0.04, 0]);
    bone(b.earRight, head, [-0.07, 0.04, 0]);
    let parent: Node = pelvis;
    b.tail.forEach((name, i) => (parent = bone(name, parent, i === 0 ? [0, 0.06, -0.12] : [0, 0.04, 0])));
    if (sockets) {
      const mouth = new Object3D();
      mouth.name = MOKE_CHARACTER.sockets.mouth;
      mouth.position.set(0, -0.01, 0.06);
      jaw.add(mouth);
      const collar = new Object3D();
      collar.name = MOKE_CHARACTER.sockets.collar;
      collar.position.set(0, -0.02, 0.05);
      neck.add(collar);
    }
  }
  if (sockets) {
    const back = new Object3D();
    back.name = MOKE_CHARACTER.sockets.back;
    back.position.set(0, 0.09, 0);
    spine.add(back);
  }
  if (!noMesh) {
    const geometry = new BoxGeometry(0.2, height, 0.4);
    if (bones) {
      const blink = geometry.getAttribute('position').clone();
      blink.name = MOKE_CHARACTER.morphs.blink;
      geometry.morphAttributes.position = [blink];
    }
    const body = new Mesh(geometry, new MeshBasicMaterial());
    body.position.y = height / 2;
    scene.add(body);
  }
  const animations = clips.map((name) =>
    new AnimationClip(name, 1, [new QuaternionKeyframeTrack('spine_01.quaternion', [0, 1], [0, 0, 0, 1, 0, 0.0998, 0, 0.995])]),
  );
  return { scene, animations };
}

export const ALL_CLIPS: readonly MokeClipName[] = CLIP_NAMES;
