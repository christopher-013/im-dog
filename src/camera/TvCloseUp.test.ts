import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { TV_CLOSE_UP } from '../config/camera';
import { TV_SCREENS } from '../world/home/places';
import { tvCloseUp } from './TvCloseUp';

describe('The TV close-up (watching the ballgame)', () => {
  for (const [name, aspect] of [['a wide desktop', 16 / 9], ['a phone held sideways', 2.1], ['a phone held upright', 0.46]] as const) {
    it(`fills ${name} with the picture, straight on, at screen height`, () => {
      const fov = 60;
      for (const screen of TV_SCREENS) {
        const position = new Vector3();
        const look = new Vector3();
        const d = tvCloseUp(screen, aspect, fov, position, look);
        expect(look.toArray()).toEqual([screen.x, screen.y, screen.z]);
        expect(position.y).toBe(screen.y);
        // On the screen's own normal, into the room, `d` away.
        expect(position.x - screen.x).toBeCloseTo(Math.sin(screen.facing) * d, 6);
        expect(position.z - screen.z).toBeCloseTo(Math.cos(screen.facing) * d, 6);
        // The picture takes up `fill` of the view in its tighter direction, and never spills out of the other.
        const halfV = Math.tan((fov * Math.PI) / 360);
        const halfH = halfV * aspect;
        const across = screen.width / 2 / (d * halfH);
        const up = screen.height / 2 / (d * halfV);
        if (d < TV_CLOSE_UP.maxDistance && d > TV_CLOSE_UP.minDistance) expect(Math.max(across, up)).toBeCloseTo(TV_CLOSE_UP.fill, 6);
        expect(across).toBeLessThanOrEqual(TV_CLOSE_UP.fill + 1e-9);
        expect(up).toBeLessThanOrEqual(TV_CLOSE_UP.fill + 1e-9);
      }
    });
  }

  it('never backs off further than the room allows', () => {
    const position = new Vector3();
    const d = tvCloseUp(TV_SCREENS[0]!, 0.2, 30, position, new Vector3());
    expect(d).toBe(TV_CLOSE_UP.maxDistance);
  });
});
