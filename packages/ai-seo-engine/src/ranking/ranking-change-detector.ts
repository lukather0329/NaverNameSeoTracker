import { computeConfidence, sampleSizeToConfidenceFactor } from "../scoring/confidence-score.js";
import { scoreToGrade } from "../scoring/score-normalizer.js";
import { ENGINE_VERSION, MIN_SAMPLE_SIZE_FOR_ANALYSIS } from "../shared/constants.js";
import { ValidationError } from "../shared/errors.js";
import type { AnalysisFinding, Recommendation } from "../shared/types.js";
import { average, hashInput, median, nowIso, round, standardDeviation } from "../shared/utils.js";
import { detectChangePoints, findBestLagCorrelation, spearmanCorrelation, type TimedValue } from "./correlation-analyzer.js";
import type {
  ChangeEvent,
  RankingCandidateCause,
  RankingChangeDetails,
  RankingChangeInput,
  RankingChangeResult,
  RankingPeriodStats,
  RankObservation,
  RankingTrend
} from "./ranking-types.js";

const RULESET_VERSION = "ranking-rules@1";
/** 여러 변경이 겹쳤다고 판단할 근접 기준 (일 단위). */
const OVERLAPPING_EVENT_WINDOW_DAYS = 3;

export interface RankingChangeDetectorOptions {
  minWindow?: number;
  lagHoursCandidates?: number[];
}

/**
 * 순위 변화를 단순 상승/하락 기록이 아니라, 변경 이력과의 시간 관계를 통계적으로 분석해
 * "원인 후보"를 제시한다. 이 엔진은 원인을 확정하지 않는다 — 항상 상관관계/추정 영향/신뢰도로
 * 표현한다. 초기 버전은 해석 가능한 통계 방식(이동평균/표준편차/변화점 탐지/상관계수)만 사용한다.
 */
export class RankingChangeDetector {
  private readonly minWindow: number;
  private readonly lagHoursCandidates: number[];

  constructor(options: RankingChangeDetectorOptions = {}) {
    this.minWindow = options.minWindow ?? 3;
    this.lagHoursCandidates = options.lagHoursCandidates ?? [0, 24, 48, 72, 168];
  }

