export interface GradientStop {
  position: number;
  color: string;
}

const HEX_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

type RGB = [number, number, number];

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string): RGB {
  if (!HEX_REGEX.test(hex)) {
    throw new Error(`Unsupported color format: ${hex}`);
  }
  let normalized = hex.slice(1);
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char.repeat(2))
      .join('');
  }
  const num = Number.parseInt(normalized, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export interface ColorScaleOptions {
  domain: [number, number];
  stops?: GradientStop[];
  reverse?: boolean;
}

export class LinearColorScale {
  readonly domain: [number, number];
  readonly #stops: GradientStop[];
  readonly reverse: boolean;

  constructor({ domain, stops, reverse = false }: ColorScaleOptions) {
    if (domain[0] === domain[1]) {
      throw new Error('Color scale domain requires a non-zero range');
    }
    this.domain = domain[0] < domain[1] ? domain : ([domain[1], domain[0]] as [number, number]);
    this.reverse = reverse;
    this.#stops = (stops ?? defaultStops).map((stop) => ({ ...stop })).sort((a, b) => a.position - b.position);
    if (this.#stops[0]?.position !== 0 || this.#stops.at(-1)?.position !== 1) {
      throw new Error('Gradient stops must start at 0 and end at 1');
    }
  }

  sample(value: number): string {
    const [min, max] = this.domain;
    const clamped = clamp((value - min) / (max - min));
    const normalized = this.reverse ? 1 - clamped : clamped;
    const [left, right] = this.#neighbourStops(normalized);
    const span = right.position - left.position;
    const localT = span === 0 ? 0 : (normalized - left.position) / span;
    const color = lerpColor(hexToRgb(left.color), hexToRgb(right.color), localT);
    return `rgb(${color.map((c) => Math.round(c)).join(', ')})`;
  }

  legend(minTicks = 3): Array<{ value: number; label: string }> {
    const [min, max] = this.domain;
    const ticks = minTicks < 2 ? 2 : minTicks;
    const step = (max - min) / (ticks - 1);
    return new Array(ticks).fill(0).map((_, index) => {
      const value = min + step * index;
      return {
        value,
        label: this.#formatLabel(value),
      };
    });
  }

  #formatLabel(value: number): string {
    if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) {
      return value.toExponential(2);
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  #neighbourStops(position: number): [GradientStop, GradientStop] {
    for (let index = 0; index < this.#stops.length - 1; index += 1) {
      const current = this.#stops[index];
      const next = this.#stops[index + 1];
      if (position >= current.position && position <= next.position) {
        return [current, next];
      }
    }
    return [this.#stops[0], this.#stops[this.#stops.length - 1]];
  }
}

const defaultStops: GradientStop[] = [
  { position: 0, color: '#1d4ed8' },
  { position: 0.5, color: '#a855f7' },
  { position: 1, color: '#f59e0b' },
];
