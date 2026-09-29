import { describe, expect, it } from 'vitest';
import { JET_BOT, LOOP, partAt, RobotCartoon, sceneAt, SCENES, TRUCK_BOT, type Box } from './RobotCartoon';

const turned = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe('RobotCartoon (GEARBOTS, on the TVs)', () => {
  it('runs its scenes back to back, in order, and loops', () => {
    expect(SCENES[0]!.from).toBe(0);
    for (let i = 1; i < SCENES.length; i++) expect(SCENES[i]!.from).toBe(SCENES[i - 1]!.to);
    expect(SCENES.at(-1)!.to).toBe(LOOP);
    expect(sceneAt(0).name).toBe('title');
    expect(sceneAt(9).name).toBe('transform');
    expect(sceneAt(LOOP + 0.5)).toMatchObject({ name: 'title', t: 0.5 });
    const k = sceneAt(SCENES[2]!.from + 1.5).k;
    expect(k).toBeCloseTo(0.5, 5);
  });

  for (const [name, bot] of [['the truck', TRUCK_BOT], ['the jet', JET_BOT]] as const) {
    it(`transforms ${name} from the vehicle exactly into the robot, piece by piece`, () => {
      const b: Box = { x: 0, y: 0, w: 0, h: 0, r: 0 };
      for (const part of bot.parts) {
        partAt(part, 0, b);
        expect([b.x, b.y, b.w, b.h], part.name).toEqual([part.vehicle.x, part.vehicle.y, part.vehicle.w, part.vehicle.h]);
        partAt(part, 1, b);
        expect(b.x, part.name).toBeCloseTo(part.robot.x, 6);
        expect(b.y, part.name).toBeCloseTo(part.robot.y, 6);
        expect(b.w, part.name).toBeCloseTo(part.robot.w, 6);
        expect(turned(b.r, part.robot.r), `${part.name} ends the right way up`).toBeLessThan(1e-6);
        expect(part.window[0]).toBeLessThan(part.window[1]);
      }
      // Halfway, some parts are still on their way and others have arrived: it folds out in stages.
      const moving = bot.parts.filter((p) => p.window[0] < 0.5 && p.window[1] > 0.5);
      expect(moving.length).toBeGreaterThan(3);
      expect(moving.length).toBeLessThan(bot.parts.length);
    });

    it(`stands ${name}'s robot up properly: feet on the ground, legs, body, then the head on top`, () => {
      const at = (part: string) => bot.parts.find((p) => p.name === part)!.robot;
      for (const p of bot.parts) expect(p.robot.y - Math.abs(p.robot.h) / 2, p.name).toBeGreaterThanOrEqual(-0.01);
      const head = at('head');
      for (const p of bot.parts) if (p.name !== 'head' && p.name !== 'wings') expect(head.y, p.name).toBeGreaterThan(p.robot.y);
      expect(at('legL').y).toBeLessThan(at('fistL').y); // hands hang above the knees
    });
  }

  it("rolls the truck on its wheels, and doesn't need a canvas to run (the screens stay dark in tests)", () => {
    for (const wheel of TRUCK_BOT.parts.filter((p) => p.kind === 'wheel')) expect(wheel.vehicle.y - wheel.vehicle.h / 2).toBeCloseTo(0, 6);
    const show = new RobotCartoon();
    expect(show.texture).toBeNull();
    expect(() => {
      show.update(1 / 60);
      show.update(0);
      show.dispose();
    }).not.toThrow();
  });
});
