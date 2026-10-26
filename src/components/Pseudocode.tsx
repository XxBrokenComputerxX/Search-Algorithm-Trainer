import { EXPLANATIONS, type LineTag } from '../content/explanations';
import type { AlgoId } from '../engine/trace';

export function Pseudocode({ algo, active = [] }: { algo: AlgoId; active?: LineTag[] }) {
  const lines = EXPLANATIONS[algo].pseudocode;
  return (
    <pre className="pseudocode" aria-label="Pseudocode">
      {lines.map((l, i) => {
        const on = l.tags?.some((t) => active.includes(t));
        return (
          <div key={i} className={on ? 'line on' : 'line'} style={{ paddingLeft: `${l.indent * 1.4 + 0.5}em` }}>
            {l.text}
          </div>
        );
      })}
    </pre>
  );
}
