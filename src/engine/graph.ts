export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export interface GNode {
  id: string;
  x: number;
  y: number;
  /** Heuristic estimate of the cost from this node to the goal (needed by informed search). */
  h?: number;
}

export interface GEdge {
  from: string;
  to: string;
  /** Step cost. Ignored (treated as 1) when the graph is unweighted. */
  w: number;
}

export interface Graph {
  id: string;
  name: string;
  description?: string;
  /** Extra teaching note shown while playing this graph. */
  note?: string;
  directed: boolean;
  weighted: boolean;
  nodes: GNode[];
  edges: GEdge[];
  start: string;
  goal: string;
  difficulty: Difficulty;
  /** Default depth limit for depth-limited search. */
  dlsLimit?: number;
  custom?: boolean;
}

export interface Successor {
  node: string;
  cost: number;
}

/** Plain code-point comparison so tie-breaking is identical on every machine. */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function stepCost(graph: Graph, edge: GEdge): number {
  return graph.weighted ? edge.w : 1;
}

/** Successors of `id`, sorted alphabetically (the order in which every algorithm generates them). */
export function successors(graph: Graph, id: string): Successor[] {
  const best = new Map<string, number>();
  const offer = (node: string, cost: number) => {
    const old = best.get(node);
    if (old === undefined || cost < old) best.set(node, cost);
  };
  for (const e of graph.edges) {
    if (e.from === id) offer(e.to, stepCost(graph, e));
    else if (!graph.directed && e.to === id) offer(e.from, stepCost(graph, e));
  }
  return [...best]
    .map(([node, cost]) => ({ node, cost }))
    .sort((a, b) => compareIds(a.node, b.node));
}

export function edgeCost(graph: Graph, from: string, to: string): number | undefined {
  return successors(graph, from).find((s) => s.node === to)?.cost;
}

export function heuristic(graph: Graph, id: string): number {
  return graph.nodes.find((n) => n.id === id)?.h ?? 0;
}

export function hasHeuristic(graph: Graph): boolean {
  return graph.nodes.length > 0 && graph.nodes.every((n) => typeof n.h === 'number' && Number.isFinite(n.h));
}

/** Total cost of a path, or null if some step is not an edge of the graph. */
export function pathCost(graph: Graph, path: string[]): number | null {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const c = edgeCost(graph, path[i - 1], path[i]);
    if (c === undefined) return null;
    total += c;
  }
  return total;
}

export function hasNode(graph: Graph, id: string): boolean {
  return graph.nodes.some((n) => n.id === id);
}
