import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PropertiesTable } from '../components/PropertiesTable';
import { RulesList } from '../components/Explanation';
import { GraphCanvas } from '../components/GraphCanvas';
import { raceAll } from '../components/ResultSummary';
import { BUILTIN_GRAPHS } from '../data/graphs';
import { defaultLimit } from '../engine/algorithms';
import { ALGOS } from '../engine/properties';
import { expansionOrder } from '../engine/trace';
import { useCustomGraphs } from '../state/graphs';
import { QUIZ } from '../content/quiz';

export function ComparePage() {
  return (
    <div className="page">
      <h1>Compare the algorithms</h1>
      <p className="lead">
        Seven algorithms, one loop: take a node out of the frontier, test it, expand it. What differs is <em>which</em> node comes out next - and
        that decides whether the algorithm is complete and optimal.
      </p>

      <section className="panel">
        <h2>Properties at a glance</h2>
        <PropertiesTable full />
      </section>

      <Race />
      <Quiz />

      <section className="panel">
        <RulesList />
      </section>
    </div>
  );
}

function Race() {
  const custom = useCustomGraphs();
  const graphs = [...BUILTIN_GRAPHS, ...custom];
  const [graphId, setGraphId] = useState(graphs[0].id);
  const graph = graphs.find((g) => g.id === graphId) ?? graphs[0];
  const [limit, setLimit] = useState<number | null>(null);
  const effLimit = limit ?? defaultLimit(graph);
  const rows = useMemo(() => raceAll(graph, effLimit), [graph, effLimit]);
  const best = rows.find((r) => r.algo === 'ucs')?.cost ?? null;

  return (
    <section className="panel">
      <h2>Algorithm race</h2>
      <p className="muted">Every algorithm on the same graph: which nodes it takes out of the frontier, which path it returns, and what that path costs.</p>
      <div className="race-controls">
        <label className="inline-field">
          Graph
          <select
            value={graph.id}
            onChange={(e) => {
              setGraphId(e.target.value);
              setLimit(null);
            }}
          >
            {graphs.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.custom ? 'custom' : g.difficulty})
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          DLS limit ℓ
          <input
            type="number"
            min={0}
            max={30}
            className="num"
            style={{ width: '5ch' }}
            value={effLimit}
            onChange={(e) => setLimit(Math.max(0, Math.min(30, Math.floor(Number(e.target.value) || 0))))}
          />
        </label>
      </div>
      <div className="race-layout">
        <div className="canvas-card small-canvas">
          <GraphCanvas graph={graph} />
        </div>
        <div className="table-wrap">
          <table className="race-table">
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>Taken from frontier (in order)</th>
                <th>Result</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.algo}>
                  <th scope="row">
                    <Link to={`/algo/${r.algo}`}>{ALGOS[r.algo].abbr}</Link>
                  </th>
                  <td className="small order-cell">
                    {r.algo === 'ids'
                      ? r.trace.rounds.map((round) => (
                          <div key={round.limit}>
                            <span className="muted">ℓ={round.limit}:</span> {round.steps.map((s) => s.pop.node).join(' ')}
                          </div>
                        ))
                      : expansionOrder(r.trace).join(' ')}
                  </td>
                  <td className="small">{r.trace.solution ? r.trace.solution.path.join('→') : r.trace.status}</td>
                  <td>
                    {r.cost ?? '-'}
                    {r.cost !== null && best !== null && (r.cost === best ? <span className="ok-mark"> ✓</span> : <span className="bad-mark"> ✗</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {graph.note && <div className="callout warn">{graph.note}</div>}
    </section>
  );
}

function Quiz() {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const correct = QUIZ.filter((q, i) => answers[i] === q.answer).length;
  const answered = Object.keys(answers).length;

  return (
    <section className="panel">
      <h2>Quick quiz</h2>
      <p className="muted">
        Test yourself on completeness, optimality and frontiers. {answered > 0 && `Score: ${correct} / ${answered}`}
        {answered > 0 && (
          <button className="btn tiny ghost" onClick={() => setAnswers({})} style={{ marginLeft: '0.5rem' }}>
            reset
          </button>
        )}
      </p>
      <ol className="quiz">
        {QUIZ.map((q, i) => {
          const picked = answers[i];
          return (
            <li key={i}>
              <p className="quiz-q">{q.question}</p>
              <div className="quiz-options">
                {q.options.map((o, j) => (
                  <button
                    key={j}
                    className={`btn quiz-opt${picked === undefined ? '' : j === q.answer ? ' right' : j === picked ? ' wrong' : ''}`}
                    disabled={picked !== undefined}
                    onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}
                  >
                    {o}
                  </button>
                ))}
              </div>
              {picked !== undefined && <p className={`quiz-why ${picked === q.answer ? 'ok' : 'bad'}`}>{q.why}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
