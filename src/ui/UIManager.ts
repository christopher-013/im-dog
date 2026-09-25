import { CONTROL_HINTS, GAMEPAD_CONTROL_HINTS, KEY_BINDINGS, TOUCH_CONTROL_HINTS, type Action, type GamepadControlHint } from '../config/input';
import type { InputMode } from '../core/InputMode';
import { keyLabel } from '../core/InputState';
import { SENSITIVITY_RANGE, type PlayerSettings } from '../core/PlayerSettings';
import { actionGlyph, onboardingRows } from './ControlGlyphs';

export type Screen = 'loading' | 'menu' | 'paused' | 'complete' | 'error';

export interface UIHandlers {
  onPlay(): void;
  onResume(): void;
  /** Sock Heist complete: go again, or carry on exploring. */
  onPlayAgain(): void;
  onKeepExploring(): void;
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
  private promptAction: Action | null = null;
  private promptLabelText: string | null = null;
  /** The on-screen touch controls (TouchInput listens on this). */
  readonly touchRoot: HTMLElement;
  private readonly touchActions: HTMLElement;
  private readonly touchInteractLabel: HTMLElement;
  private readonly onboarding: HTMLElement;
  private onboardingTimer: number | undefined;
  private inputMode: InputMode = 'keyboard';
  private speechTimer: number | undefined;
  private discoveryTimer: number | undefined;
  private objective: string | null = null;
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
      complete: this.el('screen-complete'),
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
    this.touchRoot = this.el('touch-controls');
    this.touchActions = this.touchRoot.querySelector<HTMLElement>('.touch-actions') ?? this.touchRoot;
    this.touchInteractLabel = this.el('touch-interact-label');
    this.onboarding = this.el('onboarding');

