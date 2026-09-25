import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CAMERA, type CameraTuning } from '../config/camera';
import { MOUSE } from '../config/input';
import { angleDelta } from '../utils/math';
import { fitVerticalFov, ThirdPersonCamera, type CameraCollider, type CameraInput, type CameraTarget } from './ThirdPersonCamera';

const DT = 1 / 60;
// A snapshot, so live tweaks to CAMERA can't change test results.
const tuning: CameraTuning = JSON.parse(JSON.stringify(CAMERA));
const NO_INPUT: CameraInput = { lookX: 0, lookY: 0, zoom: 0 };

class FakeCollider implements CameraCollider {
  free = Infinity;
  /** Optional: a vertical wall this far behind the pivot, horizontally, in every direction. */
  wallBehind: number | null = null;
  sweepSphere(_origin: Vector3, direction: Vector3, radius: number, maxDistance: number): number {
    let free = this.free;
    if (this.wallBehind !== null) {
      const horizontal = Math.hypot(direction.x, direction.z);
      free = Math.min(free, horizontal < 1e-9 ? Infinity : (this.wallBehind - radius) / horizontal);
    }
    return Math.min(maxDistance, Math.max(0, free));
  }
}

const target = (overrides: Partial<CameraTarget> = {}): CameraTarget => ({
  position: new Vector3(0, 0, 0),
  heading: 0,
  speed: 0,
  headroom: Infinity,
  ...overrides,
});

function setup(t: CameraTarget = target()) {
  const camera = new PerspectiveCamera(tuning.fov, 16 / 9, 0.03, 60);
  const rig = new ThirdPersonCamera(camera, t, tuning);
  rig.mode = 'follow';
  const collider = new FakeCollider();
  rig.collider = collider;
  const run = (seconds: number, input: CameraInput = NO_INPUT, tgt: CameraTarget = t) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) rig.update(DT, input, tgt);
  };
  const pivot = () => new Vector3(t.position.x, t.position.y + tuning.pivotHeight, t.position.z);
  return { camera, rig, collider, run, pivot };
}

describe('ThirdPersonCamera: placement', () => {
  it('sits low and close behind Moke, at dog height', () => {
    const { camera, run, pivot } = setup();
    run(1);
    expect(camera.position.z).toBeLessThan(-1); // Moke faces +z; the camera trails behind him
    expect(Math.abs(camera.position.x)).toBeLessThan(1e-6);
    expect(camera.position.y).toBeGreaterThan(0.4);
    expect(camera.position.y).toBeLessThan(0.9);
    expect(camera.position.distanceTo(pivot())).toBeCloseTo(tuning.defaultDistance, 2);
  });

  it('follows smoothly instead of being rigidly attached', () => {
    const t = target();
    const { camera, rig, run } = setup(t);
    run(1);
    const before = camera.position.clone();
    t.position.set(1, 0, 0);
    rig.update(DT, NO_INPUT, t);
    const moved = camera.position.x - before.x;
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(0.5);
    run(2);
    expect(camera.position.x).toBeCloseTo(1, 3);
  });
});

