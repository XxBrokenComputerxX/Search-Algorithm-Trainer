import type { AlgoId, ChildAction, ValueField } from './trace';

export type FrontierKind = 'fifo' | 'lifo' | 'pq';

export const FRONTIER_KIND: Record<AlgoId, FrontierKind> = {
  bfs: 'fifo',
  ucs: 'pq',
  dfs: 'lifo',
  dls: 'lifo',
  ids: 'lifo',
  greedy: 'pq',
  astar: 'pq',
};

export const FRONTIER_LABEL: Record<FrontierKind, string> = {
  fifo: 'FIFO queue',
  lifo: 'LIFO stack',
  pq: 'Priority queue',
};

export const GOAL_TEST: Record<AlgoId, 'generation' | 'expansion'> = {
  bfs: 'generation',
  ucs: 'expansion',
  dfs: 'expansion',
  dls: 'expansion',
  ids: 'expansion',
  greedy: 'expansion',
  astar: 'expansion',
};

/** Graph search (explored set) vs. depth-limited tree search with a cycle check on the current path. */
export const USES_EXPLORED: Record<AlgoId, boolean> = {
  bfs: true,
  ucs: true,
  dfs: true,
  dls: false,
  ids: false,
  greedy: true,
  astar: true,
};

export const HAS_LIMIT: Record<AlgoId, boolean> = {
  bfs: false,
  ucs: false,
  dfs: false,
  dls: true,
  ids: true,
  greedy: false,
  astar: false,
};

export const INFORMED: Record<AlgoId, boolean> = {
  bfs: false,
  ucs: false,
  dfs: false,
  dls: false,
  ids: false,
  greedy: true,
  astar: true,
};

/** Values the player has to compute for each new frontier entry (Medium/Hard). */
export const VALUE_FIELDS: Record<AlgoId, ValueField[]> = {
  bfs: [],
  dfs: [],
  dls: ['depth'],
  ids: ['depth'],
  ucs: ['g'],
  greedy: ['h'],
  astar: ['g', 'h', 'f'],
};

/** Name of the value a priority queue orders by. */
export const PRIORITY: Partial<Record<AlgoId, ValueField>> = {
  ucs: 'g',
  greedy: 'h',
  astar: 'f',
};

/** What the player may choose for each successor. "goal" is always offered - it's only right for BFS. */
export const CHILD_ACTIONS: Record<AlgoId, ChildAction[]> = {
  bfs: ['add', 'skip-explored', 'skip-frontier', 'goal'],
  dfs: ['add', 'skip-explored', 'skip-frontier', 'goal'],
  ucs: ['add', 'skip-explored', 'skip-frontier', 'replace', 'goal'],
  greedy: ['add', 'skip-explored', 'skip-frontier', 'replace', 'goal'],
  astar: ['add', 'skip-explored', 'skip-frontier', 'replace', 'goal'],
  dls: ['add', 'skip-path', 'goal'],
  ids: ['add', 'skip-path', 'goal'],
};

export const CHILD_ACTION_LABEL: Record<ChildAction, string> = {
  add: 'Add to frontier',
  'skip-explored': 'Skip - already explored',
  'skip-frontier': 'Skip - already in frontier (keep old)',
  replace: 'Replace frontier entry (cheaper)',
  'skip-path': 'Skip - on current path (cycle)',
  goal: 'Goal! Stop now',
};

export function fValue(algo: AlgoId, g: number, h: number): number {
  switch (algo) {
    case 'greedy':
      return h;
    case 'astar':
      return g + h;
    default:
      return g;
  }
}

export const RULES: { title: string; text: string }[] = [
  {
    title: 'Successor order',
    text: 'Successors of a node are always generated in alphabetical order of their names.',
  },
  {
    title: 'Ties',
    text: 'In a priority queue, entries with equal priority are taken in alphabetical order. Queues and stacks follow insertion order (#1, #2, ...).',
  },
  {
    title: 'Stacks (DFS, DLS, IDS)',
    text: 'Children are pushed so that the alphabetically first child ends up on top and is expanded first.',
  },
  {
    title: 'Graph search',
    text: 'BFS, DFS, UCS, Greedy and A* keep an explored set. A node is added to it when it is expanded. Explored nodes are never added again or reopened (AIMA graph search).',
  },
  {
    title: 'Duplicates in the frontier',
    text: 'BFS and DFS skip a child that is already in the frontier. UCS, Greedy and A* replace the frontier entry only if the new path gives a strictly lower priority value.',
  },
  {
    title: 'Goal test',
    text: 'BFS tests the goal when a node is generated (as in AIMA). All other algorithms test it when the node is removed from the frontier for expansion.',
  },
  {
    title: 'Depth-limited search',
    text: 'DLS and IDS are tree searches without an explored set; they only skip children that are already on the current path (cycle check). A node at depth = limit is goal-tested but not expanded - that is a cutoff. If any cutoff happened the result is "cutoff", otherwise "failure".',
  },
  {
    title: 'Iterative deepening',
    text: 'IDS runs DLS with limit 0, 1, 2, ... starting from scratch each time, until the result is not "cutoff".',
  },
  {
    title: 'Costs',
    text: 'In unweighted graphs every edge costs 1. Path cost g is always tracked - even BFS and DFS report the cost of the path they find.',
  },
];
