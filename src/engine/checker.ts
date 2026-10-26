import { edgeCost, type Graph } from './graph';
import { FRONTIER_KIND, GOAL_TEST, HAS_LIMIT, PRIORITY, USES_EXPLORED, VALUE_FIELDS } from './conventions';
import { ALGOS } from './properties';
import type { AlgoId, ChildAction, ChildRecord, FrontierEntry, NodeDecision, Round, Step, ValueField } from './trace';
import { goalChild } from './trace';

export interface Verdict {
  ok: boolean;
  text: string;
}

export type Values = Partial<Record<ValueField, number>>;

export interface ChildInput {
  node: string;
  action: ChildAction | '';
  values: Values;
}

export interface ChildVerdict extends Verdict {
  fieldErrors: Partial<Record<ValueField, string>>;
}

export interface DraftEntry {
  node: string;
  values: Values;
}

const abbr = (algo: AlgoId) => ALGOS[algo].abbr;
const path = (p: string[]) => p.join(' → ');
const fieldName: Record<ValueField, string> = { g: 'g', h: 'h', f: 'f', depth: 'depth' };

// ---------------------------------------------------------------- picking

function priorityGloss(algo: AlgoId): string {
  switch (algo) {
    case 'ucs':
      return 'UCS ignores any heuristic - only the path cost g paid so far counts.';
    case 'greedy':
      return 'Greedy ignores the cost already paid (g) - only the estimate h counts.';
    case 'astar':
      return 'A* uses f = g + h: cost so far plus estimated cost to the goal.';
    default:
      return '';
  }
}

export function pickSuccessText(algo: AlgoId, frontier: FrontierEntry[], e: FrontierEntry): string {
  const kind = FRONTIER_KIND[algo];
  if (kind === 'fifo') return `${e.node} is the oldest entry in the FIFO queue (#${e.seq}) - it leaves first.`;
  if (kind === 'lifo') return `${e.node} is on top of the stack (newest entry, #${e.seq}) - it leaves first.`;
  const p = PRIORITY[algo]!;
  const tied = frontier.filter((x) => x.f === e.f).length > 1;
  return `${e.node} has the lowest ${p} = ${e.f}${tied ? ' (tie broken alphabetically)' : ''}.`;
}

export function pickVerdict(algo: AlgoId, frontier: FrontierEntry[], chosen: FrontierEntry): Verdict {
  const expected = frontier[0];
  if (chosen.key === expected.key) return { ok: true, text: `Correct: ${pickSuccessText(algo, frontier, expected)}` };

  const kind = FRONTIER_KIND[algo];
  const name = abbr(algo);
  if (kind === 'fifo') {
    return {
      ok: false,
      text: `${name} uses a FIFO queue: whatever was added first leaves first. ${expected.node} was added as #${expected.seq}, before ${chosen.node} (#${chosen.seq}).`,
    };
  }
  if (kind === 'lifo') {
    const siblings = chosen.parent === expected.parent && chosen.depth === expected.depth;
    return {
      ok: false,
      text:
        `${name} uses a LIFO stack: the most recently added entry leaves first. ${expected.node} (#${expected.seq}) is newer than ${chosen.node} (#${chosen.seq}).` +
        (siblings ? ' Siblings are pushed so that the alphabetically first one ends up on top.' : ''),
    };
  }
  const p = PRIORITY[algo]!;
  if (chosen.f === expected.f) {
    return {
      ok: false,
      text: `${expected.node} and ${chosen.node} are tied at ${p} = ${expected.f}. Ties are broken alphabetically, so ${expected.node} comes first.`,
    };
  }
  return {
    ok: false,
    text: `${name} always expands the entry with the lowest ${p}. ${expected.node} has ${p} = ${expected.f}, but ${chosen.node} has ${p} = ${chosen.f}. ${priorityGloss(algo)}`,
  };
}

export function cutoffNodes(round: Round): string[] {
  return round.steps.filter((s) => s.decision === 'cutoff').map((s) => s.pop.node);
}

