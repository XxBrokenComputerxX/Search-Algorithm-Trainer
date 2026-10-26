export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  why: string;
}

export const QUIZ: QuizQuestion[] = [
  {
    question: 'On a weighted graph, is BFS guaranteed to return the cheapest path?',
    options: ['Yes', 'No', 'Only if the graph is directed'],
    answer: 1,
    why: 'BFS finds the path with the fewest edges. It is optimal only when all step costs are equal.',
  },
  {
    question: 'Which data structure does uniform-cost search use for its frontier?',
    options: ['FIFO queue', 'LIFO stack', 'Priority queue ordered by g'],
    answer: 2,
    why: 'UCS always expands the entry with the lowest path cost g, so it needs a priority queue.',
  },
  {
    question: 'Why does UCS test for the goal on expansion rather than on generation?',
    options: [
      'It is faster',
      'A cheaper path to the goal might still be found before the goal is taken out of the frontier',
      'Because it has no explored set',
    ],
    answer: 1,
    why: 'When the goal is first generated, its path may not be the cheapest. Only once it is the cheapest entry in the frontier is its cost final.',
  },
  {
    question: 'Depth-limited search returns "cutoff". What does that tell you?',
    options: ['There is no solution', 'Some node was not expanded because of the limit - a solution may exist deeper', 'The goal is exactly at depth ℓ'],
    answer: 1,
    why: '"failure" means no solution exists; "cutoff" means the limit stopped the search somewhere, so a deeper solution is still possible.',
  },
  {
    question: 'Which algorithm is complete and optimal for unit step costs while using only O(b·d) memory?',
    options: ['BFS', 'DFS', 'Iterative deepening search', 'Greedy best-first'],
    answer: 2,
    why: 'IDS finds the shallowest goal like BFS, but each iteration is a depth-first search with linear memory.',
  },
  {
    question: 'A* with an admissible but inconsistent heuristic, as graph search without reopening explored nodes, is…',
    options: ['always optimal', 'not guaranteed to be optimal', 'not complete'],
    answer: 1,
    why: 'Graph search needs consistency: a node can be closed via an expensive path before the cheaper one is found. Try the “Misleading Signposts” graph.',
  },
  {
    question: 'What does A* become if h(n) = 0 for every node?',
    options: ['Greedy best-first search', 'Uniform-cost search', 'Breadth-first search'],
    answer: 1,
    why: 'f = g + 0 = g, which is exactly the UCS ordering.',
  },
  {
    question: 'Why is greedy best-first search not optimal?',
    options: ['It ignores the path cost already paid (g)', 'It uses a stack', 'It tests the goal on generation'],
    answer: 0,
    why: 'Greedy orders only by h. A node that looks close to the goal may have been reached by a very expensive path.',
  },
  {
    question: 'In what situation can (tree-search) DFS fail to terminate?',
    options: ['When the graph has cycles or infinite depth', 'When step costs differ', 'When there are ties'],
    answer: 0,
    why: 'Without an explored set DFS can loop forever on a cycle, and in an infinite space it can follow an infinite branch.',
  },
  {
    question: 'A heuristic is admissible if…',
    options: ['h(n) ≤ c(n, n′) + h(n′) for every edge', 'it never overestimates the true cost to the goal', 'h(goal) > 0'],
    answer: 1,
    why: 'Admissible: h(n) ≤ h*(n). The edge inequality is consistency, which is stronger (consistent ⇒ admissible).',
  },
];
