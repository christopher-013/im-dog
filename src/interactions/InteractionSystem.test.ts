import { describe, expect, it } from 'vitest';
import type { Interactable } from './Interactable';
import { InteractionSystem } from './InteractionSystem';

type TestItem = { -readonly [K in keyof Interactable]: Interactable[K] } & { uses: number };

function item(id: string, x: number, z: number, extra: Partial<Interactable> = {}): TestItem {
  const it: TestItem = {
    id,
    type: 'INVESTIGATE' as const,
    label: `Check ${id}`,
    interactionDistance: 0.6,
    enabled: true,
    position: { x, y: 0, z },
    uses: 0,
    interact() {
      it.uses++;
    },
    ...extra,
  };
  return it;
}

/** Moke at the origin facing +z (heading 0). */
const facingForward = { position: { x: 0, y: 0, z: 0 }, heading: 0 };

describe('InteractionSystem', () => {
  it('has no target when nothing is in reach', () => {
    const system = new InteractionSystem();
    system.register(item('far', 0, 2));
    expect(system.update(facingForward)).toBeNull();
    expect(system.interact()).toBe(false);
  });

  it('targets a nearby thing in front and triggers it', () => {
    const system = new InteractionSystem();
    const sock = item('sock', 0, 0.4);
    system.register(sock);
    expect(system.update(facingForward)?.id).toBe('sock');
    expect(system.interact()).toBe(true);
    expect(sock.uses).toBe(1);
  });

  it('ignores things behind him unless they are right under his nose', () => {
    const system = new InteractionSystem();
    system.register(item('behind', 0, -0.5));
    expect(system.update(facingForward)).toBeNull();
    system.register(item('underfoot', 0, -0.1));
    expect(system.update(facingForward)?.id).toBe('underfoot');
  });

  it('can skip the facing check', () => {
    const system = new InteractionSystem();
    system.register(item('bed', 0, -0.5, { requiresFacing: false }));
    expect(system.update(facingForward)?.id).toBe('bed');
  });

  it('prefers the nearer, better-faced thing, and priority over both', () => {
    const system = new InteractionSystem();
    system.register(item('near', 0.05, 0.3));
    system.register(item('side', 0.45, 0.2));
    expect(system.update(facingForward)?.id).toBe('near');
    system.register(item('drop', 0, 0, { priority: 1, requiresFacing: false }));
    expect(system.update(facingForward)?.id).toBe('drop');
  });

  it('skips disabled things and forgets unregistered ones', () => {
    const system = new InteractionSystem();
    const sock = item('sock', 0, 0.3);
    system.register(sock);
    expect(system.update(facingForward)?.id).toBe('sock');
    sock.enabled = false;
    expect(system.interact()).toBe(false);
    expect(system.update(facingForward)).toBeNull();
    sock.enabled = true;
    system.update(facingForward);
    system.unregister('sock');
    expect(system.current).toBeNull();
    expect(system.count).toBe(0);
  });

  it('keeps the current target when a rival is only marginally better (no flicker)', () => {
    const system = new InteractionSystem();
    const a = item('a', -0.05, 0.4);
    const b = item('b', 0.05, 0.42);
    system.register(a);
    system.register(b);
    expect(system.update(facingForward)?.id).toBe('a');
    a.position.z = 0.43;
    expect(system.update(facingForward)?.id).toBe('a');
  });

  it('rejects duplicate ids', () => {
    const system = new InteractionSystem();
    system.register(item('x', 0, 0));
    expect(() => system.register(item('x', 1, 1))).toThrow();
  });
});
