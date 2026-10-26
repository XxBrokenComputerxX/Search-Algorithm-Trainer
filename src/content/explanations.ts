import type { AlgoId } from '../engine/trace';

/** Pseudocode line tags the play screen highlights: */
export type LineTag = 'init' | 'empty' | 'pop' | 'goal' | 'cutoff' | 'explored' | 'expand' | 'goal-gen' | 'loop' | 'restart';

export interface CodeLine {
  text: string;
  indent: number;
  tags?: LineTag[];
}

export interface Explanation {
  intuition: string[];
  howTo: string[];
  pitfalls: string[];
  contrasts: { other: AlgoId; text: string }[];
  pseudocode: CodeLine[];
}

const L = (indent: number, text: string, ...tags: LineTag[]): CodeLine => ({ indent, text, tags });

export const EXPLANATIONS: Record<AlgoId, Explanation> = {
  bfs: {
    intuition: [
      'Breadth-first search explores the graph in “rings”: first everything one edge away from the start, then everything two edges away, and so on.',
      'It does this with a FIFO queue - nodes leave the frontier in the same order they entered it. Because of that, the first time BFS reaches a node it has used the fewest possible edges.',
      'BFS knows that, so it already checks for the goal when a node is generated (as in AIMA): no shallower path can still show up later.',
    ],
    howTo: [
      'Put the start node in the queue. (If the start is the goal, you are done.)',
      'Take the node at the front of the queue (the oldest one) and add it to the explored set.',
      'Go through its successors in alphabetical order. Skip a successor if it is explored or already in the queue.',
      'If a new successor is the goal → stop and return the path. Otherwise append it to the back of the queue.',
      'Repeat. If the queue runs empty, return failure.',
    ],
    pitfalls: [
      'Taking the newest node instead of the oldest - that is DFS!',
      'Waiting until the goal is expanded: BFS stops as soon as the goal is generated.',
      'Thinking BFS is optimal on weighted graphs. It minimises the number of edges, not the cost.',
    ],
    contrasts: [
      { other: 'ucs', text: 'UCS is “BFS by cost”: it orders by g instead of insertion time, which makes it optimal for any positive edge costs.' },
      { other: 'dfs', text: 'DFS uses a stack instead of a queue - same loop, opposite end of the frontier.' },
      { other: 'ids', text: 'IDS finds the same shallowest goal as BFS but needs only O(b·d) memory instead of O(b^d).' },
    ],
    pseudocode: [
      L(0, 'function BFS(problem):', 'init'),
      L(1, 'node ← start; if GOAL(node) return node', 'init'),
      L(1, 'frontier ← FIFO queue [node]; explored ← ∅', 'init'),
      L(1, 'loop:', 'loop'),
      L(2, 'if frontier is empty: return failure', 'empty'),
      L(2, 'node ← POP-OLDEST(frontier)', 'pop'),
      L(2, 'add node to explored', 'explored'),
      L(2, 'for each child of node (alphabetical):', 'expand'),
      L(3, 'if child ∉ explored and child ∉ frontier:', 'expand'),
      L(4, 'if GOAL(child): return child', 'goal-gen'),
      L(4, 'append child to the back of frontier', 'expand'),
    ],
  },
  ucs: {
    intuition: [
      'Uniform-cost search always expands the node with the cheapest path from the start so far - the lowest g.',
      'Think of water flowing out from the start: it reaches nearby (cheap) places first, regardless of how many edges that takes.',
      'Because it expands nodes in order of increasing g, the first time the goal is taken out of the frontier its path is the cheapest one. That is why the goal test happens on expansion, not generation.',
    ],
    howTo: [
      'Put the start node in the priority queue with g = 0.',
      'Take out the entry with the lowest g (ties: alphabetically). If it is the goal → done.',
      'Add it to the explored set and look at each successor: g(child) = g(node) + edge cost.',
      'Explored → skip. Already in the frontier with a higher g → replace it. Already there with lower/equal g → keep the old one. Otherwise → add.',
      'Repeat until the goal is taken out or the frontier is empty (failure).',
    ],
    pitfalls: [
      'Stopping when the goal is generated - a cheaper path to it might still be found.',
      'Forgetting to replace a frontier entry when a cheaper path to the same node appears.',
      'Using the edge cost alone instead of the total path cost g.',
    ],
    contrasts: [
      { other: 'bfs', text: 'On unweighted graphs UCS behaves like BFS. With weights, BFS can return a more expensive path.' },
      { other: 'astar', text: 'A* is UCS plus a heuristic: f = g + h instead of f = g. With h = 0, A* is exactly UCS.' },
      { other: 'greedy', text: 'Greedy looks only forward (h); UCS looks only backward (g).' },
    ],
    pseudocode: [
      L(0, 'function UCS(problem):', 'init'),
      L(1, 'frontier ← priority queue by g, containing start (g = 0)', 'init'),
      L(1, 'explored ← ∅', 'init'),
      L(1, 'loop:', 'loop'),
      L(2, 'if frontier is empty: return failure', 'empty'),
      L(2, 'node ← POP-LOWEST-g(frontier)', 'pop'),
      L(2, 'if GOAL(node): return node', 'goal'),
      L(2, 'add node to explored', 'explored'),
      L(2, 'for each child of node (alphabetical):', 'expand'),
      L(3, 'g(child) ← g(node) + cost(node, child)', 'expand'),
      L(3, 'if child ∉ explored and child ∉ frontier: insert child', 'expand'),
      L(3, 'else if child ∈ frontier with higher g: replace it', 'expand'),
    ],
  },
  dfs: {
    intuition: [
      'Depth-first search always continues from the node it discovered most recently - it dives down one branch as deep as possible and only backtracks when it is stuck.',
      'The frontier is a LIFO stack. In this game children are pushed so that the alphabetically first child lies on top and is expanded next.',
      'DFS needs very little memory (in the tree-search version) but gives no guarantee about the quality of the path it finds.',
    ],
    howTo: [
      'Push the start node onto the stack.',
      'Pop the top node (the newest one). If it is the goal → done.',
      'Add it to the explored set.',
      'Push its successors that are neither explored nor already in the frontier - the alphabetically first one must end up on top.',
      'Repeat. If the stack runs empty, return failure.',
    ],
    pitfalls: [
      'Pushing children in the wrong order: the alphabetically first child goes on top.',
      'Treating the stack like a queue (taking the oldest node).',
      'Expecting the shortest path. DFS returns whatever it finds first.',
    ],
    contrasts: [
      { other: 'bfs', text: 'BFS = same algorithm with a FIFO queue. BFS finds the shallowest goal; DFS can find a very deep one.' },
      { other: 'dls', text: 'DLS is DFS with a depth limit, which stops it from diving forever.' },
      { other: 'ids', text: 'IDS repeats DLS with growing limits to combine DFS memory with BFS guarantees.' },
    ],
    pseudocode: [
      L(0, 'function DFS(problem):', 'init'),
      L(1, 'frontier ← LIFO stack [start]; explored ← ∅', 'init'),
      L(1, 'loop:', 'loop'),
      L(2, 'if frontier is empty: return failure', 'empty'),
      L(2, 'node ← POP-NEWEST(frontier)', 'pop'),
      L(2, 'if GOAL(node): return node', 'goal'),
      L(2, 'add node to explored', 'explored'),
      L(2, 'for each child (alphabetical, first child ends on top):', 'expand'),
      L(3, 'if child ∉ explored and child ∉ frontier: push child', 'expand'),
    ],
  },
  dls: {
    intuition: [
      'Depth-limited search is DFS with a safety rope: nodes deeper than a limit ℓ are never generated.',
      'A node at depth ℓ is still goal-tested, but not expanded - that event is called a cutoff.',
      'At the end the result is one of three: a solution, “cutoff” (the goal may exist deeper - we just did not look), or “failure” (no cutoff happened, so there truly is no solution).',
      'Like AIMA’s version, DLS here has no explored set; it only avoids cycles by not revisiting nodes on the current path. So the same node may sit in the stack several times via different paths.',
    ],
    howTo: [
      'Push the start node (depth 0).',
      'Pop the top entry. If it is the goal → done.',
      'If its depth equals ℓ → cutoff: do not expand it, but remember that a cutoff happened.',
      'Otherwise push every successor that is not on its path (depth + 1), alphabetically first on top.',
      'When the stack is empty: return cutoff if any cutoff happened, failure otherwise.',
    ],
    pitfalls: [
      'Checking the depth before the goal test - a goal at depth ℓ must still be found.',
      'Answering “failure” although a node was cut off.',
      'Using an explored set: DLS only checks the current path.',
    ],
    contrasts: [
      { other: 'dfs', text: 'Same stack discipline as DFS, but it can never run deeper than ℓ.' },
      { other: 'ids', text: 'IDS calls DLS repeatedly with ℓ = 0, 1, 2, ... until the result is not cutoff.' },
      { other: 'bfs', text: 'DLS does not guarantee the shallowest goal, even if ℓ ≥ d.' },
    ],
    pseudocode: [
      L(0, 'function DLS(problem, ℓ):', 'init'),
      L(1, 'frontier ← LIFO stack [start]; result ← failure', 'init'),
      L(1, 'while frontier is not empty:', 'loop'),
      L(2, 'node ← POP-NEWEST(frontier)', 'pop'),
      L(2, 'if GOAL(node): return node', 'goal'),
      L(2, 'if DEPTH(node) = ℓ: result ← cutoff', 'cutoff'),
      L(2, 'else for each child not on the path to node:', 'expand'),
      L(3, 'push child (depth + 1), first child ends on top', 'expand'),
      L(1, 'return result   // cutoff or failure', 'empty'),
    ],
  },
  ids: {
    intuition: [
      'Iterative deepening search runs depth-limited search with limit 0, then 1, then 2, ... each time starting over from scratch.',
      'It looks wasteful, but most nodes of a tree live in its deepest level, so repeating the shallow levels costs little - total time is still O(b^d).',
      'You get the best of both worlds: like BFS it finds the shallowest goal (complete; optimal for unit costs), like DFS it needs only O(b·d) memory.',
    ],
    howTo: [
      'Set ℓ = 0 and run DLS (see the DLS rules: goal test, then cutoff at depth ℓ, cycle check on the path).',
      'If DLS returns a solution → done. If it returns failure → no solution exists.',
      'If it returns cutoff → increase ℓ by one and run DLS again from the start.',
    ],
    pitfalls: [
      'Carrying the frontier over between iterations - every iteration starts fresh with just the start node.',
      'Stopping on cutoff instead of increasing the limit.',
    ],
    contrasts: [
      { other: 'bfs', text: 'Same result as BFS (shallowest goal), much less memory.' },
      { other: 'dls', text: 'IDS is a loop around DLS - it removes the need to guess the right limit.' },
      { other: 'ucs', text: 'For weighted graphs IDS is not optimal; UCS is.' },
    ],
    pseudocode: [
      L(0, 'function IDS(problem):', 'init'),
      L(1, 'for ℓ = 0, 1, 2, ...:', 'restart'),
      L(2, 'result ← DLS(problem, ℓ)', 'loop'),
      L(3, 'pop newest; if GOAL: return it', 'pop', 'goal'),
      L(3, 'if DEPTH = ℓ: cutoff', 'cutoff'),
      L(3, 'else push children not on path', 'expand'),
      L(2, 'if result ≠ cutoff: return result', 'empty'),
    ],
  },
  greedy: {
    intuition: [
      'Greedy best-first search always expands the node that looks closest to the goal according to the heuristic h - it ignores what the path so far has cost.',
      'With a good heuristic it heads straight for the goal and expands very few nodes. But because it ignores g, it happily follows a route that looks promising and turns out expensive.',
    ],
    howTo: [
      'Put the start node in the priority queue with priority h(start).',
      'Take out the entry with the lowest h (ties: alphabetically). If it is the goal → done.',
      'Add it to explored. For each successor: explored → skip; already in frontier → keep it (its h cannot change); otherwise add with priority h(child).',
      'Repeat until the goal is taken out or the frontier is empty.',
    ],
    pitfalls: ['Adding g to the priority - that would be A*.', 'Expecting the cheapest path.'],
    contrasts: [
      { other: 'astar', text: 'A* adds the cost so far: f = g + h. That one change makes it optimal (with a consistent h).' },
      { other: 'ucs', text: 'UCS uses only g (backward-looking); Greedy uses only h (forward-looking).' },
    ],
    pseudocode: [
      L(0, 'function GREEDY(problem):', 'init'),
      L(1, 'frontier ← priority queue by h, containing start', 'init'),
      L(1, 'explored ← ∅', 'init'),
      L(1, 'loop:', 'loop'),
      L(2, 'if frontier is empty: return failure', 'empty'),
      L(2, 'node ← POP-LOWEST-h(frontier)', 'pop'),
      L(2, 'if GOAL(node): return node', 'goal'),
      L(2, 'add node to explored', 'explored'),
      L(2, 'for each child of node (alphabetical):', 'expand'),
      L(3, 'if child ∉ explored and child ∉ frontier: insert child with h(child)', 'expand'),
    ],
  },
  astar: {
    intuition: [
      'A* orders the frontier by f(n) = g(n) + h(n): what reaching n has cost, plus an estimate of what is still to come. f is an estimate of the cost of the cheapest solution through n.',
      'If h never overestimates (admissible) and - for graph search - satisfies h(n) ≤ c(n, n′) + h(n′) (consistent), the first time the goal is taken out of the frontier its path is optimal.',
      'A* is optimally efficient: no other optimal algorithm using the same heuristic is guaranteed to expand fewer nodes. Its weakness is memory - it keeps every generated node.',
    ],
    howTo: [
      'Put the start node in the priority queue with f = 0 + h(start).',
      'Take out the entry with the lowest f (ties: alphabetically). If it is the goal → done.',
      'Add it to explored. For each successor compute g = g(node) + cost, f = g + h(child).',
      'Explored → skip. In frontier with higher f → replace. In frontier otherwise → keep the old entry. Else → add.',
      'Repeat until the goal is taken out or the frontier is empty.',
    ],
    pitfalls: [
      'Stopping when the goal is generated instead of when it is taken out of the frontier.',
      'Forgetting the replacement step when a cheaper path to a frontier node appears.',
      'Using an inconsistent heuristic with graph search: explored nodes are not reopened, so A* can miss the optimum (see “Misleading Signposts”).',
    ],
    contrasts: [
      { other: 'ucs', text: 'With h = 0 everywhere, A* is exactly UCS. A good h lets A* skip nodes that UCS would expand.' },
      { other: 'greedy', text: 'Greedy uses only h and is not optimal; A* balances h with the real cost g.' },
    ],
    pseudocode: [
      L(0, 'function A*(problem):', 'init'),
      L(1, 'frontier ← priority queue by f = g + h, containing start', 'init'),
      L(1, 'explored ← ∅', 'init'),
      L(1, 'loop:', 'loop'),
      L(2, 'if frontier is empty: return failure', 'empty'),
      L(2, 'node ← POP-LOWEST-f(frontier)', 'pop'),
      L(2, 'if GOAL(node): return node', 'goal'),
      L(2, 'add node to explored', 'explored'),
      L(2, 'for each child of node (alphabetical):', 'expand'),
      L(3, 'g ← g(node) + cost; f ← g + h(child)', 'expand'),
      L(3, 'if child ∉ explored and child ∉ frontier: insert child', 'expand'),
      L(3, 'else if child ∈ frontier with higher f: replace it', 'expand'),
    ],
  },
};

export const DIFFICULTY_INFO = {
  easy: {
    label: 'Easy',
    task: 'Choose which frontier entry is taken out next. Everything else is done for you.',
  },
  medium: {
    label: 'Medium',
    task: 'Choose the next entry, run the goal test, and decide for every successor whether it is added, skipped or replaces an entry - with its values.',
  },
  hard: {
    label: 'Hard',
    task: 'Maintain the frontier and explored set yourself (order matters for queues and stacks!), decide when to stop, and give the final path and cost.',
  },
} as const;
