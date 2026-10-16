import { describe, expect, it, vi } from 'vitest';
import { ANNOUNCER } from '../config/dogSelect';
import { Announcer, pickAnnouncerVoice, type SpeechLike } from './Announcer';

const voice = (name: string, lang = 'en-US', isDefault = false) => ({ name, lang, default: isDefault, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

function fakeSpeech(voices: SpeechSynthesisVoice[] = []) {
  const said: SpeechSynthesisUtterance[] = [];
  let cancelled = 0;
  const speech: SpeechLike = { speak: (u) => void said.push(u), cancel: () => void cancelled++, getVoices: () => voices };
  const make = (text: string) => ({ text, pitch: 1, rate: 1, volume: 1, lang: '', voice: null }) as unknown as SpeechSynthesisUtterance;
  return { speech, make, said, cancelled: () => cancelled };
}

describe('the Choose Your Dog announcer', () => {
  it("calls out each dog's name as it's picked", () => {
    const f = fakeSpeech([voice('Daniel', 'en-GB')]);
    const announcer = new Announcer(f.speech, f.make);
    announcer.say(ANNOUNCER.dogName('Moke'));
    announcer.say(ANNOUNCER.dogName('Dougie'));
    expect(f.said.map((u) => u.text)).toEqual(['Moke!', 'Dougie!']);
  });

  it('says when it starts and stops talking (the music dips under it), ignoring lines it cut off', () => {
    vi.useFakeTimers();
    try {
      const f = fakeSpeech();
      const announcer = new Announcer(f.speech, f.make);
      const heard: boolean[] = [];
      announcer.onSpeaking = (speaking) => heard.push(speaking);
      announcer.say('Choose your dog!');
      const first = f.said[0]!;
      first.onstart?.({} as SpeechSynthesisEvent);
      expect(heard).toEqual([true]);
      announcer.say('Moke!'); // cuts the first line off...
      const second = f.said[1]!;
      first.onend?.({} as SpeechSynthesisEvent); // ...whose late "ended" mustn't bring the music back up
      second.onstart?.({} as SpeechSynthesisEvent);
      expect(heard).toEqual([true]);
      second.onend?.({} as SpeechSynthesisEvent);
      expect(heard).toEqual([true, false]);

      // A browser that never says a line ended: the music comes back up anyway.
      announcer.say('Begin!');
      f.said[2]!.onstart?.({} as SpeechSynthesisEvent);
      expect(heard).toEqual([true, false, true]);
      vi.advanceTimersByTime(ANNOUNCER.longestLine * 1000 + 10);
      expect(heard).toEqual([true, false, true, false]);

      // Stopping (BACK) while it talks: the music comes back up.
      announcer.say('Dougie!');
      f.said[3]!.onstart?.({} as SpeechSynthesisEvent);
      announcer.stop();
      expect(heard).toEqual([true, false, true, false, true, false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says its lines low and slow (deep, theatrical), cutting off anything it was still saying', () => {
    const f = fakeSpeech([voice('Samantha'), voice('Daniel', 'en-GB')]);
    const announcer = new Announcer(f.speech, f.make);
    expect(announcer.available).toBe(true);
    expect(announcer.say(ANNOUNCER.choose)).toBe(true);
    expect(announcer.say(ANNOUNCER.begin)).toBe(true);
    expect(f.said.map((u) => u.text)).toEqual(['Choose your dog!', 'Begin!']);
    for (const u of f.said) {
      expect(u.pitch).toBeLessThan(0.6);
      expect(u.rate).toBeLessThan(1);
      expect(u.voice?.name).toBe('Daniel');
    }
    expect(f.cancelled()).toBe(2);
  });

  it("prefers a low English voice, never mistaking 'Female' for 'male', else the default English one", () => {
    expect(pickAnnouncerVoice([voice('Google UK English Female'), voice('Google UK English Male')])?.name).toBe('Google UK English Male');
    expect(pickAnnouncerVoice([voice('Google UK English Female'), voice('Zira', 'en-US', true)])?.name).toBe('Zira');
    expect(pickAnnouncerVoice([voice('Thomas', 'fr-FR'), voice('Anna', 'de-DE')])).toBeNull();
    expect(pickAnnouncerVoice([])).toBeNull();
  });

  it("can't speak (no speech, or it throws): says so, and never breaks the game", () => {
    expect(new Announcer(null, null).say('Begin!')).toBe(false);
    expect(new Announcer(null, null).available).toBe(false);
    const throwing: SpeechLike = { speak: () => { throw new Error('not allowed'); }, cancel: () => {}, getVoices: () => [] };
    const f = fakeSpeech();
    expect(new Announcer(throwing, f.make).say('Begin!')).toBe(false);
    expect(() => new Announcer(throwing, f.make).stop()).not.toThrow();
  });
});
