import { successors, type Graph } from '../graph';
import type { AlgoId, ChildRecord, FrontierEntry, Round, Step, Trace } from '../trace';
import { EntryFactory, buildTrace, record, snapshot } from './common';
import { pushChildren } from './dfs';

/**
 * One depth-limited search (AIMA): LIFO tree search with a cycle check on the current path.
 * A node at depth = limit is goal-tested but not expanded (cutoff).
 */
function dlsRound(graph: Graph, limit: number, make: EntryFactory): { round: Round; solution: FrontierEntry | null } {
  make.resetSeq();
  const frontier: FrontierEntry[] = [make.root()];
  const steps: Step[] = [];
  let cutoff = false;

  while (frontier.length > 0) {
    const before = snapshot(frontier, []);
    const node = frontier.shift()!;
    if (node.node === graph.goal) {
      steps.push({ before, pop: node, decision: 'goal', children: [], after: snapshot(frontier, []) });
      return { round: { limit, steps, end: 'solution' }, solution: node };
    }
    if (node.depth >= limit) {
      cutoff = true;
      steps.push({ before, pop: node, decision: 'cutoff', children: [], after: snapshot(frontier, []) });
      continue;
    }
    const children: ChildRecord[] = successors(graph, node.node).map((s) => {
      const child = make.child(node, s);
      return node.path.includes(s.node) ? record(child, s.cost, 'skip-path') : record(child, s.cost, 'add');
    });
    pushChildren(make, frontier, children);
    steps.push({ before, pop: node, decision: 'expand', children, after: snapshot(frontier, []) });
  }
  return { round: { limit, steps, end: cutoff ? 'cutoff' : 'failure' }, solution: null };
}

export function dls(graph: Graph, limit: number): Trace {
  const { round, solution } = dlsRound(graph, limit, new EntryFactory(graph, 'dls'));
  return buildTrace(graph, 'dls', [round], solution, { limit });
}

/** Iterative deepening: DLS with limit 0, 1, 2, ... until the result is not "cutoff". */
export function ids(graph: Graph): Trace {
  const algo: AlgoId = 'ids';
  const make = new EntryFactory(graph, algo);
  const rounds: Round[] = [];
  // With the path cycle check no path is longer than |V| - 1 edges, so this always terminates.
  for (let limit = 0; limit <= graph.nodes.length; limit++) {
    const { round, solution } = dlsRound(graph, limit, make);
    rounds.push(round);
    if (round.end !== 'cutoff') return buildTrace(graph, algo, rounds, solution);
  }
  return buildTrace(graph, algo, rounds, null);
}
