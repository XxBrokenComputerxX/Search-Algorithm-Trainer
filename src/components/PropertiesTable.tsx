import { Link } from 'react-router-dom';
import { ALGOS, COMPLEXITY_LEGEND } from '../engine/properties';
import { ALGO_IDS, type AlgoId } from '../engine/trace';
import { EXPLANATIONS } from '../content/explanations';
import { VerdictBadge } from './common';

export function PropertiesTable({ current, full = false }: { current?: AlgoId; full?: boolean }) {
  return (
    <div className="table-wrap">
      <table className={`props-table${full ? ' full' : ''}`}>
        <thead>
          <tr>
            <th>Algorithm</th>
            <th>Complete?</th>
            <th>Optimal?</th>
            <th>Frontier</th>
            {full && <th>Goal test</th>}
            {full && <th>Time</th>}
            {full && <th>Space</th>}
          </tr>
        </thead>
        <tbody>
          {ALGO_IDS.map((id) => {
            const a = ALGOS[id];
            return (
              <tr key={id} className={id === current ? 'current' : undefined}>
                <th scope="row">
                  <Link to={`/algo/${id}`} title={a.name}>
                    {a.abbr}
                  </Link>
                  {full && <span className={`family-tag ${a.family}`}>{a.family}</span>}
                </th>
                <td>
                  <VerdictBadge p={a.complete} />
                  {full && <div className="cell-note">{a.complete.text}</div>}
                </td>
                <td>
                  <VerdictBadge p={a.optimal} />
                  {full && <div className="cell-note">{a.optimal.text}</div>}
                </td>
                <td className="mono-sm">{a.frontier}</td>
                {full && <td>{a.goalTest}</td>}
                {full && <td className="mono-sm">{a.time}</td>}
                {full && <td className="mono-sm">{a.space}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {full && <p className="muted small">{COMPLEXITY_LEGEND}</p>}
    </div>
  );
}

/** Side panel on the play screen: how the current algorithm relates to the others. */
export function CompareSidebar({ algo, note }: { algo: AlgoId; note?: string }) {
  const a = ALGOS[algo];
  return (
    <div className="compare-sidebar">
      <h3>Know your algorithms</h3>
      <PropertiesTable current={algo} />
      <p className="muted small">Hover a badge for the exact condition.</p>
      <h4>{a.abbr} in one sentence</h4>
      <p>{a.tagline}</p>
      <dl className="facts">
        <dt>Complete</dt>
        <dd>{a.complete.text}</dd>
        <dt>Optimal</dt>
        <dd>{a.optimal.text}</dd>
        <dt>Goal test</dt>
        <dd>{a.goalTest}</dd>
      </dl>
      <h4>Compared with…</h4>
      <ul className="contrasts">
        {EXPLANATIONS[algo].contrasts.map((c) => (
          <li key={c.other}>
            <strong>{ALGOS[c.other].abbr}:</strong> {c.text}
          </li>
        ))}
      </ul>
      {note && (
        <div className="callout warn">
          <strong>About this graph:</strong> {note}
        </div>
      )}
      <Link to="/compare" className="small">
        Full comparison, race &amp; quiz →
      </Link>
    </div>
  );
}
