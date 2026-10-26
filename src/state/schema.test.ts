import { describe, expect, it } from 'vitest';
import schema from '../../schema/graph.schema.json';
import example from '../../schema/example-graph.json';
import { BUILTIN_GRAPHS } from '../data/graphs';
import { bfs, ucs, astar } from '../engine/algorithms';
import { checkHeuristic } from '../engine/heuristicCheck';
import { NODE_NAME, validateGraph } from '../engine/validate';
import type { Graph } from '../engine/graph';
import { parseGraph } from './graphs';

describe('graph JSON schema', () => {
  it('the example file imports, validates and teaches what its note says', () => {
    const g = parseGraph(example);
    expect(typeof g).not.toBe('string');
    const graph = g as Graph;
    expect(validateGraph(graph).errors).toEqual([]);
    expect(checkHeuristic(graph).consistent).toBe(true);
    expect(bfs(graph).solution).toMatchObject({ path: ['S', 'C', 'G'], g: 9 });
    expect(ucs(graph).solution).toMatchObject({ path: ['S', 'A', 'B', 'G'], g: 6 });
    expect(astar(graph).solution).toMatchObject({ path: ['S', 'A', 'B', 'G'], g: 6 });
  });

  it('the inline schema example imports and validates', () => {
    const g = parseGraph(schema.examples[0]) as Graph;
    expect(validateGraph(g).errors).toEqual([]);
  });

  it('describes every field the built-in graphs use', () => {
    const top = new Set(Object.keys(schema.properties));
    const nodeKeys = new Set(Object.keys(schema.$defs.node.properties));
    const edgeKeys = new Set(Object.keys(schema.$defs.edge.properties));
    for (const g of BUILTIN_GRAPHS) {
      for (const k of Object.keys(g)) if (k !== 'custom' && (g as unknown as Record<string, unknown>)[k] !== undefined) expect(top).toContain(k);
      for (const n of g.nodes) for (const k of Object.keys(n)) expect(nodeKeys).toContain(k);
      for (const e of g.edges) for (const k of Object.keys(e)) expect(edgeKeys).toContain(k);
    }
  });

  it('uses the same node-name rule as the app', () => {
    expect(schema.$defs.nodeId.pattern).toBe(NODE_NAME.source);
  });
});
