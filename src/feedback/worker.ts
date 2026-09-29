import { handlePing, PING_PATH, postDailyDigest, type Kv, type RateLimiter } from './usage';

/**
 * The site Worker for im-dog.com (wrangler.jsonc), built like the owner's Adtona and Pictayo Workers: it serves the
 * built game (the ASSETS binding, dist/), takes player feedback at /api/feedback on the same origin (a public GitHub
 * Issue, and a private record), and counts real players at /api/ping (see usage.ts). A daily Cron purges old private
 * records and posts yesterday's counts. docs/FEEDBACK.md. Never imported by the game bundle.
 */
interface DbStatement {
  bind(...values: (string | number | null)[]): DbStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface FeedbackDb {
  prepare(sql: string): DbStatement;
}

export interface FeedbackEnv {
  FEEDBACK_DB: FeedbackDb;
  GITHUB_TOKEN: string;
  /** Where the form may post from, comma separated (https://im-dog.com). */
  ALLOWED_ORIGINS: string;
  /** Cloudflare's rate limiter (wrangler.jsonc: 5 a minute per key), as Adtona and Pictayo use. */
  FEEDBACK_RATE_LIMITER?: RateLimiter;
  /** The anonymous usage counts (KV). */
  USAGE_COUNTS?: Kv;
  /** The built game (Workers static assets). */
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

/** Where the game's form posts. */
export const FEEDBACK_PATH = '/api/feedback';

interface FeedbackFields {
  name: string;
  email: string;
  comments: string;
  website: string;
  submissionId: string;
  context: FeedbackContext;
}

/** What the game reports about how it was played (all optional; anything malformed is dropped, not rejected). */
interface FeedbackContext {
  /** keyboard, touch or gamepad (public: it helps with bugs, and identifies no one). */
  input: string;
  /** The game build (public). */
  build: string;
  /** Private: the browser's language, time zone and window size. */
  language: string;
  timeZone: string;
  screen: string;
}

const CONTEXT_PATTERNS: Readonly<Record<keyof FeedbackContext, RegExp>> = {
  input: /^(keyboard|touch|gamepad)$/,
  build: /^[0-9a-z]{1,12}$/,
  language: /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/,
  timeZone: /^[A-Za-z0-9_+-]{1,32}(\/[A-Za-z0-9_+-]{1,32}){0,2}$/,
  screen: /^\d{2,5}x\d{2,5}$/,
};
const INPUT_NAMES: Readonly<Record<string, string>> = { keyboard: 'keyboard and mouse', touch: 'touch (phone or tablet)', gamepad: 'controller' };

function parseContext(value: unknown): FeedbackContext {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const pick = (key: keyof FeedbackContext) => {
    const text = typeof record[key] === 'string' ? (record[key] as string).trim() : '';
    return CONTEXT_PATTERNS[key].test(text) ? text : '';
  };
  return { input: pick('input'), build: pick('build'), language: pick('language'), timeZone: pick('timeZone'), screen: pick('screen') };
}

const MAX_BODY_BYTES = 8_192;
/** A cap on top of the per-minute rate limiter: no more than this many from one address an hour. */
const MAX_PER_HOUR = 3;
const RETENTION_SECONDS = 30 * 24 * 60 * 60;
const GITHUB_ISSUES = 'https://api.github.com/repos/christopher-013/im-dog/issues';

function json(status: number, body: object, origin?: string): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(JSON.stringify(body), { status, headers });
}

async function readSmallBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function parseFields(value: unknown): FeedbackFields | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const fields = ['name', 'email', 'comments', 'website', 'submissionId'] as const;
  if (fields.some((key) => typeof record[key] !== 'string')) return null;
  const [name, email, comments, website, submissionId] = fields.map((key) => (record[key] as string).trim());
  if (name.length > 80 || email.length > 254 || comments.length > 2_000 || website.length > 200) return null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) return null;
  return { name, email, comments, website, submissionId, context: parseContext(record.context) };
}

/** The public title: the first line of the comments, like "[Feedback] Moke is the best" (as Adtona and Pictayo do). */
function issueTitle(fields: FeedbackFields): string {
  const line = fields.comments.split(/\r?\n/).find((l) => l.trim())?.replace(/\s+/g, ' ').trim() ?? '';
  const summary = line.length > 60 ? `${line.slice(0, 59).trimEnd()}\u2026` : line;
  return `[Feedback] ${summary ? summary.replace(/@/g, '@\u200b') : '(no comments)'}`;
}

function issueBody(fields: FeedbackFields, id: string, createdAt: number): string {
  // Do not publish name, email, IP, country, User-Agent, language, time zone or screen size. Neutralize @mentions
  // in untrusted comments. How it was played and the build are public: they help with bugs and identify no one.
  const comment = fields.comments ? fields.comments.replace(/@/g, '@\u200b') : '(No written comments.)';
  const { input, build } = fields.context;
  const played = input ? `Played with: ${INPUT_NAMES[input]}\n` : '';
  const game = build ? `Game build: ${build}\n` : '';
  return `## Player feedback\n\n${comment}\n\n---\n${played}${game}Reference: ${id}\nReceived: ${new Date(createdAt * 1000).toISOString()}\n`;
}

