import { SIMULATION } from '@/lib/config';

type Cfg = { totalMs: number; phase1EndMs: number; start: number; mid: number; end: number };

/** Progression (%) à l'instant `elapsedMs` : 1 -> 81 rapidement, puis 81 -> 94 lentement (~8 s). */
export function progressAt(elapsedMs: number, cfg: Cfg = SIMULATION): number {
  const e = Math.max(0, elapsedMs);
  if (e >= cfg.totalMs) return cfg.end;
  if (e <= cfg.phase1EndMs) {
    const p = e / cfg.phase1EndMs;
    return cfg.start + (cfg.mid - cfg.start) * (p * (2 - p));
  }
  const p = (e - cfg.phase1EndMs) / (cfg.totalMs - cfg.phase1EndMs);
  return cfg.mid + (cfg.end - cfg.mid) * p;
}
