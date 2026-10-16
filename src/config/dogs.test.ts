import { describe, expect, it } from 'vitest';
import { MOKE_LOOK } from './mokeLook';
import { COURSE_REWARD, COURSE_TEXT } from './obstacleCourse';
import { HEIST } from './heist';
import { MISCHIEF } from './mischief';
import { HOME_ACTIVITIES } from './homeActivities';
import { CONTROL_HINTS, GAMEPAD_CONTROL_HINTS, TOUCH_CONTROL_HINTS } from './input';
import { DEFAULT_DOG, DOGS, dogById, dogText, isDogId } from './dogs';
import { DOUGIE_LOOK, MOKE_DOG_LOOK } from './dogLooks';

const moke = dogById('moke');
const dougie = dogById('dougie');

/** Every string in a nested config object. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') {
    try {
      const result = (value as (...a: number[]) => unknown)(1, 2);
      if (typeof result === 'string') out.push(result);
    } catch {
      // Not a line-making function.
    }
  } else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

describe('the playable dogs', () => {
  it('Moke and Dougie, Moke first and the default', () => {
    expect(DOGS.map((d) => d.id)).toEqual(['moke', 'dougie']);
    expect(DEFAULT_DOG).toBe('moke');
    expect(new Set(DOGS.map((d) => d.logicKey)).size).toBe(DOGS.length);
    expect(isDogId('dougie')).toBe(true);
    expect(isDogId('rex')).toBe(false);
    expect(isDogId(null)).toBe(false);
  });

  it("keeps Moke's look exactly MOKE_LOOK and his Dog Logic where it has always been saved", () => {
    expect(moke.look).toBe(MOKE_DOG_LOOK);
    expect(MOKE_DOG_LOOK.palette).toBe(MOKE_LOOK.palette);
    expect(MOKE_DOG_LOOK.collar).toBe(MOKE_LOOK.collar);
    expect(MOKE_DOG_LOOK.coat).toBeNull();
    expect(moke.logicKey).toBe('imdog.dogLogic');
    expect(moke.usesModel).toBe(true);
  });

  it("gives Dougie his own look (markings, brown eyes, his name on the tag) and his own progress", () => {
    expect(dougie.look).toBe(DOUGIE_LOOK);
    expect(DOUGIE_LOOK.coat).not.toBeNull();
    expect(DOUGIE_LOOK.collar.name).toBe('Dougie');
    expect(dougie.logicKey).not.toBe(moke.logicKey);
    expect(dougie.usesModel).toBe(false);
  });
});

describe('dogText: the game talks about the dog being played', () => {
  it('leaves every line alone for Moke', () => {
    for (const line of ['Moke! Is that my sock?!', 'MOKE.', 'Mo-ke~']) expect(dogText(line, moke)).toBe(line);
  });

  it("says Dougie's name instead, in every form the lines use", () => {
    expect(dogText('Moke! Is that my sock?!', dougie)).toBe('Dougie! Is that my sock?!');
    expect(dogText('MOKE.', dougie)).toBe('DOUGIE.');
    expect(dogText('Mo-ke~', dougie)).toBe('Dou-gie~');
    expect(dogText("Moke's bowl", dougie)).toBe("Dougie's bowl");
    expect(dogText('Phew! Moke is tired!', dougie)).toBe('Phew! Dougie is tired!');
    // Only the name: other words that happen to contain it don't change.
    expect(dogText('Smoke on the water', dougie)).toBe('Smoke on the water');
  });

  it("leaves no 'Moke' in any of the human's lines, the course's lines or the controls when Dougie is playing", () => {
    const lines = strings([HEIST, MISCHIEF, HOME_ACTIVITIES, COURSE_TEXT, COURSE_REWARD.lines, CONTROL_HINTS, GAMEPAD_CONTROL_HINTS, TOUCH_CONTROL_HINTS]);
    const withName = lines.filter((line) => /moke|mo-ke/i.test(line));
    expect(withName.length).toBeGreaterThanOrEqual(8);
    for (const line of withName) expect(dogText(line, dougie), line).not.toMatch(/moke|mo-ke/i);
  });
});
