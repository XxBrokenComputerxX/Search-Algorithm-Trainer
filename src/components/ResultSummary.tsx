import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { defaultLimit, isApplicable, runAlgorithm } from '../engine/algorithms';
import type { Difficulty, Graph } from '../engine/graph';
import { ALGOS } from '../engine/properties';
import { ALGO_IDS, countExpanded, type AlgoId, type Trace } from '../engine/trace';
import { checkHeuristic } from '../engine/heuristicCheck';
import { Stars } from './common';

export interface RaceRow {
  algo: AlgoId;
  trace: Trace;
  cost: number | null;
  expanded: number;
}

export function raceAll(graph: Graph, dlsLimit?: number): RaceRow[] {
  return ALGO_IDS.filter((a) => isApplicable(a, graph)).map((algo) => {
    const trace = runAlgorithm(algo, graph, algo === 'dls' ? (dlsLimit ?? defaultLimit(graph)) : undefined);
    return { algo, trace, cost: trace.solution?.g ?? null, expanded: countExpanded(trace) };
  });
}

function insight(algo: AlgoId, graph: Graph, cost: number | null, best: number | null): string | null {
  if (cost === null || best === null) return null;
  if (cost === best) {
    if (algo === 'bfs' || algo === 'ids')
      return graph.weighted
        ? `${ALGOS[algo].abbr} happened to find a cheapest path here - but only because the path with the fewest edges is also cheapest. On weighted graphs that is luck, not a guarantee.`
        : `On an unweighted graph every edge costs 1, so ${ALGOS[algo].abbr} is optimal: it finds the path with the fewest edges.`;
    if (algo === 'dfs' || algo === 'dls' || algo === 'greedy')
      return `${ALGOS[algo].abbr} found a cheapest path this time - but it is not optimal in general. Try it on another graph!`;
    return `${ALGOS[algo].abbr} is optimal${algo === 'astar' ? ' with a consistent heuristic' : ''}: no cheaper path exists.`;
  }
  const extra = `${ALGOS[algo].abbr} found a path of cost ${cost}, but the cheapest path costs ${best}.`;
  switch (algo) {
    case 'bfs':
    case 'ids':
      return `${extra} ${ALGOS[algo].abbr} minimises the number of edges, not the total cost. Use UCS or A* on weighted graphs.`;
    case 'dfs':
    case 'dls':
      return `${extra} Depth-first search returns the first goal it stumbles upon.`;
    case 'greedy':
      return `${extra} Greedy follows the heuristic and ignores the cost already paid.`;
    case 'astar': {
      const r = checkHeuristic(graph);
      return `${extra} That can only happen when the heuristic is not ${r.admissible ? 'consistent' : 'admissible'}: ${
        r.admissible ? 'graph-search A* never reopens an explored node, so the cheap route was discarded.' : 'h overestimates somewhere.'
      }`;
    }
    case 'ucs':
      return extra;
  }
}

interface Props {
  trace: Trace;
  difficulty: Difficulty;
  stars: number;
  mistakes: number;
  hints: number;
  reveals: number;
  onRestart: () => void;
}

export function ResultSummary({ trace, difficulty, stars, mistakes, hints, reveals, onRestart }: Props) {
  const { algo, graph } = trace;
  const race = useMemo(() => raceAll(graph, trace.limit), [graph, trace.limit]);
  const costs = race.map((r) => r.cost).filter((c): c is number => c !== null);
  const best = race.find((r) => r.algo === 'ucs')?.cost ?? (costs.length ? Math.min(...costs) : null);
  const cost = trace.solution?.g ?? null;
  const text = insight(algo, graph, cost, best);
  const harder: Difficulty | null = difficulty === 'easy' ? 'medium' : difficulty === 'medium' ? 'hard' : null;
  const limitQuery = trace.limit !== undefined ? `?limit=${trace.limit}` : '';

  return (
    <div className="result">
      <div className="result-head">
        <Stars value={stars} size="lg" />
        <div>
          <h3>
            {trace.status === 'solution'
              ? `Solution found: ${trace.solution!.path.join(' → ')}`
              : trace.status === 'cutoff'
                ? 'Result: cutoff'
                : 'Result: failure'}
          </h3>
          <p className="muted">
            {trace.status === 'solution' && <>Path cost {cost} · </>}
            {mistakes} mistake{mistakes === 1 ? '' : 's'} · {hints} hint{hints === 1 ? '' : 's'} · {reveals} answer{reveals === 1 ? '' : 's'} shown
          </p>
        </div>
      </div>
      {text && <div className="callout">{text}</div>}
      {trace.status === 'cutoff' && (
        <div className="callout">
          The goal is deeper than the limit ℓ = {trace.limit}. DLS is not complete when ℓ &lt; d - that is exactly the problem iterative deepening
          solves.
        </div>
      )}

      <h4>Same graph, every algorithm</h4>
      <div className="table-wrap">
        <table className="race-table">
          <thead>
            <tr>
              <th>Algorithm</th>
              <th>Path found</th>
              <th>Cost</th>
              <th>Expanded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {race.map((r) => (
              <tr key={r.algo} className={r.algo === algo ? 'current' : undefined}>
                <th scope="row">
                  {ALGOS[r.algo].abbr}
                  {r.algo === 'dls' && <span className="muted small"> (ℓ={r.trace.limit})</span>}
                </th>
                <td className="small">{r.trace.solution ? r.trace.solution.path.join('→') : r.trace.status}</td>
                <td>
                  {r.cost ?? '-'}
                  {r.cost !== null && best !== null && (r.cost === best ? <span className="ok-mark"> ✓</span> : <span className="bad-mark"> ✗</span>)}
                </td>
                <td>{r.expanded}</td>
                <td>
                  {r.algo !== algo && (
                    <Link className="small" to={`/play/${r.algo}/${difficulty}/${graph.id}${r.algo === 'dls' ? limitQuery : ''}`}>
                      play
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">✓ = cheapest possible cost. “Expanded” counts nodes whose successors were generated (all IDS iterations together).</p>

      <div className="button-row">
        <button className="btn" onClick={onRestart}>
          Play again
        </button>
        {harder && (
          <Link className="btn primary" to={`/algo/${algo}?difficulty=${harder}`}>
            Try {harder} →
          </Link>
        )}
        <Link className="btn ghost" to={`/algo/${algo}`}>
          Choose another graph
        </Link>
      </div>
    </div>
  );
}
