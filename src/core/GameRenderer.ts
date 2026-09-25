import { PCFShadowMap, SRGBColorSpace, WebGLRenderer, type PerspectiveCamera, type Scene } from 'three';
import { RENDER } from '../config/engine';
import type { QualitySettings } from '../config/quality';

export class WebGLUnavailableError extends Error {
  constructor(cause: unknown) {
    super('WebGL 2 is not available in this browser.', { cause });
    this.name = 'WebGLUnavailableError';
  }
}

/**
 * Owns the WebGL renderer and keeps the drawing buffer matched to its container:
 * window resizes, DevTools opening, browser zoom and moving between monitors with different DPI.
 */
export class GameRenderer {
  readonly renderer: WebGLRenderer;
  onContextLost: (() => void) | null = null;
  onContextRestored: (() => void) | null = null;

  /** Highest pixel ratio to render at: the quality preset's, lowered by dynamic resolution on phones. */
  pixelRatioCap: number;
  private sizeDirty = true;
  private currentPixelRatio = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly container: HTMLElement,
    quality: Pick<QualitySettings, 'antialias' | 'maxPixelRatio'> = { antialias: RENDER.antialias, maxPixelRatio: RENDER.maxPixelRatio },
  ) {
    this.pixelRatioCap = quality.maxPixelRatio;
    try {
      this.renderer = new WebGLRenderer({
        antialias: quality.antialias,
        powerPreference: 'high-performance',
        stencil: false,
      });
    } catch (cause) {
      throw new WebGLUnavailableError(cause);
    }

    const r = this.renderer;
    r.outputColorSpace = SRGBColorSpace;
    r.toneMapping = RENDER.toneMapping;
    r.toneMappingExposure = RENDER.exposure;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFShadowMap;

    const canvas = r.domElement;
    canvas.setAttribute('aria-label', "I'M DOG? game view");
    canvas.tabIndex = -1;
    container.appendChild(canvas);

    this.resizeObserver = new ResizeObserver(() => {
      this.sizeDirty = true;
    });
    this.resizeObserver.observe(container);

    // three.js handles the GL side of restoration; we just surface it to the player.
    canvas.addEventListener('webglcontextlost', () => this.onContextLost?.());
    canvas.addEventListener('webglcontextrestored', () => {
      this.sizeDirty = true;
      this.onContextRestored?.();
    });
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get pixelRatio(): number {
    return this.currentPixelRatio;
  }

  get drawingBufferSize(): { width: number; height: number } {
    return { width: this.canvas.width, height: this.canvas.height };
  }

  /** Cheap when nothing changed, so it's safe to call every frame. */
  syncSize(camera: PerspectiveCamera): void {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.pixelRatioCap);
    if (!this.sizeDirty && pixelRatio === this.currentPixelRatio) return;
    this.sizeDirty = false;
    this.currentPixelRatio = pixelRatio;

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  render(scene: Scene, camera: PerspectiveCamera): void {
    this.syncSize(camera);
    this.renderer.render(scene, camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.canvas.remove();
  }
}
