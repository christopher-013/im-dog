import { describe, expect, it } from 'vitest';
import { GameEvents } from './GameEvents';

describe('GameEvents', () => {
  it('delivers payloads to listeners in subscription order', () => {
    const events = new GameEvents();
    const seen: string[] = [];
    events.on('HUMAN_SAID', (s) => seen.push(`a:${s.text}`));
    events.on('HUMAN_SAID', (s) => seen.push(`b:${s.mood}`));
    events.emit('HUMAN_SAID', { text: 'Moke!', mood: 'surprised' });
    expect(seen).toEqual(['a:Moke!', 'b:surprised']);
  });

  it('unsubscribes, including from inside a listener', () => {
    const events = new GameEvents();
    let count = 0;
    const off = events.on('CHASE_STARTED', () => {
      count++;
      off();
    });
    events.emit('CHASE_STARTED');
    events.emit('CHASE_STARTED');
    expect(count).toBe(1);
  });

  it('remembers the last few events for the debug panel', () => {
    const events = new GameEvents();
    for (let i = 0; i < 8; i++) events.emit('GRAB_MISSED');
    events.emit('HEIST_COMPLETE', { seconds: 200 });
    expect(events.recent).toHaveLength(6);
    expect(events.recent.at(-1)).toBe('HEIST_COMPLETE');
  });
});