/** The player declared the round over (frontier empty). */
export function endVerdict(algo: AlgoId, round: Round, remaining: number, chosen: 'failure' | 'cutoff'): Verdict {
  if (remaining > 0) {
    return {
      ok: false,
      text: `The frontier still contains ${remaining} entr${remaining === 1 ? 'y' : 'ies'} - keep searching until it is empty.`,
    };
  }
  const cut = cutoffNodes(round);
  if (chosen === round.end) {
    if (chosen === 'cutoff') {
      return {
        ok: true,
        text: `Correct: the frontier is empty and ${cut.join(', ')} ${cut.length === 1 ? 'was' : 'were'} cut off at the depth limit, so the result is "cutoff" - a solution may exist deeper.`,
      };
    }
    return {
      ok: true,
      text: HAS_LIMIT[algo]
        ? 'Correct: no node was cut off, so every path was searched completely. The result is "failure" - there is no solution.'
        : 'Correct: the frontier is empty, so there is no path to the goal. Return failure.',
    };
  }
  if (round.end === 'cutoff') {
    return {
      ok: false,
      text: `Not failure: ${cut.join(', ')} ${cut.length === 1 ? 'was' : 'were'} cut off at the depth limit ℓ = ${round.limit}. A deeper search might still find the goal, so the result is "cutoff".`,
    };
  }
  return {
    ok: false,
    text: 'No node was ever cut off by the depth limit - every path was searched to its end. So this is a real "failure", not a cutoff.',
  };
}

// ---------------------------------------------------------------- goal test / cutoff decision

export function decisionVerdict(algo: AlgoId, graph: Graph, step: Step, limit: number | undefined, chosen: NodeDecision): Verdict {
  const n = step.pop.node;
  const expected = step.decision;
  if (chosen === expected) {
    if (expected === 'goal') return { ok: true, text: `Correct: ${n} is the goal - the goal test on expansion succeeds. Done!` };
    if (expected === 'cutoff')
      return { ok: true, text: `Correct: ${n} is at depth ${step.pop.depth} = limit ${limit}, so it is not expanded (cutoff).` };
    return {
      ok: true,
      text: `Correct: ${n} is not the goal${HAS_LIMIT[algo] ? ` and its depth ${step.pop.depth} < ${limit}` : ''} → expand it.`,
    };
  }
  if (expected === 'goal') {
    return {
      ok: false,
      text:
        chosen === 'cutoff'
          ? `The goal test comes before the depth check: ${n} is the goal, so it is returned even at the depth limit.`
          : `${n} is the goal! ${abbr(algo)} tests the goal when a node is taken out of the frontier - stop here.`,
    };
  }
  if (chosen === 'goal') {
    return { ok: false, text: `${n} is not the goal (the goal is ${graph.goal}).` };
  }
  if (expected === 'cutoff') {
    return {
      ok: false,
      text: `${n} is at depth ${step.pop.depth}, which equals the limit ℓ = ${limit}. It must not be expanded - remember that a cutoff happened.`,
    };
  }
  return {
    ok: false,
    text: HAS_LIMIT[algo]
      ? `${n} is at depth ${step.pop.depth} < limit ${limit}, so it may still be expanded.`
      : `${abbr(algo)} has no depth limit - every non-goal node is expanded.`,
  };
}

// ---------------------------------------------------------------- successors

export function valueDerivation(graph: Graph, entry: FrontierEntry, field: ValueField, parent?: FrontierEntry): string {
  const p = entry.parent;
  const cost = p ? edgeCost(graph, p, entry.node) : undefined;
  switch (field) {
    case 'g':
      return p && parent
        ? `g(${entry.node}) = g(${p}) + cost(${p}→${entry.node}) = ${parent.g} + ${cost} = ${entry.g}`
        : `g(${entry.node}) = ${entry.g}`;
    case 'h':
      return `h(${entry.node}) = ${entry.h} (read it off the node)`;
    case 'f':
      return `f(${entry.node}) = g + h = ${entry.g} + ${entry.h} = ${entry.f}`;
    case 'depth':
      return p ? `depth(${entry.node}) = depth(${p}) + 1 = ${entry.depth}` : `depth = ${entry.depth}`;
  }
}

export function childActionReason(algo: AlgoId, rec: ChildRecord, parent: FrontierEntry): string {
  const c = rec.node;
  const p = PRIORITY[algo];
  switch (rec.action) {
    case 'skip-explored':
      return `${c} is already in the explored set - graph search never adds an explored state again (and never reopens it).`;
    case 'skip-frontier':
      if (!p) return `${c} is already in the frontier - ${abbr(algo)} graph search doesn't add a second copy.`;
      return algo === 'greedy'
        ? `${c} is already in the frontier. For Greedy, f = h depends only on the node, so a new path can never improve it - keep the old entry.`
        : `${c} is already in the frontier with ${p} = ${rec.existing!.f}. The new path via ${parent.node} gives ${p} = ${rec.entry.f}, which is not lower - keep the old entry.`;
    case 'replace':
      return `${c} is already in the frontier with ${p} = ${rec.existing!.f}, but the new path via ${parent.node} gives ${p} = ${rec.entry.f}, which is lower → replace the old entry.`;
    case 'skip-path':
      return `${c} is already on the current path ${path(parent.path)} - going there again would be a cycle.`;
    case 'goal':
      return `BFS tests the goal as soon as a node is generated: ${c} is the goal → return the solution immediately.`;
    case 'add':
      if (HAS_LIMIT[algo]) return `${c} is not on the current path ${path(parent.path)} → push it (depth ${rec.entry.depth}).`;
      return `${c} is neither explored nor in the frontier → add it.`;
  }
}

