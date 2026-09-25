import {
  AnimationMixer,
  AnimationUtils,
  Box3,
  Euler,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  Object3D,
  Quaternion,
  type AnimationAction,
  type AnimationClip,
  type Material,
} from 'three';
import { MOKE_ANIMATION } from '../../config/animation';
import { MOKE_CHARACTER } from '../../config/mokeCharacter';
import { MOKE_LOOK } from '../../config/mokeLook';
import { clamp, damp, lerp } from '../../utils/math';
import { mulberry32 } from '../../utils/random';
import type { MokeAnimationState } from '../MokeAnimationController';
import type { MokeAttachments, MokeVisual } from '../MokeVisual';
import { ADDITIVE_CLIPS, CLIP_NAMES, createClipTargets, isMokeClip, MOKE_CLIPS, selectClips, type MokeClipName } from './clips';

/** How quickly clip weights follow their targets (per second): smooth crossfades, no snapping. */
const BLEND_RATE = 10;
/** Envelope length (s) for a pickup/drop when the model has no clip for it. */
const EVENT_TIME = 0.45;
/** Ducking without a `duck` clip: how far the head dips and the tail root lowers (radians) at full crouch. */
const DUCK_HEAD_DIP = 0.45;
const DUCK_TAIL_DROP = 0.8;

interface ClipAction {
  name: MokeClipName;
  action: AnimationAction;
  loop: boolean;
  weight: number;
}

/** A bone the game turns on top of the clips, with its rest pose so procedural turns never accumulate. */
interface DrivenBone {
  bone: Object3D;
  rest: Quaternion;
}

type Config = typeof MOKE_CHARACTER;

/**
 * The final Moke: a rigged, animated `moke.glb` that follows the conventions in `config/mokeCharacter.ts` and
 * docs/MOKE_3D_SPEC.md. Clips are blended from the model-independent animation state (see `selectClips`), and a
 * light procedural layer adds what's better done live: glancing at things, head tilts, tail wag, ear bounce,
 * an open jaw for barks and panting, and blinks. Everything optional is optional: missing clips, bones, sockets
 * or morphs are reported in `issues` and simply skipped, never a crash.
 */
export class GltfMokeVisual implements MokeVisual {
  readonly object = new Group();
  readonly attachments: MokeAttachments;
  /** Anything that doesn't match the spec (for the console and debug panel). Empty = all good. */
  readonly issues: string[] = [];
  readonly clips: readonly MokeClipName[];

  private readonly model: Object3D;
  private readonly mixer: AnimationMixer;
  private readonly actions: ClipAction[] = [];
  private readonly available: Set<string>;
  private readonly targets = createClipTargets();
  private readonly head: DrivenBone | null;
  private readonly neck: DrivenBone | null;
  private readonly jaw: DrivenBone | null;
  private readonly ears: DrivenBone[];
  private readonly tail: DrivenBone[];
  private readonly blinkMorphs: { mesh: Mesh; index: number }[] = [];
  private readonly hasDuckClip: boolean;
  private readonly random = mulberry32(2024);
  private carrying = false;
  private lastRest = 0;
  private restRising = false;
  private pickupLeft = 0;
  private dropLeft = 0;
  private untilBlink: number = MOKE_LOOK.blink.every[0];
  private blinkLeft = 0;
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private readonly turn = new Quaternion();
  private readonly parentWorld = new Quaternion();
  private readonly modelWorld = new Quaternion();
  private readonly parentInverse = new Quaternion();
  /** Every driven bone, for resetting to rest each frame. */
  private readonly driven: DrivenBone[];

