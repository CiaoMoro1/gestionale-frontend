import { STATE_STYLES, FLOW_STATES } from "@/features/produzione";
import type { FlowGraph, ProduzioneRow, StatoProduzione } from "@/features/produzione";
import { totalsByStateForSku } from "@/features/produzione";

type Props = {
  graph: FlowGraph;
  sku?: string;
  selectedCanale?: string | null;
  allRows: ProduzioneRow[];
};

export default function FlowMap({ graph, sku, selectedCanale, allRows }: Props) {
  const width = 1100;
  const height = 320;
  const paddingX = 70;
  const nodeRadius = 28;
  const nodeY = 140;
  const step = (width - paddingX * 2) / (FLOW_STATES.length - 1);

  const positions = new Map<StatoProduzione, { x: number; y: number }>();
  FLOW_STATES.forEach((st, i) => positions.set(st, { x: paddingX + i * step, y: nodeY }));

  const totals = totalsByStateForSku(allRows, sku, selectedCanale ?? null);

  const edgeStyle = (from: StatoProduzione, to: StatoProduzione) => {
    const iFrom = FLOW_STATES.indexOf(from);
    const iTo = FLOW_STATES.indexOf(to);
    return {
      dasharray: iTo < iFrom ? "6,6" : undefined,
      color: iTo < iFrom ? "#b45309" : "#0e7490",
    };
  };

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mappa flusso movimenti">
      {/* Archi */}
      {graph.edges.map(({ from, to, qty, unknown }, idx) => {
        const p1 = positions.get(from)!;
        const p2 = positions.get(to)!;
        const dx = Math.abs(p2.x - p1.x);
        const dir = p2.x >= p1.x ? 1 : -1;
        const curvature = Math.min(90, 32 + dx * 0.22);
        const c1x = p1.x + dir * curvature;
        const c1y = p1.y - 46;
        const c2x = p2.x - dir * curvature;
        const c2y = p2.y - 46;
        const d = `M ${p1.x} ${p1.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
        const { dasharray, color } = edgeStyle(from, to);

        const t = 0.3;
        const midX = (1 - t) ** 3 * p1.x + 3 * (1 - t) ** 2 * t * c1x + 3 * (1 - t) * t ** 2 * c2x + t ** 3 * p2.x;
        const midY = (1 - t) ** 3 * p1.y + 3 * (1 - t) ** 2 * t * c1y + 3 * (1 - t) * t ** 2 * c2y + t ** 3 * p2.y - 14;

        const iFrom = FLOW_STATES.indexOf(from);
        const iTo = FLOW_STATES.indexOf(to);
        const suffix = iTo < iFrom ? "rientrati" : "spostati";
        const label = unknown ? `${suffix}` : `${qty} ${suffix}`;

        return (
          <g key={`${from}-${to}-${idx}`}>
            <path d={d} fill="none" stroke={color} strokeWidth={3.5} strokeDasharray={dasharray} />
            <polygon
              points={`${p2.x},${p2.y} ${p2.x - 8 * (dir === 1 ? 1 : -1)},${p2.y - 6} ${p2.x - 8 * (dir === 1 ? 1 : -1)},${p2.y + 6}`}
              fill={color}
            />
            <g>
              <rect x={midX - 48} y={midY - 14} width="96" height="26" rx="10" fill="white" stroke={color} opacity={0.95} />
              <text x={midX} y={midY + 4} fontSize="12" fontWeight={800} fill={color} textAnchor="middle">
                {label}
              </text>
            </g>
          </g>
        );
      })}

      {/* Nodi */}
      {FLOW_STATES.map((st) => {
        const p = positions.get(st)!;
        const sty = STATE_STYLES[st];
        const qty = totals[st] || 0;
        return (
          <g key={st}>
            <circle cx={p.x} cy={p.y} r={nodeRadius + 9} fill={sty.glow} opacity={0.45} />
            <circle cx={p.x} cy={p.y} r={nodeRadius} fill={sty.fill} stroke={sty.stroke} strokeWidth={2.2} />
            <text x={p.x} y={p.y + 4} fontSize="12" fontWeight={900} fill={sty.text} textAnchor="middle">
              {st === "Da Stampare" ? "DS" : st[0]}
            </text>
            <text x={p.x} y={p.y + 42} fontSize="12" fill="#334155" textAnchor="middle">
              {st}
            </text>
            <g>
              <rect x={p.x - 22} y={p.y + 52} width="44" height="22" rx="8" fill="white" stroke={sty.stroke} />
              <text x={p.x} y={p.y + 68} fontSize="12" fontWeight={800} fill={sty.text} textAnchor="middle">
                {qty}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
