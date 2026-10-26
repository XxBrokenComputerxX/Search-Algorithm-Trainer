import { compareIds } from '../engine/graph';
import { FRONTIER_KIND, FRONTIER_LABEL, HAS_LIMIT, VALUE_FIELDS } from '../engine/conventions';
import type { AlgoId, FrontierEntry } from '../engine/trace';

interface Props {
  algo: AlgoId;
  entries: FrontierEntry[];
  /** Show entries in their true order (front/top first) instead of alphabetically. */
  ordered: boolean;
  onPick?: (key: string) => void;
}

export function entryValues(algo: AlgoId, e: FrontierEntry): string {
  const kind = FRONTIER_KIND[algo];
  const parts: string[] = [];
  if (kind !== 'pq') parts.push(`#${e.seq}`);
  for (const f of VALUE_FIELDS[algo]) parts.push(`${f === 'depth' ? 'd' : f}=${e[f]}`);
  return parts.join(' · ');
}

export function FrontierPanel({ algo, entries, ordered, onPick }: Props) {
  const kind = FRONTIER_KIND[algo];
  const shown = ordered
    ? entries
    : [...entries].sort((a, b) => compareIds(a.node, b.node) || compareIds(a.key, b.key));
  const showPath = HAS_LIMIT[algo];
  const ends = kind === 'fifo' ? ['front', 'back'] : ['top', 'bottom'];

  return (
    <div className="frontier">
      <p className="muted small">
        {FRONTIER_LABEL[kind]}
        {ordered
          ? ` - shown ${kind === 'fifo' ? 'front → back' : 'top → bottom'}.`
          : ' - shown alphabetically. You decide what comes out next.'}
        {kind !== 'pq' && ' “#n” = order in which entries were added.'}
      </p>
      {shown.length === 0 ? (
        <p className="empty-note">(empty)</p>
      ) : (
        <ul className={`entry-list${ordered ? ' ordered' : ''}`}>
          {shown.map((e, i) => (
            <li key={e.key}>
              <button
                type="button"
                className="entry"
                disabled={!onPick}
                onClick={onPick ? () => onPick(e.key) : undefined}
                title={`Path: ${e.path.join(' → ')}`}
              >
                {ordered && kind !== 'pq' && (i === 0 || i === shown.length - 1) && (
                  <span className="entry-end">{i === 0 ? ends[0] : ends[1]}</span>
                )}
                <span className="entry-node">{e.node}</span>
                <span className="entry-values">{entryValues(algo, e)}</span>
                <span className="entry-via">{showPath ? e.path.join('→') : e.parent ? `via ${e.parent}` : 'start'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
