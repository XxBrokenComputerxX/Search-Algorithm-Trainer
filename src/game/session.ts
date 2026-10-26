import type { Difficulty } from '../engine/graph';
import {
  childVerdict,
  decisionVerdict,
  editIssues,
  endVerdict,
  finalVerdict,
  goalGeneratedVerdict,
  pickVerdict,
  summarizeChildren,
  type ChildInput,
  type ChildVerdict,
  type DraftEntry,
} from '../engine/checker';
import { HAS_LIMIT, VALUE_FIELDS } from '../engine/conventions';
import { ALGOS } from '../engine/properties';
import { goalChild, type FrontierEntry, type NodeDecision, type Round, type Step, type Trace } from '../engine/trace';
import { getHint } from './hints';

export type Phase = 'pick' | 'decide' | 'children' | 'edit' | 'final' | 'done';

export interface LogEntry {
  id: number;
  kind: 'ok' | 'mistake' | 'info' | 'hint' | 'reveal';
  text: string;
}

export interface Session {
  trace: Trace;
  difficulty: Difficulty;
  round: number;
  step: number;
  phase: Phase;
  mistakes: number;
  hintsUsed: number;
  reveals: number;
  /** How many hints were shown for the current decision (0..2). */
  hintLevel: number;
  log: LogEntry[];
  nextId: number;
  childFeedback: ChildVerdict[] | null;
  editProblems: string[] | null;
}

export type GameAction =
  | { type: 'pick'; key: string }
  | { type: 'end'; result: 'failure' | 'cutoff' }
  | { type: 'decide'; decision: NodeDecision }
  | { type: 'children'; rows: ChildInput[] }
  | { type: 'edit'; frontier: DraftEntry[]; explored: string[] }
  | { type: 'goal-generated' }
  | { type: 'final'; path: string[]; cost: number | undefined }
  | { type: 'hint' }
  | { type: 'reveal' };

export function currentRound(s: Session): Round {
  return s.trace.rounds[s.round];
}

/** The step being worked on, or undefined when the round's frontier has run empty. */
export function currentStep(s: Session): Step | undefined {
  return currentRound(s).steps[s.step];
}

export function createSession(trace: Trace, difficulty: Difficulty): Session {
  let s: Session = {
    trace,
    difficulty,
    round: 0,
    step: 0,
    phase: 'pick',
    mistakes: 0,
    hintsUsed: 0,
    reveals: 0,
    hintLevel: 0,
    log: [],
    nextId: 1,
    childFeedback: null,
    editProblems: null,
  };
  const g = trace.graph;
  s = log(s, 'info', `Start: the frontier contains only the start node ${g.start}. Goal: ${g.goal}.`);
  if (HAS_LIMIT[trace.algo]) {
    s = log(s, 'info', `Depth limit ℓ = ${currentRound(s).limit}.`);
  }
  if (trace.startIsGoal) {
    s = log(s, 'ok', `The start node ${g.start} is already the goal - BFS's initial goal test succeeds.`);
    return { ...s, phase: 'done' };
  }
  return autoRoundEnd(s);
}

function log(s: Session, kind: LogEntry['kind'], text: string): Session {
  return { ...s, log: [...s.log, { id: s.nextId, kind, text }], nextId: s.nextId + 1 };
}

function mistake(s: Session, text: string): Session {
  return log({ ...s, mistakes: s.mistakes + 1 }, 'mistake', text);
}

const resetDecision = (s: Session): Session => ({ ...s, hintLevel: 0, childFeedback: null, editProblems: null });

function finishSolution(s: Session): Session {
  const sol = s.trace.solution!;
  if (s.difficulty === 'hard') {
    return log(resetDecision({ ...s, phase: 'final' }), 'info', 'Goal found! Now give the solution path (click the nodes) and its cost.');
  }
  return log(resetDecision({ ...s, phase: 'done' }), 'ok', `Solution: ${sol.path.join(' → ')} with path cost ${sol.g}.`);
}

/** Step fully processed without reaching the goal: move on to the next pick. */
function completeStep(s: Session): Session {
  return autoRoundEnd(resetDecision({ ...s, step: s.step + 1, phase: 'pick' }));
}

function resolveRoundEnd(s: Session): Session {
  const round = currentRound(s);
  if (round.end === 'cutoff' && s.trace.algo === 'ids' && s.round + 1 < s.trace.rounds.length) {
    const next = s.trace.rounds[s.round + 1];
    return log(
      resetDecision({ ...s, round: s.round + 1, step: 0, phase: 'pick' }),
      'info',
      `Cutoff at limit ${round.limit}. IDS throws everything away and restarts from ${s.trace.graph.start} with limit ℓ = ${next.limit}.`,
    );
  }
  const text =
    round.end === 'cutoff'
      ? `Result: cutoff. The goal was not found within the depth limit ℓ = ${round.limit} - try a larger limit (or IDS).`
      : `Result: failure. There is no path from ${s.trace.graph.start} to ${s.trace.graph.goal}.`;
  return log(resetDecision({ ...s, phase: 'done' }), 'info', text);
}

