import { describe, expect, it, vi } from 'vitest';
import worker, { handleFeedback, purgePrivateFeedback, type FeedbackEnv } from './worker';

function setup() {
  const rows = new Map<string, { ip: string; created: number; issue: number | null }>();
  const statements: { sql: string; values: (string | number | null)[] }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: (string | number | null)[]) {
          const call = { sql, values };
          statements.push(call);
          return {
            async first<T>() {
              if (sql.includes('WHERE id = ?')) {
                const row = rows.get(String(values[0]));
                return row ? { ip: row.ip, issue_number: row.issue } as T : null;
              }
              const count = [...rows.values()].filter((row) => row.ip === values[0] && row.created > Number(values[1])).length;
              return { count } as T;
            },
            async run() {
              if (sql.startsWith('INSERT')) rows.set(String(values[0]), { ip: String(values[4]), created: Number(values[1]), issue: null });
              if (sql.startsWith('UPDATE')) rows.get(String(values[1]))!.issue = Number(values[0]);
              if (sql.startsWith('DELETE') && sql.includes('WHERE id')) rows.delete(String(values[0]));
              if (sql.startsWith('DELETE') && sql.includes('created_at')) {
                for (const [id, row] of rows) if (row.created < Number(values[0])) rows.delete(id);
              }
            },
          };
        },
      };
    },
  };
  const env = {
    FEEDBACK_DB: db,
    GITHUB_TOKEN: 'test-secret',
    TURNSTILE_SECRET: 'test-challenge-secret',
    ALLOWED_ORIGIN: 'https://christopher-013.github.io',
    TURNSTILE_HOSTNAME: 'christopher-013.github.io',
  } as FeedbackEnv;
  const githubBodies: string[] = [];
  let challengeValid = true;
  let githubWorks: boolean | 'network-error' = true;
  const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).includes('siteverify')) {
      return Response.json({ success: challengeValid, hostname: 'christopher-013.github.io', action: 'feedback' });
    }
    githubBodies.push(String(init?.body));
    if (githubWorks === 'network-error') throw new Error('Connection dropped');
    return githubWorks ? Response.json({ number: 42 }, { status: 201 }) : Response.json({}, { status: 503 });
  }) as unknown as typeof fetch;
  const request = (body: object, origin = env.ALLOWED_ORIGIN) => Object.assign(new Request('https://example.workers.dev/feedback', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.44', 'User-Agent': 'PrivateBrowser/1' },
    body: JSON.stringify(body),
  }), { cf: { country: 'US' } });
  const fields = { name: 'Alice Private', email: 'alice@example.com', comments: 'I like Moke!', website: '', turnstileToken: 'valid-token', submissionId: crypto.randomUUID() };
  return { env, rows, statements, githubBodies, fetcher, request, fields, setChallenge: (valid: boolean) => { challengeValid = valid; }, setGithub: (works: boolean | 'network-error') => { githubWorks = works; } };
}

