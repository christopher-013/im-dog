import { describe, expect, it } from 'vitest';
import { DogBowls } from './DogBowls';

const places = { food: { x: 13, y: 0.03, z: 5.12 }, water: { x: 13.3, y: 0.03, z: 5.12 } };

describe('DogBowls (what is in his bowls)', () => {
  it('starts full, empties over the time he eats or drinks, and says so once', () => {
    const bowls = new DogBowls(places);
    const emptied: string[] = [];
    bowls.onEmptied = (kind) => emptied.push(kind);
    expect(bowls.has('food')).toBe(true);
    expect(bowls.has('water')).toBe(true);
    bowls.finish('food', 2);
    // Mid-meal: going down, and not offered again while he's at it.
    for (let i = 0; i < 60; i++) bowls.update(1 / 60);
    expect(bowls.level('food')).toBeCloseTo(0.5, 1);
    expect(bowls.has('food')).toBe(false);
    for (let i = 0; i < 120; i++) bowls.update(1 / 60);
    expect(bowls.level('food')).toBe(0);
    expect(emptied).toEqual(['food']);
    // The water's untouched; the kibble is gone from view.
    expect(bowls.has('water')).toBe(true);
    expect(bowls.object.getObjectByName('bowl:food')?.visible).toBe(false);
    bowls.dispose();
  });

  it('is full again once refilled', () => {
    const bowls = new DogBowls(places);
    bowls.finish('water', 1);
    for (let i = 0; i < 90; i++) bowls.update(1 / 60);
    expect(bowls.has('water')).toBe(false);
    bowls.refill('water');
    expect(bowls.has('water')).toBe(true);
    expect(bowls.level('water')).toBe(1);
    expect(bowls.object.getObjectByName('bowl:water')?.visible).toBe(true);
    bowls.dispose();
  });
});
