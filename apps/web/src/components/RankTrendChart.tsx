interface RankTrendPoint {
  trackedAt: string;
  currentRank: number | null;
}

interface RankTrendChartProps {
  points: RankTrendPoint[];
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 220;
const PADDING_LEFT = 44;
const PADDING_RIGHT = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 28;

// 순위는 낮을수록(1위에 가까울수록) 좋은 지표라서, 그래프에서는 위로 갈수록 좋은 순위가
// 되도록 y축을 뒤집어서 그린다. "이탈(OUT, 순위 없음)"은 맨 아래 별도 위치에 점으로 표시한다.
export function RankTrendChart({ points }: RankTrendChartProps) {
  if (points.length === 0) {
    return <p className="helper-copy">표시할 추적 데이터가 없습니다.</p>;
  }

  const rankedValues = points.map((point) => point.currentRank).filter((value): value is number => typeof value === "number");
  const maxRank = rankedValues.length > 0 ? Math.max(...rankedValues, 1) : 1;
  const minRank = rankedValues.length > 0 ? Math.min(...rankedValues, 1) : 1;
  const rankSpan = Math.max(1, maxRank - minRank);
  const outY = CHART_HEIGHT - PADDING_BOTTOM;
  const plotWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  function rankToY(rank: number | null) {
    if (rank === null) {
      return outY;
    }
    if (rankSpan === 0) {
      return PADDING_TOP + plotHeight / 2;
    }
    // 순위가 작을수록(=좋을수록) 위쪽(작은 y)에 오도록 뒤집는다.
    return PADDING_TOP + ((rank - minRank) / rankSpan) * plotHeight;
  }

  const coords = points.map((point, index) => ({
    x: PADDING_LEFT + stepX * index,
    y: rankToY(point.currentRank),
    rank: point.currentRank,
    trackedAt: point.trackedAt
  }));

  const linePath = coords.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`).join(" ");

  const yAxisTicks = [minRank, Math.round((minRank + maxRank) / 2), maxRank];

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="rank-trend-chart"
      role="img"
      aria-label="키워드별 순위 변화 추이 그래프"
    >
      {/* y축 기준선 */}
      <line x1={PADDING_LEFT} y1={PADDING_TOP} x2={PADDING_LEFT} y2={outY} stroke="rgba(148, 163, 184, 0.5)" strokeWidth={1} />
      <line x1={PADDING_LEFT} y1={outY} x2={CHART_WIDTH - PADDING_RIGHT} y2={outY} stroke="rgba(148, 163, 184, 0.5)" strokeWidth={1} />

      {yAxisTicks.map((tick, index) => (
        <g key={index}>
          <text x={4} y={rankToY(tick) + 4} className="rank-trend-axis-label">
            {tick}위
          </text>
          <line
            x1={PADDING_LEFT}
            y1={rankToY(tick)}
            x2={CHART_WIDTH - PADDING_RIGHT}
            y2={rankToY(tick)}
            stroke="rgba(148, 163, 184, 0.18)"
            strokeWidth={1}
          />
        </g>
      ))}

      <text x={4} y={outY + 20} className="rank-trend-axis-label rank-trend-out-label">
        이탈
      </text>

      <path d={linePath} fill="none" stroke="#7551ff" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {coords.map((coord, index) => (
        <circle
          key={index}
          cx={coord.x}
          cy={coord.y}
          r={coord.rank === null ? 3.5 : 3}
          fill={coord.rank === null ? "#ff4757" : "#7551ff"}
        >
          <title>{`${new Date(coord.trackedAt).toLocaleString("ko-KR")} · ${coord.rank === null ? "이탈" : coord.rank + "위"}`}</title>
        </circle>
      ))}
    </svg>
  );
}
