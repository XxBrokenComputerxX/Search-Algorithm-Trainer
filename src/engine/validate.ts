import { hasHeuristic, successors, type Graph } from './graph';

export interface Validation {
  errors: string[];
  warnings: string[];
}

export const NODE_NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,19}$/;

export function reachable(graph: Graph, from: string): Set<string> {
  const seen = new Set([from]);
  const stack = [from];
  while (stack.length) {
    const n = stack.pop()!;
    for (const s of successors(graph, n)) {
      if (!seen.has(s.node)) {
        seen.add(s.node);
        stack.push(s.node);
      }
    }
  }
  return seen;
}

export function validateGraph(graph: Graph): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = graph.nodes.map((n) => n.id);

  if (!graph.name.trim()) errors.push('Give the graph a name.');
  if (graph.nodes.length < 2) errors.push('Add at least two nodes.');
  if (new Set(ids).size !== ids.length) errors.push('Node names must be unique.');
  for (const id of ids) if (!NODE_NAME.test(id)) errors.push(`“${id}” is not a valid node name (letters, digits, space, _ or -; max 20).`);
  if (!ids.includes(graph.start)) errors.push('Choose a start node.');
  if (!ids.includes(graph.goal)) errors.push('Choose a goal node.');
  if (graph.start && graph.start === graph.goal) warnings.push('Start and goal are the same node - every search ends immediately.');

  for (const e of graph.edges) {
    if (e.from === e.to) errors.push(`Self-loop on ${e.from} is not allowed.`);
    if (graph.weighted && !(e.w > 0)) errors.push(`Edge ${e.from}–${e.to} must have a positive cost (got ${e.w}).`);
  }
  const seen = new Set<string>();
  for (const e of graph.edges) {
    const key = graph.directed ? `${e.from}>${e.to}` : [e.from, e.to].sort().join('|');
    if (seen.has(key)) warnings.push(`Duplicate edge ${e.from}–${e.to}: only the cheapest one is used.`);
    seen.add(key);
  }

  if (errors.length === 0) {
    if (!reachable(graph, graph.start).has(graph.goal)) {
      warnings.push('The goal cannot be reached from the start - every algorithm will return failure (or cutoff). That can be a useful exercise!');
    }
    if (!hasHeuristic(graph)) warnings.push('Not every node has a heuristic value h, so Greedy and A* are unavailable for this graph.');
  }
  return { errors, warnings };
}
