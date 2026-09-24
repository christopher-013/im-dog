import { describe, expect, it, vi } from 'vitest';
import type { WebGLRenderer } from 'three';
import { GameLoop } from './GameLoop';
import { FrameStats } from '../ui/DebugPanel';

describe('frame timing diagnostics', () => {
  it('reports real elapsed time separately from the capped simulation delta', () => {
    let tick: ((time: number) => void) | null = null;
    const renderer = { setAnimationLoop: (callback: typeof tick) => { tick = callback; } };
    const frame = vi.fn();
    const loop = new GameLoop(renderer as unknown as WebGLRenderer, frame);
    loop.start();
    tick!(1000);
    tick!(1250);
    expect(frame).toHaveBeenLastCalledWith(0.1, 0.25);
    loop.stop();
    expect(tick).toBeNull();
  });

  it('does not count the initial zero-duration frame as an extra measured frame', () => {
    const stats = new FrameStats();
    stats.record(0);
    stats.record(0.25);
    stats.record(0.25);
    expect(stats.fps).toBe(4);
    expect(stats.averageMs).toBe(250);
    expect(stats.worstMs).toBe(250);
  });
});