describe('ThirdPersonCamera: mouse and wheel', () => {
  it('turns the view right when the mouse moves right', () => {
    const { rig, run } = setup();
    run(0.5);
    const before = rig.yaw;
    run(0.5, { lookX: 20, lookY: 0, zoom: 0 });
    expect(rig.yaw).toBeLessThan(before);
  });

  it('respects the sensitivity multiplier', () => {
    const a = setup();
    const b = setup();
    a.run(0.1, { lookX: 50, lookY: 0, zoom: 0 });
    MOUSE.sensitivityScale = 2;
    b.run(0.1, { lookX: 50, lookY: 0, zoom: 0 });
    MOUSE.sensitivityScale = 1;
    expect(Math.abs(b.rig.yaw - Math.PI)).toBeGreaterThan(Math.abs(a.rig.yaw - Math.PI) * 1.5);
  });

  it('clamps how far up and down you can look', () => {
    const { camera, run, pivot } = setup();
    run(2, { lookX: 0, lookY: 5000, zoom: 0 });
    const high = camera.position.y - pivot().y;
    expect(high).toBeLessThanOrEqual(tuning.defaultDistance * Math.sin(tuning.maxPitch) + 1e-3);
    run(2, { lookX: 0, lookY: -5000, zoom: 0 });
    const low = camera.position.y - pivot().y;
    expect(low).toBeGreaterThanOrEqual(tuning.defaultDistance * Math.sin(tuning.minPitch) - 1e-3);
  });

  it('zooms with the wheel, within the min and max distance', () => {
    const { camera, run, pivot } = setup();
    run(4, { lookX: 0, lookY: 0, zoom: 5 });
    expect(camera.position.distanceTo(pivot())).toBeCloseTo(tuning.maxDistance, 2);
    run(4, { lookX: 0, lookY: 0, zoom: -5 });
    expect(camera.position.distanceTo(pivot())).toBeCloseTo(tuning.minDistance, 2);
  });
});

describe('ThirdPersonCamera: collision', () => {
  it('pulls in instantly when something blocks the view, then eases back out', () => {
    const { camera, collider, rig, run, pivot } = setup();
    run(1);
    collider.free = 0.5;
    rig.update(DT, NO_INPUT, target());
    expect(camera.position.distanceTo(pivot())).toBeLessThanOrEqual(0.5 + 1e-6);

    collider.free = Infinity;
    rig.update(DT, NO_INPUT, target());
    expect(camera.position.distanceTo(pivot())).toBeLessThan(0.7);
    run(4);
    expect(camera.position.distanceTo(pivot())).toBeCloseTo(tuning.defaultDistance, 2);
  });

  it('walls always win: it goes as close as needed and asks for Moke to be hidden', () => {
    const { camera, collider, rig, run, pivot } = setup();
    run(1);
    expect(rig.isInsideTarget).toBe(false);
    collider.free = 0.05;
    run(0.5);
    expect(camera.position.distanceTo(pivot())).toBeLessThanOrEqual(0.05 + 1e-6);
    expect(rig.isInsideTarget).toBe(true);
  });

  it('lifts up and over Moke when he backs into a wall, and settles without wobbling', () => {
    const { camera, collider, run, pivot } = setup();
    run(1);
    const normalHeight = camera.position.y;
    collider.wallBehind = 0.17; // Moke's back against the wall
    run(3);
    const heights: number[] = [];
    for (let i = 0; i < 30; i++) {
      run(DT);
      heights.push(camera.position.y);
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1e-3);
    expect(camera.position.y).toBeGreaterThan(pivot().y + 0.15);
    expect(camera.position.y).toBeLessThan(normalHeight + 0.5);
    // ...and still never behind the wall.
    const horizontal = Math.hypot(camera.position.x, camera.position.z);
    expect(horizontal).toBeLessThanOrEqual(0.17 - tuning.collisionRadius + 1e-6);
  });

  it('swings round to open space when Moke faces a wall with the camera trapped behind him', () => {
    const { camera, collider, rig, run, pivot } = setup();
    run(1);
    // A flat wall just behind the camera side (the camera trails at -z; the wall is the plane z = -0.17).
    collider.sweepSphere = (_o, d, r, max) => Math.min(max, d.z < -1e-9 ? (0.17 - r) / -d.z : Infinity);
    run(3);
    expect(Math.abs(angleDelta(rig.yaw, Math.PI))).toBeGreaterThan(1);
    expect(camera.position.distanceTo(pivot())).toBeGreaterThan(tuning.closeDistance);
    expect(camera.position.z).toBeGreaterThanOrEqual(-0.17 + tuning.collisionRadius - 1e-6);
  });

  it("doesn't steer away from walls while the player is aiming with the mouse", () => {
    const { collider, rig, run } = setup();
    run(1);
    collider.sweepSphere = (_o, d, r, max) => Math.min(max, d.z < -1e-9 ? (0.17 - r) / -d.z : Infinity);
    for (let i = 0; i < 60; i++) rig.update(DT, { lookX: 0.001, lookY: 0, zoom: 0 }, target());
    expect(Math.abs(angleDelta(rig.yaw, Math.PI))).toBeLessThan(0.01);
  });

  it('stays underneath a low ceiling (the coffee table) with Moke', () => {
    const tableTop = 0.4;
    const { camera, run } = setup(target({ headroom: tableTop }));
    run(2);
    expect(camera.position.y + tuning.collisionRadius).toBeLessThanOrEqual(tableTop + 1e-3);
    expect(camera.position.y).toBeGreaterThan(0.1);
  });
});

