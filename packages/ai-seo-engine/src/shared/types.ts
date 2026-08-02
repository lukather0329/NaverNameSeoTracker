/**
 * 모든 분석 엔진이 공통으로 사용하는 결과 형식.
 * score/grade는 공개 데이터와 내부 규칙에 기반한 추정치이며,
 * 네이버의 실제 내부 알고리즘 점수를 의미하지 않는다.
 */
export interface AnalysisResult<TDetails = unknown> {
  score: number;
  grade: Grade;
  confidence: number;

  summary: string;

  strengths: AnalysisFinding[];
  weaknesses: AnalysisFinding[];
  recommendations: Recommendation[];

  details: TDetails;

  metadata: AnalysisMetadata;
}

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface AnalysisFinding {
  code: string;
  title: string;
  description: string;
  evidence?: string[];
  weight?: number;
}

export type RecommendationPriority = "HIGH" | "MEDIUM" | "LOW";

export interface Recommendation {
  code: string;
  priority: RecommendationPriority;
  title: string;
  description: string;
  expectedImpact?: {
    min: number;
    max: number;
  };
}

export interface AnalysisMetadata {
  engineVersion: string;
  analyzedAt: string;
  inputHash?: string;
  rulesetVersion?: string;
  llmUsed: boolean;
}

/** 특정 항목이 채점 가능한지, 채점된다면 몇 점/근거가 무엇인지를 나타낸다. */
export interface RuleCheckResult {
  code: string;
  passed: boolean;
  score: number;
  finding?: AnalysisFinding;
  recommendation?: Recommendation;
}
