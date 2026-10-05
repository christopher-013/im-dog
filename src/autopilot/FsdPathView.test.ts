import { describe, expect, it } from 'vitest';
import { FSD_PATH } from '../config/autopilot';
import { FsdPathView } from './FsdPathView';

describe("FSD's rainbow path on the floor", () => {
  it('lays a ribbon from his paws along the route ahead, the right width, rounded at corners, never too long', () => {
    const view = new FsdPathView();
    const from = { x: 0, y: 0, z: 0 };
    const trail = [{ x: 2, z: 0 }, { x: 2, z: 3 }, { x: 8, z: 3 }];
    for (let i = 0; i < 30; i++) view.update(1 / 30, from, trail);
    expect(view.mesh.visible).toBe(true);
    const geometry = view.mesh.geometry;
    const count = geometry.drawRange.count;
    expect(count).toBeGreaterThan(0);
    const pos = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    const vertices = count / 3 + 2;
    let longest = 0;
    for (let i = 0; i < Math.min(vertices, pos.count); i++) {
      expect(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getZ(i))).toBe(true);
      expect(pos.getY(i)).toBeCloseTo(FSD_PATH.height, 6);
      longest = Math.max(longest, uv.getX(i));
    }
    // The two edges of the first sample: the ribbon's width, across the way he's going (+x here).
    expect(Math.hypot(pos.getX(0) - pos.getX(1), pos.getZ(0) - pos.getZ(1))).toBeCloseTo(FSD_PATH.width, 3);
    expect(pos.getX(0)).toBeCloseTo(0, 3);
    // 2 + 3 + 6 m of route, cut at the maximum length.
    expect(longest).toBeLessThanOrEqual(FSD_PATH.maxLength + FSD_PATH.step);
    expect(longest).toBeGreaterThan(FSD_PATH.maxLength - 0.5);
  });

  it('fades out when FSD stops driving (or he is waiting), and back in when he sets off', () => {
    const view = new FsdPathView();
    const from = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 30; i++) view.update(1 / 30, from, [{ x: 3, z: 0 }]);
    expect(view.mesh.visible).toBe(true);
    for (let i = 0; i < 60; i++) view.update(1 / 30, null, null);
    expect(view.mesh.visible).toBe(false);
    for (let i = 0; i < 60; i++) view.update(1 / 30, from, []);
    expect(view.mesh.visible).toBe(false);
  });
});
