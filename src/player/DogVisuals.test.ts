import { Box3, Group, Mesh, Vector3, type BufferAttribute, type InterleavedBufferAttribute, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { MOKE_ANIMATION } from '../config/animation';
import { dogById } from '../config/dogs';
import { MOKE_BODY } from '../config/movement';
import { MOKE_CHARACTER } from '../config/mokeCharacter';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Moke } from './Moke';
import { MokeAnimationController, type MokeAnimationState } from './MokeAnimationController';
import { MokeController } from './MokeController';
import { createDogVisual, createPreviewVisual } from './MokeVisual';
import { ToonMokeVisual } from './ToonMokeVisual';
import { TRICKS } from './Tricks';

const DT = 1 / 60;
const dougie = dogById('dougie');
const nori = dogById('nori');
const moke = dogById('moke');

function pose(over: Partial<MokeAnimationState> = {}): MokeAnimationState {
  return { ...new MokeAnimationController().state, ...over };
}

function furMeshes(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((o) => {
    // The fur clumps (the teeth share the fur's geometry attributes, but aren't fur).
    if (o instanceof Mesh && o.geometry.hasAttribute('smoothNormal') && !(o.parent instanceof Mesh) && o.name !== 'growlTeeth') found.push(o);
  });
  return found;
}

function finite(root: Object3D): boolean {
  let ok = true;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.matrixWorld.elements.every(Number.isFinite)) ok = false;
  });
  return ok;
}

/** Luminance of a vertex colour. */
function luminance(color: BufferAttribute | InterleavedBufferAttribute, i: number): number {
  return 0.2126 * color.getX(i) + 0.7152 * color.getY(i) + 0.0722 * color.getZ(i);
}

describe("Dougie's coat", () => {
  it('every fur mesh carries his coat colours (dark, white and tan); Moke has none and stays one colour', () => {
    const d = new ToonMokeVisual(dougie.look);
    const fur = furMeshes(d.object);
    expect(fur.length).toBeGreaterThanOrEqual(8);
    const shades = new Set<string>();
    for (const mesh of fur) {
      const color = mesh.geometry.getAttribute('color');
      expect(color, mesh.name).toBeDefined();
      for (let i = 0; i < color.count; i += 37) {
        const l = luminance(color, i);
        shades.add(l < 0.1 ? 'dark' : l > 0.8 ? 'white' : 'mid');
      }
    }
    expect([...shades].sort()).toEqual(['dark', 'mid', 'white']);
    const m = new ToonMokeVisual(moke.look);
    for (const mesh of furMeshes(m.object)) expect(mesh.geometry.hasAttribute('color'), mesh.name).toBe(false);
    d.dispose();
    m.dispose();
  });
});

describe("Nori's coat", () => {
  it('is warm apricot all over (no dark or grey patches), with ears deeper than the rest of the coat', () => {
    const n = new ToonMokeVisual(nori.look);
    const fur = furMeshes(n.object);
    expect(fur.length).toBeGreaterThanOrEqual(8);
    const mean = (name?: string) => {
      let sum = 0;
      let count = 0;
      for (const mesh of fur.filter((f) => name === undefined || f.name === name)) {
        const color = mesh.geometry.getAttribute('color');
        for (let i = 0; i < color.count; i++, count++) sum += luminance(color, i);
      }
      return sum / count;
    };
    for (const mesh of fur) {
      const color = mesh.geometry.getAttribute('color');
      expect(color, mesh.name).toBeDefined();
      for (let i = 0; i < color.count; i += 29) {
        // Apricot and cream: red over green over blue, and never dark (Dougie's charcoal is about 0.04).
        expect(color.getX(i), mesh.name).toBeGreaterThan(color.getY(i));
        expect(color.getY(i), mesh.name).toBeGreaterThan(color.getZ(i));
        expect(luminance(color, i), mesh.name).toBeGreaterThan(0.25);
      }
    }
    expect(mean('ear')).toBeLessThan(mean() - 0.05);
    n.dispose();
  });
});

