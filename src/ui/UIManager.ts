import { CONTROL_HINTS, KEY_BINDINGS } from '../config/input';
import { keyLabel } from '../core/InputState';

export type Screen = 'loading' | 'menu' | 'paused' | 'error';

export interface UIHandlers {
  onPlay(): void;
  onResume(): void;
}

/**
 * HTML/CSS overlays: loading, start menu, pause, controls, error, and the light in-game HUD.
 * The markup lives in index.html; this class only wires behaviour and swaps screens.
 * Created before the game, so it can still show an error if the game fails to start.
 */
export class UIManager {
  private readonly screens: Record<Screen, HTMLElement>;
  private readonly loadingFill: HTMLElement;
  private readonly loadingTrack: HTMLElement;
  private readonly loadingDetail: HTMLElement;
  private readonly controlsDialog: HTMLDialogElement;
  private readonly toast: HTMLElement;
  private readonly pointerHint: HTMLElement;
  private readonly errorDetail: HTMLElement;
  private handlers: UIHandlers | null = null;
  private toastTimer: number | undefined;

  constructor(private readonly doc: Document = document) {
    this.screens = {
      loading: this.el('screen-loading'),
      menu: this.el('screen-menu'),
      paused: this.el('screen-pause'),
      error: this.el('screen-error'),
    };
    this.loadingFill = this.el('loading-fill');
    this.loadingTrack = this.el('loading-track');
    this.loadingDetail = this.el('loading-detail');
    this.controlsDialog = this.el<HTMLDialogElement>('controls-dialog');
    this.toast = this.el('toast');
    this.pointerHint = this.el('pointer-hint');
    this.errorDetail = this.el('error-detail');

    this.el('btn-play').addEventListener('click', () => this.handlers?.onPlay());
    this.el('btn-resume').addEventListener('click', () => this.handlers?.onResume());
    this.el('btn-retry').addEventListener('click', () => location.reload());
    this.el('btn-controls-close').addEventListener('click', () => this.controlsDialog.close());
    for (const button of doc.querySelectorAll('[data-open-controls]')) {
      button.addEventListener('click', () => this.openControls());
    }
    // Click on the dimmed backdrop closes the dialog.
    this.controlsDialog.addEventListener('click', (e) => {
      if (e.target === this.controlsDialog) this.controlsDialog.close();
    });

    this.renderControls(this.el('controls-list'));
  }

  bind(handlers: UIHandlers): void {
    this.handlers = handlers;
  }

  /** Shows one full-screen overlay, or none (null) during play. */
  showScreen(screen: Screen | null): void {
    for (const [name, element] of Object.entries(this.screens)) {
      element.classList.toggle('is-active', name === screen);
    }
    if (screen !== 'menu' && screen !== 'paused' && this.controlsDialog.open) this.controlsDialog.close();
    if (screen !== null) this.setPointerHint(false);
  }

  setLoadingProgress(fraction: number, detail?: string): void {
    const clamped = Math.min(1, Math.max(0, fraction));
    this.loadingFill.style.transform = `scaleX(${clamped})`;
    this.loadingTrack.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    if (detail !== undefined) this.loadingDetail.textContent = detail;
  }

  showToast(text: string, durationMs = 4000): void {
    this.toast.textContent = text;
    this.toast.classList.add('is-visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('is-visible'), durationMs);
  }

  /** "Click to look around" — shown when play is running but the mouse isn't captured. */
  setPointerHint(visible: boolean): void {
    this.pointerHint.classList.toggle('is-visible', visible);
  }

  openControls(): void {
    if (!this.controlsDialog.open) this.controlsDialog.showModal();
  }

  showFatalError(message: string): void {
    this.errorDetail.textContent = message;
    this.showScreen('error');
  }

  private renderControls(list: HTMLElement): void {
    for (const hint of CONTROL_HINTS) {
      const row = this.doc.createElement('li');
      row.className = 'control-row';
      row.classList.toggle('is-soon', !hint.ready);

      const keys = this.doc.createElement('span');
      keys.className = 'control-keys';
      const labels = hint.input === 'Mouse' ? ['Mouse'] : hint.input.map((a) => keyLabel(KEY_BINDINGS[a][0] ?? '?'));
      for (const label of labels) {
        const kbd = this.doc.createElement('kbd');
        kbd.textContent = label;
        keys.appendChild(kbd);
      }

      const label = this.doc.createElement('span');
      label.className = 'control-label';
      label.textContent = hint.label;
      row.append(keys, label);

      if (!hint.ready) {
        const soon = this.doc.createElement('span');
        soon.className = 'soon';
        soon.textContent = 'soon';
        row.appendChild(soon);
      }
      list.appendChild(row);
    }
  }

  private el<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = this.doc.getElementById(id);
    if (!element) throw new Error(`UI element #${id} is missing from index.html`);
    return element as T;
  }
}
