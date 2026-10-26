import { describe, expect, it } from 'vitest';
import { BUILTIN_GRAPHS } from '../data/graphs';
import { astar, bfs, dfs, dls, greedy, ids, runAlgorithm, ucs } from './algorithms';
import { checkHeuristic } from './heuristicCheck';
import { expansionOrder, type Trace } from './trace';
import { ALGO_IDS } from './trace';
import type { Graph } from './graph';

const graph = (id: string): Graph => {
  const g = BUILTIN_GRAPHS.find((x) => x.id === id);
  if (!g) throw new Error(`missing graph ${id}`);
  return g;
};

const result = (t: Trace) => ({ status: t.status, path: t.solution?.path, cost: t.solution?.g });

describe('Romania (AIMA reference results)', () => {
  const romania = graph('hard-romania');

  it('A* expands Arad, Sibiu, Rimnicu Vilcea, Fagaras, Pitesti, Bucharest and finds cost 418', () => {
    const t = astar(romania);
    expect(expansionOrder(t)).toEqual(['Arad', 'Sibiu', 'Rimnicu Vilcea', 'Fagaras', 'Pitesti', 'Bucharest']);
    expect(result(t)).toEqual({
      status: 'solution',
      path: ['Arad', 'Sibiu', 'Rimnicu Vilcea', 'Pitesti', 'Bucharest'],
      cost: 418,
    });
  });

  it('A* replaces Bucharest (450 -> 418) when expanding Pitesti', () => {
    const t = astar(romania);
    const pitesti = t.rounds[0].steps.find((s) => s.pop.node === 'Pitesti')!;
    const b = pitesti.children.find((c) => c.node === 'Bucharest')!;
    expect(b.action).toBe('replace');
    expect(b.existing?.f).toBe(450);
    expect(b.entry.f).toBe(418);
  });

  it('Greedy goes Arad, Sibiu, Fagaras, Bucharest (cost 450)', () => {
    const t = greedy(romania);
    expect(expansionOrder(t)).toEqual(['Arad', 'Sibiu', 'Fagaras', 'Bucharest']);
    expect(result(t)).toEqual({ status: 'solution', path: ['Arad', 'Sibiu', 'Fagaras', 'Bucharest'], cost: 450 });
  });

  it('UCS finds the optimal cost 418', () => {
    expect(result(ucs(romania)).cost).toBe(418);
  });

  it('BFS finds Arad-Sibiu-Fagaras-Bucharest by goal test on generation', () => {
    const t = bfs(romania);
    expect(result(t)).toEqual({ status: 'solution', path: ['Arad', 'Sibiu', 'Fagaras', 'Bucharest'], cost: 450 });
    const last = t.rounds[0].steps.at(-1)!;
    expect(last.pop.node).toBe('Fagaras');
    expect(last.children.at(-1)?.action).toBe('goal');
    expect(expansionOrder(t)).toEqual(['Arad', 'Sibiu', 'Timisoara', 'Zerind', 'Fagaras']);
  });

  it('the straight-line heuristic is admissible and consistent', () => {
    const r = checkHeuristic(romania);
    expect(r.admissible).toBe(true);
    expect(r.consistent).toBe(true);
  });
});

describe('hand-computed small graphs', () => {
  it('BFS on First Steps', () => {
    const t = bfs(graph('easy-first-steps'));
    expect(expansionOrder(t)).toEqual(['S', 'A', 'B', 'C', 'D']);
    expect(result(t)).toEqual({ status: 'solution', path: ['S', 'A', 'D', 'G'], cost: 3 });
  });

  it('A* on Weighted Warm-up: replacement and alphabetical tie-break', () => {
    const t = astar(graph('easy-weighted-warmup'));
    expect(expansionOrder(t)).toEqual(['S', 'A', 'B', 'D', 'C', 'G']);
    expect(result(t)).toEqual({ status: 'solution', path: ['S', 'A', 'B', 'D', 'G'], cost: 10 });
    const a = t.rounds[0].steps[1];
    expect(a.children.find((c) => c.node === 'B')?.action).toBe('replace');
  });

  it('Greedy on Weighted Warm-up is not optimal', () => {
    expect(result(greedy(graph('easy-weighted-warmup')))).toEqual({
      status: 'solution',
      path: ['S', 'B', 'D', 'G'],
      cost: 11,
    });
  });

  it('BFS vs UCS on One-Way Streets', () => {
    const g = graph('easy-one-way');
    expect(result(bfs(g))).toEqual({ status: 'solution', path: ['S', 'B', 'G'], cost: 13 });
    expect(result(ucs(g))).toEqual({ status: 'solution', path: ['S', 'A', 'B', 'C', 'D', 'G'], cost: 9 });
  });

  it('A* on Crossroads', () => {
    const t = astar(graph('medium-crossroads'));
    expect(expansionOrder(t)).toEqual(['S', 'B', 'E', 'A', 'H', 'G']);
    expect(result(t).cost).toBe(12);
  });

  it('A* on The Detour finds 10, BFS and Greedy find 12', () => {
    const g = graph('medium-detour');
    expect(result(astar(g))).toEqual({ status: 'solution', path: ['S', 'A', 'D', 'E', 'G'], cost: 10 });
    expect(result(bfs(g)).cost).toBe(12);
    expect(result(greedy(g)).cost).toBe(12);
  });

  it('A* graph search is NOT optimal with the inconsistent heuristic of Misleading Signposts', () => {
    const g = graph('hard-misleading');
    const report = checkHeuristic(g);
    expect(report.admissible).toBe(true);
    expect(report.consistent).toBe(false);
    expect(report.violations).toContainEqual({ from: 'A', to: 'C', cost: 1, hFrom: 4, hTo: 0 });
    expect(result(astar(g))).toEqual({ status: 'solution', path: ['S', 'B', 'C', 'F', 'G'], cost: 7 });
    expect(result(ucs(g))).toEqual({ status: 'solution', path: ['S', 'A', 'C', 'F', 'G'], cost: 5 });
    const aStep = astar(g).rounds[0].steps.find((s) => s.pop.node === 'A')!;
    expect(aStep.children.find((c) => c.node === 'C')?.action).toBe('skip-explored');
  });
});

