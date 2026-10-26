import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { GraphCanvas, VIEW_H, VIEW_W, type NodeTone } from '../components/GraphCanvas';
import { NumberInput } from '../components/common';
import { BUILTIN_GRAPHS } from '../data/graphs';
import { isApplicable } from '../engine/algorithms';
import { DIFFICULTIES, compareIds, hasHeuristic, type Difficulty, type GEdge, type Graph } from '../engine/graph';
import { checkHeuristic, trueCostsToGoal } from '../engine/heuristicCheck';
import { ALGOS } from '../engine/properties';
import { ALGO_IDS } from '../engine/trace';
import { NODE_NAME, validateGraph } from '../engine/validate';
import { deleteCustomGraph, findGraph, newGraphId, parseGraph, saveCustomGraph, useCustomGraphs } from '../state/graphs';

// ------------------------------------------------------------------ list / import

export function EditorHome() {
  const custom = useCustomGraphs();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(BUILTIN_GRAPHS[0].id);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      const parsed = parseGraph(JSON.parse(await file.text()));
      if (typeof parsed === 'string') return setImportError(parsed);
      const g = { ...parsed, id: newGraphId() };
      saveCustomGraph(g);
      navigate(`/editor/${g.id}`);
    } catch {
      setImportError('That file is not valid JSON.');
    }
  };

  return (
    <div className="page">
      <h1>Graph editor</h1>
      <p className="lead">Build your own search problems. Saved graphs appear in the graph list of every algorithm they work with.</p>

      <div className="editor-home">
        <section className="panel">
          <h2>Your graphs</h2>
          {custom.length === 0 ? (
            <p className="muted">No graphs yet.</p>
          ) : (
            <ul className="graph-list">
              {custom.map((g) => (
                <li key={g.id} className="graph-item">
                  <div className="graph-item-main">
                    <strong>{g.name}</strong>
                    <div className="tags">
                      <span className="badge">{g.difficulty}</span>
                      <span className="badge">{g.directed ? 'directed' : 'undirected'}</span>
                      <span className="badge">{g.weighted ? 'weighted' : 'unweighted'}</span>
                      <span className="badge">{g.nodes.length} nodes</span>
                      <span className="badge">{hasHeuristic(g) ? 'has h' : 'no h'}</span>
                    </div>
                  </div>
                  <div className="graph-item-actions">
                    <Link className="btn small" to={`/editor/${g.id}`}>
                      Edit
                    </Link>
                    <button className="btn small" onClick={() => downloadGraph(g)}>
                      Export
                    </button>
                    {confirmDelete === g.id ? (
                      <button className="btn small danger" onClick={() => deleteCustomGraph(g.id)}>
                        Really delete?
                      </button>
                    ) : (
                      <button className="btn small ghost" onClick={() => setConfirmDelete(g.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Create</h2>
          <div className="stack">
            <Link className="btn primary" to="/editor/new">
              + New empty graph
            </Link>
            <div className="inline-field wrap">
              <select value={template} onChange={(e) => setTemplate(e.target.value)} aria-label="Built-in graph to copy">
                {BUILTIN_GRAPHS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.difficulty})
                  </option>
                ))}
              </select>
              <Link className="btn" to={`/editor/new?from=${template}`}>
                Copy built-in graph
              </Link>
            </div>
            <label className="btn file-btn">
              Import JSON…
              <input type="file" accept="application/json,.json" onChange={(e) => onImport(e.target.files?.[0])} />
            </label>
            {importError && <p className="error-text">{importError}</p>}
          </div>
          <h3>Tips</h3>
          <ul className="small">
            <li>Make the alphabetically first branch a dead end to trap DFS.</li>
            <li>Give a short path expensive edges to show that BFS is not optimal on weighted graphs.</li>
            <li>Use “perfect h”, then raise one value to see what an inadmissible heuristic does to A*.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function downloadGraph(g: Graph) {
  const { custom: _custom, ...data } = g;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${g.name.replace(/[^A-Za-z0-9-_]+/g, '_') || 'graph'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blankGraph(): Graph {
  return {
    id: newGraphId(),
    name: 'My graph',
    description: '',
    directed: false,
    weighted: true,
    difficulty: 'medium',
    start: 'S',
    goal: 'G',
    dlsLimit: 2,
    nodes: [
      { id: 'S', x: 120, y: 250, h: 0 },
      { id: 'G', x: 680, y: 250, h: 0 },
    ],
    edges: [],
    custom: true,
  };
}

// ------------------------------------------------------------------ editor

type Mode = 'select' | 'node' | 'edge' | 'delete';

const MODES: { id: Mode; label: string; help: string }[] = [
  { id: 'select', label: 'Select / move', help: 'Click a node or edge to edit it. Drag nodes to move them.' },
  { id: 'node', label: 'Add node', help: 'Click on an empty spot to add a node.' },
  { id: 'edge', label: 'Add edge', help: 'Click the first node, then the second node.' },
  { id: 'delete', label: 'Delete', help: 'Click a node or edge to delete it.' },
];

function nextName(g: Graph): string {
  const used = new Set(g.nodes.map((n) => n.id));
  for (const c of 'ABCDEFHIJKLMNOPQRTUVWXYZ') if (!used.has(c)) return c;
  for (let i = 1; ; i++) if (!used.has(`N${i}`)) return `N${i}`;
}

export function EditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  useCustomGraphs();

  const initial = useMemo<Graph | null>(() => {
    if (id === 'new') {
      const from = params.get('from');
      const src = from ? findGraph(from) : undefined;
      if (src) return { ...structuredClone(src), id: newGraphId(), name: `${src.name} (copy)`, custom: true };
      return blankGraph();
    }
    const g = id ? findGraph(id) : undefined;
    return g?.custom ? structuredClone(g) : null;
  }, [id]);

  if (!initial) {
    return (
      <div className="page narrow">
        <h1>Graph not found</h1>
        <p>Only your own graphs can be edited. Built-in graphs can be copied from the editor start page.</p>
        <Link className="btn primary" to="/editor">
          Back to the editor
        </Link>
      </div>
    );
  }
  return <GraphEditor key={initial.id} initial={initial} isNew={id === 'new'} />;
}

function GraphEditor({ initial, isNew }: { initial: Graph; isNew: boolean }) {
  const navigate = useNavigate();
  const [g, setG] = useState<Graph>(initial);
  const [mode, setMode] = useState<Mode>('select');
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [dirty, setDirty] = useState(isNew);
  const [savedOnce, setSavedOnce] = useState(!isNew);
  const [renameText, setRenameText] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [playDiff, setPlayDiff] = useState<Difficulty>(initial.difficulty);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const useH = g.nodes.some((n) => typeof n.h === 'number');
  const validation = validateGraph(g);
  const report = validation.errors.length === 0 && hasHeuristic(g) ? checkHeuristic(g) : null;

  const change = (fn: (g: Graph) => Graph) => {
    setG((old) => fn(old));
    setDirty(true);
  };

  const selectNode = (id: string | null) => {
    setSelNode(id);
    setSelEdge(null);
    setRenameText(id ?? '');
    setRenameError(null);
  };

  const clampX = (x: number) => Math.round(Math.min(VIEW_W - 30, Math.max(30, x)));
  const clampY = (y: number) => Math.round(Math.min(VIEW_H - 30, Math.max(30, y)));

  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    const exists = g.edges.findIndex((e) => (e.from === from && e.to === to) || (!g.directed && e.from === to && e.to === from));
    if (exists >= 0) {
      setSelEdge(exists);
      setSelNode(null);
      return;
    }
    change((old) => ({ ...old, edges: [...old.edges, { from, to, w: 1 }] }));
    setSelEdge(g.edges.length);
    setSelNode(null);
  };

  const deleteNode = (id: string) => {
    change((old) => ({
      ...old,
      nodes: old.nodes.filter((n) => n.id !== id),
      edges: old.edges.filter((e) => e.from !== id && e.to !== id),
      start: old.start === id ? '' : old.start,
      goal: old.goal === id ? '' : old.goal,
    }));
    selectNode(null);
  };

  const deleteEdge = (i: number) => {
    change((old) => ({ ...old, edges: old.edges.filter((_, j) => j !== i) }));
    setSelEdge(null);
  };

  const updateEdge = (i: number, patch: Partial<GEdge>) =>
    change((old) => ({ ...old, edges: old.edges.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));

  const setDirected = (directed: boolean) => {
    change((old) => {
      if (directed) return { ...old, directed };
      // Merge opposite directions into one undirected edge (cheapest wins).
      const merged: GEdge[] = [];
      for (const e of old.edges) {
        const twin = merged.find((m) => (m.from === e.from && m.to === e.to) || (m.from === e.to && m.to === e.from));
        if (twin) twin.w = Math.min(twin.w, e.w);
        else merged.push({ ...e });
      }
      return { ...old, directed, edges: merged };
    });
    setSelEdge(null);
  };

  const setUseH = (on: boolean) =>
    change((old) => ({
      ...old,
      nodes: old.nodes.map((n) => (on ? { ...n, h: n.h ?? 0 } : { id: n.id, x: n.x, y: n.y })),
    }));

  const perfectH = () => {
    const costs = trueCostsToGoal(g);
    change((old) => ({
      ...old,
      nodes: old.nodes.map((n) => {
        const c = costs.get(n.id) ?? Infinity;
        return { ...n, h: Number.isFinite(c) ? c : 0 };
      }),
    }));
  };

  const rename = () => {
    if (!selNode) return;
    const name = renameText.trim();
    if (name === selNode) return;
    if (!NODE_NAME.test(name)) return setRenameError('Use letters, digits, space, _ or - (max 20).');
    if (g.nodes.some((n) => n.id === name)) return setRenameError('That name is taken.');
    const swap = (x: string) => (x === selNode ? name : x);
    change((old) => ({
      ...old,
      nodes: old.nodes.map((n) => (n.id === selNode ? { ...n, id: name } : n)),
      edges: old.edges.map((e) => ({ ...e, from: swap(e.from), to: swap(e.to) })),
      start: swap(old.start),
      goal: swap(old.goal),
    }));
    setSelNode(name);
    setRenameError(null);
  };

  const save = () => {
    saveCustomGraph(g);
    setDirty(false);
    setSavedOnce(true);
    if (isNew) navigate(`/editor/${g.id}`, { replace: true });
  };

  // ---- canvas
  const tones: Record<string, NodeTone> = {};
  if (report) for (const o of report.overestimates) tones[o.node] = 'warn';
  if (pending) tones[pending] = 'current';
  if (selNode) tones[selNode] = 'selected';
  const warnEdges = new Set<number>();
  if (report) {
    g.edges.forEach((e, i) => {
      if (report.violations.some((v) => (v.from === e.from && v.to === e.to) || (!g.directed && v.from === e.to && v.to === e.from))) warnEdges.add(i);
    });
  }

  const editor = {
    onCanvasPointerDown: (x: number, y: number) => {
      if (mode === 'node') {
        const id = nextName(g);
        change((old) => ({ ...old, nodes: [...old.nodes, { id, x: clampX(x), y: clampY(y), ...(useH ? { h: 0 } : {}) }] }));
        selectNode(id);
      } else if (mode === 'edge') setPending(null);
      else if (mode === 'select') {
        selectNode(null);
      }
    },
    onNodePointerDown: (id: string, x: number, y: number) => {
      if (mode === 'delete') return deleteNode(id);
      if (mode === 'edge') {
        if (!pending) setPending(id);
        else {
          addEdge(pending, id);
          setPending(null);
        }
        return;
      }
      selectNode(id);
      if (mode === 'select') {
        const n = g.nodes.find((x) => x.id === id)!;
        drag.current = { id, dx: n.x - x, dy: n.y - y };
      }
    },
    onPointerMove: (x: number, y: number) => {
      const d = drag.current;
      if (!d) return;
      change((old) => ({ ...old, nodes: old.nodes.map((n) => (n.id === d.id ? { ...n, x: clampX(x + d.dx), y: clampY(y + d.dy) } : n)) }));
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onEdgeClick: (i: number) => {
      if (mode === 'delete') return deleteEdge(i);
      setSelEdge(i);
      setSelNode(null);
    },
  };

  const node = selNode ? g.nodes.find((n) => n.id === selNode) : undefined;
  const edge = selEdge !== null ? g.edges[selEdge] : undefined;
  const sortedIds = g.nodes.map((n) => n.id).sort(compareIds);

  return (
    <div className="page wide">
      <div className="crumbs">
        <Link to="/editor">← All graphs</Link>
      </div>
      <header className="editor-head">
        <h1>{g.name || 'Untitled graph'}</h1>
        <div className="button-row">
          <span className={`save-state${dirty ? ' dirty' : ''}`}>{dirty ? 'Unsaved changes' : 'Saved ✓'}</span>
          <button className="btn primary" onClick={save} disabled={validation.errors.length > 0 || !dirty}>
            Save
          </button>
          <button className="btn" onClick={() => downloadGraph(g)}>
            Export JSON
          </button>
        </div>
      </header>

      <div className="editor-layout">
        <section className="editor-main">
          <div className="toolbar" role="toolbar" aria-label="Editing mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`btn small${mode === m.id ? ' active' : ''}`}
                aria-pressed={mode === m.id}
                onClick={() => {
                  setMode(m.id);
                  setPending(null);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="muted small">
            {MODES.find((m) => m.id === mode)!.help}
            {mode === 'edge' && pending && ` First node: ${pending}.`}
          </p>
          <div className={`canvas-card mode-${mode}`}>
            <GraphCanvas graph={g} tones={tones} selectedEdge={selEdge} warnEdges={warnEdges} editor={editor} ariaLabel="Graph editor canvas" />
          </div>

          <div className="panel">
            <h3>Check</h3>
            {validation.errors.length === 0 && validation.warnings.length === 0 && <p className="ok-text">✓ The graph is valid.</p>}
            <ul className="problems">
              {validation.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <ul className="warnings">
              {validation.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            {report && (
              <div className="h-report">
                <p>
                  <strong>Heuristic:</strong>{' '}
                  <span className={report.admissible ? 'ok-text' : 'error-text'}>{report.admissible ? '✓ admissible' : '✗ not admissible'}</span>
                  {' · '}
                  <span className={report.consistent ? 'ok-text' : 'error-text'}>{report.consistent ? '✓ consistent' : '✗ not consistent'}</span>
                </p>
                {report.overestimates.length > 0 && (
                  <p className="small">
                    Overestimates (orange nodes):{' '}
                    {report.overestimates.map((o) => `h(${o.node}) = ${o.h} > true cost ${o.trueCost}`).join('; ')}. A* may return a non-optimal path.
                  </p>
                )}
                {report.violations.length > 0 && (
                  <p className="small">
                    Consistency violated on the orange edges:{' '}
                    {report.violations
                      .slice(0, 6)
                      .map((v) => `h(${v.from}) = ${v.hFrom} > ${v.cost} + h(${v.to}) = ${v.cost + v.hTo}`)
                      .join('; ')}
                    {report.violations.length > 6 && ' …'}. Graph-search A* may be non-optimal.
                  </p>
                )}
                {report.consistent && <p className="small muted">A consistent heuristic guarantees that graph-search A* returns an optimal path.</p>}
              </div>
            )}
          </div>
        </section>

        <aside className="editor-side">
          <section className="panel">
            <h3>Graph</h3>
            <label className="field">
              Name
              <input value={g.name} onChange={(e) => change((o) => ({ ...o, name: e.target.value }))} />
            </label>
            <label className="field">
              Description
              <textarea rows={2} value={g.description ?? ''} onChange={(e) => change((o) => ({ ...o, description: e.target.value }))} />
            </label>
            <div className="field-row">
              <label className="field">
                Start
                <select value={g.start} onChange={(e) => change((o) => ({ ...o, start: e.target.value }))}>
                  <option value="">-</option>
                  {sortedIds.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Goal
                <select value={g.goal} onChange={(e) => change((o) => ({ ...o, goal: e.target.value }))}>
                  <option value="">-</option>
                  {sortedIds.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                Difficulty tag
                <select value={g.difficulty} onChange={(e) => change((o) => ({ ...o, difficulty: e.target.value as Difficulty }))}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                DLS limit
                <NumberInput label="DLS limit" value={g.dlsLimit} onChange={(v) => change((o) => ({ ...o, dlsLimit: v === undefined ? undefined : Math.max(0, Math.floor(v)) }))} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={g.directed} onChange={(e) => setDirected(e.target.checked)} /> Directed edges
            </label>
            <label className="check">
              <input type="checkbox" checked={g.weighted} onChange={(e) => change((o) => ({ ...o, weighted: e.target.checked }))} /> Weighted (else every edge costs 1)
            </label>
            <label className="check">
              <input type="checkbox" checked={useH} onChange={(e) => setUseH(e.target.checked)} /> Heuristic values h (for Greedy / A*)
            </label>
            {useH && (
              <div className="button-row">
                <button className="btn small" onClick={perfectH} disabled={!g.goal}>
                  Set h = true cost (perfect)
                </button>
                <button className="btn small" onClick={() => change((o) => ({ ...o, nodes: o.nodes.map((n) => ({ ...n, h: 0 })) }))}>
                  Set all h = 0
                </button>
              </div>
            )}
          </section>

          {node && (
            <section className="panel">
              <h3>Node {node.id}</h3>
              <div className="field-row">
                <label className="field">
                  Name
                  <input value={renameText} onChange={(e) => setRenameText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename()} onBlur={rename} />
                </label>
                {useH && (
                  <label className="field">
                    h
                    <NumberInput
                      label={`h of ${node.id}`}
                      value={node.h}
                      onChange={(v) => change((o) => ({ ...o, nodes: o.nodes.map((n) => (n.id === node.id ? { ...n, h: v ?? 0 } : n)) }))}
                    />
                  </label>
                )}
              </div>
              {renameError && <p className="error-text small">{renameError}</p>}
              <div className="button-row">
                <button className="btn small" onClick={() => change((o) => ({ ...o, start: node.id }))} disabled={g.start === node.id}>
                  Make start
                </button>
                <button className="btn small" onClick={() => change((o) => ({ ...o, goal: node.id }))} disabled={g.goal === node.id}>
                  Make goal
                </button>
                <button className="btn small danger" onClick={() => deleteNode(node.id)}>
                  Delete node
                </button>
              </div>
            </section>
          )}

          {edge && selEdge !== null && (
            <section className="panel">
              <h3>
                Edge {edge.from} {g.directed ? '→' : '–'} {edge.to}
              </h3>
              {g.weighted && (
                <label className="field">
                  Cost
                  <NumberInput label="Edge cost" value={edge.w} onChange={(v) => updateEdge(selEdge, { w: v ?? 0 })} />
                </label>
              )}
              <div className="button-row">
                {g.directed && (
                  <>
                    <button className="btn small" onClick={() => updateEdge(selEdge, { from: edge.to, to: edge.from })}>
                      Flip direction
                    </button>
                    {!g.edges.some((e) => e.from === edge.to && e.to === edge.from) && (
                      <button className="btn small" onClick={() => addEdge(edge.to, edge.from)}>
                        Add reverse edge
                      </button>
                    )}
                  </>
                )}
                <button className="btn small danger" onClick={() => deleteEdge(selEdge)}>
                  Delete edge
                </button>
              </div>
            </section>
          )}

          <section className="panel">
            <h3>Play this graph</h3>
            {!savedOnce || dirty ? (
              <p className="muted small">Save the graph first.</p>
            ) : validation.errors.length > 0 ? (
              <p className="muted small">Fix the errors first.</p>
            ) : (
              <>
                <div className="tabs small-tabs">
                  {DIFFICULTIES.map((d) => (
                    <button key={d} className={`tab${d === playDiff ? ' selected' : ''}`} onClick={() => setPlayDiff(d)}>
                      {d}
                    </button>
                  ))}
                </div>
                <div className="chips">
                  {ALGO_IDS.filter((a) => isApplicable(a, g)).map((a) => (
                    <Link key={a} className="chip link" to={`/play/${a}/${playDiff}/${g.id}`}>
                      {ALGOS[a].abbr}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
