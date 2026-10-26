import { cutoffNodes } from '../engine/checker';
import { FRONTIER_KIND, HAS_LIMIT, PRIORITY, USES_EXPLORED, VALUE_FIELDS } from '../engine/conventions';
import { ALGOS } from '../engine/properties';
import type { AlgoId } from '../engine/trace';
import { goalChild } from '../engine/trace';
import { currentRound, currentStep, type Session } from './session';

function pickRule(algo: AlgoId): string {
  const kind = FRONTIER_KIND[algo];
  if (kind === 'fifo') return 'BFS uses a FIFO queue: take the entry that was added earliest (the smallest #).';
  if (kind === 'lifo') return `${ALGOS[algo].abbr} uses a LIFO stack: take the entry that was added most recently (the largest #).`;
  return `Take the entry with the lowest ${PRIORITY[algo]}. If several are tied, take the alphabetically first one.`;
}

function successorRule(algo: AlgoId): string {
  const valueText = () => {
    const f = VALUE_FIELDS[algo];
    const parts: string[] = [];
    if (f.includes('g')) parts.push('g(child) = g(parent) + edge cost');
    if (f.includes('h')) parts.push('h is written next to the node');
    if (f.includes('f')) parts.push('f = g + h');
    if (f.includes('depth')) parts.push('depth(child) = depth(parent) + 1');
    return parts.length ? ` Values: ${parts.join(', ')}.` : '';
  };
  if (HAS_LIMIT[algo]) {
    return `There is no explored set. Skip a child only if it is already on the current path (cycle); push all others.${valueText()}`;
  }
  if (FRONTIER_KIND[algo] === 'pq') {
    return `For each successor: explored → skip. Already in the frontier → compare the new ${PRIORITY[algo]} with the old one: strictly lower → replace, otherwise keep the old entry. Otherwise → add.${valueText()}`;
  }
  return `For each successor: explored → skip; already in the frontier → skip; otherwise add it.${algo === 'bfs' ? ' If the new child is the goal, stop immediately (goal test on generation).' : ''}`;
}

function orderRule(algo: AlgoId): string {
  const kind = FRONTIER_KIND[algo];
  if (kind === 'fifo') return ' New children go to the back of the queue, in alphabetical order.';
  if (kind === 'lifo') return ' New children go on top of the stack - the alphabetically first child must end up on top.';
  return ' In a priority queue the order you list entries in does not matter - only the values.';
}

export function getHint(s: Session, level: number): string {
  const algo = s.trace.algo;
  const step = currentStep(s);
  const round = currentRound(s);

  switch (s.phase) {
    case 'pick': {
      if (!step) {
        if (level === 1) return 'The frontier is empty. Was any node cut off by the depth limit during this run?';
        const cut = cutoffNodes(round);
        return cut.length ? `Nodes cut off at the limit: ${cut.join(', ')}.` : 'No node was cut off in this run.';
      }
      if (level === 1) return pickRule(algo);
      const frontier = step.before.frontier;
      const kind = FRONTIER_KIND[algo];
      if (kind === 'pq') {
        const min = Math.min(...frontier.map((e) => e.f));
        const tied = frontier.filter((e) => e.f === min).map((e) => e.node);
        return `The lowest ${PRIORITY[algo]} in the frontier is ${min}${tied.length > 1 ? `, shared by ${tied.join(', ')}` : ''}.`;
      }
      const nums = frontier.map((e) => e.seq);
      return kind === 'fifo' ? `The smallest number in the frontier is #${Math.min(...nums)}.` : `The largest number in the frontier is #${Math.max(...nums)}.`;
    }
    case 'decide': {
      const n = step!.pop;
      if (level === 1) {
        return `First the goal test: is ${n.node} the goal?${HAS_LIMIT[algo] ? ' If not, compare its depth with the limit ℓ.' : ''}${algo === 'bfs' ? ' (BFS already tests on generation, so a node in its frontier is never the goal.)' : ''}`;
      }
      return `${n.node} is ${n.node === s.trace.graph.goal ? '' : 'not '}the goal (${s.trace.graph.goal}).${HAS_LIMIT[algo] ? ` Depth ${n.depth}, limit ${round.limit}.` : ''}`;
    }
    case 'children':
    case 'edit': {
      if (level === 1) return successorRule(algo) + (s.phase === 'edit' ? orderRule(algo) : '');
      const st = step!;
      const parts: string[] = [];
      if (USES_EXPLORED[algo]) parts.push(`Explored before this step: {${st.before.explored.join(', ')}}.`);
      else parts.push(`Current path: ${st.pop.path.join(' → ')}.`);
      const others = st.before.frontier.filter((e) => e.key !== st.pop.key);
      parts.push(
        `Frontier besides ${st.pop.node}: ${others.length ? others.map((e) => (PRIORITY[algo] ? `${e.node}(${PRIORITY[algo]}=${e.f})` : e.node)).join(', ') : 'empty'}.`,
      );
      if (goalChild(st)) parts.push(`One of the successors is the goal ${s.trace.graph.goal}.`);
      return parts.join(' ');
    }
    case 'final': {
      const sol = s.trace.solution!;
      if (level === 1) return 'Follow the parent pointers from the goal back to the start, then add up the edge costs on that path.';
      return `The goal ${sol.node} was reached from ${sol.parent}. The path has ${sol.path.length - 1} edges.`;
    }
    case 'done':
      return '';
  }
}