  async analyze(input: RankingChangeInput): Promise<RankingChangeResult> {
    if (!input.observations || input.observations.length === 0) {
      throw new ValidationError("observations는 비어 있을 수 없습니다.");
    }

    const strengths: AnalysisFinding[] = [];
    const weaknesses: AnalysisFinding[] = [];
    const recommendations: Recommendation[] = [];
    const warnings: string[] = [];

    const sorted = [...input.observations].sort(
      (a, b) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime()
    );

    const missingCount = sorted.filter((observation) => observation.rank === null).length;
    const missingRate = missingCount / sorted.length;
    if (missingRate > 0.2) {
      warnings.push(`순위 측정 누락률이 높습니다 (${round(missingRate * 100)}%). 분석 신뢰도가 낮아질 수 있습니다.`);
    }

    const changeEvents = [...(input.changeEvents ?? [])].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    const splitAt = input.splitAt ?? changeEvents[0]?.occurredAt;

    if (!splitAt) {
      warnings.push("변경 시점 정보가 없어 변경 전/후를 나눌 수 없습니다. splitAt 또는 changeEvents를 제공하세요.");
    }

    const beforeObservations = splitAt
      ? sorted.filter((o) => new Date(o.collectedAt).getTime() < new Date(splitAt).getTime())
      : [];
    const afterObservations = splitAt
      ? sorted.filter((o) => new Date(o.collectedAt).getTime() >= new Date(splitAt).getTime())
      : sorted;

    const before = computePeriodStats(beforeObservations);
    const after = computePeriodStats(afterObservations);

    const hasEnoughData =
      before.sampleCount >= MIN_SAMPLE_SIZE_FOR_ANALYSIS && after.sampleCount >= MIN_SAMPLE_SIZE_FOR_ANALYSIS;

    let rankDelta: number | null = null;
    let percentageChange: number | null = null;
    let trend: RankingTrend = "INSUFFICIENT_DATA";

    if (hasEnoughData && before.averageRank !== null && after.averageRank !== null) {
      // 순위는 낮을수록 좋다: rankDelta가 음수면 순위가 개선(숫자가 작아짐)된 것이다.
      rankDelta = round(after.averageRank - before.averageRank);
      percentageChange = before.averageRank === 0 ? null : round(((before.averageRank - after.averageRank) / before.averageRank) * 100);
      trend = classifyTrend(percentageChange);
    } else {
      warnings.push("변경 전/후 비교에 필요한 표본이 부족합니다 (최소 " + MIN_SAMPLE_SIZE_FOR_ANALYSIS + "개 권장).");
    }

    if (trend === "STRONG_UP" || trend === "UP") {
      strengths.push({
        code: "RANK_IMPROVED",
        title: "순위가 개선되었습니다",
        description: `평균 순위 ${before.averageRank} → ${after.averageRank} (${percentageChange}% 개선)`
      });
    } else if (trend === "STRONG_DOWN" || trend === "DOWN") {
      weaknesses.push({
        code: "RANK_WORSENED",
        title: "순위가 하락했습니다",
        description: `평균 순위 ${before.averageRank} → ${after.averageRank}`
      });
      recommendations.push({
        code: "INVESTIGATE_RANK_DROP",
        priority: "HIGH",
        title: "순위 하락 원인 후보를 점검하세요",
        description: "candidateCauses를 참고해 최근 변경 사항과의 상관관계를 확인하세요."
      });
    }

    // 변동성 (분석 항목 4)
    const VOLATILITY_WARNING_THRESHOLD = 15;
    if (after.volatility !== null && after.volatility > VOLATILITY_WARNING_THRESHOLD) {
      weaknesses.push({
        code: "HIGH_VOLATILITY",
        title: "순위 변동성이 과도합니다",
        description: `변경 후 표준편차 ${after.volatility}. 단발성 이벤트(광고, 특가 등)의 영향일 수 있어 해석에 주의가 필요합니다.`
      });
      warnings.push("순위 변동성이 커서 평균값만으로 추세를 판단하기 어렵습니다.");
    }

    // 최고/최저 순위 (분석 항목 5, 6)
    const allRanks = sorted.map((o) => o.rank).filter((rank): rank is number => rank !== null);
    if (allRanks.length > 0) {
      const bestRank = Math.min(...allRanks);
      const worstRank = Math.max(...allRanks);
      strengths.push({
        code: "BEST_WORST_RANK",
        title: "관측 기간 내 최고/최저 순위",
        description: `최고 ${bestRank}위 / 최저 ${worstRank}위`
      });
    }

    // 일시적 상승인지 지속 상승인지 (분석 항목 9)
    if (afterObservations.length >= this.minWindow * 2) {
      const half = Math.floor(afterObservations.length / 2);
      const earlyAfter = average(afterObservations.slice(0, half).map((o) => o.rank ?? NaN).filter((v) => !Number.isNaN(v)));
      const lateAfter = average(afterObservations.slice(half).map((o) => o.rank ?? NaN).filter((v) => !Number.isNaN(v)));
      if (earlyAfter !== null && lateAfter !== null && before.averageRank !== null) {
        const earlyImprovement = before.averageRank - earlyAfter;
        const lateImprovement = before.averageRank - lateAfter;
        if (earlyImprovement > 0 && lateImprovement < earlyImprovement * 0.5) {
          warnings.push("초기에는 개선되었으나 이후 효과가 줄어드는 일시적 상승 패턴으로 보입니다.");
        } else if (earlyImprovement > 0 && lateImprovement >= earlyImprovement * 0.8) {
          strengths.push({
            code: "SUSTAINED_IMPROVEMENT",
            title: "지속적인 순위 개선 패턴입니다",
            description: "변경 이후 초반과 후반 모두 개선 효과가 유지되고 있습니다."
          });
        }
      }
    }

    // 여러 변경이 겹쳤는지 (분석 항목 10)
    const overlappingGroups = findOverlappingEvents(changeEvents, OVERLAPPING_EVENT_WINDOW_DAYS);
    if (overlappingGroups.length > 0) {
      warnings.push(
        `${OVERLAPPING_EVENT_WINDOW_DAYS}일 이내에 여러 변경이 겹쳐 원인을 특정하기 어렵습니다: ` +
          overlappingGroups.map((group) => group.map((e) => e.type).join("+")).join(", ")
      );
    }

    // 요일 또는 시간대 변동 가능성 (분석 항목 12)
    const weekdaySpread = computeWeekdaySpread(sorted);
    if (weekdaySpread !== null && weekdaySpread > 5) {
      warnings.push(`요일별 평균 순위 편차가 큽니다 (최대 ${round(weekdaySpread)}위 차이). 요일 효과를 고려하세요.`);
    }

    // 변화점 탐지
    const series: TimedValue[] = sorted
      .filter((o) => o.rank !== null)
      .map((o) => ({ at: o.collectedAt, value: o.rank as number }));
    const detectedChangePoints = detectChangePoints(series, this.minWindow);

    // 원인 후보 (changeEvents 각각에 대해 상관관계 계산)
    const candidateCauses: RankingCandidateCause[] = changeEvents.map((event) =>
      this.buildCandidateCause(event, series)
    );

    const score = computeRankingScore(trend, before, after);

    const confidence = computeConfidence({
      sampleSize: Math.min(before.sampleCount, after.sampleCount),
      missingRate,
      ruleApplicability: hasEnoughData ? 1 : 0.3,
      periodAdequacy: hasEnoughData ? 1 : 0.4
    });

    const details: RankingChangeDetails = {
      before,
      after,
      rankDelta,
      percentageChange,
      trend,
      detectedChangePoints,
      candidateCauses,
      warnings
    };

    return {
      score,
      grade: scoreToGrade(score),
      confidence,
      summary: buildSummary(trend, percentageChange, hasEnoughData),
      strengths,
      weaknesses,
      recommendations,
      details,
      metadata: {
        engineVersion: ENGINE_VERSION,
        analyzedAt: nowIso(),
        inputHash: hashInput(input),
        rulesetVersion: RULESET_VERSION,
        llmUsed: false
      }
    };
  }

