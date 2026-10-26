import { useId, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Graph } from '../engine/graph';

export const VIEW_W = 800;
export const VIEW_H = 500;

export type NodeTone = 'frontier' | 'explored' | 'current' | 'path' | 'cutoff' | 'selected' | 'warn';

export interface EditorHandlers {
  onCanvasPointerDown?: (x: number, y: number) => void;
  onNodePointerDown?: (id: string, x: number, y: number) => void;
  onEdgeClick?: (index: number) => void;
  onPointerMove?: (x: number, y: number) => void;
  onPointerUp?: () => void;
}

interface Props {
  graph: Graph;
  tones?: Record<string, NodeTone | undefined>;
  /** Edges of the solution path, as [from, to]. */
  pathEdges?: [string, string][];
  /** Search-tree edges (parent → child) discovered so far. */
  treeEdges?: [string, string][];
  /** Node whose outgoing edges are highlighted (the node being expanded). */
  activeNode?: string | null;
  showH?: boolean;
  onNodeClick?: (id: string) => void;
  isClickable?: (id: string) => boolean;
  selectedEdge?: number | null;
  warnEdges?: Set<number>;
  editor?: EditorHandlers;
  ariaLabel?: string;
}

const isShort = (id: string) => id.length <= 2;
const radius = (id: string) => (isShort(id) ? 20 : 11);

function matches(list: [string, string][] | undefined, from: string, to: string, directed: boolean): boolean {
  if (!list) return false;
  return list.some(([a, b]) => (a === from && b === to) || (!directed && a === to && b === from));
}

