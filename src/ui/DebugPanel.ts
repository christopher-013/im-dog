export type DebugValues = Record<string, string | number | boolean>;

/**
 * Developer overlay, toggled with ` (Backquote), or open at startup with ?debug in the URL.
 * Systems register a section with a provider function; providers are only called while the
 * panel is visible, a few times per second, so they cost nothing in normal play.
 */
export class DebugPanel {
  private readonly element: HTMLPreElement;
  private readonly sections = new Map<string, () => DebugValues>();
  private visible = false;
  private sinceRefresh = 0;

  constructor(
    parent: HTMLElement,
    private readonly refreshInterval = 0.2,
  ) {
    this.element = document.createElement('pre');
    this.element.id = 'debug-panel';
    this.element.hidden = true;
    parent.appendChild(this.element);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  addSection(name: string, provider: () => DebugValues): void {
    this.sections.set(name, provider);
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.element.hidden = !visible;
    this.sinceRefresh = Infinity; // refresh on the next update
  }

  update(dt: number): void {
    if (!this.visible) return;
    this.sinceRefresh += dt;
    if (this.sinceRefresh < this.refreshInterval) return;
    this.sinceRefresh = 0;
    this.element.textContent = this.format();
  }

  private format(): string {
    const lines: string[] = [];
    for (const [name, provider] of this.sections) {
      lines.push(`── ${name} ──`);
      for (const [key, value] of Object.entries(provider())) {
        lines.push(`${key.padEnd(13)} ${String(value)}`);
      }
    }
    return lines.join('\n');
  }
}

/** Rolling frame-rate stats over half-second windows. */
export class FrameStats {
  fps = 0;
  averageMs = 0;
  worstMs = 0;

  private frames = 0;
  private elapsed = 0;
  private worst = 0;

  record(dt: number): void {
    if (dt <= 0) return;
    this.frames++;
    this.elapsed += dt;
    this.worst = Math.max(this.worst, dt);
    if (this.elapsed < 0.5) return;
    this.fps = this.frames / this.elapsed;
    this.averageMs = (this.elapsed / this.frames) * 1000;
    this.worstMs = this.worst * 1000;
    this.frames = 0;
    this.elapsed = 0;
    this.worst = 0;
  }
}
