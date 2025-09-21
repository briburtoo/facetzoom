import { LinearColorScale, type ColorScaleOptions } from './color/linearColorScale.js';

export type Grain = 'G0' | 'G1' | 'G2';

export interface SemanticZoomConfig {
  g0Max?: number;
  g1Max?: number;
  crossfadeMs?: number;
}

export class SemanticZoomController {
  readonly g0Max: number;
  readonly g1Max: number;
  readonly crossfadeMs: number;

  constructor({ g0Max = 64, g1Max = 160, crossfadeMs = 180 }: SemanticZoomConfig = {}) {
    if (g0Max <= 0 || g1Max <= g0Max) {
      throw new Error('Invalid semantic zoom thresholds');
    }
    this.g0Max = g0Max;
    this.g1Max = g1Max;
    this.crossfadeMs = crossfadeMs;
  }

  grainForWidth(width: number): Grain {
    if (width <= this.g0Max) return 'G0';
    if (width <= this.g1Max) return 'G1';
    return 'G2';
  }

  transitionPlan(previousWidth: number, nextWidth: number): { from: Grain; to: Grain; duration: number } | null {
    const from = this.grainForWidth(previousWidth);
    const to = this.grainForWidth(nextWidth);
    if (from === to) return null;
    return { from, to, duration: this.crossfadeMs };
  }
}

export interface RendererEnvironment {
  preferred: 'webgpu' | 'webgl2' | 'canvas2d';
  supported: {
    webgpu: boolean;
    webgl2: boolean;
    canvas2d: boolean;
  };
}

export function detectEnvironment(): RendererEnvironment {
  if (typeof window === 'undefined') {
    return {
      preferred: 'canvas2d',
      supported: { webgpu: false, webgl2: false, canvas2d: false },
    };
  }
  const canvas = document.createElement('canvas');
  const webgpu = Boolean((canvas as unknown as { getContext(type: 'webgpu'): unknown }).getContext?.('webgpu'));
  const webgl2 = Boolean(canvas.getContext('webgl2'));
  const canvas2d = Boolean(canvas.getContext('2d'));
  const preferred = webgpu ? 'webgpu' : webgl2 ? 'webgl2' : 'canvas2d';
  return { preferred, supported: { webgpu, webgl2, canvas2d } };
}

export interface TileSummary {
  id: string;
  title?: string;
  grain: Grain;
  metrics?: Record<string, number | null | undefined>;
  color?: string;
}

export interface TilePresenterOptions {
  colorScale: ColorScaleOptions;
  colorField: string;
}

export class TilePresenter {
  readonly zoom: SemanticZoomController;
  #scale: LinearColorScale;
  #colorField: string;

  constructor(zoom: SemanticZoomController, options: TilePresenterOptions) {
    this.zoom = zoom;
    this.#scale = new LinearColorScale(options.colorScale);
    this.#colorField = options.colorField;
  }

  updateColorScale(options: ColorScaleOptions): void {
    this.#scale = new LinearColorScale(options);
  }

  summariseTile(
    width: number,
    item: { id: string; title?: string; metrics?: Record<string, number | null | undefined> }
  ): TileSummary {
    const grain = this.zoom.grainForWidth(width);
    const numericValue = item.metrics?.[this.#colorField];
    const color = typeof numericValue === 'number' ? this.#scale.sample(numericValue) : undefined;
    return {
      id: item.id,
      title: grain === 'G2' ? item.title : undefined,
      grain,
      metrics: grain === 'G2' ? item.metrics : undefined,
      color,
    };
  }

  legendLabels(): Array<{ value: number; label: string }> {
    return this.#scale.legend();
  }
}

export { LinearColorScale } from './color/linearColorScale.js';
