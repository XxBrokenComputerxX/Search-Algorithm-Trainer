import { useEffect, useState } from 'react';
import { compareIds, type Graph } from '../engine/graph';
import { FRONTIER_KIND, FRONTIER_LABEL, USES_EXPLORED, VALUE_FIELDS } from '../engine/conventions';
import type { DraftEntry, Values } from '../engine/checker';
import type { AlgoId, FrontierEntry } from '../engine/trace';
import { NumberInput } from './common';

interface Props {
  algo: AlgoId;
  graph: Graph;
  expanding: FrontierEntry;
  initialFrontier: DraftEntry[];
  initialExplored: string[];
  problems: string[] | null;
  /** Node most recently clicked on the graph (pre-selects it in the "add" form). */
  clicked: { node: string; n: number } | null;
  onSubmit: (frontier: DraftEntry[], explored: string[]) => void;
  onGoalGenerated: () => void;
}

/** Hard mode: the player maintains the frontier and explored set by hand. */
export function FrontierEditor({ algo, graph, expanding, initialFrontier, initialExplored, problems, clicked, onSubmit, onGoalGenerated }: Props) {
  const kind = FRONTIER_KIND[algo];
  const fields = VALUE_FIELDS[algo];
  const [draft, setDraft] = useState<DraftEntry[]>(initialFrontier);
  const [explored, setExplored] = useState<string[]>(initialExplored);
  const [addNode, setAddNode] = useState('');
  const [addValues, setAddValues] = useState<Values>({});
  const nodes = graph.nodes.map((n) => n.id).sort(compareIds);
  const ends = kind === 'fifo' ? ['front', 'back'] : kind === 'lifo' ? ['top', 'bottom'] : null;

  useEffect(() => {
    if (clicked) setAddNode(clicked.node);
  }, [clicked]);

  const move = (i: number, d: number) =>
    setDraft((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const add = (atFront: boolean) => {
    if (!addNode) return;
    const entry = { node: addNode, values: { ...addValues } };
    setDraft((list) => (atFront ? [entry, ...list] : [...list, entry]));
    setAddValues({});
  };

  return (
    <div className="editor-hard">
      <p className="muted small">
        {FRONTIER_LABEL[kind]}. {expanding.node} has already been removed.{' '}
        {kind === 'pq' ? 'Order does not matter - only the entries and their values.' : `Order matters: the list runs ${ends![0]} → ${ends![1]}.`}{' '}
        Tip: click a node on the graph to select it below.
      </p>

      {draft.length === 0 ? (
        <p className="empty-note">(frontier is empty)</p>
      ) : (
        <ol className="draft-list">
          {draft.map((d, i) => (
            <li key={`${d.node}-${i}`}>
              {ends && <span className="entry-end">{i === 0 ? ends[0] : i === draft.length - 1 ? ends[1] : ''}</span>}
              <span className="entry-node">{d.node}</span>
              {fields.map((f) => (
                <label key={f} className="inline-field">
                  {f}
                  <NumberInput
                    label={`${f} of ${d.node}`}
                    value={d.values[f]}
                    onChange={(v) => setDraft((list) => list.map((x, j) => (j === i ? { ...x, values: { ...x.values, [f]: v } } : x)))}
                  />
                </label>
              ))}
              <span className="row-buttons">
                {kind !== 'pq' && (
                  <>
                    <button type="button" className="btn tiny" onClick={() => move(i, -1)} aria-label={`Move ${d.node} up`} disabled={i === 0}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn tiny"
                      onClick={() => move(i, 1)}
                      aria-label={`Move ${d.node} down`}
                      disabled={i === draft.length - 1}
                    >
                      ↓
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn tiny danger"
                  onClick={() => setDraft((list) => list.filter((_, j) => j !== i))}
                  aria-label={`Remove ${d.node}`}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="add-row">
        <select value={addNode} onChange={(e) => setAddNode(e.target.value)} aria-label="Node to add">
          <option value="">- node -</option>
          {nodes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {fields.map((f) => (
          <label key={f} className="inline-field">
            {f}
            <NumberInput label={`${f} of new entry`} value={addValues[f]} onChange={(v) => setAddValues((x) => ({ ...x, [f]: v }))} />
          </label>
        ))}
        {ends ? (
          <>
            <button type="button" className="btn" onClick={() => add(true)} disabled={!addNode}>
              Add at {ends[0]}
            </button>
            <button type="button" className="btn" onClick={() => add(false)} disabled={!addNode}>
              Add at {ends[1]}
            </button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => add(false)} disabled={!addNode}>
            Add entry
          </button>
        )}
      </div>

      {USES_EXPLORED[algo] && (
        <div className="explored-edit">
          <span className="small muted">Explored set (click to toggle):</span>
          <div className="chips">
            {nodes.map((n) => (
              <button
                type="button"
                key={n}
                className={`chip${explored.includes(n) ? ' on' : ''}`}
                aria-pressed={explored.includes(n)}
                onClick={() => setExplored((ex) => (ex.includes(n) ? ex.filter((x) => x !== n) : [...ex, n]))}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {problems && problems.length > 0 && (
        <ul className="problems">
          {problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}

      <div className="button-row">
        <button type="button" className="btn primary" onClick={() => onSubmit(draft, explored)}>
          Check this step
        </button>
        <button type="button" className="btn" onClick={onGoalGenerated} title="Use this if a newly generated child passes the goal test">
          Goal generated → stop
        </button>
      </div>
    </div>
  );
}
