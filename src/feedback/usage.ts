import { USAGE } from '../config/site';

/**
 * The anonymous player counter at /api/ping, like the ones in the owner's Adtona and Pictayo Workers: it answers
 * "are real people playing?", and is deliberately unable to answer anything narrower.
 *
 * The game sends two events (config/site.ts): `open` when it has loaded (bots and link previews can do that too), and
 * `play` once someone has really played: pressed PLAY and moved Moke through `USAGE.realPlayAfter` seconds of play.
 * `play` is the real-user figure. What's stored is a count per UTC day per event, plus a few running figures kept as
 * they happen (the total, active days, the first and best days). No identifier, cookie, per-visit row, IP address or
 * device detail is ever stored: the address is only the rate limiter's key, and nothing is written about the person.
 *
 * The figures are published to a single public Issue, "I'M DOG? usage log": its body is rewritten with the current
 * numbers (at most once a minute), and a daily comment from the Cron keeps the history.
 */

export interface Kv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface UsageEnv {
  ALLOWED_ORIGINS: string;
  USAGE_COUNTS?: Kv;
  FEEDBACK_RATE_LIMITER?: RateLimiter;
  GITHUB_TOKEN?: string;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

export const PING_PATH = '/api/ping';
export const USAGE_EVENTS = ['play', 'open'] as const;
export type UsageEvent = (typeof USAGE_EVENTS)[number];
const LABELS: Readonly<Record<UsageEvent, { plural: string; one: string }>> = {
  play: { plural: 'players', one: 'player' },
  open: { plural: 'visits', one: 'visit' },
};

const REPO = 'christopher-013/im-dog';
const LOG_TITLE = "I'M DOG? usage log";
/** A ping is one short field; anything larger isn't one. */
const MAX_PING_BYTES = 256;
/** Daily counts are kept about 13 months, so a year-on-year look still has something to show. */
const COUNT_TTL_SECONDS = 400 * 24 * 60 * 60;
/** The rolling windows (and the most days read to build them). */
const WINDOW_DAYS = 30;
/** The log's body is rewritten at most this often, so a burst of players can't become a burst of GitHub writes. */
const LOG_SYNC_MIN_MS = 60_000;

const dayKey = (day: string, event: UsageEvent) => `count:${day}:${event}`;
const totalKey = (event: UsageEvent) => `count:total:${event}`;
const firstKey = (event: UsageEvent) => `stats:first:${event}`;
const bestKey = (event: UsageEvent) => `stats:best:${event}`;
const activeKey = (event: UsageEvent) => `stats:active:${event}`;
const LOG_ISSUE_KEY = 'log:issue';
const LOG_SYNC_KEY = 'log:synced';

/** What a ping just wrote (KV is eventually consistent: the publisher trusts these over a read-back). */
interface Recorded {
  event: UsageEvent;
  today: number;
  total: number;
}

export interface EventStats {
  event: UsageEvent;
  total: number;
  today: number;
  last7: number;
  last30: number;
  activeDays: number;
  firstDay: string;
  bestDay: string;
  bestCount: number;
}

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isUsageEvent(value: unknown): value is UsageEvent {
  return typeof value === 'string' && (USAGE_EVENTS as readonly string[]).includes(value);
}

function readInt(value: string | null): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseBest(value: string | null): { day: string; count: number } {
  const [day = '', count = '0'] = (value ?? '').split(':');
  return { day, count: readInt(count) };
}

function allowedOrigins(value: string | undefined): string[] {
  return (value ?? '').split(',').map((o) => o.trim()).filter(Boolean);
}

function corsHeaders(origin: string): Headers {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin' });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
  }
  return headers;
}

