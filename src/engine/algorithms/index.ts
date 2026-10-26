import { hasHeuristic, type Graph } from '../graph';
import { INFORMED } from '../conventions';
import type { AlgoId, Trace } from '../trace';
import { bfs } from './bfs';
import { dfs } from './dfs';
import { astar, greedy, ucs } from './bestFirst';
import { dls, ids } from './dls';

export { bfs, dfs, ucs, greedy, astar, dls, ids };

export function defaultLimit(graph: Graph): number {
  return graph.dlsLimit ?? 2;
}

export function runAlgorithm(algo: AlgoId, graph: Graph, limit?: number): Trace {
  switch (algo) {
    case 'bfs':
      return bfs(graph);
    case 'dfs':
      return dfs(graph);
    case 'ucs':
      return ucs(graph);
    case 'greedy':
      return greedy(graph);
    case 'astar':
      return astar(graph);
    case 'dls':
      return dls(graph, limit ?? defaultLimit(graph));
    case 'ids':
      return ids(graph);
  }
}

/** Informed algorithms need a heuristic value on every node. */
export function isApplicable(algo: AlgoId, graph: Graph): boolean {
  return !INFORMED[algo] || hasHeuristic(graph);
}
