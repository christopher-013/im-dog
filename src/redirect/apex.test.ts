import { describe, expect, it } from 'vitest';
import worker, { redirectToWww } from './apex';

describe('im-dog.com → www.im-dog.com', () => {
  it('sends every request to the same path and query on https://www.im-dog.com, permanently', () => {
    for (const [from, to] of [
      ['https://im-dog.com/', 'https://www.im-dog.com/'],
      ['https://im-dog.com/feedback-privacy.html', 'https://www.im-dog.com/feedback-privacy.html'],
      ['http://im-dog.com/app/index.js?v=2#top', 'https://www.im-dog.com/app/index.js?v=2#top'],
      ['https://im-dog.com:8443/api/ping', 'https://www.im-dog.com/api/ping'],
    ] as const) {
      const response = redirectToWww(new Request(from));
      expect(response.status, from).toBe(301);
      expect(response.headers.get('Location'), from).toBe(to);
    }
  });

  it('is the Worker\'s whole job, whatever the method', () => {
    const response = worker.fetch(new Request('https://im-dog.com/api/feedback', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://www.im-dog.com/api/feedback');
  });
});
