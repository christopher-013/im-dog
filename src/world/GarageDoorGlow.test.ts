import { describe, expect, it } from 'vitest';
import { RIDE } from '../config/ride';
import { doorGlowWanted, GarageDoorGlow } from './GarageDoorGlow';
import { GARAGE } from './home/layout';

/** The door is in the living room's south wall (z = 3): facing it from the room is heading 0 (toward +z). */
const door = { x: GARAGE.houseDoor.x, z: 3 };

describe('the Garage door glow (Phase 6)', () => {
  it('glows when he passes close by, whichever way he faces', () => {
    for (const heading of [0, Math.PI / 2, Math.PI]) expect(doorGlowWanted({ x: door.x + 1, z: door.z - 1, heading }, true)).toBe(true);
  });

  it('glows when he looks at it from across the room, not when he looks away', () => {
    const at = { x: door.x - 1.5, z: door.z - 4 };
    const toward = Math.atan2(door.x - at.x, door.z - at.z);
    expect(doorGlowWanted({ ...at, heading: toward }, true)).toBe(true);
    expect(doorGlowWanted({ ...at, heading: toward + 1.2 }, true)).toBe(false);
    expect(doorGlowWanted({ ...at, heading: toward + Math.PI }, true)).toBe(false);
    // Too far to count, even looking straight at it.
    const far = { x: door.x, z: door.z - RIDE.doorGlow.lookRange - 1 };
    expect(doorGlowWanted({ ...far, heading: 0 }, true)).toBe(false);
  });

  it('only while a ride can be asked for, and not from the Garage side', () => {
    expect(doorGlowWanted({ x: door.x, z: door.z - 0.6, heading: 0 }, false)).toBe(false);
    expect(doorGlowWanted({ x: door.x, z: door.z + 1, heading: Math.PI }, true)).toBe(false);
  });

  it('fades in, pulses, and fades out to nothing (hidden when off)', () => {
    const glow = new GarageDoorGlow();
    expect(glow.object.visible).toBe(false);
    for (let i = 0; i < 60; i++) glow.update(1 / 60, true);
    expect(glow.strength).toBe(1);
    expect(glow.object.visible).toBe(true);
    for (let i = 0; i < 120; i++) glow.update(1 / 60, false);
    expect(glow.strength).toBe(0);
    expect(glow.object.visible).toBe(false);
    glow.dispose();
  });
});