describe('depth-first family', () => {
  it('DFS expands the alphabetically first child first and pushes it on top', () => {
    const t = dfs(graph('medium-maze'));
    const first = t.rounds[0].steps[0];
    expect(first.after.frontier.map((e) => e.node)).toEqual(['A', 'C']);
    // Top of the stack carries the highest insertion number.
    expect(first.after.frontier[0].seq).toBeGreaterThan(first.after.frontier[1].seq);
  });

  it('DFS falls into the deep trap', () => {
    const t = dfs(graph('hard-deep-trap'));
    // C's child D is skipped because D (pushed by A) is already in the frontier.
    const c = t.rounds[0].steps.find((s) => s.pop.node === 'C')!;
    expect(c.children.find((x) => x.node === 'D')?.action).toBe('skip-frontier');
    expect(result(t)).toEqual({
      status: 'solution',
      path: ['S', 'A', 'D', 'E', 'F', 'H', 'J', 'L', 'G'],
      cost: 8,
    });
  });

  it('DLS on First Steps (limit 3) cuts off B and then finds G', () => {
    const t = dls(graph('easy-first-steps'), 3);
    expect(t.rounds[0].steps.map((s) => `${s.pop.node}:${s.decision}`)).toEqual([
      'S:expand',
      'A:expand',
      'C:expand',
      'D:expand',
      'B:cutoff',
      'G:goal',
    ]);
    expect(result(t).path).toEqual(['S', 'A', 'D', 'G']);
  });

  it('DLS distinguishes cutoff from failure', () => {
    const g = graph('hard-deep-trap');
    expect(dls(g, 2).status).toBe('cutoff');
    const unreachable: Graph = { ...g, edges: g.edges.filter((e) => e.to !== 'G') };
    expect(dls(unreachable, 20).status).toBe('failure');
  });

  it('DLS skips children on the current path (cycle check)', () => {
    const t = dls(graph('easy-first-steps'), 3);
    const a = t.rounds[0].steps[1];
    expect(a.children.find((c) => c.node === 'S')?.action).toBe('skip-path');
  });

  it('IDS on The Deep Trap finds the shallow goal at limit 3', () => {
    const t = ids(graph('hard-deep-trap'));
    expect(t.rounds.map((r) => [r.limit, r.end])).toEqual([
      [0, 'cutoff'],
      [1, 'cutoff'],
      [2, 'cutoff'],
      [3, 'solution'],
    ]);
    expect(result(t).path).toEqual(['S', 'B', 'K', 'G']);
  });

  it('IDS returns failure when the goal is unreachable', () => {
    const g = graph('hard-deep-trap');
    const unreachable: Graph = { ...g, edges: g.edges.filter((e) => e.to !== 'G') };
    expect(ids(unreachable).status).toBe('failure');
  });
});

describe('every built-in graph', () => {
  for (const g of BUILTIN_GRAPHS) {
    it(`${g.name}: every algorithm terminates with a solution and UCS is optimal`, () => {
      const best = ucs(g).solution!.g;
      for (const algo of ALGO_IDS) {
        const t = runAlgorithm(algo, g, algo === 'dls' ? 50 : undefined);
        expect(t.status).toBe('solution');
        expect(t.solution!.g).toBeGreaterThanOrEqual(best);
      }
    });

    it(`${g.name}: heuristic is admissible${g.id === 'hard-misleading' ? '' : ' and consistent'}`, () => {
      const r = checkHeuristic(g);
      expect(r.admissible).toBe(true);
      if (g.id !== 'hard-misleading') expect(r.consistent).toBe(true);
    });
  }
});
