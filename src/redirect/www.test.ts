import { describe, expect, it } from 'vitest';
import worker, { redirectToApex } from './www';

describe('www.im-dog.com → im-dog.com', () => {
  it('sends every request to the same path and query on https://im-dog.com, permanently', () => {
    for (const [from, to] of [
      ['https://www.im-dog.com/', 'https://im-dog.com/'],
      ['https://www.im-dog.com/feedback-privacy.html', 'https://im-dog.com/feedback-privacy.html'],
      ['http://www.im-dog.com/app/index.js?v=2#top', 'https://im-dog.com/app/index.js?v=2#top'],
      ['https://www.im-dog.com:8443/api/ping', 'https://im-dog.com/api/ping'],
    ] as const) {
      const response = redirectToApex(new Request(from));
      expect(response.status, from).toBe(301);
      expect(response.headers.get('Location'), from).toBe(to);
    }
  });

  it('is the Worker\'s whole job, whatever the method', () => {
    const response = worker.fetch(new Request('https://www.im-dog.com/api/feedback', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://im-dog.com/api/feedback');
  });
});