describe.each([dougie, nori])("$name's build (the same toon dog as Moke, a look of their own)", (dog) => {
  it('is a procedural toon dog with working mouth, collar and back sockets', () => {
    const { visual, kind } = createDogVisual(dog, undefined, false);
    expect(kind).toBe('stand-in');
    expect(visual).toBeInstanceOf(ToonMokeVisual);
    expect(visual.attachments.mouth.name).toBe('socket_mouth');
    expect(visual.attachments.collar?.name).toBe('socket_collar');
    expect(visual.attachments.back?.name).toBe('socket_back');
    visual.dispose();
  });

  it('has the same gameplay-compatible size as Moke (only the ears differ)', () => {
    const d = new ToonMokeVisual(dog.look);
    const m = new ToonMokeVisual(moke.look);
    d.update(DT, pose());
    m.update(DT, pose());
    const bd = new Box3().setFromObject(d.object, true);
    const bm = new Box3().setFromObject(m.object, true);
    expect(bd.max.y).toBeCloseTo(bm.max.y, 1);
    expect(bd.max.y).toBeLessThan(MOKE_ANIMATION.duckBelowHeadroom);
    expect(Math.abs(bd.max.z - bm.max.z)).toBeLessThan(0.02);
    expect(bd.min.y).toBeGreaterThan(-0.01);
    expect(bd.max.y).toBeLessThan(MOKE_CHARACTER.size.headTop + 0.05);
    d.dispose();
    m.dispose();
  });

  it('animates through everything a dog does: walking, running, jumping, sniffing, barking, growling, eating, drinking, carrying, chewing, tugging, digging, resting and every trick', () => {
    const d = new ToonMokeVisual(dog.look);
    const states: Partial<MokeAnimationState>[] = [
      { speed: 1.2, gait: 'trot' }, { speed: 4, gait: 'run', runBlend: 1 }, { air: 1, rise: 1 }, { air: 1, rise: -1 }, { land: 1 },
      { sniff: 1 }, { bark: 1 }, { growl: 1 }, { eat: 1 }, { drink: 1 }, { carry: 1 }, { carry: 1, chew: 1, chewPhase: 0.5 },
      { tug: 1 }, { dig: 1 }, { rest: 1 }, { sit: 1 }, { stretch: 1 }, { crouch: 1 }, { headTilt: 0.3, headYaw: 0.5, headPitch: 0.3 },
      ...TRICKS.map((trick) => ({ trick, trickTime: 0.8, trickBlend: 1 })),
    ];
    for (const s of states) {
      d.update(DT, pose(s));
      expect(finite(d.object), JSON.stringify(s)).toBe(true);
    }
    d.dispose();
  });

  it('carries things in the mouth: a held toy rides at the front of the face, and moves with the head', () => {
    const d = new ToonMokeVisual(dog.look);
    const toy = new Group();
    d.attachments.mouth.add(toy);
    d.update(DT, pose({ carry: 1 }));
    d.object.updateMatrixWorld(true);
    const held = toy.getWorldPosition(new Vector3());
    expect(held.z).toBeGreaterThan(0.08); // in front of the middle
    expect(held.y).toBeGreaterThan(0.15);
    expect(held.y).toBeLessThan(0.4);
    d.update(DT, pose({ carry: 1, sniff: 1 }));
    d.update(DT, pose({ carry: 1, sniff: 1 }));
    d.object.updateMatrixWorld(true);
    expect(toy.getWorldPosition(new Vector3()).distanceTo(held)).toBeGreaterThan(0.005);
    d.dispose();
  });

  it('a preview copy is its own visual, never the game one', () => {
    const a = createPreviewVisual(dog, undefined);
    const b = createDogVisual(dog, undefined, false).visual;
    expect(a).not.toBe(b);
    expect(a.object).not.toBe(b.object);
    a.dispose();
    b.dispose();
  });
});

describe('Moke.setVisual: a new look on the same dog body', () => {
  it('replaces the old visual in the scene, disposes it, and poses the new one where the body is', async () => {
    const physics = await PhysicsWorld.create();
    const body = new CharacterBody(physics, { x: 1.5, y: 0, z: -2 }, MOKE_BODY);
    const scene = new Group();
    const old = new ToonMokeVisual(moke.look);
    const dog = new Moke(new MokeController(body, 0.7), old);
    scene.add(dog.visual.object);
    let disposed = false;
    const dispose = old.dispose.bind(old);
    old.dispose = () => {
      disposed = true;
      dispose();
    };
    const next = new ToonMokeVisual(dougie.look);
    dog.setVisual(next);
    expect(dog.visual).toBe(next);
    expect(scene.children).toEqual([next.object]);
    expect(disposed).toBe(true);
    expect(next.object.position.x).toBeCloseTo(1.5, 5);
    expect(next.object.position.z).toBeCloseTo(-2, 5);
    expect(next.object.rotation.y).toBeCloseTo(0.7, 5);
    dog.setVisual(next); // the same again: nothing happens
    expect(scene.children).toEqual([next.object]);
    next.dispose();
    physics.world.free();
  });
});
