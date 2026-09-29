import { describe, expect, it } from 'vitest';
import { UsageCounter, type UsagePing } from './UsageCounter';

const DT = 1 / 60;

function counter() {
  const sent: UsagePing[] = [];
  const usage = new UsageCounter((event) => sent.push(event), 30);
  const run = (seconds: number, playing: boolean, moving: boolean) => {
    for (let i = 0; i < seconds / DT; i++) usage.update(DT, playing, moving);
  };
  return { usage, sent, run };
}

describe('UsageCounter (anonymous visits and players)', () => {
  it('says the game opened, once', () => {
    const { usage, sent } = counter();
    usage.open();
    usage.open();
    expect(sent).toEqual(['open']);
  });

  it('counts a player once they have really played: PLAY, Moke moved, 30 s of play', () => {
    const { sent, run } = counter();
    run(5, true, true);
    run(20, true, false);
    expect(sent).toEqual([]);
    run(6, true, false);
    expect(sent).toEqual(['play']);
    run(120, true, true);
    expect(sent).toEqual(['play']); // once a page
  });

  it('never counts sitting in the menu, being paused, or leaving the game running without moving', () => {
    const { sent, run } = counter();
    run(300, false, false); // the menu, or paused
    run(300, false, true);
    run(120, true, false); // playing, but nobody touched a thing
    expect(sent).toEqual([]);
  });
});
