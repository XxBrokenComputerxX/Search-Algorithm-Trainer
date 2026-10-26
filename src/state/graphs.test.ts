import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BUILTIN_GRAPHS } from '../data/graphs';

const stored = { ...BUILTIN_GRAPHS[1], id: 'custom-test', custom: true };

beforeAll(() => {
  // Simulate a browser that already has a saved custom graph when the module first loads.
  const data: Record<string, string> = { 'sat.customGraphs.v1': JSON.stringify([stored]) };
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  });
});

describe('custom graph storage', () => {
  it('loads graphs saved in a previous session', async () => {
    const { findGraph } = await import('./graphs');
    expect(findGraph('custom-test')?.name).toBe(stored.name);
  });

  it('round-trips every built-in graph through parseGraph', async () => {
    const { parseGraph } = await import('./graphs');
    for (const g of BUILTIN_GRAPHS) {
      const parsed = parseGraph(JSON.parse(JSON.stringify(g)));
      expect(parsed).toMatchObject({ nodes: g.nodes, edges: g.edges, start: g.start, goal: g.goal });
    }
  });

  it('rejects malformed graphs with a reason', async () => {
    const { parseGraph } = await import('./graphs');
    expect(parseGraph({ nodes: [{ id: 'A', x: 1, y: 1 }], edges: [{ from: 'A', to: 'Z' }], start: 'A', goal: 'A' })).toMatch(/unknown node/);
    expect(parseGraph('nope')).toMatch(/Not a graph/);
  });
});
