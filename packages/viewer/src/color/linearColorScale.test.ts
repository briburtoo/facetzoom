import { describe, expect, it } from 'vitest';
import { LinearColorScale } from './linearColorScale.js';

describe('LinearColorScale', () => {
  it('maps values into the gradient', () => {
    const scale = new LinearColorScale({ domain: [0, 100] });
    expect(scale.sample(0)).toBe('rgb(29, 78, 216)');
    expect(scale.sample(50)).toBe('rgb(168, 85, 247)');
    expect(scale.sample(100)).toBe('rgb(245, 158, 11)');
  });

  it('respects reverse flag', () => {
    const scale = new LinearColorScale({ domain: [0, 1], reverse: true });
    expect(scale.sample(0)).toBe('rgb(245, 158, 11)');
    expect(scale.sample(1)).toBe('rgb(29, 78, 216)');
  });

  it('generates legend ticks', () => {
    const scale = new LinearColorScale({ domain: [10, 20] });
    const legend = scale.legend(3);
    expect(legend).toEqual([
      { value: 10, label: '10' },
      { value: 15, label: '15' },
      { value: 20, label: '20' },
    ]);
  });
});
