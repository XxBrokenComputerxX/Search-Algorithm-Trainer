import { successors, type Graph } from '../graph';
import type { ChildRecord, FrontierEntry, Step, Trace } from '../trace';
import { EntryFactory, buildTrace, record, snapshot } from './common';

/**
 * Pushes the "add" children (alphabetical) onto the stack so the alphabetically first child ends on top.
 * They are numbered in reverse, so "most recently pushed" (highest #) is the one on top.
 */
export function pushChildren(make: EntryFactory, frontier: FrontierEntry[], children: ChildRecord[]): void {
  const added = children.filter((c) => c.action === 'add');
  for (let i = added.length - 1; i >= 0; i--) make.stamp(added[i].entry);
  frontier.unshift(...added.map((c) => ({ ...c.entry })));
}

/** AIMA depth-first graph search: LIFO frontier, explored set, goal test on expansion. */
export function dfs(graph: Graph): Trace {
  const make = new EntryFactory(graph, 'dfs');
  const frontier: FrontierEntry[] = [make.root()];
  const explored: string[] = [];
  const steps: Step[] = [];

  while (frontier.length > 0) {
    const before = snapshot(frontier, explored);
    const node = frontier.shift()!;
    if (node.node === graph.goal) {
      steps.push({ before, pop: node, decision: 'goal', children: [], after: snapshot(frontier, explored) });
      return buildTrace(graph, 'dfs', [{ steps, end: 'solution' }], node);
    }
    explored.push(node.node);

    const children: ChildRecord[] = successors(graph, node.node).map((s) => {
      const child = make.child(node, s);
      if (explored.includes(s.node)) return record(child, s.cost, 'skip-explored');
      const existing = frontier.find((e) => e.node === s.node);
      if (existing) return record(child, s.cost, 'skip-frontier', existing);
      return record(child, s.cost, 'add');
    });
    pushChildren(make, frontier, children);

    steps.push({ before, pop: node, decision: 'expand', children, after: snapshot(frontier, explored) });
  }
  return buildTrace(graph, 'dfs', [{ steps, end: 'failure' }], null);
}
