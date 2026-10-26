# Search Algorithm Trainer - Feature & Architecture Reference

This document describes everything the app does and how it is built. It is written for both humans and AI coding agents: read it before changing behaviour, and update it when you add or change a feature.

---

## 1. What the app is

A browser-based learning game that teaches seven graph-search algorithms by making the player **execute them by hand**, step by step, with immediate feedback that explains every mistake.

| Family | Algorithms |
|---|---|
| Uninformed | Breadth-first search (BFS), Uniform-cost search (UCS), Depth-first search (DFS), Depth-limited search (DLS), Iterative deepening search (IDS) |
| Informed | Greedy best-first search, A* |

Graphs can be directed or undirected, weighted or unweighted. Algorithms that ignore weights (BFS, DFS, DLS, IDS) still report the real cost of the path they find, which is how the game shows that they are not optimal on weighted graphs.

Tech: Vite + React 19 + TypeScript, `react-router-dom` (HashRouter), Vitest. No backend - everything runs and is stored in the browser.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (engine, game logic, storage, schema)
npm run build    # type-check + static build into dist/ (base './', works from any static folder)
```

---

## 2. Pages and routes

| Route | Page | Purpose |
|---|---|---|
| `/#/` | Start page (`src/pages/StartPage.tsx`) | Hero text; **"1. What do you want to learn?"** - two cards *Uninformed search* / *Informed search* act as a filter (`?family=uninformed\|informed`); **"2. Pick an algorithm"** - algorithm cards for the chosen family with frontier type, complete/optimal badges and best stars per difficulty; "How it works" (the three difficulties); links to Compare and Graph editor. |
| `/#/algo/:algo` | Algorithm page (`AlgorithmPage.tsx`) | Header with properties; difficulty tabs (`?difficulty=easy\|medium\|hard`) with the task description; list of built-in graphs for that difficulty plus "Your graphs" (custom graphs work in every difficulty); DLS depth-limit input; full explanation (idea, steps by hand, pseudocode, properties, common mistakes, comparisons, rules). |
| `/#/play/:algo/:difficulty/:graphId[?limit=n]` | Play page (`PlayPage.tsx`) | The game (see §3). `limit` only applies to DLS. |
| `/#/compare` | Compare page (`ComparePage.tsx`) | Full properties table (complete, optimal, frontier, goal test, time, space + conditions); **algorithm race** (every applicable algorithm on a chosen graph: order of nodes taken from the frontier, path, cost, optimal ✓/✗; IDS shown per iteration; adjustable DLS limit); **10-question quiz** with explanations; game rules. |
| `/#/editor` | Editor home (`EditorPage.tsx` → `EditorHome`) | List of custom graphs (edit / export / delete with inline confirm); create new; copy a built-in graph; import JSON. |
| `/#/editor/:id` | Graph editor (`EditorPage.tsx` → `GraphEditor`) | `id = new` creates a graph (`?from=<graphId>` copies one). See §7. |

The algorithm ids used in URLs: `bfs`, `ucs`, `dfs`, `dls`, `ids`, `greedy`, `astar`.

---

## 3. Gameplay

### 3.1 Screen layout (Play page)
- **Board (left):** SVG graph with node colours (being expanded = violet, in frontier = amber, explored/visited = grey, cut off = red dashed, solution path = green), start/goal double rings, h values (informed algorithms only), edge costs (weighted graphs), dashed search-tree edges, highlighted outgoing edges of the node being expanded. Below: legend, latest feedback message, collapsible history log.
- **Work column (middle):** the **task panel** (what to do now, with *Hint* and *Show answer*), the **frontier** panel, the **explored set** + **order taken from frontier** (or, for DLS/IDS, "taken from frontier this round" with ✂ for cutoffs), and the **pseudocode** with the current line(s) highlighted.
- **Comparison sidebar (right, collapsible; moves below the board on screens < 1400 px):** complete/optimal table for all seven algorithms with the current one highlighted (hover for the exact condition), a one-sentence summary, facts, "Compared with…" contrasts, the graph's teaching note, and the current score.
- **Header:** depth limit ℓ and IDS iteration, mistakes, hints used, *Explain* (drawer with the full explanation; Esc closes), *Restart*, *Hide/Show comparison*.