export function GraphCanvas({
  graph,
  tones = {},
  pathEdges,
  treeEdges,
  activeNode,
  showH = true,
  onNodeClick,
  isClickable,
  selectedEdge,
  warnEdges,
  editor,
  ariaLabel,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const pos = new Map(graph.nodes.map((n) => [n.id, n]));
  const hasH = showH && graph.nodes.some((n) => typeof n.h === 'number');

  const toSvg = (e: ReactPointerEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const edgeEls = graph.edges.map((e, i) => {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) return null;
    const reverse = graph.directed && graph.edges.some((o) => o.from === e.to && o.to === e.from);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Curve opposite-direction edges apart.
    const bend = reverse ? 22 : 0;
    const nx = -uy * bend;
    const ny = ux * bend;
    const ra = radius(e.from) + 3;
    const rb = radius(e.to) + (graph.directed ? 7 : 3);
    const x1 = a.x + ux * ra + nx * 0.35;
    const y1 = a.y + uy * ra + ny * 0.35;
    const x2 = b.x - ux * rb + nx * 0.35;
    const y2 = b.y - uy * rb + ny * 0.35;
    const cx = (a.x + b.x) / 2 + nx;
    const cy = (a.y + b.y) / 2 + ny;
    const d = reverse ? `M${x1},${y1} Q${cx},${cy} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`;
    const mx = reverse ? (x1 + 2 * cx + x2) / 4 : (a.x + b.x) / 2;
    const my = reverse ? (y1 + 2 * cy + y2) / 4 : (a.y + b.y) / 2;

    const onPath = matches(pathEdges, e.from, e.to, graph.directed);
    const onTree = matches(treeEdges, e.from, e.to, graph.directed);
    const active = !!activeNode && (e.from === activeNode || (!graph.directed && e.to === activeNode));
    const cls = [
      'gedge',
      onPath && 'path',
      !onPath && onTree && 'tree',
      active && 'active',
      selectedEdge === i && 'selected',
      warnEdges?.has(i) && 'warn',
    ]
      .filter(Boolean)
      .join(' ');
    const marker = graph.directed
      ? `url(#arrow-${uid}-${onPath ? 'path' : active ? 'active' : selectedEdge === i ? 'sel' : 'base'})`
      : undefined;
    const label = String(e.w);

    return (
      <g
        key={`${e.from}-${e.to}-${i}`}
        className={cls}
        onPointerDown={editor?.onEdgeClick ? (ev) => ev.stopPropagation() : undefined}
        onClick={editor?.onEdgeClick ? (ev) => (ev.stopPropagation(), editor.onEdgeClick!(i)) : undefined}
        style={editor?.onEdgeClick ? { cursor: 'pointer' } : undefined}
      >
        {editor?.onEdgeClick && <path d={d} className="gedge-hit" />}
        <path d={d} className="gedge-line" markerEnd={marker} />
        {graph.weighted && (
          <g className="gedge-label">
            <rect x={mx - 4 - label.length * 4} y={my - 10} width={8 + label.length * 8} height={18} rx={5} />
            <text x={mx} y={my + 3.5}>
              {label}
            </text>
          </g>
        )}
      </g>
    );
  });

  const nodeEls = graph.nodes.map((n) => {
    const r = radius(n.id);
    const tone = tones[n.id];
    const clickable = !!onNodeClick && (isClickable ? isClickable(n.id) : true);
    const cls = ['gnode', tone, n.id === graph.start && 'start', n.id === graph.goal && 'goal', clickable && 'clickable']
      .filter(Boolean)
      .join(' ');
    return (
      <g
        key={n.id}
        className={cls}
        transform={`translate(${n.x},${n.y})`}
        onClick={clickable ? () => onNodeClick!(n.id) : undefined}
        onPointerDown={
          editor?.onNodePointerDown
            ? (e) => {
                e.stopPropagation();
                const p = toSvg(e);
                editor.onNodePointerDown!(n.id, p.x, p.y);
              }
            : undefined
        }
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-label={clickable ? `Node ${n.id}` : undefined}
        onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onNodeClick!(n.id) : undefined}
      >
        {(n.id === graph.start || n.id === graph.goal) && <circle r={r + 5} className="gnode-ring" />}
        <circle r={r} className="gnode-circle" />
        {isShort(n.id) ? (
          <text className="gnode-text" y={5}>
            {n.id}
          </text>
        ) : (
          <text className="gnode-label" y={r + 15}>
            {n.id}
          </text>
        )}
        {hasH && typeof n.h === 'number' && (
          <text className="gnode-h" x={r + 3} y={-r + 1}>
            h={n.h}
          </text>
        )}
      </g>
    );
  });

  const markerColors: [string, string][] = [
    ['base', 'var(--edge)'],
    ['path', 'var(--path)'],
    ['active', 'var(--current)'],
    ['sel', 'var(--accent)'],
  ];

  return (
    <svg
      ref={svgRef}
      className={`graph-canvas${editor ? ' editing' : ''}`}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={ariaLabel ?? `Graph ${graph.name}`}
      onPointerDown={
        editor?.onCanvasPointerDown
          ? (e) => {
              const p = toSvg(e);
              editor.onCanvasPointerDown!(p.x, p.y);
            }
          : undefined
      }
      onPointerMove={
        editor?.onPointerMove
          ? (e) => {
              const p = toSvg(e);
              editor.onPointerMove!(p.x, p.y);
            }
          : undefined
      }
      onPointerUp={editor?.onPointerUp}
      onPointerLeave={editor?.onPointerUp}
    >
      <defs>
        {markerColors.map(([k, color]) => (
          <marker
            key={k}
            id={`arrow-${uid}-${k}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={color} />
          </marker>
        ))}
      </defs>
      <g>{edgeEls}</g>
      <g>{nodeEls}</g>
    </svg>
  );
}

export function GraphLegend({ showLimit = false }: { showLimit?: boolean }) {
  const items: [string, string][] = [
    ['current', 'Being expanded'],
    ['frontier', 'In frontier'],
    ['explored', showLimit ? 'Visited this round' : 'Explored'],
    ...(showLimit ? ([['cutoff', 'Cut off']] as [string, string][]) : []),
    ['path', 'Solution path'],
  ];
  return (
    <ul className="legend" aria-label="Legend">
      {items.map(([cls, label]) => (
        <li key={cls}>
          <span className={`legend-dot ${cls}`} />
          {label}
        </li>
      ))}
      <li>
        <span className="legend-dot start-ring" />
        Start / goal (double ring)
      </li>
    </ul>
  );
}