  private buildCandidateCause(event: ChangeEvent, series: TimedValue[]): RankingCandidateCause {
    const lagResult = findBestLagCorrelation(series, event.occurredAt, this.lagHoursCandidates);
    const beforeEventSeries = series.filter((point) => new Date(point.at).getTime() < new Date(event.occurredAt).getTime());
    const afterEventSeries = series.filter((point) => new Date(point.at).getTime() >= new Date(event.occurredAt).getTime());

    const timeIndex = series.map((_, index) => index);
    const correlationWithTime =
      beforeEventSeries.length >= 2 && afterEventSeries.length >= 2
        ? spearmanCorrelation(
            timeIndex,
            series.map((point) => point.value)
          )
        : null;

    const correlationScore = lagResult ? round(lagResult.correlationScore, 3) : round(correlationWithTime ?? 0, 3);
    const sampleCount = Math.min(beforeEventSeries.length, afterEventSeries.length);
    const confidence = computeConfidence({ sampleSize: sampleCount, ruleApplicability: lagResult ? 1 : 0.4 });

    return {
      changeEventId: event.id,
      type: event.type,
      correlationScore,
      confidence,
      lagHours: lagResult?.bestLagHours,
      explanation: buildCauseExplanation(event, correlationScore, lagResult?.bestLagHours)
    };
  }
}

