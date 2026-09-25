import { describe, expect, it } from 'vitest';
import { MOKE_ATTENTION } from '../config/attention';
import { AttentionSystem, type AttentionTarget } from './AttentionSystem';

const DT = 1 / 60;
/** Standing at the origin, facing +z. */
const still = { position: { x: 0, y: 0, z: 0 }, heading: 0, speed: 0 };
const at = (id: string, x: number, z: number, interest = 1, enabled = true): AttentionTarget => ({
  id,
  kind: 'toy',
  position: { x, y: 0.03, z },
  interest,
  enabled,
});

/** Runs frames and returns the id he looks at on the last one (or null). */
function watch(system: AttentionSystem, seconds: number, observer = still): string | null {
  let looking: unknown = null;
  for (let t = 0; t < seconds; t += DT) looking = system.update(DT, observer);
  return looking ? (system.target?.id ?? 'focus') : null;
}

describe('AttentionSystem', () => {
  it('glances at the most interesting thing in front of him', () => {
    const system = new AttentionSystem(MOKE_ATTENTION, () => 0);
    system.register(at('far', 0, 2.2));
    system.register(at('near', 0.3, 1));
    system.register(at('sock', -0.5, 1.2, 1.6));
    expect(watch(system, DT)).toBe('sock');
  });

  it("ignores things behind him, too far away, right under his nose, or switched off (e.g. in his mouth)", () => {
    const system = new AttentionSystem(MOKE_ATTENTION, () => 0);
    system.register(at('behind', 0, -1));
    system.register(at('far', 0, 5));
    system.register(at('underNose', 0, 0.1));
    system.register(at('carried', 0.2, 0.8, 1, false));
    expect(watch(system, 1)).toBeNull();
  });

  it("looks for a moment, then looks away, and doesn't stare at the same thing again straight away", () => {
    const random = () => 0; // shortest glance, shortest pause
    const system = new AttentionSystem(MOKE_ATTENTION, random);
    system.register(at('sock', 0, 1, 2));
    system.register(at('toy', 0.6, 1.5));
    expect(watch(system, DT)).toBe('sock');
    expect(watch(system, MOKE_ATTENTION.glance[0] + 0.1)).toBeNull(); // glance over, a pause
    expect(watch(system, MOKE_ATTENTION.lookAway[0])).toBe('toy'); // the sock is "boring" for a while
  });

  it("doesn't glance about at a run or while busy (a trick, lying down)", () => {
    const system = new AttentionSystem(MOKE_ATTENTION, () => 0);
    system.register(at('sock', 0, 1));
    expect(watch(system, 0.5, { ...still, speed: MOKE_ATTENTION.maxSpeed + 1 })).toBeNull();
    expect(system.update(DT, still, true)).toBeNull();
  });

  it('follows the sniff focus (the strongest scent) while it is set', () => {
    const system = new AttentionSystem(MOKE_ATTENTION, () => 0);
    system.register(at('sock', 0, 1));
    const scent = { x: 1, y: 0, z: 1 };
    system.focus = scent;
    expect(system.update(DT, still)).toBe(scent);
    system.focus = null;
    expect(system.update(DT, still)).not.toBe(scent);
  });
});
