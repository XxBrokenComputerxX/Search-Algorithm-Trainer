import { heuristic, successors, type Graph } from './graph';

/** Cheapest cost from every node to the goal (Dijkstra over reversed edges). Infinity = goal unreachable. */
export function trueCostsToGoal(graph: Graph): Map<string, number> {
  const preds = new Map<string, { node: string; cost: number }[]>();
  for (const n of graph.nodes) preds.set(n.id, []);
  for (const n of graph.nodes) {
    for (const s of successors(graph, n.id)) preds.get(s.node)?.push({ node: n.id, cost: s.cost });
  }

  const dist = new Map<string, number>(graph.nodes.map((n) => [n.id, Infinity]));
  if (!dist.has(graph.goal)) return dist;
  dist.set(graph.goal, 0);
  const done = new Set<string>();
  while (done.size < graph.nodes.length) {
    let u: string | null = null;
    for (const [id, d] of dist) {
      if (!done.has(id) && d < Infinity && (u === null || d < dist.get(u)!)) u = id;
    }
    if (u === null) break;
    done.add(u);
    for (const p of preds.get(u) ?? []) {
      const nd = dist.get(u)! + p.cost;
      if (nd < dist.get(p.node)!) dist.set(p.node, nd);
    }
  }
  return dist;
}

export interface HeuristicReport {
  admissible: boolean;
  consistent: boolean;
  /** h(n) > true cost h*(n). */
  overestimates: { node: string; h: number; trueCost: number }[];
  /** h(from) > cost(from, to) + h(to). */
  violations: { from: string; to: string; cost: number; hFrom: number; hTo: number }[];
  trueCosts: Map<string, number>;
}

export function checkHeuristic(graph: Graph): HeuristicReport {
  const trueCosts = trueCostsToGoal(graph);
  const overestimates: HeuristicReport['overestimates'] = [];
  const violations: HeuristicReport['violations'] = [];
  for (const n of graph.nodes) {
    const h = heuristic(graph, n.id);
    const t = trueCosts.get(n.id) ?? Infinity;
    if (h > t) overestimates.push({ node: n.id, h, trueCost: t });
    for (const s of successors(graph, n.id)) {
      const hTo = heuristic(graph, s.node);
      if (h > s.cost + hTo) violations.push({ from: n.id, to: s.node, cost: s.cost, hFrom: h, hTo });
    }
  }
  return {
    admissible: overestimates.length === 0,
    consistent: violations.length === 0 && heuristic(graph, graph.goal) === 0,
    overestimates,
    violations,
    trueCosts,
  };
}
