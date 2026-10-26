import { useState } from 'react';
import { successors, type Graph } from '../engine/graph';
import { CHILD_ACTIONS, CHILD_ACTION_LABEL, VALUE_FIELDS } from '../engine/conventions';
import type { ChildInput, ChildVerdict } from '../engine/checker';
import type { AlgoId, ChildAction, FrontierEntry } from '../engine/trace';
import { NumberInput } from './common';

interface Props {
  algo: AlgoId;
  graph: Graph;
  parent: FrontierEntry;
  feedback: ChildVerdict[] | null;
  onSubmit: (rows: ChildInput[]) => void;
}

/** Medium mode: classify each successor of the expanded node and enter its values. */
export function ChildrenTable({ algo, graph, parent, feedback, onSubmit }: Props) {
  const succ = successors(graph, parent.node);
  const [rows, setRows] = useState<ChildInput[]>(() => succ.map((s) => ({ node: s.node, action: '', values: {} })));
  const fields = VALUE_FIELDS[algo];
  const goalAt = rows.findIndex((r) => r.action === 'goal');

  const update = (i: number, patch: Partial<ChildInput>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch, values: { ...r.values, ...patch.values } } : r)));

  if (succ.length === 0) {
    return (
      <div className="children">
        <p>
          <strong>{parent.node}</strong> has no successors - nothing to add.
        </p>
        <button className="btn primary" onClick={() => onSubmit([])}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <form
      className="children"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(rows);
      }}
    >
      <ul className="child-cards">
        {succ.map((s, i) => {
          const fb = feedback?.[i];
          const disabled = goalAt >= 0 && i > goalAt;
          const needsValues = rows[i].action === 'add' || rows[i].action === 'replace';
          return (
            <li key={s.node} className={`child-card${disabled ? ' disabled' : fb ? (fb.ok ? ' row-ok' : ' row-bad') : ''}`}>
              <div className="child-top">
                <span className="succ-name">{s.node}</span>
                <span className="mono-sm muted">
                  edge {parent.node}→{s.node} costs {s.cost}
                </span>
                {fb && !disabled && <span className={fb.ok ? 'ok-mark' : 'bad-mark'}>{fb.ok ? '✓' : '✗'}</span>}
              </div>
              <div className="child-controls">
                <select
                  aria-label={`Action for ${s.node}`}
                  value={rows[i].action}
                  disabled={disabled}
                  onChange={(e) => update(i, { action: e.target.value as ChildAction | '' })}
                >
                  <option value="">- what happens? -</option>
                  {CHILD_ACTIONS[algo].map((a) => (
                    <option key={a} value={a}>
                      {CHILD_ACTION_LABEL[a]}
                    </option>
                  ))}
                </select>
                {fields.map((f) => (
                  <label key={f} className="inline-field">
                    {f}
                    <NumberInput
                      label={`${f} of ${s.node}`}
                      value={rows[i].values[f]}
                      disabled={disabled || !needsValues}
                      invalid={!!fb?.fieldErrors[f]}
                      onChange={(v) => update(i, { values: { [f]: v } })}
                    />
                  </label>
                ))}
              </div>
              {fb && !fb.ok && !disabled && <div className="row-msg">{fb.text}</div>}
            </li>
          );
        })}
      </ul>
      {goalAt >= 0 && <p className="muted small">Rows after the goal are ignored - the search stops there.</p>}
      <button type="submit" className="btn primary">
        Check successors
      </button>
    </form>
  );
}
