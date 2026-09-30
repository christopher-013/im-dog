/**
 * The im-dog.com Worker (wrangler.apex.jsonc): sends every request to the same path and query on
 * https://www.im-dog.com, permanently, so the game has one address (and one origin for its saves, feedback and
 * counter). The owner chose www as the address people see (D26). Never imported by the game bundle.
 */
export const CANONICAL_HOST = 'www.im-dog.com';

export function redirectToWww(request: Request): Response {
  const url = new URL(request.url);
  url.protocol = 'https:';
  url.hostname = CANONICAL_HOST;
  url.port = '';
  return new Response(null, { status: 301, headers: { Location: url.toString(), 'Cache-Control': 'public, max-age=86400' } });
}

export default {
  fetch(request: Request): Response {
    return redirectToWww(request);
  },
};
