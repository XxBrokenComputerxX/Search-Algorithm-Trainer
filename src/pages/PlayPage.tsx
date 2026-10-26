import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { GraphCanvas, GraphLegend, type NodeTone } from '../components/GraphCanvas';
import { FrontierPanel } from '../components/FrontierPanel';
import { ChildrenTable } from '../components/ChildrenTable';
import { FrontierEditor } from '../components/FrontierEditor';
import { Pseudocode } from '../components/Pseudocode';
import { CompareSidebar } from '../components/PropertiesTable';
import { ExplanationDrawer } from '../components/Explanation';
import { ResultSummary } from '../components/ResultSummary';
import { NumberInput, Panel, Stars } from '../components/common';
import type { LineTag } from '../content/explanations';
import { DIFFICULTY_INFO } from '../content/explanations';
import { isApplicable, runAlgorithm } from '../engine/algorithms';
import { FRONTIER_KIND, HAS_LIMIT, USES_EXPLORED } from '../engine/conventions';
import { DIFFICULTIES, type Difficulty, type Graph } from '../engine/graph';
import { ALGOS } from '../engine/properties';
import { ALGO_IDS, goalChild, type AlgoId } from '../engine/trace';
import { correctDraft, createSession, currentRound, currentStep, gameReducer, phaseTitle, stars, view, type Session } from '../game/session';
import { findGraph, useCustomGraphs } from '../state/graphs';
import { recordResult } from '../state/progress';

export function PlayPage() {
  const { algo, difficulty, graphId } = useParams();
  const [params] = useSearchParams();
  useCustomGraphs(); // re-render if custom graphs load/change
  const [restarts, setRestarts] = useState(0);

  const graph = graphId ? findGraph(graphId) : undefined;
  const a = ALGO_IDS.find((x) => x === algo);
  const d = DIFFICULTIES.find((x) => x === difficulty);
  const rawLimit = Number(params.get('limit'));
  const limit = Number.isInteger(rawLimit) && rawLimit >= 0 && params.get('limit') !== null ? rawLimit : undefined;

  if (!graph || !a || !d) {
    return (
      <div className="page narrow">
        <h1>Game not found</h1>
        <p>That algorithm, difficulty or graph doesn't exist (custom graphs live only in the browser where they were made).</p>
        <Link to="/" className="btn primary">
          Back to start
        </Link>
      </div>
    );
  }
  if (!isApplicable(a, graph)) {
    return (
      <div className="page narrow">
        <h1>No heuristic on this graph</h1>
        <p>{ALGOS[a].name} needs a heuristic value h on every node. Add them in the graph editor first.</p>
        <Link to={`/algo/${a}`} className="btn primary">
          Choose another graph
        </Link>
      </div>
    );
  }
  return (
    <Game
      key={`${a}-${graph.id}-${d}-${limit}-${restarts}`}
      algo={a}
      graph={graph}
      difficulty={d}
      limit={limit}
      onRestart={() => setRestarts((n) => n + 1)}
    />
  );
}

function activeLines(s: Session): LineTag[] {
  const step = currentStep(s);
  switch (s.phase) {
    case 'pick':
      return step ? ['pop'] : ['empty'];
    case 'decide':
      return HAS_LIMIT[s.trace.algo] ? ['goal', 'cutoff'] : s.trace.algo === 'bfs' ? ['pop'] : ['goal'];
    case 'children':
    case 'edit':
      return ['explored', 'expand', 'goal-gen'];
    case 'final':
    case 'done':
      if (s.trace.status !== 'solution') return ['empty'];
      return s.trace.algo === 'bfs' ? ['goal-gen'] : ['goal'];
  }
}