export function childVerdict(algo: AlgoId, graph: Graph, parent: FrontierEntry, rec: ChildRecord, input: ChildInput): ChildVerdict {
  const fieldErrors: ChildVerdict['fieldErrors'] = {};
  if (input.action === '') return { ok: false, text: `Choose what happens to ${rec.node}.`, fieldErrors };

  if (input.action !== rec.action) {
    let text = childActionReason(algo, rec, parent);
    if (input.action === 'goal' && GOAL_TEST[algo] === 'expansion') {
      text = `${abbr(algo)} tests the goal when a node is expanded (taken out of the frontier), not when it is generated. ${text}`;
      if (algo === 'ucs' || algo === 'astar') text += ' Testing on generation could return a more expensive path.';
    }
    if (input.action === 'replace' && !PRIORITY[algo]) text += ` (${abbr(algo)} never replaces frontier entries.)`;
    return { ok: false, text, fieldErrors };
  }

  if (rec.action === 'add' || rec.action === 'replace') {
    for (const f of VALUE_FIELDS[algo]) {
      if (input.values[f] === undefined || Number.isNaN(input.values[f])) fieldErrors[f] = `Enter ${fieldName[f]}(${rec.node}).`;
      else if (input.values[f] !== rec.entry[f]) fieldErrors[f] = valueDerivation(graph, rec.entry, f, parent);
    }
    const errs = Object.values(fieldErrors);
    if (errs.length > 0) return { ok: false, text: `Right decision, wrong value: ${errs.join('; ')}.`, fieldErrors };
  }
  return { ok: true, text: childActionReason(algo, rec, parent), fieldErrors };
}

export function summarizeChildren(algo: AlgoId, step: Step): string {
  if (step.children.length === 0) return `${step.pop.node} has no successors.`;
  const groups = new Map<ChildAction, string[]>();
  for (const c of step.children) {
    const fields = VALUE_FIELDS[algo];
    const label =
      (c.action === 'add' || c.action === 'replace') && fields.length > 0
        ? `${c.node} (${fields.map((f) => `${f}=${c.entry[f]}`).join(', ')})`
        : c.node;
    groups.set(c.action, [...(groups.get(c.action) ?? []), label]);
  }
  const words: Record<ChildAction, string> = {
    add: 'added',
    replace: 'replaced',
    'skip-explored': 'skipped (explored)',
    'skip-frontier': 'skipped (already in frontier)',
    'skip-path': 'skipped (on path)',
    goal: 'is the goal → stop',
  };
  const order: ChildAction[] = ['add', 'replace', 'skip-explored', 'skip-frontier', 'skip-path', 'goal'];
  return order
    .filter((a) => groups.has(a))
    .map((a) => `${groups.get(a)!.join(', ')} ${words[a]}`)
    .join('; ');
}

// ---------------------------------------------------------------- Hard mode: frontier editing

function sameValues(algo: AlgoId, d: DraftEntry, e: FrontierEntry): ValueField | null {
  for (const f of VALUE_FIELDS[algo]) if (d.values[f] !== e[f]) return f;
  return null;
}

