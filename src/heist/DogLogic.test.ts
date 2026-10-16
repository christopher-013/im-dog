import { describe, expect, it } from 'vitest';
import { dogById } from '../config/dogs';
import { DOG_LOGIC_KEY, DogLogicMemory } from './DogLogic';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

const moke = dogById('moke');
const dougie = dogById('dougie');

describe("Dog Logic is each dog's own", () => {
  it("an existing player's Moke progress (saved before there were two dogs) loads exactly as it was", () => {
    // What a browser that played before Dougie existed has saved.
    const saved = JSON.stringify(['sock=treat', 'bark+door=protect']);
    const store = memoryStore({ 'imdog.dogLogic': saved });
    const memory = new DogLogicMemory(store, moke.logicKey);
    expect(DOG_LOGIC_KEY).toBe('imdog.dogLogic');
    expect(memory.has('sock=treat')).toBe(true);
    expect(memory.has('bark+door=protect')).toBe(true);
    // Nothing moved, nothing rewritten.
    expect(store.data.get('imdog.dogLogic')).toBe(saved);
    expect([...store.data.keys()]).toEqual(['imdog.dogLogic']);
  });

  it("Dougie starts knowing nothing, and what he learns never touches Moke's", () => {
    const store = memoryStore({ 'imdog.dogLogic': JSON.stringify(['sock=treat']) });
    const memory = new DogLogicMemory(store, moke.logicKey);
    memory.switchTo(dougie.logicKey);
    expect(memory.key).toBe(dougie.logicKey);
    expect(memory.has('sock=treat')).toBe(false);
    expect(memory.learn('sock=treat')).toBe(true); // a brand-new discovery, for him
    expect(memory.learn('pillows=fun')).toBe(true);
    expect(JSON.parse(store.data.get('imdog.dogLogic')!)).toEqual(['sock=treat']);
    expect(JSON.parse(store.data.get(dougie.logicKey)!)).toEqual(['sock=treat', 'pillows=fun']);
    // Back to Moke: his own, as it was.
    memory.switchTo(moke.logicKey);
    expect(memory.has('sock=treat')).toBe(true);
    expect(memory.has('pillows=fun')).toBe(false);
    // And Dougie's again next time.
    expect(new DogLogicMemory(store, dougie.logicKey).has('pillows=fun')).toBe(true);
  });

  it('corrupt or blocked storage: the dog simply rediscovers things', () => {
    const memory = new DogLogicMemory(memoryStore({ [dougie.logicKey]: '{nope' }), dougie.logicKey);
    expect(memory.has('sock=treat')).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const blocked = new DogLogicMemory(broken, moke.logicKey);
    expect(blocked.learn('sock=treat')).toBe(true);
    expect(blocked.has('sock=treat')).toBe(true);
    expect(() => blocked.switchTo(dougie.logicKey)).not.toThrow();
  });
});