### 3.2 Turn structure (phases)
The game is a state machine (`src/game/session.ts`). Each loop iteration of the algorithm is one "step":

1. **pick** - choose which frontier entry is removed next (click it in the frontier list, or click the node on the graph when it is unambiguous). If the frontier is empty, choose *Frontier empty → return failure* or (DLS/IDS) *→ return cutoff*. For IDS, a correct "cutoff" restarts the search with ℓ + 1.
2. **decide** (Medium/Hard) - for the removed node: *Goal test passes → return solution*, *Depth limit reached → cutoff* (DLS/IDS only), or *Expand*.
3. **children** (Medium) - for each successor (alphabetical) choose: *Add to frontier*, *Skip - already explored*, *Skip - already in frontier (keep old)*, *Replace frontier entry (cheaper)* (UCS/Greedy/A*), *Skip - on current path (cycle)* (DLS/IDS), or *Goal! Stop now* (correct only for BFS, which tests on generation). For added/replaced children also enter the values: g (UCS), h (Greedy), g/h/f (A*), depth (DLS/IDS); BFS/DFS need no values.
4. **edit** (Hard) - instead of 3: edit the frontier directly (add entries at front/back or top/bottom, move up/down, delete, edit values) and toggle nodes in the explored set; or press *Goal generated → stop* (BFS). Order is checked for queues and stacks; for priority queues only the entries and values matter.
5. **final** (Hard) - after the goal is found: click the solution path on the graph (start → goal) and enter its cost.
6. **done** - result summary (§4).

### 3.3 Difficulties

| | Easy | Medium | Hard |
|---|---|---|---|
| Player does | pick only | pick, decide, classify successors + values | pick, decide, edit frontier & explored set, give path + cost |
| Done automatically | goal test, successors, empty-frontier result | - | - |
| Frontier shown | alphabetically ("bag"), with #insertion numbers or values | same | the player's own list (true order) for queues/stacks; alphabetical for priority queues |
| Built-in graphs | 6-7 nodes | 8-9 nodes, cycles | 10-20 nodes, traps |

