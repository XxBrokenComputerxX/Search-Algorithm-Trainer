import { successors, type Graph } from '../graph';
import type { ChildRecord, FrontierEntry, Step, Trace } from '../trace';
import { EntryFactory, buildTrace, record, snapshot } from './common';

/** AIMA breadth-first graph search: FIFO frontier, explored set, goal test on generation. */
export function bfs(graph: Graph): Trace {
  const make = new EntryFactory(graph, 'bfs');
  const root = make.root();
  if (root.node === graph.goal) {
    return buildTrace(graph, 'bfs', [{ steps: [], end: 'solution' }], root, { startIsGoal: true });
  }

  const frontier: FrontierEntry[] = [root];
  const explored: string[] = [];
  const steps: Step[] = [];

  while (frontier.length > 0) {
    const before = snapshot(frontier, explored);
    const node = frontier.shift()!;
    explored.push(node.node);
    const children: ChildRecord[] = [];
    let found: FrontierEntry | null = null;

    for (const s of successors(graph, node.node)) {
      const child = make.child(node, s);
      if (explored.includes(s.node)) {
        children.push(record(child, s.cost, 'skip-explored'));
        continue;
      }
      const existing = frontier.find((e) => e.node === s.node);
      if (existing) {
        children.push(record(child, s.cost, 'skip-frontier', existing));
        continue;
      }
      if (s.node === graph.goal) {
        children.push(record(child, s.cost, 'goal'));
        found = child;
        break;
      }
      frontier.push(make.stamp(child));
      children.push(record(child, s.cost, 'add'));
    }

    steps.push({ before, pop: node, decision: 'expand', children, after: snapshot(frontier, explored) });
    if (found) return buildTrace(graph, 'bfs', [{ steps, end: 'solution' }], found);
  }
  return buildTrace(graph, 'bfs', [{ steps, end: 'failure' }], null);
}
