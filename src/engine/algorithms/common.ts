import { compareIds, heuristic, type Graph, type Successor } from '../graph';
import { fValue } from '../conventions';
import type { AlgoId, ChildAction, ChildRecord, FrontierEntry, Round, Snapshot, Trace } from '../trace';

/** Creates search-tree nodes and hands out insertion numbers. */
export class EntryFactory {
  private seq = 0;
  private readonly graph: Graph;
  private readonly algo: AlgoId;

  constructor(graph: Graph, algo: AlgoId) {
    this.graph = graph;
    this.algo = algo;
  }

  root(): FrontierEntry {
    return this.stamp(this.make(this.graph.start, null, 0));
  }

  child(parent: FrontierEntry, s: Successor): FrontierEntry {
    return this.make(s.node, parent, parent.g + s.cost);
  }

  /** Give an entry its insertion number - call this when it actually enters the frontier. */
  stamp(e: FrontierEntry): FrontierEntry {
    e.seq = ++this.seq;
    return e;
  }

  resetSeq(): void {
    this.seq = 0;
  }

  private make(node: string, parent: FrontierEntry | null, g: number): FrontierEntry {
    const h = heuristic(this.graph, node);
    const path = parent ? [...parent.path, node] : [node];
    return {
      key: path.join('>'),
      node,
      parent: parent?.node ?? null,
      path,
      g,
      h,
      f: fValue(this.algo, g, h),
      depth: path.length - 1,
      seq: 0,
    };
  }
}

export function snapshot(frontier: FrontierEntry[], explored: string[]): Snapshot {
  return { frontier: frontier.map((e) => ({ ...e })), explored: [...explored] };
}

/** Priority order: lower f first, then alphabetical, then older entry first. */
export function sortByPriority(frontier: FrontierEntry[]): void {
  frontier.sort((a, b) => a.f - b.f || compareIds(a.node, b.node) || a.seq - b.seq);
}

export function record(entry: FrontierEntry, cost: number, action: ChildAction, existing?: FrontierEntry): ChildRecord {
  return { node: entry.node, cost, entry: { ...entry }, action, existing: existing ? { ...existing } : undefined };
}

export function buildTrace(
  graph: Graph,
  algo: AlgoId,
  rounds: Round[],
  solution: FrontierEntry | null,
  extra: { limit?: number; startIsGoal?: boolean } = {},
): Trace {
  const last = rounds[rounds.length - 1];
  return {
    algo,
    graph,
    limit: extra.limit,
    rounds,
    status: last ? last.end : 'failure',
    solution,
    startIsGoal: extra.startIsGoal ?? false,
  };
}