/** One ping from the game. Always answers without content: the game neither needs nor reads a reply. */
export async function handlePing(request: Request, env: UsageEnv, ctx?: WorkerContext, fetcher: typeof fetch = fetch): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = allowedOrigins(env.ALLOWED_ORIGINS).includes(origin);
  const headers = corsHeaders(allowed ? origin : '');
  if (!allowed) return new Response(null, { status: 403, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers });
  const quiet = () => new Response(null, { status: 204, headers });

  let event: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_PING_BYTES) return quiet();
    event = (JSON.parse(raw) as { event?: unknown } | null)?.event;
  } catch {
    return quiet();
  }
  if (!isUsageEvent(event)) return quiet();

  // A counter with no throttle is one anyone can inflate: without the limiter or the store, count nothing. The key's
  // prefix keeps pings apart from feedback, so counting can never use up someone's feedback allowance.
  const limiter = env.FEEDBACK_RATE_LIMITER;
  const counts = env.USAGE_COUNTS;
  if (typeof limiter?.limit !== 'function' || !counts) return quiet();
  try {
    if (!(await limiter.limit({ key: `ping:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}` })).success) return quiet();
  } catch {
    return quiet();
  }

  let recorded: Recorded;
  try {
    recorded = await count(counts, event, utcDay(new Date()));
  } catch {
    return quiet();
  }
  // Publish after answering: nothing the player sees waits on GitHub.
  const publish = syncLog(env, counts, fetcher, recorded).catch(() => undefined);
  if (ctx) ctx.waitUntil(publish);
  return quiet();
}

/**
 * Adds one to the day's count and keeps the running figures. KV's read-then-write isn't atomic, so two pings at the
 * same instant can land as one: fine for "are people playing?", and the alternative (a row per visit) would store
 * strictly more about visitors.
 */
async function count(counts: Kv, event: UsageEvent, day: string): Promise<Recorded> {
  const today = readInt(await counts.get(dayKey(day, event))) + 1;
  await counts.put(dayKey(day, event), String(today), { expirationTtl: COUNT_TTL_SECONDS });
  const total = readInt(await counts.get(totalKey(event))) + 1;
  await counts.put(totalKey(event), String(total));
  if (today === 1) {
    await counts.put(activeKey(event), String(readInt(await counts.get(activeKey(event))) + 1));
    if (!(await counts.get(firstKey(event)))) await counts.put(firstKey(event), day);
  }
  if (today > parseBest(await counts.get(bestKey(event))).count) await counts.put(bestKey(event), `${day}:${today}`);
  return { event, today, total };
}

/** Everything known about one event: the stored figures, and the rolling windows from the last 30 daily counts. */
export async function eventStats(counts: Kv, event: UsageEvent, today: string, fresh?: Recorded): Promise<EventStats> {
  const own = fresh?.event === event ? fresh : undefined;
  let last7 = 0;
  let last30 = 0;
  let todayCount = 0;
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const day = utcDay(new Date(Date.parse(`${today}T00:00:00Z`) - i * 86_400_000));
    let n = readInt(await counts.get(dayKey(day, event)));
    if (i === 0) n = todayCount = Math.max(n, own?.today ?? 0);
    if (i < 7) last7 += n;
    last30 += n;
  }
  const best = parseBest(await counts.get(bestKey(event)));
  return {
    event,
    total: Math.max(readInt(await counts.get(totalKey(event))), own?.total ?? 0),
    today: todayCount,
    last7,
    last30,
    activeDays: readInt(await counts.get(activeKey(event))),
    firstDay: (await counts.get(firstKey(event))) ?? '',
    bestDay: best.day,
    bestCount: best.count,
  };
}