function computePeriodStats(observations: RankObservation[]): RankingPeriodStats {
  const ranks = observations.map((o) => o.rank).filter((rank): rank is number => rank !== null);
  return {
    averageRank: average(ranks) !== null ? round(average(ranks) as number) : null,
    medianRank: median(ranks) !== null ? round(median(ranks) as number) : null,
    volatility: standardDeviation(ranks) !== null ? round(standardDeviation(ranks) as number) : null,
    sampleCount: observations.length
  };
}

function classifyTrend(percentageChange: number | null): RankingTrend {
  if (percentageChange === null) {
    return "INSUFFICIENT_DATA";
  }
  if (percentageChange >= 30) {
    return "STRONG_UP";
  }
  if (percentageChange >= 10) {
    return "UP";
  }
  if (percentageChange > -10) {
    return "STABLE";
  }
  if (percentageChange > -30) {
    return "DOWN";
  }
  return "STRONG_DOWN";
}

function computeRankingScore(trend: RankingTrend, before: RankingPeriodStats, after: RankingPeriodStats): number {
  const trendScores: Record<RankingTrend, number> = {
    STRONG_UP: 95,
    UP: 78,
    STABLE: 60,
    DOWN: 35,
    STRONG_DOWN: 15,
    INSUFFICIENT_DATA: 40
  };
  let score = trendScores[trend];

  const volatility = after.volatility ?? before.volatility;
  if (volatility !== null && volatility > 15) {
    score = Math.max(0, score - 10);
  }

  return round(score);
}

function findOverlappingEvents(events: ChangeEvent[], windowDays: number): ChangeEvent[][] {
  const groups: ChangeEvent[][] = [];
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  for (let i = 0; i < events.length; i += 1) {
    const group = [events[i] as ChangeEvent];
    for (let j = i + 1; j < events.length; j += 1) {
      const gap = new Date(events[j]!.occurredAt).getTime() - new Date(events[i]!.occurredAt).getTime();
      if (gap <= windowMs) {
        group.push(events[j] as ChangeEvent);
      }
    }
    if (group.length > 1) {
      groups.push(group);
    }
  }

  return groups;
}

function computeWeekdaySpread(observations: RankObservation[]): number | null {
  const buckets = new Map<number, number[]>();
  for (const observation of observations) {
    if (observation.rank === null) {
      continue;
    }
    const day = new Date(observation.collectedAt).getDay();
    const list = buckets.get(day) ?? [];
    list.push(observation.rank);
    buckets.set(day, list);
  }

  const dayAverages = [...buckets.values()]
    .map((ranks) => average(ranks))
    .filter((value): value is number => value !== null);

  if (dayAverages.length < 2) {
    return null;
  }

  return Math.max(...dayAverages) - Math.min(...dayAverages);
}

function buildCauseExplanation(event: ChangeEvent, correlationScore: number, lagHours?: number): string {
  const direction = correlationScore > 0.1 ? "개선과" : correlationScore < -0.1 ? "악화와" : "뚜렷한 변화 없이";
  const lagText = lagHours !== undefined ? ` (약 ${lagHours}시간 후 반응)` : "";
  return `${event.description || event.type} 변경이 순위 ${direction} 상관관계를 보입니다${lagText}. 이는 상관관계 추정치이며 인과관계를 확정하지 않습니다.`;
}

function buildSummary(trend: RankingTrend, percentageChange: number | null, hasEnoughData: boolean): string {
  if (!hasEnoughData) {
    return "비교 가능한 순위 데이터가 충분하지 않아 신뢰도 높은 분석을 제공할 수 없습니다.";
  }
  const trendLabel: Record<RankingTrend, string> = {
    STRONG_UP: "큰 폭으로 개선",
    UP: "개선",
    STABLE: "큰 변화 없음",
    DOWN: "하락",
    STRONG_DOWN: "큰 폭으로 하락",
    INSUFFICIENT_DATA: "데이터 부족"
  };
  return `순위 변화 추세: ${trendLabel[trend]}${percentageChange !== null ? ` (${percentageChange}%)` : ""}.`;
}
