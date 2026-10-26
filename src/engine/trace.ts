import type { Graph } from './graph';

export type AlgoId = 'bfs' | 'ucs' | 'dfs' | 'dls' | 'ids' | 'greedy' | 'astar';
export const ALGO_IDS: AlgoId[] = ['bfs', 'ucs', 'dfs', 'dls', 'ids', 'greedy', 'astar'];

export type ValueField = 'g' | 'h' | 'f' | 'depth';

/** One search-tree node sitting in the frontier. */
export interface FrontierEntry {
  /** Unique id of the search-tree node: its path joined with ">". */
  key: string;
  node: string;
  parent: string | null;
  path: string[];
  g: number;
  h: number;
  /** The priority the algorithm orders by (g for UCS, h for Greedy, g+h for A*, g otherwise). */
  f: number;
  depth: number;
  /** Insertion counter (#1, #2, ...): what FIFO/LIFO order is based on. */
  seq: number;
}

export type ChildAction =
  | 'add'
  | 'skip-explored'
  | 'skip-frontier'
  | 'replace'
  | 'skip-path'
  | 'goal';

export interface ChildRecord {
  node: string;
  cost: number;
  /** The new search-tree node for this child (seq is only meaningful if it was added). */
  entry: FrontierEntry;
  action: ChildAction;
  /** The entry already in the frontier (for skip-frontier / replace). */
  existing?: FrontierEntry;
}

export type NodeDecision = 'goal' | 'cutoff' | 'expand';

export interface Snapshot {
  /** Frontier in true removal order: index 0 is the next entry to be removed. */
  frontier: FrontierEntry[];
  explored: string[];
}

export interface Step {
  before: Snapshot;
  pop: FrontierEntry;
  decision: NodeDecision;
  /** Successors in alphabetical order (BFS stops early when it generates the goal). */
  children: ChildRecord[];
  after: Snapshot;
}

export type RoundEnd = 'solution' | 'cutoff' | 'failure';

/** One complete run of the search loop. Only IDS has more than one round. */
export interface Round {
  limit?: number;
  steps: Step[];
  end: RoundEnd;
}

export interface Trace {
  algo: AlgoId;
  graph: Graph;
  limit?: number;
  rounds: Round[];
  status: RoundEnd;
  solution: FrontierEntry | null;
  /** BFS only: the start state itself passed the initial goal test. */
  startIsGoal: boolean;
}

export function goalChild(step: Step): ChildRecord | undefined {
  return step.children.find((c) => c.action === 'goal');
}

/** Every node removed from the frontier, in order, across all rounds. */
export function expansionOrder(trace: Trace): string[] {
  return trace.rounds.flatMap((r) => r.steps.map((s) => s.pop.node));
}

export function countExpanded(trace: Trace): number {
  return trace.rounds.reduce((n, r) => n + r.steps.filter((s) => s.decision === 'expand').length, 0);
}
