import { CONTROL_HINTS, KEY_BINDINGS, type Action } from '../config/input';
import { keyLabel } from '../core/InputState';
import { SENSITIVITY_RANGE, type PlayerSettings } from '../core/PlayerSettings';

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
  private readonly prompt: HTMLElement;
  private readonly promptKey: HTMLElement;
  private readonly promptLabel: HTMLElement;
  private promptText: string | null = null;
  private readonly sniffVignette: HTMLElement;
  private readonly barkBubble: HTMLElement;
  private sniffing = false;
  private readonly hud: HTMLElement;
  private resting = false;
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
    this.prompt = this.el('interact-prompt');
    this.promptKey = this.el('interact-key');
    this.promptLabel = this.el('interact-label');
    this.sniffVignette = this.el('sniff-vignette');
    this.barkBubble = this.el('bark-bubble');
    this.hud = this.el('hud');

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

  /** Wires the pause-screen settings: shows `initial`, reports every change. */
  bindSettings(initial: PlayerSettings, onChange: (settings: PlayerSettings) => void): void {
    const slider = this.el<HTMLInputElement>('setting-sensitivity');
    const readout = this.el<HTMLOutputElement>('setting-sensitivity-value');
    const invert = this.el<HTMLInputElement>('setting-invert-y');
    const current = { ...initial };

    slider.min = String(SENSITIVITY_RANGE.min);
    slider.max = String(SENSITIVITY_RANGE.max);
    slider.step = String(SENSITIVITY_RANGE.step);
    slider.value = String(current.mouseSensitivity);
    invert.checked = current.invertY;
    const showValue = () => (readout.textContent = `${current.mouseSensitivity.toFixed(2)}×`);
    showValue();

    slider.addEventListener('input', () => {
      current.mouseSensitivity = Number(slider.value);
      showValue();
      onChange({ ...current });
    });
    invert.addEventListener('change', () => {
      current.invertY = invert.checked;
      onChange({ ...current });
    });
  }

  /** Shows one full-screen overlay, or none (null) during play. */
  showScreen(screen: Screen | null): void {
    if (screen !== 'menu' && screen !== 'paused' && this.controlsDialog.open) this.controlsDialog.close();
    // Move focus before making the departing screen inert, including during its visual fade.
    for (const [name, element] of Object.entries(this.screens)) {
      if (name !== screen && element.contains(this.doc.activeElement)) {
        this.doc.querySelector<HTMLElement>('#viewport canvas')?.focus({ preventScroll: true });
      }
    }
    for (const [name, element] of Object.entries(this.screens)) {
      const active = name === screen;
      element.classList.toggle('is-active', active);
      element.inert = !active;
      element.setAttribute('aria-hidden', String(!active));
    }
    this.hud.setAttribute('aria-hidden', String(screen !== null));
    if (screen) this.screens[screen].querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    if (screen !== null) {
      this.setPointerHint(false);
      this.setPrompt(null, null);
      this.setSniffing(false);
      this.setResting(false);
    }
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
    this.toast.setAttribute('aria-hidden', 'false');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.remove('is-visible');
      this.toast.setAttribute('aria-hidden', 'true');
    }, durationMs);
  }

  /** "Click to look around" — shown when play is running but the mouse isn't captured. */
  setPointerHint(visible: boolean): void {
    this.pointerHint.classList.toggle('is-visible', visible);
    this.pointerHint.setAttribute('aria-hidden', String(!visible));
  }

  /**
   * The contextual prompt, e.g. "E — Pick Up Sock", or null to hide it. Cheap to call every frame:
   * the DOM is only touched when the text changes.
   */
  setPrompt(action: Action | null, label: string | null): void {
    const text = action && label ? `${action}:${label}` : null;
    if (text === this.promptText) return;
    this.promptText = text;
    if (action && label) {
      this.promptKey.textContent = keyLabel(KEY_BINDINGS[action][0] ?? '?');
      this.promptLabel.textContent = label;
    }
    this.prompt.classList.toggle('is-visible', text !== null);
    this.prompt.setAttribute('aria-hidden', String(text === null));
  }

  /** The soft warm haze at the edges of the view during sniff mode. */
  setSniffing(active: boolean): void {
    if (active === this.sniffing) return;
    this.sniffing = active;
    this.sniffVignette.classList.toggle('is-visible', active);
  }

  /** Lying in his bed: a quieter HUD with a soft "Resting…" note. */
  setResting(active: boolean): void {
    if (active === this.resting) return;
    this.resting = active;
    this.hud.classList.toggle('is-resting', active);
    this.el('rest-note').setAttribute('aria-hidden', String(!active));
  }

  /** Pops a comic bark ("Arf!") at a screen position (CSS pixels), e.g. above Moke's head. */
  showBark(x: number, y: number, text: string): void {
    const bubble = this.barkBubble;
    bubble.textContent = text;
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    bubble.classList.remove('is-popping');
    void bubble.offsetWidth; // restart the animation
    bubble.classList.add('is-popping');
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
      const labels =
        typeof hint.input === 'string' ? [hint.input] : hint.input.map((a) => keyLabel(KEY_BINDINGS[a][0] ?? '?'));
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