Showing the frontier alphabetically in Easy/Medium is deliberate: the player has to apply the ordering rule (oldest #, newest #, lowest g/h/f) rather than click the first item.

### 3.4 Feedback, hints, answers
- Every wrong action is rejected with an explanation generated from the algorithm's rule and the actual numbers (`src/engine/checker.ts`), e.g. *"UCS always expands the entry with the lowest g. C has g = 4, but D has g = 5."*, *"f(B) = g + h = 5 + 5 = 10"*, *"UCS tests the goal when a node is expanded… Testing on generation could return a more expensive path."*, cutoff vs failure explanations, wrong order in a stack, missing explored entries, wrong parent pointer in the final path.
- Correct actions are confirmed with a short reason, so the history log reads like a worked solution.
- **Hint** (2 levels per decision): level 1 = the rule; level 2 = concrete pointer (e.g. "the lowest f in the frontier is 7, shared by B, D").
- **Show answer** performs the correct action, logs it as "Answer: …", and counts as a reveal.

### 3.5 Scoring and progress
- Penalty = mistakes + 2 × answers shown + 0.5 × hints used. **3 stars** if 0, **2 stars** if ≤ 3, otherwise **1 star**.
- Best stars are stored per algorithm × difficulty × graph and shown on the start page cards and graph lists.

---

## 4. Teaching the differences between algorithms

- **Result summary** (end of every game): stars and stats, an insight paragraph (e.g. *"Greedy found a path of cost 11, but the cheapest path costs 10. Greedy follows the heuristic and ignores the cost already paid."*; for A* it diagnoses an inadmissible or inconsistent heuristic), a cutoff explanation for DLS, and a table running **every applicable algorithm on the same graph** (path, cost with ✓/✗ vs. optimum, nodes expanded) with "play" links.
- **Comparison sidebar** on the play screen (§3.1) and the **Compare page** (§2).
- **Per-algorithm explanations** (`src/content/explanations.ts`): intuition, how to do it by hand, pseudocode, common mistakes, contrasts with related algorithms.
- **Properties** (`src/engine/properties.ts`, AIMA): BFS complete, optimal only for unit costs, O(b^d)/O(b^d); UCS complete & optimal (costs ≥ ε); DFS complete only in finite graphs (graph search), not optimal, O(b^m)/O(bm); DLS incomplete if ℓ < d, not optimal; IDS complete, optimal for unit costs, O(b^d)/O(bd); Greedy complete only in finite graphs, not optimal; A* complete, optimal with admissible (tree) / consistent (graph) h.

---

## 5. Algorithm conventions (what counts as "correct")

Single source of truth: `src/engine/conventions.ts` (also displayed in-app as "Rules used in this game"). Follows Russell & Norvig (AIMA).

| Rule | Detail |
|---|---|
| Successor order | Alphabetical by node id (plain code-point comparison). |
| Ties | Priority queue: lower value first, then alphabetical id, then older entry. Queue/stack: insertion order (#1, #2, …). |
| Stack push order | Children are pushed so the alphabetically first child is on top (it gets the highest # of its batch). |
| BFS | Graph search, FIFO, explored set; start goal-tested first; **goal test on generation** (stops as soon as the goal child is generated); skips children that are explored or already in the frontier. |
| DFS | Graph search, LIFO, explored set; goal test on expansion; skips children explored or already in the frontier. |
| UCS / Greedy / A* | Best-first graph search with f = g / h / g + h; goal test on expansion; explored nodes are **never reopened**; a frontier entry is **replaced only if the new f is strictly lower** (so Greedy never replaces). |
| DLS | Tree search (no explored set) with a **cycle check on the current path**; goal test first, then a node at depth = ℓ is a **cutoff** (not expanded); result `cutoff` if any cutoff happened, else `failure`. The same node may be in the stack several times via different paths. |
| IDS | DLS with ℓ = 0, 1, 2, … restarting from scratch (insertion numbers restart too) until the result is not `cutoff`. |
| Costs | Unweighted graphs: every edge costs 1. If two edges connect the same pair, the cheaper one is used. |

Because explored nodes are not reopened, graph-search A* can be non-optimal with an admissible but inconsistent heuristic - intentionally demonstrated by the "Misleading Signposts" graph.

---

## 6. Built-in graphs (`src/data/graphs.ts`)

| id | Name | Diff. | Type | Nodes | ℓ | Teaching point |
|---|---|---|---|---|---|---|
| `easy-first-steps` | First Steps | easy | undirected, unweighted | 7 | 3 | Basics; DLS cuts off B at depth 3, then finds G. |
| `easy-weighted-warmup` | Weighted Warm-up | easy | undirected, weighted | 6 | 3 | Greedy cost 11 vs optimal 10; A* replacement and alphabetical tie-break. |
| `easy-one-way` | One-Way Streets | easy | directed, weighted | 6 | 2 | BFS finds cost 13, UCS finds 9. |
| `medium-detour` | The Detour | medium | directed, weighted | 8 | 3 | BFS & Greedy 12 vs optimal 10; A* replacements. |
| `medium-crossroads` | Crossroads | medium | undirected, weighted | 9 | 3 | Many frontier replacements; BFS 14 vs 12. |
| `medium-maze` | Little Maze | medium | undirected, unweighted | 9 | 3 | Cycles; goal at depth 4 so DLS(3) returns cutoff. |
| `hard-romania` | Romania (AIMA) | hard | undirected, weighted | 20 | 3 | Textbook reference: A* 418 (Arad, Sibiu, Rimnicu Vilcea, Fagaras, Pitesti, Bucharest), Greedy 450. |
| `hard-misleading` | Misleading Signposts | hard | directed, weighted | 10 | 4 | h admissible but inconsistent (h(A)=4 > 1 + h(C)=0): A* returns cost 7, optimum is 5. |
| `hard-deep-trap` | The Deep Trap | hard | directed, unweighted | 12 | 2 | DFS returns an 8-edge path; IDS finds the 3-edge path at ℓ = 3; DLS(2) cutoff. |

All built-in graphs have a heuristic on every node. Tests assert that every heuristic is admissible and (except `hard-misleading`) consistent.

---

## 7. Custom graphs

### 7.1 Graph editor
- **Modes:** *Select/move* (click to select, drag to move), *Add node* (click empty canvas; names A, B, C… skipping S/G), *Add edge* (click two nodes; default cost 1), *Delete*.
- **Graph settings:** name, description, start, goal, difficulty tag, default DLS limit, directed (switching to undirected merges opposite edges, keeping the cheaper cost), weighted, heuristic on/off.
- **Heuristic tools:** *Set h = true cost (perfect)* (Dijkstra to the goal), *Set all h = 0*.
- **Selected node:** rename (updates edges/start/goal), h value, make start/goal, delete. **Selected edge:** cost, flip direction, add reverse edge, delete.
- **Live check** (`src/engine/validate.ts`): errors block saving (missing name/start/goal, < 2 nodes, duplicate or invalid names, self-loops, non-positive costs on weighted graphs); warnings (goal unreachable, duplicate edges, start = goal, missing h → Greedy/A* unavailable).
- **Heuristic report** (`src/engine/heuristicCheck.ts`): admissible ✓/✗ (overestimating nodes drawn orange) and consistent ✓/✗ (violating edges drawn orange) with the exact inequalities.
- **Save** to browser storage, **Export JSON**, and after saving **Play this graph** links for every applicable algorithm and difficulty.

### 7.2 JSON format
- Schema: [`schema/graph.schema.json`](../schema/graph.schema.json) (JSON Schema 2020-12, documented field by field). Example: [`schema/example-graph.json`](../schema/example-graph.json) - add `"$schema": "./graph.schema.json"` to get autocompletion in VS Code.
- Import via *Graph editor → Import JSON…*; the importer (`parseGraph` in `src/state/graphs.ts`) validates the file, ignores unknown fields such as `$schema`, and always assigns a fresh id. Import one graph per file.
- Coordinates refer to an 800 × 500 canvas (y grows downward).
- Rules beyond the schema (checked on import/save): edge endpoints, start and goal must be existing node ids; ids unique; no self-loops.
- Tests keep the schema in sync with the app (`src/state/schema.test.ts`).

---

## 8. Persistence

`localStorage` only (per browser, per origin). Missing or blocked storage falls back to in-memory state.

| Key | Content |
|---|---|
| `sat.customGraphs.v1` | `Graph[]` - custom graphs (validated with `parseGraph` on load; invalid entries are dropped). |
| `sat.progress.v1` | `{ [algo]: { [difficulty]: { [graphId]: stars } } }` - best stars. |

---

## 9. Architecture

```
src/
  engine/                 pure TypeScript, no React - all unit-tested
    graph.ts              Graph/GNode/GEdge types, successors() (alphabetical), costs, heuristic helpers
    trace.ts              FrontierEntry, Step, Round, Trace types
    conventions.ts        rules: frontier kind, goal-test timing, value fields, child actions, RULES text
    algorithms/           bfs.ts, dfs.ts, bestFirst.ts (ucs/greedy/astar), dls.ts (dls/ids), index.ts (runAlgorithm, isApplicable)
    checker.ts            compares a player action with the trace and builds the explanation text
    properties.ts         ALGOS metadata: names, completeness/optimality with conditions, complexity
    heuristicCheck.ts     true costs to goal (Dijkstra), admissibility/consistency report
    validate.ts           editor validation, NODE_NAME pattern
  game/
    session.ts            game state machine: createSession, gameReducer, correctAction, view, stars, phaseTitle
    hints.ts              2-level hints per phase
  content/
    explanations.ts       per-algorithm prose + pseudocode (lines tagged for highlighting), difficulty texts
    quiz.ts               quiz questions
  data/graphs.ts          built-in graphs
  state/                  localStorage stores (storage.ts), custom graphs + parseGraph (graphs.ts), progress (progress.ts)
  components/             GraphCanvas (SVG, also used by the editor), FrontierPanel, ChildrenTable (Medium),
                          FrontierEditor (Hard), Pseudocode, PropertiesTable/CompareSidebar, Explanation (+drawer),
                          ResultSummary (+raceAll), common (Stars, VerdictBadge, Panel, NumberInput)
  pages/                  StartPage, AlgorithmPage, PlayPage, ComparePage, EditorPage
  styles.css              all styles; colour tokens on :root with a dark-mode override
schema/                   graph.schema.json, example-graph.json
```

**Data flow:** `Graph` → `runAlgorithm(algo, graph, limit)` produces a complete **`Trace`** up front (every round, step, frontier snapshot before/after, child decisions) → `createSession(trace, difficulty)` → `gameReducer(session, action)` checks each player action against the trace via `checker.ts` and advances → `view(session)` derives what to display (frontier, explored, current node, removed nodes, solution path) → React components render it.

Key idea: the game never "simulates" the player's state independently. The trace is the ground truth, and after each correct step the displayed state is the trace's snapshot. This keeps checking simple and guarantees consistency.

Important types:
- `FrontierEntry` - `{ key (path joined by ">"), node, parent, path, g, h, f, depth, seq }`. `f` is the priority (g for UCS, h for Greedy, g+h for A*). `seq` is the insertion number.
- `Step` - `{ before, pop, decision: 'goal'|'cutoff'|'expand', children: ChildRecord[], after }`; `Snapshot.frontier` is in true removal order (index 0 = next out).
- `ChildRecord.action` - `add | skip-explored | skip-frontier | replace | skip-path | goal`.
- `Round` - one search loop (`limit`, `steps`, `end: solution|cutoff|failure`); only IDS has several.

---

## 10. How to extend

- **Add a built-in graph:** add a `build({...})` entry in `src/data/graphs.ts` and append it to `BUILTIN_GRAPHS`. Give every node an `h` (admissible/consistent unless it is meant as a trap - then set `note`). The test suite automatically plays it with every algorithm at every difficulty and checks the heuristic.
- **Change a rule:** edit the algorithm in `src/engine/algorithms/`, then the matching text in `conventions.ts` (`RULES`), `checker.ts` (explanations), `game/hints.ts`, and `content/explanations.ts`, and this document.
- **Add an algorithm:** add its id to `AlgoId`/`ALGO_IDS` (`trace.ts`); add entries to every `Record<AlgoId, …>` in `conventions.ts`, `properties.ts` (`ALGOS`, and `UNINFORMED`/`INFORMED_IDS`), `content/explanations.ts`; implement it to return a `Trace` and register it in `algorithms/index.ts`. TypeScript will flag every missing map entry.
- **Add quiz questions:** append to `src/content/quiz.ts`.

---

## 11. Testing

`npm test` runs:
- `src/engine/algorithms.test.ts` - AIMA Romania reference results, hand-computed small graphs (replacement, tie-break, cutoff vs failure, cycle check, inconsistent-h A*), every built-in graph solvable, heuristic properties.
- `src/game/session.test.ts` - every algorithm × built-in graph × difficulty can be played perfectly for 3 stars; mistakes are counted and explained; IDS restart; reveal accounting.
- `src/state/graphs.test.ts` - custom graphs saved in an earlier session load correctly; `parseGraph` round-trip and error messages.
- `src/state/schema.test.ts` - the schema example(s) import and validate; the schema covers every field the built-in graphs use; node-name pattern matches the app.

`npm run build` type-checks with `tsc --noEmit` (strict, no unused locals/params).

---

## 12. Known limitations

- Single-player, browser-local: custom graphs and progress don't sync between devices; use JSON export/import to move graphs.
- One goal node per graph.
- Graph-search A* never reopens explored nodes (by design, see §5).
- The editor canvas is fixed at 800 × 500; there is no zoom or auto-layout.
- Import handles one graph per file.
- UI text is English only.
