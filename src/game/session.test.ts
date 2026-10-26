import { describe, expect, it } from 'vitest';
import { BUILTIN_GRAPHS } from '../data/graphs';
import { runAlgorithm } from '../engine/algorithms';
import { ALGO_IDS } from '../engine/trace';
import { DIFFICULTIES } from '../engine/graph';
import { correctAction, createSession, gameReducer, stars, view, type Session } from './session';

function playPerfectly(s: Session): Session {
  for (let i = 0; i < 500 && s.phase !== 'done'; i++) {
    const a = correctAction(s);
    if (!a) throw new Error(`no correct action in phase ${s.phase}`);
    s = gameReducer(s, a);
  }
  return s;
}

const graph = (id: string) => BUILTIN_GRAPHS.find((g) => g.id === id)!;

describe('game session', () => {
  for (const g of BUILTIN_GRAPHS) {
    for (const algo of ALGO_IDS) {
      for (const d of DIFFICULTIES) {
        it(`${algo} on ${g.name} (${d}) can be played perfectly for 3 stars`, () => {
          const s = playPerfectly(createSession(runAlgorithm(algo, g), d));
          expect(s.phase).toBe('done');
          expect(s.mistakes).toBe(0);
          expect(stars(s)).toBe(3);
        });
      }
    }
  }

  it('a wrong pick counts as a mistake and explains FIFO order', () => {
    let s = createSession(runAlgorithm('bfs', graph('easy-first-steps')), 'easy');
    s = gameReducer(s, { type: 'pick', key: 'S' }); // S → A, B
    s = gameReducer(s, { type: 'pick', key: 'S>B' });
    expect(s.mistakes).toBe(1);
    expect(s.log.at(-1)?.text).toMatch(/FIFO/);
    s = gameReducer(s, { type: 'pick', key: 'S>A' });
    expect(s.mistakes).toBe(1);
  });

  it('Medium: choosing "goal" on generation in UCS is a mistake', () => {
    let s = createSession(runAlgorithm('ucs', graph('easy-one-way')), 'medium');
    // Play until a step where G is a successor.
    for (let i = 0; i < 100; i++) {
      const v = view(s);
      if (s.phase === 'children' && v.current && ['B', 'C', 'D'].includes(v.current.node)) break;
      s = gameReducer(s, correctAction(s)!);
    }
    const rows = (correctAction(s) as { type: 'children'; rows: { node: string; action: string; values: object }[] }).rows.map((r) =>
      r.node === 'G' ? { ...r, action: 'goal' as const } : r,
    );
    s = gameReducer(s, { type: 'children', rows: rows as never });
    expect(s.mistakes).toBe(1);
    expect(s.log.at(-1)?.text).toMatch(/expanded/);
  });

  it('Hard: wrong value in the frontier is reported with its derivation', () => {
    let s = createSession(runAlgorithm('astar', graph('easy-weighted-warmup')), 'hard');
    s = gameReducer(s, { type: 'pick', key: 'S' });
    s = gameReducer(s, { type: 'decide', decision: 'expand' });
    s = gameReducer(s, {
      type: 'edit',
      frontier: [
        { node: 'A', values: { g: 2, h: 6, f: 8 } },
        { node: 'B', values: { g: 5, h: 5, f: 9 } },
      ],
      explored: ['S'],
    });
    expect(s.mistakes).toBe(1);
    expect(s.editProblems?.[0]).toMatch(/f\(B\) = g \+ h = 5 \+ 5 = 10/);
  });

  it('IDS asks for cutoff and restarts with a bigger limit', () => {
    let s = createSession(runAlgorithm('ids', graph('hard-deep-trap')), 'medium');
    s = gameReducer(s, { type: 'pick', key: 'S' });
    s = gameReducer(s, { type: 'decide', decision: 'cutoff' }); // limit 0: S is cut off
    expect(s.mistakes).toBe(0);
    s = gameReducer(s, { type: 'end', result: 'failure' });
    expect(s.mistakes).toBe(1);
    s = gameReducer(s, { type: 'end', result: 'cutoff' });
    expect(s.round).toBe(1);
    expect(view(s).limit).toBe(1);
  });

  it('reveal advances but is recorded', () => {
    let s = createSession(runAlgorithm('greedy', graph('easy-first-steps')), 'easy');
    s = gameReducer(s, { type: 'reveal' });
    expect(s.reveals).toBe(1);
    expect(s.log.some((e) => e.kind === 'reveal')).toBe(true);
    expect(stars(playPerfectly(s))).toBeLessThan(3);
  });
});