function Game({ algo, graph, difficulty, limit, onRestart }: { algo: AlgoId; graph: Graph; difficulty: Difficulty; limit?: number; onRestart: () => void }) {
  const trace = useMemo(() => runAlgorithm(algo, graph, limit), [algo, graph, limit]);
  const [s, dispatch] = useReducer(gameReducer, trace, (t) => createSession(t, difficulty));
  const [explainOpen, setExplainOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [clicked, setClicked] = useState<{ node: string; n: number } | null>(null);
  const [finalPath, setFinalPath] = useState<string[]>([]);
  const [finalCost, setFinalCost] = useState<number | undefined>(undefined);
  const recorded = useRef(false);

  const v = view(s);
  const step = currentStep(s);
  const meta = ALGOS[algo];
  const lastLog = s.log[s.log.length - 1];
  const kind = FRONTIER_KIND[algo];

  useEffect(() => {
    if (s.phase === 'done' && !recorded.current) {
      recorded.current = true;
      recordResult(algo, difficulty, graph.id, stars(s));
    }
  }, [s, algo, difficulty, graph.id]);

  // ---- graph colouring
  const tones: Record<string, NodeTone> = {};
  for (const r of v.removed) tones[r.node] = r.decision === 'cutoff' ? 'cutoff' : 'explored';
  for (const n of v.explored) tones[n] = 'explored';
  for (const e of v.frontier) tones[e.node] = 'frontier';
  if (v.current) tones[v.current.node] = 'current';
  if (s.phase === 'done' && step && goalChild(step)) tones[goalChild(step)!.node] = 'current';
  if (v.solutionPath) for (const n of v.solutionPath) tones[n] = 'path';
  if (s.phase === 'final') for (const n of finalPath) tones[n] = 'selected';

  const treeEdges: [string, string][] = [
    ...v.removed.filter((r) => r.parent).map((r) => [r.parent!, r.node] as [string, string]),
    ...v.frontier.filter((e) => e.parent).map((e) => [e.parent!, e.node] as [string, string]),
  ];
  const pathEdges: [string, string][] = [];
  const pathNodes = v.solutionPath ?? (s.phase === 'final' ? finalPath : []);
  for (let i = 1; i < pathNodes.length; i++) pathEdges.push([pathNodes[i - 1], pathNodes[i]]);

  const pickable = s.phase === 'pick' && !!step;
  const onNodeClick = (id: string) => {
    if (pickable) {
      const matches = step!.before.frontier.filter((e) => e.node === id);
      if (matches.length === 1) dispatch({ type: 'pick', key: matches[0].key });
    } else if (s.phase === 'edit') {
      setClicked((c) => ({ node: id, n: (c?.n ?? 0) + 1 }));
    } else if (s.phase === 'final') {
      setFinalPath((p) => [...p, id]);
    }
  };
  const clickable = (id: string) =>
    pickable ? step!.before.frontier.filter((e) => e.node === id).length === 1 : s.phase === 'edit' || s.phase === 'final';

  const round = currentRound(s);

  return (
    <div className={`play${sidebarOpen ? '' : ' no-sidebar'}`}>
      <header className="play-head">
        <div>
          <div className="crumbs">
            <Link to="/">Start</Link> / <Link to={`/algo/${algo}`}>{meta.abbr}</Link> / {graph.name}
          </div>
          <h1>
            {meta.name} <span className={`diff-tag ${difficulty}`}>{DIFFICULTY_INFO[difficulty].label}</span>
          </h1>
        </div>
        <div className="play-stats">
          {HAS_LIMIT[algo] && (
            <span className="stat" title="Current depth limit">
              ℓ = {v.limit}
              {algo === 'ids' && <span className="muted small"> (iteration {s.round + 1})</span>}
            </span>
          )}
          <span className="stat" title="Mistakes">
            ✗ {s.mistakes}
          </span>
          <span className="stat" title="Hints used">
            💡 {s.hintsUsed}
          </span>
          <button className="btn" onClick={() => setExplainOpen(true)}>
            Explain {meta.abbr}
          </button>
          <button className="btn ghost" onClick={onRestart}>
            Restart
          </button>
          <button className="btn ghost" onClick={() => setSidebarOpen((o) => !o)} aria-pressed={sidebarOpen}>
            {sidebarOpen ? 'Hide' : 'Show'} comparison
          </button>
        </div>
      </header>

      <div className="play-grid">
        <section className="board">
          <div className="canvas-card">
            <GraphCanvas
              graph={graph}
              tones={tones}
              treeEdges={treeEdges}
              pathEdges={pathEdges}
              activeNode={s.phase === 'children' || s.phase === 'edit' ? v.current?.node : null}
              showH={meta.family === 'informed'}
              onNodeClick={onNodeClick}
              isClickable={clickable}
            />
            <GraphLegend showLimit={HAS_LIMIT[algo]} />
            <p className="muted small graph-meta">
              {graph.directed ? 'Directed' : 'Undirected'} · {graph.weighted ? 'weighted' : 'unweighted (every edge costs 1)'} · start {graph.start} ·
              goal {graph.goal}
            </p>
          </div>

          {lastLog && (
            <div className={`feedback ${lastLog.kind}`} role="status" aria-live="polite">
              {lastLog.text}
            </div>
          )}

          <details className="log">
            <summary>History ({s.log.length})</summary>
            <ol>
              {s.log.map((e) => (
                <li key={e.id} className={e.kind}>
                  {e.text}
                </li>
              ))}
            </ol>
          </details>
        </section>

        <section className="work">
          <Panel
            className="task"
            title={phaseTitle(s)}
            actions={
              s.phase !== 'done' && (
                <>
                  <button className="btn small" onClick={() => dispatch({ type: 'hint' })} disabled={s.hintLevel >= 2}>
                    Hint {s.hintLevel > 0 ? `(${s.hintLevel}/2)` : ''}
                  </button>
                  <button className="btn small ghost" onClick={() => dispatch({ type: 'reveal' })}>
                    Show answer
                  </button>
                </>
              )
            }
          >
            {s.phase === 'pick' && (
              <>
                <p className="muted small">
                  {step
                    ? `Click an entry in the frontier below${difficulty !== 'hard' || kind === 'pq' ? ' or a node on the graph' : ''}.`
                    : 'Nothing is left to expand.'}{' '}
                  {DIFFICULTY_INFO[difficulty].task}
                </p>
                <div className="button-row">
                  <button className="btn" onClick={() => dispatch({ type: 'end', result: 'failure' })}>
                    Frontier empty → return failure
                  </button>
                  {HAS_LIMIT[algo] && (
                    <button className="btn" onClick={() => dispatch({ type: 'end', result: 'cutoff' })}>
                      Frontier empty → return cutoff{algo === 'ids' ? ' (increase ℓ)' : ''}
                    </button>
                  )}
                </div>
              </>
            )}

            {s.phase === 'decide' && v.current && (
              <>
                <p>
                  <strong>{v.current.node}</strong>
                  <span className="muted">
                    {' '}
                    - path {v.current.path.join(' → ')}, g = {v.current.g}, depth {v.current.depth}
                  </span>
                </p>
                <div className="button-row">
                  <button className="btn" onClick={() => dispatch({ type: 'decide', decision: 'goal' })}>
                    Goal test passes → return solution
                  </button>
                  {HAS_LIMIT[algo] && (
                    <button className="btn" onClick={() => dispatch({ type: 'decide', decision: 'cutoff' })}>
                      Depth limit reached → cutoff
                    </button>
                  )}
                  <button className="btn primary" onClick={() => dispatch({ type: 'decide', decision: 'expand' })}>
                    Expand {v.current.node}
                  </button>
                </div>
              </>
            )}

            {s.phase === 'children' && v.current && (
              <ChildrenTable key={v.current.key} algo={algo} graph={graph} parent={v.current} feedback={s.childFeedback} onSubmit={(rows) => dispatch({ type: 'children', rows })} />
            )}

            {s.phase === 'edit' && v.current && (
              <FrontierEditor
                key={`${s.round}-${s.step}`}
                algo={algo}
                graph={graph}
                expanding={v.current}
                initialFrontier={correctDraft(s, v.frontier)}
                initialExplored={v.explored}
                problems={s.editProblems}
                clicked={clicked}
                onSubmit={(frontier, explored) => dispatch({ type: 'edit', frontier, explored })}
                onGoalGenerated={() => dispatch({ type: 'goal-generated' })}
              />
            )}

            {s.phase === 'final' && (
              <div className="final">
                <p className="muted small">Click the nodes of the path on the graph, from start to goal.</p>
                <div className="chips path-chips">
                  {finalPath.length === 0 ? <span className="muted">(no nodes yet)</span> : finalPath.map((n, i) => <span key={i} className="chip on">{n}</span>)}
                </div>
                <div className="button-row">
                  <button className="btn small" onClick={() => setFinalPath((p) => p.slice(0, -1))} disabled={!finalPath.length}>
                    Undo
                  </button>
                  <button className="btn small" onClick={() => setFinalPath([])} disabled={!finalPath.length}>
                    Clear
                  </button>
                  <label className="inline-field">
                    Path cost
                    <NumberInput label="Path cost" value={finalCost} onChange={setFinalCost} width={6} />
                  </label>
                  <button className="btn primary" onClick={() => dispatch({ type: 'final', path: finalPath, cost: finalCost })}>
                    Submit answer
                  </button>
                </div>
              </div>
            )}

            {s.phase === 'done' && (
              <ResultSummary
                trace={trace}
                difficulty={difficulty}
                stars={stars(s)}
                mistakes={s.mistakes}
                hints={s.hintsUsed}
                reveals={s.reveals}
                onRestart={onRestart}
              />
            )}
          </Panel>

          {s.phase !== 'edit' && (
          <Panel
            title={
              <>
                Frontier <span className="count">{v.frontier.length}</span>
              </>
            }
          >
            <FrontierPanel
              algo={algo}
              entries={v.frontier}
              ordered={difficulty === 'hard' && kind !== 'pq'}
              onPick={pickable ? (key) => dispatch({ type: 'pick', key }) : undefined}
            />
          </Panel>
          )}

          {USES_EXPLORED[algo] ? (
            <div className="two-col">
              <Panel title="Explored set">
                <div className="chips">
                  {v.explored.length ? v.explored.map((n) => <span key={n} className="chip explored">{n}</span>) : <span className="empty-note">(empty)</span>}
                </div>
              </Panel>
              <Panel title="Order taken from frontier">
                <div className="chips">
                  {v.removed.length ? (
                    v.removed.map((r, i) => (
                      <span key={i} className="chip">
                        {i + 1}. {r.node}
                      </span>
                    ))
                  ) : (
                    <span className="empty-note">(nothing yet)</span>
                  )}
                </div>
              </Panel>
            </div>
          ) : (
            <Panel title={`Taken from frontier this round (ℓ = ${round.limit})`}>
              <p className="muted small">No explored set - DLS only avoids cycles on the current path. ✂ = cut off at the depth limit.</p>
              <div className="chips">
                {v.removed.length ? (
                  v.removed.map((r, i) => (
                    <span key={i} className={`chip ${r.decision === 'cutoff' ? 'cutoff' : 'explored'}`} title={r.decision}>
                      {i + 1}. {r.node}
                      {r.decision === 'cutoff' ? ' ✂' : ''}
                    </span>
                  ))
                ) : (
                  <span className="empty-note">(nothing yet)</span>
                )}
              </div>
            </Panel>
          )}

          <Panel title="Pseudocode">
            <Pseudocode algo={algo} active={activeLines(s)} />
          </Panel>
        </section>

        {sidebarOpen && (
          <aside className="sidebar">
            <CompareSidebar algo={algo} note={graph.note} />
            <div className="sidebar-stars">
              <span className="muted small">Score so far</span>
              <Stars value={stars(s)} />
            </div>
          </aside>
        )}
      </div>

      <ExplanationDrawer algo={algo} open={explainOpen} onClose={() => setExplainOpen(false)} />
    </div>
  );
}
