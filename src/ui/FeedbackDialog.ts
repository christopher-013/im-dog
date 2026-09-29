/** The player-facing form. No GitHub credential or private visitor data lives in the game bundle. */
interface TurnstileApi {
  render(container: HTMLElement, options: {
    sitekey: string;
    action: string;
    theme: 'light';
    callback(token: string): void;
    'expired-callback'(): void;
    'error-callback'(): boolean;
  }): string;
  reset(id: string): void;
  remove(id: string): void;
}

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

function validEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}

export class FeedbackDialog {
  private readonly dialog: HTMLDialogElement;
  private readonly form: HTMLFormElement;
  private readonly status: HTMLElement;
  private readonly issueLink: HTMLAnchorElement;
  private readonly submitButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly challenge: HTMLElement;
  private readonly consent: HTMLInputElement;
  private widgetId: string | undefined;
  private token = '';
  private scriptLoading: Promise<void> | undefined;
  private sending = false;
  private submissionId: string | undefined;
  readonly enabled: boolean;

  constructor(
    private readonly doc: Document,
    private readonly endpoint: string,
    private readonly siteKey: string,
  ) {
    const el = <T extends HTMLElement>(id: string): T => {
      const found = doc.getElementById(id);
      if (!found) throw new Error(`Missing #${id}`);
      return found as T;
    };
    this.dialog = el<HTMLDialogElement>('feedback-dialog');
    this.form = el<HTMLFormElement>('feedback-form');
    this.status = el('feedback-status');
    this.issueLink = el<HTMLAnchorElement>('feedback-issue-link');
    this.submitButton = el<HTMLButtonElement>('btn-feedback-submit');
    this.closeButton = el<HTMLButtonElement>('btn-feedback-close');
    this.challenge = el('feedback-turnstile');
    this.consent = el<HTMLInputElement>('feedback-consent');
    this.enabled = validEndpoint(endpoint) && Boolean(siteKey);

    for (const button of doc.querySelectorAll<HTMLButtonElement>('[data-open-feedback]')) {
      button.hidden = !this.enabled;
      button.addEventListener('click', () => this.open());
    }
    this.closeButton.addEventListener('click', () => this.close());
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.close();
    });
    this.dialog.addEventListener('cancel', (event) => {
      if (this.sending) event.preventDefault();
    });
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit();
    });
    this.consent.addEventListener('change', () => {
      if (this.consent.checked) void this.loadChallenge();
      else this.resetChallenge();
    });
    this.form.addEventListener('input', (event) => {
      if (!this.sending && ['feedback-name', 'feedback-email', 'feedback-comments'].includes((event.target as HTMLElement).id)) this.submissionId = undefined;
    });
  }

  get openNow(): boolean { return this.dialog.open; }

  open(): void {
    if (!this.enabled || this.dialog.open) return;
    this.status.textContent = '';
    this.issueLink.hidden = true;
    this.dialog.showModal();
    this.doc.getElementById('feedback-name')?.focus({ preventScroll: true });
    if (this.consent.checked) void this.loadChallenge();
  }

  close(): void {
    if (!this.sending && this.dialog.open) this.dialog.close();
  }

  /**
   * How the game was played, sent with the feedback: the input (keyboard, touch or controller) and the game build go
   * in the public Issue; the browser's language, time zone and window size stay private (see the privacy page).
   */
  private context(): Record<string, string> {
    const win = this.doc.defaultView;
    let timeZone = '';
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    } catch { /* not every browser says */ }
    return {
      input: this.doc.documentElement.dataset.input ?? '',
      build: __GAME_BUILD__,
      language: win?.navigator.language ?? '',
      timeZone,
      screen: win ? `${Math.round(win.innerWidth)}x${Math.round(win.innerHeight)}` : '',
    };
  }

  private async loadChallenge(): Promise<void> {
    const win = this.doc.defaultView as TurnstileWindow | null;
    if (!win) return;
    try {
      if (!this.scriptLoading) {
        this.scriptLoading = new Promise<void>((resolve, reject) => {
          if (win.turnstile) { resolve(); return; }
          const script = this.doc.createElement('script');
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Verification could not load'));
          this.doc.head.appendChild(script);
        });
      }
      await this.scriptLoading;
      if (!this.dialog.open || !this.consent.checked) return;
      if (!win.turnstile) throw new Error('Verification unavailable');
      if (this.widgetId) {
        win.turnstile.reset(this.widgetId);
      } else {
        this.challenge.textContent = '';
        this.widgetId = win.turnstile.render(this.challenge, {
          sitekey: this.siteKey,
          action: 'feedback',
          theme: 'light',
          callback: (token) => {
            this.token = token;
            if (this.status.textContent?.startsWith('Verification') || this.status.textContent?.startsWith('Please complete')) this.status.textContent = '';
          },
          'expired-callback': () => {
            this.token = '';
            if (this.issueLink.hidden) this.status.textContent = 'Verification expired. Please try again.';
          },
          'error-callback': () => {
            this.token = '';
            if (this.issueLink.hidden) this.status.textContent = 'Verification failed. Please try again.';
            return true; // We show the error in the dialog; Turnstile need not repeat it in the console.
          },
        });
      }
    } catch {
      this.scriptLoading = undefined;
      this.status.textContent = 'Verification could not load. Check your connection and try again.';
    }
  }

  private resetChallenge(): void {
    this.token = '';
    const win = this.doc.defaultView as TurnstileWindow | null;
    if (this.widgetId && win?.turnstile) {
      if (this.consent.checked) win.turnstile.reset(this.widgetId);
      else {
        win.turnstile.remove(this.widgetId);
        this.widgetId = undefined;
        this.challenge.textContent = 'Verification loads after you check the box below.';
      }
    }
  }

  private async submit(): Promise<void> {
    if (this.sending) return;
    if (!this.token) {
      this.status.textContent = 'Please complete the verification first.';
      return;
    }
    const name = (this.doc.getElementById('feedback-name') as HTMLInputElement).value.trim();
    const email = (this.doc.getElementById('feedback-email') as HTMLInputElement).value.trim();
    const comments = (this.doc.getElementById('feedback-comments') as HTMLTextAreaElement).value.trim();
    const website = (this.doc.getElementById('feedback-website') as HTMLInputElement).value;
    this.submissionId ??= crypto.randomUUID();
    this.sending = true;
    this.submitButton.disabled = true;
    this.closeButton.disabled = true;
    this.status.textContent = 'Sending feedback…';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({ name, email, comments, website, turnstileToken: this.token, submissionId: this.submissionId, context: this.context() }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== 'object' || !('issueNumber' in result)) {
        throw new Error(response.status === 429 ? 'Too many requests. Please try later.'
          : response.status === 409 ? 'Submission status is uncertain. Please check public Issues before sending it again.'
            : 'Feedback could not be sent. Please try again.');
      }
      const issueNumber = (result as { issueNumber: unknown }).issueNumber;
      if (!Number.isSafeInteger(issueNumber) || Number(issueNumber) < 1) throw new Error('Feedback could not be confirmed.');
      this.form.reset();
      this.submissionId = undefined;
      this.status.textContent = 'Thank you! Your feedback was sent.';
      this.issueLink.href = `https://github.com/christopher-013/im-dog/issues/${issueNumber}`;
      this.issueLink.hidden = false;
    } catch (error) {
      this.status.textContent = error instanceof Error && error.name === 'AbortError'
        ? 'Feedback timed out. Please try again.'
        : error instanceof Error && ['Too many requests. Please try later.', 'Submission status is uncertain. Please check public Issues before sending it again.', 'Feedback could not be sent. Please try again.', 'Feedback could not be confirmed.'].includes(error.message)
          ? error.message
          : 'Feedback could not be sent. Please check your connection and try again.';
    } finally {
      clearTimeout(timeout);
      this.resetChallenge();
      this.sending = false;
      this.submitButton.disabled = false;
      this.closeButton.disabled = false;
    }
  }
}
