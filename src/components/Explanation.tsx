import { useEffect } from 'react';
import { EXPLANATIONS } from '../content/explanations';
import { ALGOS } from '../engine/properties';
import type { AlgoId } from '../engine/trace';
import { RULES } from '../engine/conventions';
import { Pseudocode } from './Pseudocode';
import { VerdictBadge } from './common';

export function ExplanationContent({ algo, compact = false }: { algo: AlgoId; compact?: boolean }) {
  const e = EXPLANATIONS[algo];
  const a = ALGOS[algo];
  return (
    <div className="explanation">
      <section>
        <h3>The idea</h3>
        {e.intuition.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>
      <section>
        <h3>Doing it by hand</h3>
        <ol>
          {e.howTo.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </section>
      <section>
        <h3>Pseudocode</h3>
        <Pseudocode algo={algo} />
      </section>
      <section>
        <h3>Properties</h3>
        <dl className="facts">
          <dt>Frontier</dt>
          <dd>
            {a.frontier} - ordered by {a.orderBy}
          </dd>
          <dt>Goal test</dt>
          <dd>{a.goalTest}</dd>
          <dt>Complete</dt>
          <dd>
            <VerdictBadge p={a.complete} /> {a.complete.text}
          </dd>
          <dt>Optimal</dt>
          <dd>
            <VerdictBadge p={a.optimal} /> {a.optimal.text}
          </dd>
          <dt>Time / space</dt>
          <dd className="mono-sm">
            {a.time} / {a.space}
          </dd>
        </dl>
      </section>
      <section>
        <h3>Common mistakes</h3>
        <ul>
          {e.pitfalls.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>How it differs</h3>
        <ul>
          {e.contrasts.map((c) => (
            <li key={c.other}>
              <strong>{ALGOS[c.other].abbr}:</strong> {c.text}
            </li>
          ))}
        </ul>
      </section>
      {!compact && <RulesList />}
    </div>
  );
}

export function RulesList() {
  return (
    <section>
      <h3>Rules used in this game</h3>
      <dl className="rules">
        {RULES.map((r) => (
          <div key={r.title}>
            <dt>{r.title}</dt>
            <dd>{r.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ExplanationDrawer({ algo, open, onClose }: { algo: AlgoId; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${ALGOS[algo].name} explained`} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2>{ALGOS[algo].name}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close explanation">
            ✕
          </button>
        </header>
        <ExplanationContent algo={algo} />
      </aside>
    </div>
  );
}