export async function handleFeedback(request: Request, env: FeedbackEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path !== FEEDBACK_PATH) return json(404, { error: 'Not found' });
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return json(403, { error: 'Forbidden' });
  if (request.method === 'OPTIONS') {
    const headers = new Headers({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
    });
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, origin);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json(415, { error: 'JSON required' }, origin);
  if (!env.GITHUB_TOKEN || !env.FEEDBACK_DB) return json(503, { error: 'Feedback unavailable' }, origin);
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return json(400, { error: 'Visitor address unavailable' }, origin);
  let fields: FeedbackFields | null;
  try {
    const raw = await readSmallBody(request);
    fields = raw ? parseFields(JSON.parse(raw) as unknown) : null;
  } catch {
    fields = null;
  }
  if (!fields) return json(400, { error: 'Invalid feedback' }, origin);
  // The hidden field only a bot fills in: quietly "accepted", as Adtona and Pictayo do, so it learns nothing.
  if (fields.website) return json(201, { issueNumber: null }, origin);

  // Cloudflare's rate limiter, keyed per address (apart from the usage counter's key). No limiter configured is no
  // control at all: fail closed, as Pictayo does.
  const limiter = env.FEEDBACK_RATE_LIMITER;
  if (typeof limiter?.limit !== 'function') return json(503, { error: 'Feedback unavailable' }, origin);
  try {
    if (!(await limiter.limit({ key: `feedback:${ip}` })).success) return json(429, { error: 'Too many submissions' }, origin);
  } catch {
    return json(503, { error: 'Feedback unavailable' }, origin);
  }

  const now = Math.floor(Date.now() / 1000);
  const id = fields.submissionId;
  const country = ((request as Request & { cf?: { country?: string | null } }).cf?.country ?? null)?.slice(0, 2) ?? null;
  const userAgent = request.headers.get('User-Agent')?.slice(0, 512) ?? null;
  try {
    const prior = await env.FEEDBACK_DB.prepare('SELECT ip, issue_number FROM feedback_private WHERE id = ?')
      .bind(id).first<{ ip: string; issue_number: number | null }>();
    if (prior) {
      if (prior.ip !== ip) return json(403, { error: 'Forbidden' }, origin);
      return prior.issue_number ? json(200, { issueNumber: prior.issue_number }, origin) : json(409, { error: 'Submission still processing' }, origin);
    }
    const count = await env.FEEDBACK_DB.prepare('SELECT COUNT(*) AS count FROM feedback_private WHERE ip = ? AND created_at > ?')
      .bind(ip, now - 3600).first<{ count: number }>();
    if ((count?.count ?? 0) >= MAX_PER_HOUR) return json(429, { error: 'Too many submissions' }, origin);
    const c = fields.context;
    await env.FEEDBACK_DB.prepare('INSERT INTO feedback_private (id, created_at, name, email, ip, country, user_agent, language, time_zone, screen, input_mode, game_build, issue_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
      .bind(id, now, fields.name || null, fields.email || null, ip, country, userAgent, c.language || null, c.timeZone || null, c.screen || null, c.input || null, c.build || null).run();
  } catch {
    return json(503, { error: 'Feedback unavailable' }, origin);
  }

  let githubRejected = false;
  try {
    const response = await fetcher(GITHUB_ISSUES, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'im-dog-feedback',
        // The version Adtona's and Pictayo's feedback Workers already use against this API.
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title: issueTitle(fields), body: issueBody(fields, id, now) }),
      // A renamed repository answers with a redirect, which fetch would follow as a GET and "succeed" without filing
      // anything: treat any redirect as a failure instead (a lesson from Pictayo's Worker).
      redirect: 'manual',
    });
    if (!response.ok) {
      githubRejected = true;
      throw new Error('GitHub rejected feedback');
    }
    const result = await response.json() as { number?: number };
    if (!Number.isSafeInteger(result.number) || (result.number ?? 0) < 1) throw new Error('GitHub did not confirm feedback');
    // An update failure must not turn a successfully created public Issue into a retry/duplicate.
    try {
      await env.FEEDBACK_DB.prepare('UPDATE feedback_private SET issue_number = ? WHERE id = ?').bind(result.number!, id).run();
    } catch { /* the reference ID in the Issue still matches the private record */ }
    return json(201, { issueNumber: result.number }, origin);
  } catch {
    // A network failure can happen after GitHub has accepted the Issue. Keep the
    // reference reserved so a retry cannot create a duplicate with the same ID.
    if (githubRejected) {
      try { await env.FEEDBACK_DB.prepare('DELETE FROM feedback_private WHERE id = ?').bind(id).run(); } catch { /* daily purge will remove it */ }
    }
    return json(502, { error: 'Feedback could not be sent' }, origin);
  }
}

export async function purgePrivateFeedback(env: FeedbackEnv, now = Math.floor(Date.now() / 1000)): Promise<void> {
  await env.FEEDBACK_DB.prepare('DELETE FROM feedback_private WHERE created_at < ?').bind(now - RETENTION_SECONDS).run();
}

/** The runtime's context: work to finish after the response has gone. */
export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

/** Every request: feedback and pings to their handlers, everything else to the game's files. */
export function handleRequest(request: Request, env: FeedbackEnv, ctx?: WorkerContext): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === FEEDBACK_PATH) return handleFeedback(request, env);
  if (path === PING_PATH) return handlePing(request, env, ctx);
  if (env.ASSETS) return env.ASSETS.fetch(request);
  return Promise.resolve(new Response('Not found', { status: 404 }));
}

export default {
  fetch(request: Request, env: FeedbackEnv, ctx?: WorkerContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
  async scheduled(_event: unknown, env: FeedbackEnv): Promise<void> {
    await Promise.allSettled([purgePrivateFeedback(env), postDailyDigest(env)]);
  },
};
