import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ExplanationContent } from '../components/Explanation';
import { Stars, VerdictBadge } from '../components/common';
import { DIFFICULTY_INFO } from '../content/explanations';
import { BUILTIN_GRAPHS } from '../data/graphs';
import { defaultLimit, isApplicable } from '../engine/algorithms';
import { DIFFICULTIES, type Difficulty, type Graph } from '../engine/graph';
import { ALGOS } from '../engine/properties';
import { ALGO_IDS, type AlgoId } from '../engine/trace';
import { useCustomGraphs } from '../state/graphs';
import { graphStars, useProgress } from '../state/progress';

export function AlgorithmPage() {
  const { algo } = useParams();
  const a = ALGO_IDS.find((x) => x === algo);
  const [params, setParams] = useSearchParams();
  const custom = useCustomGraphs();

  if (!a) {
    return (
      <div className="page narrow">
        <h1>Unknown algorithm</h1>
        <Link to="/">Back to start</Link>
      </div>
    );
  }
  const meta = ALGOS[a];
  const difficulty = (DIFFICULTIES.find((d) => d === params.get('difficulty')) ?? 'easy') as Difficulty;
  const builtins = BUILTIN_GRAPHS.filter((g) => g.difficulty === difficulty && isApplicable(a, g));
  const mine = custom.filter((g) => isApplicable(a, g));
  const hiddenCustom = custom.length - mine.length;

  return (
    <div className="page">
      <div className="crumbs">
        <Link to={`/?family=${meta.family}`}>← {meta.family === 'informed' ? 'Informed' : 'Uninformed'} search</Link>
      </div>
      <header className="algo-head">
        <span className="algo-abbr big">{meta.abbr}</span>
        <div>
          <h1>{meta.name}</h1>
          <p className="lead">{meta.tagline}</p>
          <div className="algo-props">
            <span>
              Complete <VerdictBadge p={meta.complete} />
            </span>
            <span>
              Optimal <VerdictBadge p={meta.optimal} />
            </span>
            <span className="badge">{meta.frontier}</span>
            <span className="badge">goal test {meta.goalTest}</span>
          </div>
        </div>
      </header>

      <div className="algo-layout">
        <section className="panel play-setup">
          <h2>Play</h2>
          <div className="tabs" role="tablist" aria-label="Difficulty">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                role="tab"
                aria-selected={d === difficulty}
                className={`tab${d === difficulty ? ' selected' : ''}`}
                onClick={() => setParams({ difficulty: d }, { replace: true })}
              >
                {DIFFICULTY_INFO[d].label}
              </button>
            ))}
          </div>
          <p className="muted">{DIFFICULTY_INFO[difficulty].task}</p>

          <h3>Graphs</h3>
          <ul className="graph-list">
            {builtins.map((g) => (
              <GraphItem key={g.id} graph={g} algo={a} difficulty={difficulty} />
            ))}
          </ul>

          <h3>Your graphs</h3>
          {mine.length === 0 ? (
            <p className="muted small">
              No custom graphs{hiddenCustom > 0 ? ` with a heuristic (${hiddenCustom} without one are hidden - informed search needs h on every node)` : ' yet'}.{' '}
              <Link to="/editor">Build one in the editor →</Link>
            </p>
          ) : (
            <ul className="graph-list">
              {mine.map((g) => (
                <GraphItem key={g.id} graph={g} algo={a} difficulty={difficulty} />
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>How {meta.abbr} works</h2>
          <ExplanationContent algo={a} />
        </section>
      </div>
    </div>
  );
}

function GraphItem({ graph, algo, difficulty }: { graph: Graph; algo: AlgoId; difficulty: Difficulty }) {
  const progress = useProgress();
  const [limit, setLimit] = useState(defaultLimit(graph));
  const query = algo === 'dls' ? `?limit=${limit}` : '';
  return (
    <li className="graph-item">
      <div className="graph-item-main">
        <div className="graph-item-title">
          <strong>{graph.name}</strong>
          <Stars value={graphStars(progress, algo, difficulty, graph.id)} size="sm" />
        </div>
        {graph.description && <p className="small muted">{graph.description}</p>}
        <div className="tags">
          <span className="badge">{graph.directed ? 'directed' : 'undirected'}</span>
          <span className="badge">{graph.weighted ? 'weighted' : 'unweighted'}</span>
          <span className="badge">{graph.nodes.length} nodes</span>
          {graph.custom && <span className="badge">custom · {graph.difficulty}</span>}
        </div>
      </div>
      <div className="graph-item-actions">
        {algo === 'dls' && (
          <label className="inline-field small">
            limit ℓ
            <input
              type="number"
              min={0}
              max={30}
              className="num"
              style={{ width: '5ch' }}
              value={limit}
              onChange={(e) => setLimit(Math.max(0, Math.min(30, Math.floor(Number(e.target.value) || 0))))}
            />
          </label>
        )}
        <Link className="btn primary" to={`/play/${algo}/${difficulty}/${graph.id}${query}`}>
          Play
        </Link>
      </div>
    </li>
  );
}
