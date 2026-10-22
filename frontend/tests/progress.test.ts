import { describe, expect, it } from 'vitest';
import { SIMULATION } from '@/lib/config';
import { progressAt } from '@/lib/simulation/progress';

describe('animation de traitement', () => {
  it('démarre à 1 %, passe par 81 % puis finit à 94 % en 8 s', () => {
    expect(progressAt(0)).toBe(1);
    expect(progressAt(SIMULATION.phase1EndMs)).toBeCloseTo(81, 5);
    expect(progressAt(SIMULATION.totalMs)).toBe(94);
    expect(SIMULATION.totalMs).toBe(8000);
  });
  it('est croissante et ne dépasse jamais 94 %', () => {
    let prev = 0;
    for (let ms = 0; ms <= 9000; ms += 50) {
      const p = progressAt(ms);
      expect(p).toBeGreaterThanOrEqual(prev);
      expect(p).toBeLessThanOrEqual(94);
      prev = p;
    }
  });
  it('ralentit après 81 %', () => {
    expect(progressAt(7500) - progressAt(6500)).toBeLessThan(progressAt(3500) - progressAt(2500));
  });
});
