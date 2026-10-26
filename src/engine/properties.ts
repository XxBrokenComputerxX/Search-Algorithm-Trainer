import type { AlgoId } from './trace';

export type Verdict = 'yes' | 'no' | 'conditional';

export interface Property {
  verdict: Verdict;
  /** Short cell text, e.g. "Yes¹". */
  short: string;
  /** The condition / reasoning. */
  text: string;
}

export interface AlgoMeta {
  id: AlgoId;
  name: string;
  abbr: string;
  family: 'uninformed' | 'informed';
  tagline: string;
  frontier: string;
  orderBy: string;
  goalTest: string;
  complete: Property;
  optimal: Property;
  time: string;
  space: string;
}

export const ALGOS: Record<AlgoId, AlgoMeta> = {
  bfs: {
    id: 'bfs',
    name: 'Breadth-first search',
    abbr: 'BFS',
    family: 'uninformed',
    tagline: 'Explore level by level - shallowest nodes first.',
    frontier: 'FIFO queue',
    orderBy: 'insertion order (oldest first)',
    goalTest: 'on generation',
    complete: { verdict: 'yes', short: 'Yes', text: 'Yes, if the branching factor b is finite.' },
    optimal: {
      verdict: 'conditional',
      short: 'Only unit costs',
      text: 'Only if all step costs are equal (e.g. unweighted graphs). It minimises the number of edges, not the total cost.',
    },
    time: 'O(b^d)',
    space: 'O(b^d)',
  },
  ucs: {
    id: 'ucs',
    name: 'Uniform-cost search',
    abbr: 'UCS',
    family: 'uninformed',
    tagline: 'Always expand the cheapest path found so far.',
    frontier: 'Priority queue by g',
    orderBy: 'path cost g (lowest first)',
    goalTest: 'on expansion',
    complete: {
      verdict: 'yes',
      short: 'Yes (costs ≥ ε)',
      text: 'Yes, if b is finite and every step cost is at least some ε > 0 (no zero-cost loops).',
    },
    optimal: { verdict: 'yes', short: 'Yes', text: 'Yes - nodes are expanded in order of increasing path cost, so the first goal expanded is the cheapest.' },
    time: 'O(b^(1+⌊C*/ε⌋))',
    space: 'O(b^(1+⌊C*/ε⌋))',
  },
  dfs: {
    id: 'dfs',
    name: 'Depth-first search',
    abbr: 'DFS',
    family: 'uninformed',
    tagline: 'Dive as deep as possible, backtrack when stuck.',
    frontier: 'LIFO stack',
    orderBy: 'insertion order (newest first)',
    goalTest: 'on expansion',
    complete: {
      verdict: 'conditional',
      short: 'Finite graphs only',
      text: 'Graph search: yes in finite state spaces. Tree search can loop forever on cycles, and no version is complete in infinite spaces (it may dive down an infinite branch).',
    },
    optimal: { verdict: 'no', short: 'No', text: 'No - it returns the first goal it reaches, which may be deep and expensive.' },
    time: 'O(b^m)',
    space: 'O(b·m) (tree search)',
  },
  dls: {
    id: 'dls',
    name: 'Depth-limited search',
    abbr: 'DLS',
    family: 'uninformed',
    tagline: 'DFS that never goes deeper than a limit ℓ.',
    frontier: 'LIFO stack + depth limit',
    orderBy: 'insertion order (newest first)',
    goalTest: 'on expansion',
    complete: {
      verdict: 'no',
      short: 'No (if ℓ < d)',
      text: 'No - if the shallowest goal is deeper than the limit (d > ℓ) it is never found. Complete only if ℓ ≥ d.',
    },
    optimal: { verdict: 'no', short: 'No', text: 'No - like DFS it returns the first goal it finds within the limit.' },
    time: 'O(b^ℓ)',
    space: 'O(b·ℓ)',
  },
  ids: {
    id: 'ids',
    name: 'Iterative deepening search',
    abbr: 'IDS',
    family: 'uninformed',
    tagline: 'Run DLS with limit 0, 1, 2, ... - BFS results with DFS memory.',
    frontier: 'LIFO stack, growing limit',
    orderBy: 'insertion order (newest first)',
    goalTest: 'on expansion',
    complete: { verdict: 'yes', short: 'Yes', text: 'Yes, if b is finite - the limit eventually reaches the depth of the shallowest goal.' },
    optimal: {
      verdict: 'conditional',
      short: 'Only unit costs',
      text: 'Only if all step costs are equal - like BFS it finds the shallowest goal first.',
    },
    time: 'O(b^d)',
    space: 'O(b·d)',
  },
  greedy: {
    id: 'greedy',
    name: 'Greedy best-first search',
    abbr: 'Greedy',
    family: 'informed',
    tagline: 'Go wherever the heuristic says the goal is closest.',
    frontier: 'Priority queue by h',
    orderBy: 'heuristic h (lowest first)',
    goalTest: 'on expansion',
    complete: {
      verdict: 'conditional',
      short: 'Finite graphs only',
      text: 'Graph search: yes in finite state spaces. Tree search can get stuck in loops; incomplete in infinite spaces.',
    },
    optimal: { verdict: 'no', short: 'No', text: 'No - it ignores the cost already paid (g), so it can be lured onto an expensive path.' },
    time: 'O(b^m) worst case',
    space: 'O(b^m) worst case',
  },
  astar: {
    id: 'astar',
    name: 'A* search',
    abbr: 'A*',
    family: 'informed',
    tagline: 'Expand by f = g + h: cost so far plus estimated cost to go.',
    frontier: 'Priority queue by f = g + h',
    orderBy: 'f = g + h (lowest first)',
    goalTest: 'on expansion',
    complete: { verdict: 'yes', short: 'Yes (costs ≥ ε)', text: 'Yes, if b is finite and every step cost is at least some ε > 0.' },
    optimal: {
      verdict: 'conditional',
      short: 'If h admissible/consistent',
      text: 'Yes if h is admissible (never overestimates) for tree search, or consistent (h(n) ≤ c(n,n′) + h(n′)) for graph search as used in this game.',
    },
    time: 'Exponential (worst case)',
    space: 'Keeps all generated nodes',
  },
};

export const UNINFORMED: AlgoId[] = ['bfs', 'ucs', 'dfs', 'dls', 'ids'];
export const INFORMED_IDS: AlgoId[] = ['greedy', 'astar'];

export const COMPLEXITY_LEGEND =
  'b = branching factor, d = depth of the shallowest goal, m = maximum depth, ℓ = depth limit, C* = optimal cost, ε = smallest step cost.';