/** Easy mode resolves an empty frontier automatically. */
function autoRoundEnd(s: Session): Session {
  if (s.phase !== 'pick' || currentStep(s) || s.difficulty !== 'easy') return s;
  const round = currentRound(s);
  return resolveRoundEnd(log(s, 'info', endVerdict(s.trace.algo, round, 0, round.end === 'cutoff' ? 'cutoff' : 'failure').text));
}

/** Easy mode: after a correct pick the rest of the step happens automatically. */
function autoStep(s: Session, step: Step): Session {
  const algo = s.trace.algo;
  if (step.decision === 'goal') return finishSolution(log(s, 'info', `${step.pop.node} is the goal - goal test on expansion succeeds.`));
  if (step.decision === 'cutoff') {
    return completeStep(log(s, 'info', `${step.pop.node} is at depth ${step.pop.depth} = limit → cutoff, not expanded.`));
  }
  s = log(s, 'info', `Expand ${step.pop.node}: ${summarizeChildren(algo, step)}.`);
  return goalChild(step) ? finishSolution(s) : completeStep(s);
}

function afterExpandDecision(s: Session): Session {
  return { ...s, phase: s.difficulty === 'hard' ? 'edit' : 'children', hintLevel: 0 };
}

export function gameReducer(s: Session, action: GameAction): Session {
  const algo = s.trace.algo;
  const graph = s.trace.graph;
  const step = currentStep(s);

  switch (action.type) {
    case 'pick': {
      if (s.phase !== 'pick' || !step) return s;
      const chosen = step.before.frontier.find((e) => e.key === action.key);
      if (!chosen) return s;
      const v = pickVerdict(algo, step.before.frontier, chosen);
      if (!v.ok) return mistake(s, v.text);
      s = log(s, 'ok', v.text);
      if (s.difficulty === 'easy') return autoStep(resetDecision(s), step);
      return resetDecision({ ...s, phase: 'decide' });
    }

    case 'end': {
      if (s.phase !== 'pick') return s;
      const v = endVerdict(algo, currentRound(s), step ? step.before.frontier.length : 0, action.result);
      if (!v.ok) return mistake(s, v.text);
      return resolveRoundEnd(log(s, 'ok', v.text));
    }

    case 'decide': {
      if (s.phase !== 'decide' || !step) return s;
      const v = decisionVerdict(algo, graph, step, currentRound(s).limit, action.decision);
      if (!v.ok) return mistake(s, v.text);
      s = log(s, 'ok', v.text);
      if (step.decision === 'goal') return finishSolution(s);
      if (step.decision === 'cutoff') return completeStep(s);
      return afterExpandDecision(s);
    }

    case 'children': {
      if (s.phase !== 'children' || !step) return s;
      const verdicts = step.children.map((rec, i) =>
        childVerdict(algo, graph, step.pop, rec, action.rows[i] ?? { node: rec.node, action: '', values: {} }),
      );
      const firstBad = verdicts.find((v) => !v.ok);
      if (firstBad) return { ...mistake(s, firstBad.text), childFeedback: verdicts };
      s = log(s, 'ok', `Correct: ${summarizeChildren(algo, step)}.`);
      return goalChild(step) ? finishSolution(s) : completeStep(s);
    }

    case 'edit': {
      if (s.phase !== 'edit' || !step) return s;
      const problems = editIssues(algo, graph, step, action.frontier, action.explored);
      if (problems.length > 0) return { ...mistake(s, problems[0]), editProblems: problems };
      return completeStep(log(s, 'ok', `Correct: ${summarizeChildren(algo, step)}.`));
    }

    case 'goal-generated': {
      if (s.phase !== 'edit' || !step) return s;
      const v = goalGeneratedVerdict(algo, step);
      if (!v.ok) return mistake(s, v.text);
      return finishSolution(log(s, 'ok', v.text));
    }

    case 'final': {
      if (s.phase !== 'final' || !s.trace.solution) return s;
      const v = finalVerdict(graph, s.trace.solution, action.path, action.cost);
      if (!v.ok) return mistake(s, v.text);
      return log(resetDecision({ ...s, phase: 'done' }), 'ok', v.text);
    }

    case 'hint': {
      if (s.phase === 'done') return s;
      const level = Math.min(s.hintLevel + 1, 2);
      const counted = level > s.hintLevel;
      return log({ ...s, hintLevel: level, hintsUsed: s.hintsUsed + (counted ? 1 : 0) }, 'hint', getHint(s, level));
    }

    case 'reveal': {
      const answer = correctAction(s);
      if (!answer) return s;
      const before = s.log.length;
      const next = gameReducer(s, answer);
      // Re-label the confirmation of the revealed move so it doesn't look like the player's own success.
      const log2 = next.log.map((e, i) => (i === before && e.kind === 'ok' ? { ...e, kind: 'reveal' as const, text: `Answer: ${e.text.replace(/^Correct: /, '')}` } : e));
      return { ...next, log: log2, reveals: s.reveals + 1 };
    }
  }
}