describe('ThirdPersonCamera: swinging behind Moke', () => {
  const behindError = (yaw: number, heading: number) => Math.abs(angleDelta(yaw, heading + Math.PI));

  it('drifts behind him while he runs sideways and the mouse is idle', () => {
    const t = target({ heading: Math.PI / 2, speed: 3 });
    const { rig, run } = setup(target());
    const before = behindError(rig.yaw, t.heading);
    run(3, NO_INPUT, t);
    expect(behindError(rig.yaw, t.heading)).toBeLessThan(before * 0.3);
  });

  it('leaves the camera alone while the player is using the mouse', () => {
    const t = target({ heading: Math.PI / 2, speed: 3 });
    const { rig, run } = setup(target());
    rig.update(DT, { lookX: 1, lookY: 0, zoom: 0 }, t);
    const yaw = rig.yaw;
    run(1, NO_INPUT, t); // within the delay after mouse input
    expect(Math.abs(rig.yaw - yaw)).toBeLessThan(0.01);
  });

  it("doesn't swing around when he runs toward the camera", () => {
    const t = target({ heading: Math.PI, speed: 3 });
    const { rig, run } = setup(target());
    const yaw = rig.yaw;
    run(3, NO_INPUT, t);
    expect(Math.abs(rig.yaw - yaw)).toBeLessThan(1e-6);
  });
});

describe('ThirdPersonCamera: menu and speed', () => {
  it('swings behind Moke the short way round when play starts', () => {
    const { rig, run } = setup();
    rig.mode = 'attract';
    run(10); // menu orbit drifts ~40°
    rig.mode = 'follow';
    const before = rig.yaw;
    rig.recenterBehind(target());
    run(1);
    expect(Math.abs(angleDelta(rig.yaw, Math.PI))).toBeLessThan(0.01);
    expect(Math.abs(rig.yaw - before)).toBeLessThan(Math.PI);
  });

  it('slowly circles in attract mode', () => {
    const { rig, run } = setup();
    rig.mode = 'attract';
    const yaw = rig.yaw;
    run(2);
    expect(rig.yaw).toBeGreaterThan(yaw + 0.05);
  });

  it('widens the field of view at a run', () => {
    const t = target({ heading: 0, speed: 4 });
    const { camera, run } = setup(target());
    run(2, NO_INPUT, t);
    expect(camera.fov).toBeCloseTo(tuning.fov + tuning.runFovBoost, 1);
  });
});

describe('fitVerticalFov (portrait phones)', () => {
  it('leaves desktop and landscape screens alone', () => {
    expect(fitVerticalFov(55, 60, 16 / 9, 80)).toBe(55);
    expect(fitVerticalFov(55, 60, 2.16, 80)).toBe(55); // a landscape phone
  });

  it('widens a tall portrait screen so more fits side to side, within a cap', () => {
    const portrait = fitVerticalFov(55, 60, 390 / 844, 80);
    expect(portrait).toBeGreaterThan(55);
    expect(portrait).toBeLessThanOrEqual(80);
    const square = fitVerticalFov(55, 60, 1, 80);
    expect(square).toBeCloseTo(60);
  });
});