/** Compares the player's hand-built frontier/explored set with the true state after expanding `step.pop`. */
export function editIssues(algo: AlgoId, graph: Graph, step: Step, draft: DraftEntry[], explored: string[]): string[] {
  const gc = goalChild(step);
  if (gc) {
    return [
      `While expanding ${step.pop.node} you generate ${gc.node}, which is the goal. BFS tests the goal on generation - press “Goal generated → stop” instead.`,
    ];
  }

  const issues: string[] = [];
  const expected = step.after.frontier;
  const count = (list: string[]) => list.reduce((m, n) => m.set(n, (m.get(n) ?? 0) + 1), new Map<string, number>());
  const want = count(expected.map((e) => e.node));
  const have = count(draft.map((d) => d.node));
  const recFor = (n: string) => step.children.find((c) => c.node === n);

  for (const [n, k] of want) {
    const h = have.get(n) ?? 0;
    if (h < k) {
      const rec = recFor(n);
      issues.push(
        rec && (rec.action === 'add' || rec.action === 'replace')
          ? `${n} is missing: ${childActionReason(algo, rec, step.pop)}`
          : `${n} is missing - it was already waiting in the frontier and has not been removed.`,
      );
    }
  }
  for (const [n, k] of have) {
    const w = want.get(n) ?? 0;
    if (k <= w) continue;
    const rec = recFor(n);
    if (w > 0 && USES_EXPLORED[algo]) issues.push(`${n} appears ${k} times - graph search keeps only one frontier entry per state.`);
    else if (n === step.pop.node) issues.push(`${n} was just taken out of the frontier for expansion - it must not be put back.`);
    else if (rec && w === 0) issues.push(`${n} should not be in the frontier: ${childActionReason(algo, rec, step.pop)}`);
    else if (!rec && w === 0) issues.push(`${n} should not be in the frontier - it is not a successor of ${step.pop.node}.`);
    else issues.push(`${n} appears too often in the frontier.`);
  }
  if (issues.length > 0) return issues.concat(exploredIssues(algo, step, explored));

  const kind = FRONTIER_KIND[algo];
  if (kind === 'pq') {
    for (const e of expected) {
      const d = draft.find((x) => x.node === e.node)!;
      const bad = sameValues(algo, d, e);
      if (bad) {
        const rec = recFor(e.node);
        const why = rec?.action === 'replace' ? ` (${childActionReason(algo, rec, step.pop)})` : '';
        issues.push(`${e.node}: ${valueDerivation(graph, e, bad, e.parent === step.pop.node ? step.pop : undefined)}${why}.`);
      }
    }
  } else {
    const i = expected.findIndex((e, idx) => e.node !== draft[idx].node);
    if (i >= 0) {
      issues.push(
        kind === 'fifo'
          ? `Order is wrong at position ${i + 1} (from the front): expected ${expected[i].node}, found ${draft[i].node}. A FIFO queue keeps the old entries in front and appends new children at the back, in alphabetical order.`
          : `Order is wrong at position ${i + 1} (from the top): expected ${expected[i].node}, found ${draft[i].node}. New children go on top of the stack, pushed so that the alphabetically first child is on top.`,
      );
    } else {
      expected.forEach((e, idx) => {
        const bad = sameValues(algo, draft[idx], e);
        if (bad) issues.push(`${e.node}: ${valueDerivation(graph, e, bad, e.parent === step.pop.node ? step.pop : undefined)}.`);
      });
    }
  }
  return issues.concat(exploredIssues(algo, step, explored));
}

function exploredIssues(algo: AlgoId, step: Step, explored: string[]): string[] {
  if (!USES_EXPLORED[algo]) return [];
  const want = new Set(step.after.explored);
  const have = new Set(explored);
  const issues: string[] = [];
  for (const n of want) {
    if (!have.has(n)) issues.push(n === step.pop.node ? `Add ${n} to the explored set - it has just been expanded.` : `${n} belongs in the explored set.`);
  }
  for (const n of have) if (!want.has(n)) issues.push(`${n} has not been expanded yet, so it is not explored.`);
  return issues;
}

export function goalGeneratedVerdict(algo: AlgoId, step: Step): Verdict {
  const gc = goalChild(step);
  if (gc) return { ok: true, text: `Correct: ${gc.node} is generated as a child of ${step.pop.node} and passes BFS's goal test on generation.` };
  if (GOAL_TEST[algo] === 'expansion') {
    return {
      ok: false,
      text: `${abbr(algo)} tests the goal on expansion, not on generation - put the goal into the frontier like any other node and stop when it is taken out.`,
    };
  }
  return { ok: false, text: `None of the new children of ${step.pop.node} is the goal.` };
}

// ---------------------------------------------------------------- final answer

export function finalVerdict(graph: Graph, solution: FrontierEntry, answerPath: string[], cost: number | undefined): Verdict {
  const sol = solution.path;
  const samePath = answerPath.length === sol.length && answerPath.every((n, i) => n === sol[i]);
  if (!samePath) {
    if (answerPath[0] !== graph.start) return { ok: false, text: `The path must start at the start node ${graph.start}.` };
    let k = 0;
    while (k < answerPath.length && k < sol.length && answerPath[k] === sol[k]) k++;
    if (k >= sol.length) return { ok: false, text: `The path must end at the goal ${graph.goal}.` };
    return {
      ok: false,
      text: `Follow the parent pointers back from the goal. In the search tree the parent of ${sol[k]} is ${sol[k - 1]}${k < sol.length - 1 ? ` and ${sol[k]} leads to ${sol[k + 1]}` : ''}.`,
    };
  }
  if (cost !== solution.g) {
    const parts = sol.slice(1).map((n, i) => edgeCost(graph, sol[i], n));
    return { ok: false, text: `Right path, wrong cost: add up the step costs ${parts.join(' + ')} = ${solution.g}.` };
  }
  return { ok: true, text: `Correct: ${path(sol)} with cost ${solution.g}.` };
}
