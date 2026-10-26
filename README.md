# Search Algorithm Trainer

A learning game for graph search. Instead of watching an animation, **you run the algorithm by hand** and get an explanation for every mistake.

Algorithms: **BFS, Uniform-cost search, DFS, Depth-limited search, Iterative deepening** (uninformed) and **Greedy best-first, A\*** (informed), on directed/undirected and weighted/unweighted graphs.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine + game-logic tests
npm run build    # static build in dist/ (open from any static host)
```

## What's in the game

- **Start page** - choose *Uninformed* or *Informed* search, then pick an algorithm.
- **Three difficulties**
  - *Easy*: choose which frontier entry is removed next.
  - *Medium*: also run the goal test and classify each successor (add / skip explored / skip in frontier / replace / cycle / goal) with its g, h, f or depth values.
  - *Hard*: maintain the frontier (order matters for queues and stacks) and explored set yourself, decide when to stop, and give the path and its cost.
- **Explanations on demand** - "Explain" drawer, progressive hints, "Show answer", highlighted pseudocode.
- **Comparison side panel** - completeness/optimality of all algorithms with the exact conditions; the result screen runs every algorithm on the same graph and explains why costs differ.
- **Compare page** - full property table, algorithm race on any graph, and a quiz.
- **Graph editor** - build your own graphs (nodes, directed/undirected edges, costs, heuristic values), with an admissibility/consistency checker. Graphs are saved in the browser and can be exported/imported as JSON.

## Conventions (AIMA)

Successors are generated alphabetically; priority-queue ties are broken alphabetically. BFS tests the goal on generation, all others on expansion. BFS/DFS/UCS/Greedy/A\* are graph searches with an explored set (no reopening; a frontier entry is replaced only by a strictly better value). DLS/IDS are tree searches with a cycle check on the current path and distinguish *cutoff* from *failure*. The full list is shown in the app under "Rules used in this game" and lives in `src/engine/conventions.ts`.

## Documentation

- [`docs/FEATURES.md`](docs/FEATURES.md) - every feature, the exact rules, built-in graphs, architecture and how to extend (for humans and AI agents).
- [`schema/graph.schema.json`](schema/graph.schema.json) - JSON Schema for creating graphs by hand; see [`schema/example-graph.json`](schema/example-graph.json). Import via *Graph editor → Import JSON…*.

## Code layout

- `src/engine/` - pure TypeScript: graph model, the seven algorithms (each produces a full step trace), the checker that turns mismatches into explanations, properties, heuristic checks.
- `src/game/` - the game state machine (`session.ts`) and hints.
- `src/content/` - explanations, pseudocode, quiz.
- `src/data/graphs.ts` - built-in graphs (incl. the AIMA Romania map).
- `src/pages/`, `src/components/` - React UI.
