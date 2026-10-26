import { successors, type Graph } from '../graph';
import type { AlgoId, ChildRecord, FrontierEntry, Step, Trace } from '../trace';
import { EntryFactory, buildTrace, record, snapshot, sortByPriority } from './common';

/**
 * AIMA best-first graph search (UCS: f = g, Greedy: f = h, A*: f = g + h).
 * Goal test on expansion; a frontier entry is replaced only by a strictly better f;
 * explored nodes are never reopened.
 */
function bestFirst(graph: Graph, algo: AlgoId): Trace {
  const make = new EntryFactory(graph, algo);
  const frontier: FrontierEntry[] = [make.root()];
  const explored: string[] = [];
  const steps: Step[] = [];

  while (frontier.length > 0) {
    sortByPriority(frontier);
    const before = snapshot(frontier, explored);
    const node = frontier.shift()!;
    if (node.node === graph.goal) {
      steps.push({ before, pop: node, decision: 'goal', children: [], after: snapshot(frontier, explored) });
      return buildTrace(graph, algo, [{ steps, end: 'solution' }], node);
    }
    explored.push(node.node);

    const children: ChildRecord[] = [];
    for (const s of successors(graph, node.node)) {
      const child = make.child(node, s);
      if (explored.includes(s.node)) {
        children.push(record(child, s.cost, 'skip-explored'));
        continue;
      }
      const idx = frontier.findIndex((e) => e.node === s.node);
      if (idx >= 0) {
        const existing = frontier[idx];
        if (child.f < existing.f) {
          frontier[idx] = make.stamp(child);
          children.push(record(child, s.cost, 'replace', existing));
        } else {
          children.push(record(child, s.cost, 'skip-frontier', existing));
        }
        continue;
      }
      frontier.push(make.stamp(child));
      children.push(record(child, s.cost, 'add'));
    }
    sortByPriority(frontier);
    steps.push({ before, pop: node, decision: 'expand', children, after: snapshot(frontier, explored) });
  }
  return buildTrace(graph, algo, [{ steps, end: 'failure' }], null);
}

export const ucs = (graph: Graph) => bestFirst(graph, 'ucs');
export const greedy = (graph: Graph) => bestFirst(graph, 'greedy');
export const astar = (graph: Graph) => bestFirst(graph, 'astar');