describe('private feedback Worker', () => {
  it('creates a public Issue without publishing optional contact or network data', async () => {
    const t = setup();
    const response = await handleFeedback(t.request(t.fields), t.env, t.fetcher);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ issueNumber: 42 });
    const issue = t.githubBodies[0]!;
    expect(issue).toContain('I like Moke!');
    for (const privateText of ['Alice Private', 'alice@example.com', '203.0.113.44', 'PrivateBrowser/1', 'US']) {
      expect(issue).not.toContain(privateText);
    }
    expect([...t.rows.values()][0]?.issue).toBe(42);
    expect(t.statements.find((s) => s.sql.startsWith('INSERT'))?.values).toContain('alice@example.com');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(t.env.ALLOWED_ORIGIN);
  });

  it('uses the runtime fetch handler without treating Cloudflare execution context as an HTTP fetcher', async () => {
    const t = setup();
    vi.stubGlobal('fetch', t.fetcher);
    try {
      const runtimeFetch = worker.fetch as (request: Request, env: FeedbackEnv, context: object) => Promise<Response>;
      const response = await runtimeFetch(t.request(t.fields), t.env, { waitUntil() {} });
      expect(response.status).toBe(201);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('accepts blank optional fields, but neutralizes mentions in public comments', async () => {
    const t = setup();
    const response = await handleFeedback(t.request({ ...t.fields, name: '', email: '', comments: '@someone' }), t.env, t.fetcher);
    expect(response.status).toBe(201);
    expect(t.githubBodies[0]).toContain('@\u200bsomeone');
  });

  it('rejects a foreign origin before verifying or writing', async () => {
    const t = setup();
    const response = await handleFeedback(t.request(t.fields, 'https://attacker.example'), t.env, t.fetcher);
    expect(response.status).toBe(403);
    expect(t.fetcher).not.toHaveBeenCalled();
    expect(t.rows.size).toBe(0);
  });

  it('requires a valid server-verified Turnstile token', async () => {
    const t = setup();
    t.setChallenge(false);
    const response = await handleFeedback(t.request(t.fields), t.env, t.fetcher);
    expect(response.status).toBe(403);
    expect(t.githubBodies).toHaveLength(0);
    expect(t.rows.size).toBe(0);
  });

  it('limits each IP to three submissions an hour', async () => {
    const t = setup();
    for (let i = 0; i < 3; i++) expect((await handleFeedback(t.request({ ...t.fields, submissionId: crypto.randomUUID() }), t.env, t.fetcher)).status).toBe(201);
    expect((await handleFeedback(t.request({ ...t.fields, submissionId: crypto.randomUUID() }), t.env, t.fetcher)).status).toBe(429);
    expect(t.githubBodies).toHaveLength(3);
  });

  it('returns the prior Issue on a network retry instead of creating a duplicate', async () => {
    const t = setup();
    expect((await handleFeedback(t.request(t.fields), t.env, t.fetcher)).status).toBe(201);
    const retry = await handleFeedback(t.request(t.fields), t.env, t.fetcher);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ issueNumber: 42 });
    expect(t.githubBodies).toHaveLength(1);
  });

  it('does not report success or retain a new record when GitHub fails', async () => {
    const t = setup();
    t.setGithub(false);
    const response = await handleFeedback(t.request(t.fields), t.env, t.fetcher);
    expect(response.status).toBe(502);
    expect(t.rows.size).toBe(0);
  });

  it('reserves the reference when the GitHub response is uncertain to prevent duplicate Issues', async () => {
    const t = setup();
    t.setGithub('network-error');
    expect((await handleFeedback(t.request(t.fields), t.env, t.fetcher)).status).toBe(502);
    expect(t.rows.size).toBe(1);
    t.setGithub(true);
    expect((await handleFeedback(t.request(t.fields), t.env, t.fetcher)).status).toBe(409);
    expect(t.githubBodies).toHaveLength(1);
  });

  it('titles the Issue from the comments, and adds how it was played and the build, keeping the rest private', async () => {
    const t = setup();
    const context = { input: 'touch', build: 'abc1234', language: 'en-US', timeZone: 'America/Los_Angeles', screen: '390x844' };
    const response = await handleFeedback(t.request({ ...t.fields, comments: 'Moke is the best dog ever\nMore thoughts…', context }), t.env, t.fetcher);
    expect(response.status).toBe(201);
    const sent = JSON.parse(t.githubBodies[0]!) as { title: string; body: string };
    expect(sent.title).toBe('[Feedback] Moke is the best dog ever');
    expect(sent.body).toContain('Played with: touch (phone or tablet)');
    expect(sent.body).toContain('Game build: abc1234');
    for (const privateText of ['en-US', 'America/Los_Angeles', '390x844']) expect(sent.body + sent.title, privateText).not.toContain(privateText);
    // Stored privately, with the IP, country and browser.
    const insert = t.statements.find((s) => s.sql.startsWith('INSERT'))!.values;
    for (const value of ['203.0.113.44', 'US', 'PrivateBrowser/1', 'en-US', 'America/Los_Angeles', '390x844', 'touch', 'abc1234']) expect(insert, value).toContain(value);
  });

  it('keeps titles short and mention-free, and copes with no comments', async () => {
    const t = setup();
    await handleFeedback(t.request({ ...t.fields, comments: `@owner ${'x'.repeat(100)}` }), t.env, t.fetcher);
    const long = JSON.parse(t.githubBodies[0]!) as { title: string };
    expect(long.title.length).toBeLessThanOrEqual('[Feedback] '.length + 61);
    expect(long.title).toMatch(/…$/);
    expect(long.title).toContain('@​owner');
    await handleFeedback(t.request({ ...t.fields, comments: '', submissionId: crypto.randomUUID() }), t.env, t.fetcher);
    expect((JSON.parse(t.githubBodies[1]!) as { title: string }).title).toBe('[Feedback] (no comments)');
  });

  it('drops malformed context instead of rejecting the feedback (and never echoes it)', async () => {
    const t = setup();
    const context = { input: 'hacker', build: '<script>', language: 'x'.repeat(50), timeZone: '../../etc', screen: 'huge' };
    const response = await handleFeedback(t.request({ ...t.fields, context }), t.env, t.fetcher);
    expect(response.status).toBe(201);
    const sent = JSON.parse(t.githubBodies[0]!) as { body: string };
    expect(sent.body).not.toContain('Played with');
    expect(sent.body).not.toContain('<script>');
    const insert = t.statements.find((s) => s.sql.startsWith('INSERT'))!.values;
    expect(insert.slice(7)).toEqual([null, null, null, null, null]);
  });

  it('purges active private records older than 30 days', async () => {
    const t = setup();
    const now = 40 * 24 * 60 * 60;
    await t.env.FEEDBACK_DB.prepare('INSERT INTO feedback_private (id, created_at, name, email, ip, country, user_agent, issue_number) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)')
      .bind('old', 0, null, null, '203.0.113.44', null, null).run();
    await purgePrivateFeedback(t.env, now);
    expect(t.rows.size).toBe(0);
  });
});
