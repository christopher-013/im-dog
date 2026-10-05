import { describe, expect, it } from 'vitest';
import * as entry from './entry';

describe('Cloudflare Worker entry point', () => {
  it('exports only the runtime handler', () => {
    expect(Object.keys(entry)).toEqual(['default']);
    expect(entry.default.fetch).toBeTypeOf('function');
    expect(entry.default.scheduled).toBeTypeOf('function');
  });
});