/** The action a perfect player would take now (used for "Show answer" and for tests). */
export function correctAction(s: Session): GameAction | null {
  const step = currentStep(s);
  switch (s.phase) {
    case 'pick':
      if (!step) return { type: 'end', result: currentRound(s).end === 'cutoff' ? 'cutoff' : 'failure' };
      return { type: 'pick', key: step.before.frontier[0].key };
    case 'decide':
      return step ? { type: 'decide', decision: step.decision } : null;
    case 'children':
      return step ? { type: 'children', rows: correctChildRows(s, step) } : null;
    case 'edit':
      if (!step) return null;
      if (goalChild(step)) return { type: 'goal-generated' };
      return { type: 'edit', frontier: correctDraft(s, step.after.frontier), explored: [...step.after.explored] };
    case 'final':
      return s.trace.solution ? { type: 'final', path: [...s.trace.solution.path], cost: s.trace.solution.g } : null;
    case 'done':
      return null;
  }
}

export function correctChildRows(s: Session, step: Step): ChildInput[] {
  const fields = VALUE_FIELDS[s.trace.algo];
  return step.children.map((c) => ({
    node: c.node,
    action: c.action,
    values: Object.fromEntries(fields.map((f) => [f, c.entry[f]])),
  }));
}

export function correctDraft(s: Session, frontier: FrontierEntry[]): DraftEntry[] {
  const fields = VALUE_FIELDS[s.trace.algo];
  return frontier.map((e) => ({ node: e.node, values: Object.fromEntries(fields.map((f) => [f, e[f]])) }));
}

export interface View {
  frontier: FrontierEntry[];
  explored: string[];
  current: FrontierEntry | null;
  limit?: number;
  /** Nodes taken out of the frontier so far in this round, in order (incl. cutoffs). */
  removed: { node: string; parent: string | null; decision: NodeDecision }[];
  solutionPath: string[] | null;
}

export function view(s: Session): View {
  const round = currentRound(s);
  const step = currentStep(s);
  const last = round.steps[round.steps.length - 1];
  const removedUpTo = (n: number) => round.steps.slice(0, n).map((st) => ({ node: st.pop.node, parent: st.pop.parent, decision: st.decision }));
  const base = { limit: round.limit, solutionPath: null };

  if (s.phase === 'pick') {
    if (step) return { ...base, frontier: step.before.frontier, explored: step.before.explored, current: null, removed: removedUpTo(s.step) };
    return { ...base, frontier: last?.after.frontier ?? [], explored: last?.after.explored ?? [], current: null, removed: removedUpTo(s.step) };
  }
  if (s.phase === 'decide' || s.phase === 'children' || s.phase === 'edit') {
    return {
      ...base,
      frontier: step!.before.frontier.filter((e) => e.key !== step!.pop.key),
      explored: step!.before.explored,
      current: step!.pop,
      removed: removedUpTo(s.step + 1),
    };
  }
  // final / done
  const shown = step ?? last;
  const solved = s.trace.status === 'solution' && !!s.trace.solution;
  return {
    ...base,
    frontier: shown?.after.frontier ?? [],
    explored: shown?.after.explored ?? [],
    current: step ? step.pop : null,
    removed: removedUpTo(step ? s.step + 1 : s.step),
    solutionPath: solved && s.phase === 'done' ? s.trace.solution!.path : null,
  };
}

export function stars(s: Session): number {
  const penalty = s.mistakes + 2 * s.reveals + 0.5 * s.hintsUsed;
  if (penalty === 0) return 3;
  if (penalty <= 3) return 2;
  return 1;
}

export function phaseTitle(s: Session): string {
  const name = ALGOS[s.trace.algo].abbr;
  switch (s.phase) {
    case 'pick':
      return currentStep(s) ? `Which entry does ${name} take out of the frontier next?` : 'The frontier is empty. What is the result?';
    case 'decide':
      return `You took ${currentStep(s)!.pop.node} out of the frontier. What happens now?`;
    case 'children':
      return `Expand ${currentStep(s)!.pop.node}: what happens to each successor?`;
    case 'edit':
      return `Expand ${currentStep(s)!.pop.node}: update the frontier${s.trace.algo === 'dls' || s.trace.algo === 'ids' ? '' : ' and the explored set'}.`;
    case 'final':
      return 'Goal reached! Which path was found, and what does it cost?';
    case 'done':
      return 'Finished!';
  }
}