/** The usage log's body: the current numbers up top, then what they mean. */
export function logBody(stats: readonly EventStats[], today: string, updated: Date): string {
  const play = stats.find((s) => s.event === 'play')!;
  const open = stats.find((s) => s.event === 'open')!;
  const row = (s: EventStats) => {
    const label = LABELS[s.event].plural[0]!.toUpperCase() + LABELS[s.event].plural.slice(1);
    return `| ${label} | ${s.total} | ${s.today} | ${s.last7} | ${s.last30} | ${s.activeDays} | ${s.bestDay ? `${s.bestCount} on ${s.bestDay}` : '—'} |`;
  };
  return [
    `## Players to date: ${play.total}`,
    '',
    `Today (${today} UTC): ${play.today} ${play.today === 1 ? 'player' : 'players'}, ${open.today} ${open.today === 1 ? 'visit' : 'visits'}`,
    '',
    `_Updated ${updated.toISOString()}_`,
    '',
    '| | Total | Today | 7 days | 30 days | Active days | Best day |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
    row(play),
    row(open),
    '',
    `Counting since ${play.firstDay || open.firstDay || today}.`,
    '',
    '---',
    '',
    "Anonymous counts from the I'M DOG? site (https://im-dog.com). A **player** pressed PLAY and really played (moved",
    `Moke around for at least ${USAGE.realPlayAfter} seconds of play); a **visit** is the game loading, which bots and link`,
    'previews can do too, so players is the real figure. Only daily totals are stored: no identifier, cookie, IP address',
    'or device details. The comments below are the daily history.',
  ].join('\n');
}

function githubHeaders(env: UsageEnv): Record<string, string> {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'im-dog-usage',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function github(env: UsageEnv, fetcher: typeof fetch, path: string, method: string, body: object): Promise<Response> {
  // redirect: 'manual', as in the feedback handler: a renamed repository must fail loudly, not "succeed" as a GET.
  return fetcher(`https://api.github.com/repos/${REPO}${path}`, { method, headers: githubHeaders(env), body: JSON.stringify(body), redirect: 'manual' });
}

/** The usage log's Issue number, creating the Issue the first time. */
async function logIssue(env: UsageEnv, counts: Kv, fetcher: typeof fetch, body: string): Promise<number | null> {
  const known = readInt(await counts.get(LOG_ISSUE_KEY));
  if (known) return known;
  const response = await github(env, fetcher, '/issues', 'POST', { title: LOG_TITLE, body });
  if (!response.ok) return null;
  const number = ((await response.json()) as { number?: number }).number;
  if (!Number.isSafeInteger(number) || !number || number < 1) return null;
  await counts.put(LOG_ISSUE_KEY, String(number));
  return number;
}

/** Rewrites the log's body with the current numbers (at most once a minute unless `force`). */
export async function syncLog(env: UsageEnv, counts: Kv, fetcher: typeof fetch = fetch, fresh?: Recorded, force = false): Promise<void> {
  if (!env.GITHUB_TOKEN) return;
  if (!force && Date.now() - readInt(await counts.get(LOG_SYNC_KEY)) < LOG_SYNC_MIN_MS) return;
  await counts.put(LOG_SYNC_KEY, String(Date.now()));
  const now = new Date();
  const today = utcDay(now);
  const stats = [];
  for (const event of USAGE_EVENTS) stats.push(await eventStats(counts, event, today, fresh));
  const body = logBody(stats, today, now);
  const issue = await logIssue(env, counts, fetcher, body);
  if (issue) await github(env, fetcher, `/issues/${issue}`, 'PATCH', { body });
}

/** The daily Cron: yesterday's line as a comment on the log (days with nobody at all are skipped). */
export async function postDailyDigest(env: UsageEnv, fetcher: typeof fetch = fetch, now = new Date()): Promise<void> {
  const counts = env.USAGE_COUNTS;
  if (!counts || !env.GITHUB_TOKEN) return;
  const yesterday = utcDay(new Date(now.getTime() - 86_400_000));
  const play = readInt(await counts.get(dayKey(yesterday, 'play')));
  const open = readInt(await counts.get(dayKey(yesterday, 'open')));
  if (play > 0 || open > 0) {
    const total = readInt(await counts.get(totalKey('play')));
    const line = `**${yesterday} (UTC)**: ${play} ${play === 1 ? 'player' : 'players'}, ${open} ${open === 1 ? 'visit' : 'visits'}. Players to date: ${total}.`;
    const issue = await logIssue(env, counts, fetcher, line);
    if (issue) await github(env, fetcher, `/issues/${issue}/comments`, 'POST', { body: line });
  }
  await syncLog(env, counts, fetcher, undefined, true);
}
