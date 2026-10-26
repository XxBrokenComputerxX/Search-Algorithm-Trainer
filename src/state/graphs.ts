import { BUILTIN_GRAPHS } from '../data/graphs';
import { DIFFICULTIES, type Difficulty, type Graph } from '../engine/graph';
import { createStore, useStore } from './storage';

const customStore = createStore<Graph[]>('sat.customGraphs.v1', [], (raw) =>
  Array.isArray(raw) ? raw.map(parseGraph).filter((g): g is Graph => typeof g !== 'string') : [],
);

export const useCustomGraphs = () => useStore(customStore);

export function allGraphs(): Graph[] {
  return [...BUILTIN_GRAPHS, ...customStore.get()];
}

export function findGraph(id: string): Graph | undefined {
  return allGraphs().find((g) => g.id === id);
}

export function saveCustomGraph(graph: Graph): void {
  const g = { ...graph, custom: true };
  const list = customStore.get();
  const i = list.findIndex((x) => x.id === g.id);
  customStore.set(i >= 0 ? list.map((x, j) => (j === i ? g : x)) : [...list, g]);
}

export function deleteCustomGraph(id: string): void {
  customStore.set(customStore.get().filter((g) => g.id !== id));
}

export function newGraphId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// Function declarations (hoisted): the store above validates stored graphs while this module is still loading.
function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function isStr(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0;
}

/** Validates untrusted JSON (imports, localStorage). Returns the graph or an error message. */
export function parseGraph(raw: unknown): Graph | string {
  if (!raw || typeof raw !== 'object') return 'Not a graph object.';
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.nodes) || !Array.isArray(r.edges)) return 'A graph needs "nodes" and "edges" arrays.';

  const nodes = [];
  for (const n of r.nodes as Record<string, unknown>[]) {
    if (!n || !isStr(n.id) || !isNum(n.x) || !isNum(n.y)) return 'Every node needs an "id" and numeric "x"/"y".';
    if (n.h !== undefined && !isNum(n.h)) return `Node ${n.id}: "h" must be a number.`;
    nodes.push(n.h === undefined ? { id: n.id, x: n.x, y: n.y } : { id: n.id, x: n.x, y: n.y, h: n.h as number });
  }
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) return 'Node ids must be unique.';

  const edges = [];
  for (const e of r.edges as Record<string, unknown>[]) {
    if (!e || !isStr(e.from) || !isStr(e.to)) return 'Every edge needs "from" and "to".';
    if (!ids.has(e.from) || !ids.has(e.to)) return `Edge ${e.from}-${e.to} refers to an unknown node.`;
    const w = e.w === undefined ? 1 : e.w;
    if (!isNum(w)) return `Edge ${e.from}-${e.to}: "w" must be a number.`;
    edges.push({ from: e.from, to: e.to, w });
  }
  if (!isStr(r.start) || !ids.has(r.start)) return 'The "start" must be one of the nodes.';
  if (!isStr(r.goal) || !ids.has(r.goal)) return 'The "goal" must be one of the nodes.';
  const difficulty = DIFFICULTIES.includes(r.difficulty as Difficulty) ? (r.difficulty as Difficulty) : 'medium';

  return {
    id: isStr(r.id) ? r.id : newGraphId(),
    name: isStr(r.name) ? r.name : 'Imported graph',
    description: typeof r.description === 'string' ? r.description : undefined,
    note: typeof r.note === 'string' ? r.note : undefined,
    directed: r.directed === true,
    weighted: r.weighted !== false,
    nodes,
    edges,
    start: r.start,
    goal: r.goal,
    difficulty,
    dlsLimit: isNum(r.dlsLimit) && r.dlsLimit >= 0 ? Math.floor(r.dlsLimit) : undefined,
    custom: true,
  };
}
