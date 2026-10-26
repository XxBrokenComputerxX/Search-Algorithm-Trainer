import { Link, useSearchParams } from 'react-router-dom';
import { Stars, VerdictBadge } from '../components/common';
import { DIFFICULTY_INFO } from '../content/explanations';
import { DIFFICULTIES } from '../engine/graph';
import { ALGOS, INFORMED_IDS, UNINFORMED } from '../engine/properties';
import { bestStars, useProgress } from '../state/progress';

type Family = 'uninformed' | 'informed';

const FAMILIES: { id: Family; title: string; text: string; icon: string; algos: string }[] = [
  {
    id: 'uninformed',
    title: 'Uninformed search',
    text: 'The algorithm knows nothing about where the goal is - it can only tell a goal apart from a non-goal. Strategies differ only in the order nodes are expanded.',
    icon: '🧭',
    algos: 'BFS · UCS · DFS · DLS · IDS',
  },
  {
    id: 'informed',
    title: 'Informed search',
    text: 'The algorithm gets a heuristic h(n) - an estimate of the remaining cost to the goal - and uses it to expand the most promising nodes first.',
    icon: '🎯',
    algos: 'Greedy best-first · A*',
  },
];

export function StartPage() {
  const [params, setParams] = useSearchParams();
  const family = params.get('family') as Family | null;
  const progress = useProgress();
  const algos = family === 'informed' ? INFORMED_IDS : family === 'uninformed' ? UNINFORMED : [];

  return (
    <div className="page">
      <section className="hero">
        <h1>Search Algorithm Trainer</h1>
        <p className="lead">
          Don't just watch search algorithms - <strong>run them yourself</strong>. Pick the next node, manage the frontier, spot the goal, and get
          instant feedback that explains every mistake.
        </p>
      </section>

      <section>
        <h2 className="section-title">1. What do you want to learn?</h2>
        <div className="family-grid" role="radiogroup" aria-label="Algorithm family">
          {FAMILIES.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={family === f.id}
              className={`family-card${family === f.id ? ' selected' : ''}`}
              onClick={() => setParams(family === f.id ? {} : { family: f.id }, { replace: true })}
            >
              <span className="family-icon" aria-hidden="true">
                {f.icon}
              </span>
              <span className="family-title">{f.title}</span>
              <span className="family-text">{f.text}</span>
              <span className="family-algos">{f.algos}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">2. Pick an algorithm</h2>
        {algos.length === 0 ? (
          <p className="muted empty-hint">Choose uninformed or informed search above to see its algorithms.</p>
        ) : (
          <div className="algo-grid">
            {algos.map((id) => {
              const a = ALGOS[id];
              return (
                <Link key={id} to={`/algo/${id}`} className="algo-card">
                  <span className="algo-abbr">{a.abbr}</span>
                  <span className="algo-name">{a.name}</span>
                  <span className="algo-tagline">{a.tagline}</span>
                  <span className="algo-badges">
                    <span className="badge">{a.frontier}</span>
                  </span>
                  <span className="algo-props">
                    <span>
                      Complete <VerdictBadge p={a.complete} />
                    </span>
                    <span>
                      Optimal <VerdictBadge p={a.optimal} />
                    </span>
                  </span>
                  <span className="algo-progress">
                    {DIFFICULTIES.map((d) => (
                      <span key={d} className="progress-item">
                        <span className="muted small">{DIFFICULTY_INFO[d].label}</span>
                        <Stars value={bestStars(progress, id, d)} size="sm" />
                      </span>
                    ))}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="how">
        <h2 className="section-title">How it works</h2>
        <div className="how-grid">
          {DIFFICULTIES.map((d) => (
            <div key={d} className="how-card">
              <span className={`diff-tag ${d}`}>{DIFFICULTY_INFO[d].label}</span>
              <p>{DIFFICULTY_INFO[d].task}</p>
            </div>
          ))}
        </div>
        <div className="link-row">
          <Link to="/compare" className="btn">
            Compare all algorithms
          </Link>
          <Link to="/editor" className="btn">
            Build your own graph
          </Link>
        </div>
      </section>
    </div>
  );
}