    this.el('btn-play').addEventListener('click', () => this.handlers?.onPlay());
    this.el('btn-resume').addEventListener('click', () => this.handlers?.onResume());
    this.el('btn-play-again').addEventListener('click', () => this.handlers?.onPlayAgain());
    this.el('btn-keep-exploring').addEventListener('click', () => this.handlers?.onKeepExploring());
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
    this.setUpFullscreen();
  }

  /**
   * FULLSCREEN (touch devices, menu and pause): offered only where the browser supports it (not iPhone
   * Safari) and when not already running as an installed app. It doesn't lock the orientation: portrait and
   * landscape both play well. Any refusal is simply ignored.
   */
  private setUpFullscreen(): void {
    const doc = this.doc as Document & { webkitFullscreenEnabled?: boolean };
    const supported = Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
    const installed = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
    const buttons = [...doc.querySelectorAll<HTMLButtonElement>('[data-fullscreen]')];
    const label = () => {
      for (const button of buttons) button.textContent = doc.fullscreenElement ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
    };
    for (const button of buttons) {
      button.hidden = !supported || installed;
      button.addEventListener('click', () => {
        if (doc.fullscreenElement) {
          void doc.exitFullscreen().catch(() => {});
          return;
        }
        const root = doc.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
        const request = root.requestFullscreen
          ? root.requestFullscreen({ navigationUI: 'hide' })
          : Promise.resolve(root.webkitRequestFullscreen?.());
        void request.catch(() => {});
      });
    }
    doc.addEventListener('fullscreenchange', label);
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
   * The active input method: keyboard + mouse, touch or controller. Prompts, hints and the on-screen touch
   * controls follow it (CSS reads `html[data-input]`).
   */
  setInputMode(mode: InputMode): void {
    this.inputMode = mode;
    this.doc.documentElement.dataset.input = mode;
    this.promptText = null; // re-render the prompt with the new glyph
    this.setPrompt(this.promptAction, this.promptLabelText);
  }

  /** Whether play is running (the touch controls only show then). */
  setPlaying(playing: boolean): void {
    this.doc.documentElement.toggleAttribute('data-playing', playing);
    if (!playing) this.hideOnboarding();
  }

  /**
   * The contextual prompt: "E — Pick Up Sock" with a keyboard, "A — …" with a controller, and on touch the
   * big interact button lights up with the label beside it. Null hides it. Cheap to call every frame: the
   * DOM is only touched when something changes.
   */
  setPrompt(action: Action | null, label: string | null): void {
    const text = action && label ? `${this.inputMode}:${action}:${label}` : null;
    if (text === this.promptText) return;
    this.promptText = text;
    this.promptAction = action;
    this.promptLabelText = label;
    const glyph = action ? actionGlyph(action, this.inputMode) : null;
    if (action && label) {
      this.promptKey.textContent = glyph ?? keyLabel(KEY_BINDINGS[action][0] ?? '?');
      this.promptLabel.textContent = label;
      this.touchInteractLabel.textContent = label;
    }
    this.prompt.classList.toggle('is-visible', text !== null);
    this.prompt.setAttribute('aria-hidden', String(text === null || this.inputMode === 'touch'));
    this.touchActions.classList.toggle('has-target', text !== null && action === 'interact');
  }

  /**
   * A few seconds of "how to play" on the first play: key/button rows on a keyboard or controller; on touch,
   * labels on the stick and the look area (the buttons label themselves).
   */
  showOnboarding(mode: InputMode, durationMs = 7000): void {
    window.clearTimeout(this.onboardingTimer);
    if (mode === 'touch') {
      this.doc.documentElement.toggleAttribute('data-onboarding', true);
    } else {
      const list = this.el('onboarding-list');
      list.replaceChildren(
        ...onboardingRows(mode).map(([key, label]) => {
          const row = this.doc.createElement('li');
          const kbd = this.doc.createElement('kbd');
          kbd.textContent = key;
          row.append(kbd, label);
          return row;
        }),
      );
      this.onboarding.classList.add('is-visible');
      this.onboarding.setAttribute('aria-hidden', 'false');
    }
    this.onboardingTimer = window.setTimeout(() => this.hideOnboarding(), durationMs);
  }

  hideOnboarding(): void {
    window.clearTimeout(this.onboardingTimer);
    this.doc.documentElement.toggleAttribute('data-onboarding', false);
    this.onboarding.classList.remove('is-visible');
    this.onboarding.setAttribute('aria-hidden', 'true');
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

  // ---- Sock Heist

  /** The human says something: a speech bubble for a moment (the game places it over their head each frame). */
  say(text: string, mood: string): void {
    // The human's line matters more than a controls reminder; they'd overlap near the top.
    window.clearTimeout(this.toastTimer);
    this.toast.classList.remove('is-visible');
    this.toast.setAttribute('aria-hidden', 'true');
    const bubble = this.el('speech-bubble');
    bubble.textContent = text;
    bubble.dataset.mood = mood;
    bubble.classList.add('is-visible');
    bubble.setAttribute('aria-hidden', 'false');
    window.clearTimeout(this.speechTimer);
    this.speechTimer = window.setTimeout(() => this.hideSpeech(), 1700 + text.length * 45);
  }

  get speaking(): boolean {
    return this.el('speech-bubble').classList.contains('is-visible');
  }

  /** Puts the bubble's tip at (x, y) CSS pixels, kept inside the screen. */
  placeSpeech(x: number, y: number): void {
    const bubble = this.el('speech-bubble');
    const half = bubble.offsetWidth / 2 + 12;
    const width = this.doc.documentElement.clientWidth;
    const height = this.doc.documentElement.clientHeight;
    const cx = Math.min(Math.max(x, half), width - half);
    // Pinned to the top, it sits below the objective line and the pause button.
    const cy = Math.min(Math.max(y, bubble.offsetHeight + 72), height - 120);
    bubble.style.left = `${cx}px`;
    bubble.style.top = `${cy}px`;
  }

  hideSpeech(): void {
    window.clearTimeout(this.speechTimer);
    const bubble = this.el('speech-bubble');
    bubble.classList.remove('is-visible');
    bubble.setAttribute('aria-hidden', 'true');
  }

  /** A short "what's going on" line (e.g. "Keep away!"), or null. Cheap to call every frame. */
  setObjective(text: string | null): void {
    if (text === this.objective) return;
    this.objective = text;
    const chip = this.el('heist-chip');
    if (text) chip.textContent = text;
    chip.classList.toggle('is-visible', text !== null);
    chip.setAttribute('aria-hidden', String(text === null));
  }

  /** SOCK = TREAT, for a few seconds. `first`: a brand-new discovery (or one he already knew). */
  showDiscovery(first: boolean, durationMs: number): void {
    const card = this.el('discovery');
    this.el('discovery-note').textContent = first ? 'Moke has learned something very important.' : 'Still true. Moke checked.';
    card.classList.remove('is-leaving');
    card.classList.add('is-visible');
    card.setAttribute('aria-hidden', 'false');
    window.clearTimeout(this.discoveryTimer);
    this.discoveryTimer = window.setTimeout(() => this.hideDiscovery(), durationMs);
  }

  hideDiscovery(): void {
    window.clearTimeout(this.discoveryTimer);
    const card = this.el('discovery');
    if (card.classList.contains('is-visible')) card.classList.add('is-leaving');
    card.classList.remove('is-visible');
    card.setAttribute('aria-hidden', 'true');
  }

  /** "Sock Heist Complete", with how long it took. */
  showComplete(seconds: number): void {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.el('complete-detail').textContent = `Sock returned. Treat eaten. Took ${m}:${String(s).padStart(2, '0')}.`;
    this.showScreen('complete');
  }

  /** Clears the heist's HUD (a replay). */
  clearHeist(): void {
    this.hideSpeech();
    this.hideDiscovery();
    this.setObjective(null);
  }

  openControls(): void {
    if (!this.controlsDialog.open) this.controlsDialog.showModal();
  }

  get controlsOpen(): boolean {
    return this.controlsDialog.open;
  }

  closeControls(): void {
    if (this.controlsDialog.open) this.controlsDialog.close();
  }

  showFatalError(message: string): void {
    this.errorDetail.textContent = message;
    this.showScreen('error');
  }

  private renderControls(list: HTMLElement): void {
    const heading = this.doc.createElement('li');
    heading.className = 'control-group controls-keyboard';
    heading.textContent = 'Keyboard & mouse';
    list.appendChild(heading);
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

    this.renderHintGroup(list, 'Controller', GAMEPAD_CONTROL_HINTS, 'controls-gamepad');
    this.renderHintGroup(list, 'Touch', TOUCH_CONTROL_HINTS, 'controls-touch');
  }

  private renderHintGroup(list: HTMLElement, title: string, hints: readonly GamepadControlHint[], className: string): void {
    const heading = this.doc.createElement('li');
    heading.className = `control-group ${className}`;
    heading.textContent = title;
    list.appendChild(heading);
    for (const hint of hints) {
      const row = this.doc.createElement('li');
      row.className = `control-row ${className}`;
      const keys = this.doc.createElement('span');
      keys.className = 'control-keys';
      const kbd = this.doc.createElement('kbd');
      kbd.textContent = hint.input;
      keys.appendChild(kbd);
      const label = this.doc.createElement('span');
      label.className = 'control-label';
      label.textContent = hint.label;
      row.append(keys, label);
      list.appendChild(row);
    }
  }

  private el<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = this.doc.getElementById(id);
    if (!element) throw new Error(`UI element #${id} is missing from index.html`);
    return element as T;
  }
}
