import { describe, expect, it, vi } from 'vitest';
import { eventStats, handlePing, logBody, postDailyDigest, syncLog, utcDay, type Kv, type UsageEnv } from './usage';

function setup() {
  const store = new Map<string, string>();
  const kv: Kv = {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
  const limited = new Map<string, number>();
  let perKey = 5;
  const env: UsageEnv = {
    ALLOWED_ORIGINS: 'https://www.im-dog.com',
    USAGE_COUNTS: kv,
    GITHUB_TOKEN: 'test-secret',
    FEEDBACK_RATE_LIMITER: {
      async limit({ key }) {
        const n = (limited.get(key) ?? 0) + 1;
        limited.set(key, n);
        return { success: n <= perKey };
      },
    },
  };
  const calls: { url: string; method: string; body: { title?: string; body?: string } }[] = [];
  const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), method: String(init?.method), body: JSON.parse(String(init?.body)) });
    return String(init?.method) === 'POST' && String(url).endsWith('/issues') ? Response.json({ number: 7 }, { status: 201 }) : Response.json({}, { status: 200 });
  }) as unknown as typeof fetch;
  const waits: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void waits.push(p) };
  let ip = 1;
  const ping = (event: unknown, origin = 'https://www.im-dog.com') =>
    handlePing(new Request('https://www.im-dog.com/api/ping', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': `198.51.100.${ip++}` },
      body: JSON.stringify({ event }),
    }), env, ctx, fetcher);
  const today = utcDay(new Date());
  return { env, kv, store, limited, calls, fetcher, waits, ping, today, setPerKey: (n: number) => { perKey = n; }, sameIp: () => { ip = 1; } };
}

describe('the player counter (/api/ping)', () => {
  it('counts visits and players per day, and keeps the running figures', async () => {
    const t = setup();
    for (let i = 0; i < 3; i++) expect((await t.ping('open')).status).toBe(204);
    expect((await t.ping('play')).status).toBe(204);
    expect(t.store.get(`count:${t.today}:open`)).toBe('3');
    expect(t.store.get(`count:${t.today}:play`)).toBe('1');
    expect(t.store.get('count:total:play')).toBe('1');
    const play = await eventStats(t.kv, 'play', t.today);
    expect(play).toMatchObject({ total: 1, today: 1, last7: 1, last30: 1, activeDays: 1, firstDay: t.today, bestDay: t.today, bestCount: 1 });
  });

  it('stores nothing about the visitor: only counts, dates and the log\'s bookkeeping', async () => {
    const t = setup();
    await t.ping('play');
    await Promise.all(t.waits);
    for (const [key, value] of t.store) {
      expect(key, key).toMatch(/^(count|stats|log):/);
      expect(value, key).not.toMatch(/198\.51\.100/);
    }
  });

  it('ignores anything that isn\'t one of its events, and answers every ping the same way', async () => {
    const t = setup();
    for (const event of ['click', '', 42, null, { open: true }]) expect((await t.ping(event)).status).toBe(204);
    expect([...t.store.keys()].filter((k) => k.startsWith('count:'))).toEqual([]);
  });

  it('only counts pings from the site, and not when the rate limiter says no (or is missing)', async () => {
    const t = setup();
    expect((await t.ping('play', 'https://evil.example')).status).toBe(403);
    t.setPerKey(0);
    await t.ping('play');
    expect(t.store.get(`count:${t.today}:play`)).toBeUndefined();
    expect([...t.limited.keys()][0]).toMatch(/^ping:/); // its own key, apart from feedback's
    t.setPerKey(5);
    t.env.FEEDBACK_RATE_LIMITER = undefined;
    await t.ping('play');
    expect(t.store.get(`count:${t.today}:play`)).toBeUndefined();
  });

  it('publishes to the usage log Issue (created once), at most once a minute', async () => {
    const t = setup();
    await t.ping('play');
    await Promise.all(t.waits);
    expect(t.calls.map((c) => `${c.method} ${c.url.replace('https://api.github.com/repos/christopher-013/im-dog', '')}`)).toEqual(['POST /issues', 'PATCH /issues/7']);
    expect(t.calls[0]!.body.title).toBe("I'M DOG? usage log");
    expect(t.calls[1]!.body.body).toContain('## Players to date: 1');
    await t.ping('play');
    await Promise.all(t.waits);
    expect(t.calls).toHaveLength(2); // throttled
    await syncLog(t.env, t.kv, t.fetcher, undefined, true);
    expect(t.calls.map((c) => c.method)).toEqual(['POST', 'PATCH', 'PATCH']); // the known Issue, not a new one
  });

  it('writes a readable board: the running total, today, the windows and the best day', () => {
    const stats = [
      { event: 'play' as const, total: 120, today: 4, last7: 30, last30: 100, activeDays: 20, firstDay: '2026-09-01', bestDay: '2026-09-20', bestCount: 12 },
      { event: 'open' as const, total: 500, today: 9, last7: 80, last30: 400, activeDays: 25, firstDay: '2026-09-01', bestDay: '2026-09-20', bestCount: 40 },
    ];
    const body = logBody(stats, '2026-09-29', new Date('2026-09-29T12:00:00Z'));
    expect(body).toContain('## Players to date: 120');
    expect(body).toContain('Today (2026-09-29 UTC): 4 players, 9 visits');
    expect(body).toContain('| Players | 120 | 4 | 30 | 100 | 20 | 12 on 2026-09-20 |');
    expect(body).toContain('| Visits | 500 | 9 | 80 | 400 | 25 | 40 on 2026-09-20 |');
    expect(body).toContain('at least 30 seconds');
  });

  it('comments yesterday\'s line each day from the Cron, skipping days with nobody', async () => {
    const t = setup();
    const now = new Date('2026-09-29T04:00:00Z');
    await postDailyDigest(t.env, t.fetcher, now);
    expect(t.calls.filter((c) => c.url.endsWith('/comments'))).toHaveLength(0);
    t.store.set('count:2026-09-28:play', '3');
    t.store.set('count:2026-09-28:open', '8');
    t.store.set('count:total:play', '50');
    await postDailyDigest(t.env, t.fetcher, now);
    const comment = t.calls.find((c) => c.url.endsWith('/comments'))!;
    expect(comment.body.body).toBe('**2026-09-28 (UTC)**: 3 players, 8 visits. Players to date: 50.');
  });
});
