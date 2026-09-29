/**
 * The player-facing Feedback form (start and pause menus). It posts to the site Worker on im-dog.com, as Adtona's and
 * Pictayo's forms do; the Worker files the public Issue and keeps the private record. No GitHub credential or private
 * visitor data lives in the game bundle. Once it's sent, Moke says thank you and the window closes by itself.
 */
import { FEEDBACK } from '../config/site';

function validEndpoint(value: string): boolean {
  // A path on this same site (im-dog.com's /api/feedback), or a full address (local testing).
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}

const MESSAGES = {
  tooMany: 'Too many requests. Please try again in a little while.',
  uncertain: 'Submission status is uncertain. Please check public Issues before sending it again.',
  failed: 'Feedback could not be sent. Please try again.',
  unconfirmed: 'Feedback could not be confirmed.',
} as const;

export class FeedbackDialog {
  private readonly dialog: HTMLDialogElement;
  private readonly form: HTMLFormElement;
  private readonly status: HTMLElement;
  private readonly thanks: HTMLElement;
  private readonly submitButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private sending = false;
  private submissionId: string | undefined;
  private thanksTimer: number | undefined;
  readonly enabled: boolean;

  constructor(
    private readonly doc: Document,
    private readonly endpoint: string,
  ) {
    const el = <T extends HTMLElement>(id: string): T => {
      const found = doc.getElementById(id);
      if (!found) throw new Error(`Missing #${id}`);
      return found as T;
    };
    this.dialog = el<HTMLDialogElement>('feedback-dialog');
    this.form = el<HTMLFormElement>('feedback-form');
    this.status = el('feedback-status');
    this.thanks = el('feedback-thanks');
    this.submitButton = el<HTMLButtonElement>('btn-feedback-submit');
    this.closeButton = el<HTMLButtonElement>('btn-feedback-close');
    this.enabled = validEndpoint(endpoint);

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
    // However it closes (the timer, Escape, a tap on the thank-you), the form is back for next time.
    this.dialog.addEventListener('close', () => this.showForm());
    this.thanks.addEventListener('click', () => this.close());
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit();
    });
    this.form.addEventListener('input', (event) => {
      if (!this.sending && ['feedback-name', 'feedback-email', 'feedback-comments'].includes((event.target as HTMLElement).id)) this.submissionId = undefined;
    });
  }

  get openNow(): boolean { return this.dialog.open; }

  open(): void {
    if (!this.enabled || this.dialog.open) return;
    this.showForm();
    this.status.textContent = '';
    this.dialog.showModal();
    this.doc.getElementById('feedback-name')?.focus({ preventScroll: true });
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

  private async submit(): Promise<void> {
    if (this.sending) return;
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
        body: JSON.stringify({ name, email, comments, website, submissionId: this.submissionId, context: this.context() }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== 'object' || !('issueNumber' in result)) {
        throw new Error(response.status === 429 ? MESSAGES.tooMany : response.status === 409 ? MESSAGES.uncertain : MESSAGES.failed);
      }
      const issueNumber = (result as { issueNumber: unknown }).issueNumber;
      if (!Number.isSafeInteger(issueNumber) || Number(issueNumber) < 1) throw new Error(MESSAGES.unconfirmed);
      this.form.reset();
      this.submissionId = undefined;
      this.status.textContent = '';
      this.showThanks();
    } catch (error) {
      this.status.textContent = error instanceof Error && error.name === 'AbortError'
        ? 'Feedback timed out. Please try again.'
        : error instanceof Error && (Object.values(MESSAGES) as string[]).includes(error.message)
          ? error.message
          : 'Feedback could not be sent. Please check your connection and try again.';
    } finally {
      clearTimeout(timeout);
      this.sending = false;
      this.submitButton.disabled = false;
      this.closeButton.disabled = false;
    }
  }

  private showForm(): void {
    clearTimeout(this.thanksTimer);
    this.thanksTimer = undefined;
    this.thanks.hidden = true;
    this.form.hidden = false;
  }

  /** "Moke says Thank you!", then back to the menu the form was opened from. */
  private showThanks(): void {
    if (!this.dialog.open) return;
    this.form.hidden = true;
    this.thanks.hidden = false;
    this.thanks.focus({ preventScroll: true });
    this.thanksTimer = window.setTimeout(() => this.close(), FEEDBACK.thanksSeconds * 1000);
  }
}
