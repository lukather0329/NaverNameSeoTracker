import type { AnalysisResult } from "../shared/types.js";
import type { AuthorityInput, AuthorityScoreDetails } from "./authority-types.js";

/**
 * Authority Score 엔진 인터페이스. 이번 1차 개발 범위에서는 완성하지 않는다.
 * 반환되는 점수는 네이버의 공식 신뢰도/권위 점수가 아니라 공개 데이터 기반 내부 추정치여야 하며,
 * 실제 구현체는 이 사실을 summary/metadata에 명시해야 한다.
 */
export interface AuthorityScore {
  evaluate(input: AuthorityInput): Promise<AnalysisResult<AuthorityScoreDetails>>;
}
