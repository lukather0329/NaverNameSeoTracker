interface SparklineBarsProps {
  points: Array<{ label: string; up: number; down: number; same: number }>;
}

export function SparklineBars({ points }: SparklineBarsProps) {
  return (
    <div className="sparkline">
      {points.map((point) => {
        const total = Math.max(1, point.up + point.down + point.same);

        return (
          <div key={point.label} className="sparkline-column">
            <div className="sparkline-stack">
              <span style={{ height: `${(point.up / total) * 100}%` }} className="spark up" />
              <span style={{ height: `${(point.same / total) * 100}%` }} className="spark same" />
              <span style={{ height: `${(point.down / total) * 100}%` }} className="spark down" />
            </div>
            <small>{point.label}</small>
          </div>
        );
      })}
    </div>
  );
}
