import { describe, expect, it } from 'vitest';
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
