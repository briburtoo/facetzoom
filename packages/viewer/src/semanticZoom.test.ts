import { describe, expect, it } from 'vitest';
import { SemanticZoomController } from './index.js';

describe('SemanticZoomController', () => {
  it('selects grain based on width', () => {
    const zoom = new SemanticZoomController();
    expect(zoom.grainForWidth(32)).toBe('G0');
    expect(zoom.grainForWidth(100)).toBe('G1');
    expect(zoom.grainForWidth(300)).toBe('G2');
  });

  it('produces transitions when grains change', () => {
    const zoom = new SemanticZoomController({ crossfadeMs: 200 });
    expect(zoom.transitionPlan(40, 200)).toEqual({ from: 'G0', to: 'G2', duration: 200 });
    expect(zoom.transitionPlan(80, 90)).toBeNull();
  });
});