  constructor(gltf: { scene: Object3D; animations: readonly AnimationClip[] }, config: Config = MOKE_CHARACTER) {
    this.object.name = 'MokeModel';
    this.model = gltf.scene;
    let meshes = 0;
    this.model.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      meshes++;
      node.castShadow = true;
      node.receiveShadow = true;
      const blink = node.morphTargetDictionary?.[config.morphs.blink];
      if (blink !== undefined) this.blinkMorphs.push({ mesh: node, index: blink });
    });
    if (meshes === 0) throw new Error('the model has no meshes');

    // Scale and orientation come from config only; nothing else in the game compensates.
    const pivot = new Group();
    pivot.rotation.y = config.model.yawOffset;
    pivot.scale.setScalar(config.model.scale);
    pivot.add(this.model);
    this.object.add(pivot);
    this.checkSize(config);

    const find = (name: string): Object3D | null => this.model.getObjectByName(name) ?? null;
    const drive = (name: string): DrivenBone | null => {
      const bone = find(name);
      return bone ? { bone, rest: bone.quaternion.clone() } : null;
    };
    this.head = drive(config.bones.head);
    this.neck = drive(config.bones.neck);
    this.jaw = drive(config.bones.jaw);
    this.ears = [drive(config.bones.earLeft), drive(config.bones.earRight)].filter((b): b is DrivenBone => b !== null);
    this.tail = config.bones.tail.map(drive).filter((b): b is DrivenBone => b !== null);
    this.driven = [this.head, this.neck, this.jaw, ...this.ears, ...this.tail].filter((b): b is DrivenBone => b !== null);
    if (!this.head) this.issues.push(`no "${config.bones.head}" bone: he can't glance at things or tilt his head`);
    if (this.tail.length === 0) this.issues.push(`no tail bones (${config.bones.tail.join(', ')}): no procedural tail wag`);
    if (!this.jaw) this.issues.push(`no "${config.bones.jaw}" bone: his mouth won't open for barks or panting`);
    if (this.ears.length === 0) this.issues.push(`no ear bones (${config.bones.earLeft}, ${config.bones.earRight}): no ear bounce`);
    if (this.blinkMorphs.length === 0) this.issues.push(`no "${config.morphs.blink}" morph target: he won't blink or close his eyes to rest`);

    this.attachments = {
      mouth: find(config.sockets.mouth) ?? this.fallbackMouth(config),
      collar: find(config.sockets.collar),
      back: find(config.sockets.back),
    };

    this.mixer = new AnimationMixer(this.model);
    for (const clip of gltf.animations) {
      if (!isMokeClip(clip.name)) {
        this.issues.push(`unknown clip "${clip.name}" (ignored; see MOKE_CLIPS for the names the game uses)`);
        continue;
      }
      const loop = MOKE_CLIPS[clip.name].loop;
      // An additive clip is measured against its own first frame (a copy, so the loaded clip stays untouched).
      const action = this.mixer.clipAction(ADDITIVE_CLIPS.has(clip.name) ? AnimationUtils.makeClipAdditive(clip.clone()) : clip);
      action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
      action.clampWhenFinished = !loop;
      action.setEffectiveWeight(0);
      action.play();
      this.actions.push({ name: clip.name, action, loop, weight: 0 });
    }
    this.available = new Set(this.actions.map((a) => a.name));
    this.clips = [...this.available] as MokeClipName[];
    this.hasDuckClip = this.available.has('duck');
    const missing = CLIP_NAMES.filter((name) => MOKE_CLIPS[name].need === 'required' && !this.available.has(name));
    if (missing.length) this.issues.push(`missing required clips: ${missing.join(', ')}`);
  }

  update(dt: number, s: Readonly<MokeAnimationState>): void {
    this.trackEvents(dt, s);
    selectClips(s, { available: this.available, restRising: this.restRising, pickup: this.envelope(this.pickupLeft), drop: this.envelope(this.dropLeft) }, this.targets);
    for (const entry of this.actions) {
      const target = this.targets.get(entry.name)!;
      // A one-shot starts from its first frame each time it's called for.
      if (!entry.loop && target.weight > 0.001 && entry.weight <= 0.001) entry.action.reset();
      entry.weight = damp(entry.weight, target.weight, BLEND_RATE, dt);
      entry.action.setEffectiveWeight(entry.weight);
      entry.action.setEffectiveTimeScale(target.timeScale);
    }

    // Clips overwrite the bones they animate; bones they don't touch go back to rest, so turns never pile up.
    for (const driven of this.driven) driven.bone.quaternion.copy(driven.rest);
    this.mixer.update(dt);
    this.object.updateMatrixWorld(true);
    this.applyProcedural(dt, s);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.model.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.geometry.dispose();
      for (const material of ([] as Material[]).concat(node.material)) material.dispose();
    });
    this.object.removeFromParent();
  }

  /** Pickups and drops are moments: start a short envelope when the carry state flips. */
  private trackEvents(dt: number, s: Readonly<MokeAnimationState>): void {
    const carrying = s.carry > 0.5;
    if (carrying !== this.carrying) {
      if (carrying) this.pickupLeft = this.eventLength('pickup');
      else this.dropLeft = this.eventLength('drop');
      this.carrying = carrying;
    }
    this.pickupLeft = Math.max(0, this.pickupLeft - dt);
    this.dropLeft = Math.max(0, this.dropLeft - dt);
    if (Math.abs(s.rest - this.lastRest) > 1e-4) this.restRising = s.rest > this.lastRest;
    this.lastRest = s.rest;
  }

  private eventLength(name: 'pickup' | 'drop'): number {
    return this.actions.find((a) => a.name === name)?.action.getClip().duration || EVENT_TIME;
  }

  /** Rises fast, holds, and fades at the end: 0..1 from the time left. */
  private envelope(left: number): number {
    return left > 0 ? Math.min(1, left / 0.15) : 0;
  }

  /** Live touches on top of the clips, each turned in the model's own frame (independent of bone axes). */
  private applyProcedural(dt: number, s: Readonly<MokeAnimationState>): void {
    // Ducking under low furniture when the model has no `duck` clip: dip the head and lower the tail.
    const dip = this.hasDuckClip ? 0 : s.crouch;
    // Head held a little higher while carrying (the same lift as the stand-in), plus glancing and tilting:
    // the neck takes some of the turn, the head the rest.
    const pitch = dip * DUCK_HEAD_DIP - s.carry * MOKE_ANIMATION.carryHeadLift - s.headPitch;
    const look = (share: number) => this.euler.set(pitch * share, s.headYaw * share, -s.headTilt * share);
    if (this.neck) this.turnInModelSpace(this.neck.bone, look(0.4));
    if (this.head) this.turnInModelSpace(this.head.bone, look(this.neck ? 0.6 : 1));

    // Tail wag: a side-to-side swing that grows toward the tip.
    const wag = (0.15 + 0.4 * s.tailWag) * Math.sin(s.time * lerp(9, 16, s.tailWag));
    this.tail.forEach((driven, i) =>
      this.turnInModelSpace(driven.bone, this.euler.set(i === 0 ? -dip * DUCK_TAIL_DROP : 0, (wag * (i + 1)) / this.tail.length, 0)),
    );

    // Ears bounce a little with his steps.
    const bounce = clamp(s.speed / 2, 0, 1) * 0.12 * Math.sin(s.time * 14);
    this.ears.forEach((driven, i) => this.turnInModelSpace(driven.bone, this.euler.set(bounce, 0, (i === 0 ? 1 : -1) * bounce)));

    // An open mouth for barks, growls and panting at a run (clips can open it further; this makes sure it shows).
    const open = s.carry < 0.5 ? Math.max(s.bark, s.growl * 0.7, s.runBlend > 0.25 ? 0.6 : 0) : 0;
    if (this.jaw && open > 0) this.turnInModelSpace(this.jaw.bone, this.euler.set(0.35 * open, 0, 0));

    // Blinks, and eyes closed while he's lying in his bed.
    const eyesShut = Math.max(this.blink(dt), s.rest > 0.9 ? 1 : 0);
    for (const { mesh, index } of this.blinkMorphs) {
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = eyesShut;
    }
  }

  /** Turns a bone by `euler`, expressed in the model's frame (+Y up, +Z forward), whatever its own axes are. */
  private turnInModelSpace(bone: Object3D, euler: Euler): void {
    if (euler.x === 0 && euler.y === 0 && euler.z === 0) return;
    this.turn.setFromEuler(euler);
    const parent = bone.parent;
    if (!parent) return;
    parent.getWorldQuaternion(this.parentWorld);
    this.model.getWorldQuaternion(this.modelWorld);
    // local' = parentWorld⁻¹ · model · turn · model⁻¹ · parentWorld · local
    this.turn.premultiply(this.modelWorld).multiply(this.modelWorld.invert());
    this.parentInverse.copy(this.parentWorld).invert();
    this.turn.premultiply(this.parentInverse).multiply(this.parentWorld);
    bone.quaternion.premultiply(this.turn);
  }

  private blink(dt: number): number {
    const { every, duration } = MOKE_LOOK.blink;
    this.untilBlink -= dt;
    if (this.untilBlink <= 0) {
      this.untilBlink = every[0] + this.random() * every[1];
      this.blinkLeft = duration;
    }
    if (this.blinkLeft <= 0) return 0;
    this.blinkLeft -= dt;
    return Math.sin(Math.PI * clamp(1 - this.blinkLeft / duration, 0, 1));
  }

  /** No mouth socket: estimate one in front of the head so carrying still works, and say so. */
  private fallbackMouth(config: Config): Object3D {
    const socket = new Object3D();
    socket.name = 'socket_mouth (estimated)';
    const parent = this.head?.bone ?? this.object;
    if (this.head) socket.position.set(0, -0.03, 0.1);
    else socket.position.set(0, config.size.eyeHeight - 0.06, 0.22);
    parent.add(socket);
    this.issues.push(`no "${config.sockets.mouth}" node: carried things use an estimated mouth position`);
    return socket;
  }

  private checkSize(config: Config): void {
    this.object.updateMatrixWorld(true);
    const height = new Box3().setFromObject(this.object).max.y;
    const expected = config.size.headTop;
    if (Math.abs(height - expected) / expected > config.model.heightTolerance) {
      this.issues.push(`standing height is ${height.toFixed(2)} m; expected about ${expected} m (is it in metres, origin on the floor?)`);
    }
  }
}
