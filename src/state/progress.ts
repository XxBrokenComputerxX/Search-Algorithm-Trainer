import type { Difficulty } from '../engine/graph';
import type { AlgoId } from '../engine/trace';
import { createStore, useStore } from './storage';

/** Best stars per algorithm → difficulty → graph id. */
export type Progress = Partial<Record<AlgoId, Partial<Record<Difficulty, Record<string, number>>>>>;

const progressStore = createStore<Progress>('sat.progress.v1', {}, (raw) =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Progress) : {},
);

export const useProgress = () => useStore(progressStore);

export function recordResult(algo: AlgoId, difficulty: Difficulty, graphId: string, stars: number): void {
  const p = progressStore.get();
  const byDiff = p[algo] ?? {};
  const byGraph = byDiff[difficulty] ?? {};
  if ((byGraph[graphId] ?? 0) >= stars) return;
  progressStore.set({ ...p, [algo]: { ...byDiff, [difficulty]: { ...byGraph, [graphId]: stars } } });
}

export function bestStars(p: Progress, algo: AlgoId, difficulty: Difficulty): number {
  const values = Object.values(p[algo]?.[difficulty] ?? {});
  return values.length ? Math.max(...values) : 0;
}

export function graphStars(p: Progress, algo: AlgoId, difficulty: Difficulty, graphId: string): number {
  return p[algo]?.[difficulty]?.[graphId] ?? 0;
}
