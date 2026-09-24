import { Box3, Mesh, Raycaster, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { MOKE_ANIMATION } from '../config/animation';
import { MokeAnimationController, type MokeAnimationState } from './MokeAnimationController';
import { ToonMokeVisual } from './ToonMokeVisual';
import { TRICKS } from './Tricks';

const DT = 1 / 60;

function pose(over: Partial<MokeAnimationState> = {}): MokeAnimationState {
  return { ...new MokeAnimationController().state, ...over };
}

function meshes(root: Object3D, name?: string): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh && (name === undefined || o.name === name)) found.push(o);
  });
  return found;
}

describe('ToonMokeVisual', () => {
  it('builds without a DOM (no canvas textures) and stays within a small draw budget', () => {
    const visual = new ToonMokeVisual();
    visual.update(DT, pose());
    const all = meshes(visual.object);
    expect(all.length).toBeLessThanOrEqual(34);
    const triangles = all.reduce((sum, m) => sum + (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3, 0);
    expect(triangles).toBeLessThan(110_000);
    visual.dispose();
  });

  it('keeps his fluffy head low enough to duck under the coffee table', () => {
    const visual = new ToonMokeVisual();
    visual.update(DT, pose());
    const box = new Box3().setFromObject(visual.object, true);
    expect(box.max.y).toBeLessThan(MOKE_ANIMATION.duckBelowHeadroom);
    expect(box.min.y).toBeGreaterThan(-0.01);

    // Under the coffee table (0.40 m clear), he ducks just enough to fit.
    const clearance = 0.4;
    const crouch = (MOKE_ANIMATION.duckBelowHeadroom - clearance) / MOKE_ANIMATION.duckRange;
    visual.update(DT, pose({ crouch }));
    expect(new Box3().setFromObject(visual.object, true).max.y).toBeLessThan(clearance);
    visual.dispose();
  });

  it('holds carried things in front of his muzzle', () => {
    const visual = new ToonMokeVisual();
    visual.update(DT, pose());
    visual.object.updateMatrixWorld(true);
    const socket = visual.mouthSocket.getWorldPosition(new Vector3());
    expect(socket.z).toBeGreaterThan(0.2);
    expect(socket.y).toBeGreaterThan(0.2);
    expect(socket.y).toBeLessThan(0.35);
    visual.dispose();
  });

  it('closes his eyes while resting, and opens them again when he gets up', () => {
    const visual = new ToonMokeVisual();
    visual.update(DT, pose({ rest: 1 }));
    expect(meshes(visual.object, 'eye').every((m) => !m.visible)).toBe(true);
    expect(meshes(visual.object, 'eyeShut').every((m) => m.visible)).toBe(true);

    visual.update(DT, pose({ rest: 0 }));
    expect(meshes(visual.object, 'eye').every((m) => m.visible)).toBe(true);
    expect(meshes(visual.object, 'eyeShut').every((m) => !m.visible)).toBe(true);
    visual.dispose();
  });

  it('blinks now and then while idle', () => {
    const visual = new ToonMokeVisual();
    let blinks = 0;
    let wasShut = false;
    for (let i = 0; i < 12 / DT; i++) {
      visual.update(DT, pose({ time: i * DT }));
      const shut = !meshes(visual.object, 'eye')[0]!.visible;
      if (shut && !wasShut) blinks++;
      wasShut = shut;
    }
    expect(blinks).toBeGreaterThanOrEqual(2);
    expect(blinks).toBeLessThanOrEqual(6);
    visual.dispose();
  });

  it('opens his mouth to bark, and keeps it closed on a carried item', () => {
    const visual = new ToonMokeVisual();
    visual.update(DT, pose({ bark: 1 }));
    expect(meshes(visual.object, 'mouthOpen')[0]!.visible).toBe(true);

    visual.update(DT, pose({ bark: 1, carry: 1 }));
    expect(meshes(visual.object, 'mouthOpen')[0]!.visible).toBe(false);
    visual.dispose();
  });

  it('shows tiny teeth and hides his tongue for the cute growl', () => {
    const visual = new ToonMokeVisual();
    visual.update(DT, pose({ growl: 1 }));
    expect(meshes(visual.object, 'mouthOpen')[0]!.visible).toBe(true);
    expect(meshes(visual.object, 'growlTeeth')[0]!.visible).toBe(true);

    visual.update(DT, pose({ growl: 0 }));
    expect(meshes(visual.object, 'growlTeeth')[0]!.visible).toBe(false);
    visual.dispose();
  });

  it('wears his collar with the name tag hanging at the front of his neck', () => {
    const visual = new ToonMokeVisual();
    visual.update(DT, pose());
    visual.object.updateMatrixWorld(true);
    expect(meshes(visual.object, 'collar')).toHaveLength(1);
    const tag = new Box3().setFromObject(meshes(visual.object, 'tag')[0]!, true);
    const head = visual.mouthSocket.getWorldPosition(new Vector3());
    expect(tag.min.z).toBeGreaterThan(0.1); // out in front of his chest
    expect(tag.max.y).toBeLessThan(head.y); // below his mouth
    expect(tag.min.y).toBeGreaterThan(0.12); // well clear of the floor
    // It keeps hanging down when he puts his nose to the ground.
    visual.update(DT, pose({ sniff: 1 }));
    visual.object.updateMatrixWorld(true);
    const hanging = new Box3().setFromObject(meshes(visual.object, 'tag')[0]!, true);
    expect(hanging.max.y - hanging.min.y).toBeGreaterThan(0.012);
    visual.dispose();
  });

  it('keeps his tail rooted in his body, whatever he is doing', () => {
    const visual = new ToonMokeVisual();
    const [body] = meshes(visual.object, 'body');
    const [tail] = meshes(visual.object, 'tail');
    const down = new Vector3(0, -1, 0);
    const raycaster = new Raycaster();
    raycaster.far = 0.5;
    /** Is this tail-space point under the surface of his body fur (a ray coming straight down meets his body first)? */
    const underFur = (x: number, y: number, z: number): boolean => {
      const p = tail!.parent!.localToWorld(new Vector3(x, y, z));
      raycaster.set(p.add(new Vector3(0, 0.5, 0)), down);
      return raycaster.intersectObject(body!, false).length > 0;
    };
    for (const over of [{}, { tailWag: 1, time: 0.1 }, { tailWag: 1, time: 0.3 }, { runBlend: 1, speed: 4 }, { crouch: 1 }]) {
      visual.update(DT, pose(over));
      visual.object.updateMatrixWorld(true);
      expect(underFur(0, 0, 0)).toBe(true);
      expect(underFur(0, 0.012, -0.004)).toBe(true); // a little way up the root, too
    }
    visual.dispose();
  });

  it('does every trick without sinking into the floor, and begs within the headroom it asks for', () => {
    for (const trick of TRICKS) {
      const visual = new ToonMokeVisual();
      const anim = new MokeAnimationController();
      anim.trick(trick);
      let lowest = Infinity;
      let highest = -Infinity;
      for (let i = 0; anim.performingTrick; i++) {
        const state = anim.update(DT, { speed: 0, turnRate: 0, headroom: Infinity });
        visual.update(DT, state);
        if (i % 6 === 0) {
          const box = new Box3().setFromObject(visual.object, true);
          lowest = Math.min(lowest, box.min.y);
          highest = Math.max(highest, box.max.y);
        }
      }
      expect(lowest, trick).toBeGreaterThan(-0.02);
      if (trick === 'beg') expect(highest).toBeLessThan(MOKE_ANIMATION.tricks.begHeadroom);
      visual.dispose();
    }
  });

  it('is back in his normal standing pose once a trick is over', () => {
    const visual = new ToonMokeVisual();
    visual.update(DT, pose());
    const before = new Box3().setFromObject(visual.object, true);
    const anim = new MokeAnimationController();
    anim.trick('bellyUp');
    while (anim.performingTrick) visual.update(DT, anim.update(DT, { speed: 0, turnRate: 0, headroom: Infinity }));
    visual.update(DT, pose());
    const after = new Box3().setFromObject(visual.object, true);
    expect(after.min.distanceTo(before.min)).toBeLessThan(0.01);
    expect(after.max.distanceTo(before.max)).toBeLessThan(0.01);
    visual.dispose();
  });

  it('removes itself from the scene on dispose', () => {
    const visual = new ToonMokeVisual();
    const parent = new Mesh();
    parent.add(visual.object);
    visual.dispose();
    expect(visual.object.parent).toBeNull();
  });
});
