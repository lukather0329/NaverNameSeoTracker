import { average, median, standardDeviation } from "../shared/utils.js";

export interface TimedValue {
  at: string;
  value: number;
}

export function movingAverage(values: number[], windowSize: number): number[] {
  if (windowSize < 1) {
    return values;
  }
  const result: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    result.push(average(window) as number);
  }
  return result;
}

function rankTransform(values: number[]): number[] {
  const sortedIndices = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < sortedIndices.length) {
    let j = i;
    while (j + 1 < sortedIndices.length && sortedIndices[j + 1]!.value === sortedIndices[i]!.value) {
      j += 1;
    }
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) {
      ranks[sortedIndices[k]!.index] = averageRank;
    }
    i = j + 1;
  }
  return ranks;
}

/** 두 수열의 Pearson 상관계수 (-1~1). 표본이 2개 미만이거나 분산이 0이면 null. */
export function pearsonCorrelation(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 2) {
    return null;
  }
  const meanX = average(x) as number;
  const meanY = average(y) as number;

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < x.length; i += 1) {
    const dx = (x[i] as number) - meanX;
    const dy = (y[i] as number) - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  const denominator = Math.sqrt(sumSqX * sumSqY);
  if (denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

/** 두 수열의 Spearman 순위상관계수 (-1~1). 이상치에 덜 민감해 순위 데이터에 적합하다. */
export function spearmanCorrelation(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 2) {
    return null;
  }
  return pearsonCorrelation(rankTransform(x), rankTransform(y));
}

/**
 * 시계열에서 평균이 크게 달라지는 지점(변화점)을 찾는다.
 * 각 지점에서 이전 구간 평균과 이후 구간 평균의 차이가 전체 표준편차의 threshold배를 넘으면
 * 변화점으로 판단하는, 해석 가능한 단순 휴리스틱이다 (고급 ML 대신 사용).
 */
export function detectChangePoints(series: TimedValue[], minWindow = 3, thresholdStdDevMultiplier = 1.0): string[] {
  if (series.length < minWindow * 2) {
    return [];
  }

  const values = series.map((point) => point.value);
  const overallStdDev = standardDeviation(values) ?? 0;
  if (overallStdDev === 0) {
    return [];
  }

  const changePoints: string[] = [];

  for (let i = minWindow; i < series.length - minWindow; i += 1) {
    const before = values.slice(Math.max(0, i - minWindow), i);
    const after = values.slice(i, i + minWindow);
    const beforeMean = average(before) as number;
    const afterMean = average(after) as number;
    const diff = Math.abs(afterMean - beforeMean);

    if (diff >= overallStdDev * thresholdStdDevMultiplier) {
      changePoints.push(series[i]!.at);
    }
  }

  return changePoints;
}

export interface LagCorrelationResult {
  bestLagHours: number;
  correlationScore: number;
}

/**
 * 이벤트 발생 시점 이후 특정 시차(lag)마다 순위가 얼마나 개선/악화됐는지 비교해,
 * 가장 뚜렷한 반응이 나타난 시차를 찾는다. "원인 확정"이 아니라 상관관계 참고용이다.
 */
export function findBestLagCorrelation(
  observations: TimedValue[],
  eventAt: string,
  lagHoursCandidates: number[] = [0, 24, 48, 72, 168]
): LagCorrelationResult | null {
  const eventTime = new Date(eventAt).getTime();
  const beforeEvent = observations.filter((observation) => new Date(observation.at).getTime() < eventTime);

  if (beforeEvent.length === 0) {
    return null;
  }

  const baseline = average(beforeEvent.map((o) => o.value)) as number;

  let best: LagCorrelationResult | null = null;

  for (const lagHours of lagHoursCandidates) {
    const windowStart = eventTime + lagHours * 60 * 60 * 1000;
    const windowEnd = windowStart + 24 * 60 * 60 * 1000;
    const windowObservations = observations.filter((observation) => {
      const t = new Date(observation.at).getTime();
      return t >= windowStart && t < windowEnd;
    });

    if (windowObservations.length === 0) {
      continue;
    }

    const windowAverage = average(windowObservations.map((o) => o.value)) as number;
    // 순위는 낮을수록 좋으므로 baseline - windowAverage > 0 이면 개선.
    const improvement = baseline - windowAverage;
    const normalizedScore = baseline === 0 ? 0 : improvement / Math.max(baseline, 1);

    if (!best || Math.abs(normalizedScore) > Math.abs(best.correlationScore)) {
      best = { bestLagHours: lagHours, correlationScore: normalizedScore };
    }
  }

  return best;
}

export { average, median, standardDeviation };
