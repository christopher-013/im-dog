/**
 * The www.im-dog.com Worker (wrangler.www.jsonc): sends every request to the same path and query on
 * https://im-dog.com, permanently, so the game has one address (and one origin for its feedback and counter).
 * Never imported by the game bundle.
 */
export const CANONICAL_HOST = 'im-dog.com';

export function redirectToApex(request: Request): Response {
  const url = new URL(request.url);
  url.protocol = 'https:';
  url.hostname = CANONICAL_HOST;
  url.port = '';
  return new Response(null, { status: 301, headers: { Location: url.toString(), 'Cache-Control': 'public, max-age=86400' } });
}

export default {
  fetch(request: Request): Response {
    return redirectToApex(request);
  },
};
