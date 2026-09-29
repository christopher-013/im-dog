/** Cloudflare Worker entry. This module is never imported by the game bundle. */
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
  TURNSTILE_SECRET: string;
  ALLOWED_ORIGIN: string;
  TURNSTILE_HOSTNAME: string;
}

interface FeedbackFields {
  name: string;
  email: string;
  comments: string;
  website: string;
  turnstileToken: string;
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

interface ChallengeResult {
  success?: boolean;
  hostname?: string;
  action?: string;
}

const MAX_BODY_BYTES = 8_192;
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
  const fields = ['name', 'email', 'comments', 'website', 'turnstileToken', 'submissionId'] as const;
  if (fields.some((key) => typeof record[key] !== 'string')) return null;
  const [name, email, comments, website, turnstileToken, submissionId] = fields.map((key) => (record[key] as string).trim());
  if (name.length > 80 || email.length > 254 || comments.length > 2_000 || website.length > 200 || turnstileToken.length > 2_048) return null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) return null;
  return { name, email, comments, website, turnstileToken, submissionId, context: parseContext(record.context) };
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

async function verifyChallenge(token: string, ip: string, env: FeedbackEnv, fetcher: typeof fetch): Promise<boolean> {
  const params = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip });
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: params,
  });
  if (!response.ok) return false;
  const result = await response.json() as ChallengeResult;
  return result.success === true && result.hostname === env.TURNSTILE_HOSTNAME && result.action === 'feedback';
}

export async function handleFeedback(request: Request, env: FeedbackEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path !== '/feedback') return json(404, { error: 'Not found' });
  const origin = request.headers.get('Origin');
  if (!origin || origin !== env.ALLOWED_ORIGIN) return json(403, { error: 'Forbidden' });
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
  if (!env.GITHUB_TOKEN || !env.TURNSTILE_SECRET || !env.FEEDBACK_DB) return json(503, { error: 'Feedback unavailable' }, origin);
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return json(400, { error: 'Visitor address unavailable' }, origin);
  let fields: FeedbackFields | null;
  try {
    const raw = await readSmallBody(request);
    fields = raw ? parseFields(JSON.parse(raw) as unknown) : null;
  } catch {
    fields = null;
  }
  if (!fields || !fields.turnstileToken) return json(400, { error: 'Invalid feedback' }, origin);
  if (fields.website) return json(400, { error: 'Invalid feedback' }, origin); // hidden bot trap

  try {
    if (!await verifyChallenge(fields.turnstileToken, ip, env, fetcher)) return json(403, { error: 'Verification failed' }, origin);
  } catch {
    return json(503, { error: 'Verification unavailable' }, origin);
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

export default {
  fetch(request: Request, env: FeedbackEnv): Promise<Response> { return handleFeedback(request, env); },
  scheduled(_event: unknown, env: FeedbackEnv): Promise<void> { return purgePrivateFeedback(env); },
};
