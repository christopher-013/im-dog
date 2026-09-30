// Tells IndexNow (Bing, and Yandex, Seznam, Naver and others through it; not Google) that www.im-dog.com's pages have
// changed, after each deploy (.github/workflows/deploy-cloudflare.yml; docs/FEEDBACK.md → "Search engines"). The pages
// are the ones in public/sitemap.xml. The key is public by design: IndexNow checks that public/<KEY>.txt on the site
// holds it, which shows the notice comes from whoever runs the site. To change it, rename that file and KEY together.
// Run: node scripts/indexnow.mjs [--dry-run]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'www.im-dog.com';
const KEY = '34b2dbe66046a9ead64ac544a887a507';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
if (readFileSync(path.join(publicDir, `${KEY}.txt`), 'utf8').trim() !== KEY) throw new Error(`public/${KEY}.txt must hold the key`);
const sitemap = readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
if (!urlList.length || urlList.some((url) => new URL(url).host !== HOST)) throw new Error(`sitemap.xml must list pages on ${HOST}`);

const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList };
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}

// 200: received. 202: received, the key still being checked (the first time). Anything else is worth a look, but it
// never fails the deploy: the site is already live by now.
try {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (response.ok) console.log(`IndexNow: ${response.status}, ${urlList.length} pages submitted (${urlList.join(', ')})`);
  else console.log(`::warning::IndexNow answered ${response.status} ${response.statusText}: ${(await response.text()).slice(0, 300)}`);
} catch (error) {
  console.log(`::warning::IndexNow couldn't be reached: ${error instanceof Error ? error.message : error}`);
}
