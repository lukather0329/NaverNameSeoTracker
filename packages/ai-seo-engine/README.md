# @makeware/ai-seo-engine

네이버쇼핑을 비롯한 이커머스 플랫폼의 상품명·상세페이지·실험·순위 변화를 분석하는
독립적인 AI SEO 분석 엔진 라이브러리(v0.1)입니다.

`NaverNameSeoTracker`, 네이버 광고 분석 MVP, OMS, 상품명 SEO 최적화 프로그램, 스마트스토어
상품관리 프로그램, 통합 AI SEO 플랫폼 등 여러 프로젝트에서 공통으로 재사용하기 위해
UI나 특정 서버 코드에 결합하지 않고 독립 패키지로 만들었습니다.

## ⚠️ 중요한 전제

- 이 엔진이 반환하는 모든 점수는 **네이버의 실제 내부 검색/랭킹 알고리즘 점수가 아닙니다.**
  공개적으로 관찰 가능한 데이터(상품명 텍스트, 상세페이지 구조, 순위 관측치)에 기반한
  **내부 추정치**입니다.
- 순위 변화의 "원인"을 확정하지 않습니다. 항상 상관관계, 추정 영향, 신뢰도로 표현합니다.
- Authority Score는 네이버 공식 신뢰도 점수가 아닙니다.

## 1. 목적

- 상품명이 검색 시스템/사용자에게 어떤 의미로 해석될지 분석 (Semantic Analyzer)
- 상세페이지가 충분한 정보를 제공하는지 분석 (Content Quality Analyzer)
- 상품명/가격/이미지 등 변경 실험을 기록하고 전후를 비교 (Experiment Manager)
- 순위 변화와 변경 이력의 시간 관계를 통계적으로 분석해 원인 후보를 제시 (Ranking Change Detector)
- 향후 리뷰 분석/브랜드 권위 점수/몬테카를로 예측까지 확장 가능한 인터페이스 제공

## 2. 설치 방법

이 저장소(`NaverNameSeoTracker`)의 npm workspaces 안에 있으므로 저장소 루트에서 평소처럼
설치하면 함께 설치됩니다.

```bash
# 저장소 루트에서
npm install
```

다른 프로젝트에서 독립적으로 쓰려면 `packages/ai-seo-engine` 폴더를 그대로 복사하거나,
추후 별도 npm 레지스트리에 게시해 `npm install @makeware/ai-seo-engine`으로 설치할 수 있습니다.
(이번 단계에서는 게시하지 않았습니다.)

## 3. 사용 예시

```ts
import { SemanticAnalyzer, ContentQualityAnalyzer, RankingChangeDetector } from "@makeware/ai-seo-engine";

const semanticAnalyzer = new SemanticAnalyzer();

const result = await semanticAnalyzer.analyze({
  productName: "허밍버드PRO",
  brand: "메이크웨어",
  category: "교육용 코딩드론",
  targetKeywords: ["코딩드론", "파이썬", "교육용 드론", "AI 드론"]
});

console.log(result.score); // 0~100 추정 점수
console.log(result.weaknesses); // 무엇이 부족한지
console.log(result.recommendations); // 무엇을 고치면 좋을지
```

## 4. 각 엔진 설명

### 4.1 Semantic Analyzer (`SemanticAnalyzer`)

상품명을 브랜드/제품유형/키워드/카테고리 적합성/중복/광고성 표현 등 12가지 규칙으로 분석합니다.

- 입력: `SemanticAnalysisInput` (`productName` 필수, `brand`/`category`/`attributes`/`targetKeywords`/`prohibitedKeywords`/`competitorNames` 선택)
- 출력: `AnalysisResult<SemanticAnalysisDetails>`
- 추가 기능: `generateSuggestions(input, options)` — 누락 키워드를 반영한 상품명 후보를 단순 조합 규칙으로 생성 (1차 버전)

### 4.2 Content Quality Analyzer (`ContentQualityAnalyzer`)

스마트스토어 상세페이지 HTML(또는 plainText)을 분석해 정보량/구조/명확성/중복/상품명과의
일관성을 평가합니다. HTML은 `cheerio`로 script/style/noscript/iframe/hidden 요소를 제거한 뒤
실제 사용자에게 보이는 텍스트만 추출합니다. **텍스트가 많다는 이유만으로 높은 점수를 주지
않습니다.**

- 입력: `ContentQualityInput` (`html` 또는 `plainText` 중 하나 필수)
- 출력: `AnalysisResult<ContentQualityDetails>` — 섹션 존재 여부(소개/특징/사양/사용법/구성품/주의사항/FAQ/대상/활용사례), 키워드 밀도, 이미지 alt 비율 등 포함

### 4.3 Experiment Manager (`ExperimentManager`)

상품명/상세페이지/가격/이미지/속성/옵션/광고 상태 변경을 실험 단위로 기록·비교합니다.
**저장소를 직접 소유하지 않습니다** — 호출자가 기존 실험 목록을 전달하면 순수 함수 형태로
새 상태를 계산해 반환하는 방식입니다. 실제 스마트스토어 상품을 자동으로 수정하거나
롤백하지 않습니다(기록/비교 전용).

주요 메서드: `createExperiment`, `startExperiment`/`scheduleExperiment`/`endExperiment`/`cancelExperiment`/`rollbackExperiment`,
`compareSnapshots`, `detectConflicts`, `setBaselinePeriod`/`setMeasurementPeriod`, `linkRankingAnalysis`, `buildTimeline`.

상태 전이: `DRAFT → SCHEDULED/RUNNING → COMPLETED → ROLLED_BACK`, 언제든 `CANCELLED` 가능
(허용되지 않는 전이는 `ConflictError`를 던짐).

### 4.4 Ranking Change Detector (`RankingChangeDetector`)

순위 변화를 단순 상승/하락 기록이 아니라 변경 이력과의 시간 관계를 분석해 **원인 후보**를
제시합니다. 이동평균, 표준편차, 변화점 탐지, Spearman/Pearson 상관계수, 시차 상관관계 등
해석 가능한 통계 방식만 사용합니다(고급 ML 미사용).

- 입력: `RankingChangeInput` (`observations` 필수, `changeEvents`/`splitAt` 선택)
- 출력: `AnalysisResult<RankingChangeDetails>` — before/after 통계, trend, 변화점, `candidateCauses`(이벤트별 상관점수/신뢰도/지연시간/설명), `warnings`
- `splitAt`을 생략하면 `changeEvents` 중 가장 이른 이벤트 시각을 기준으로 전/후를 나눕니다.

### 4.4-a Review Intelligence (`RuleBasedReviewIntelligence`)

리뷰 배열을 규칙 기반으로 분석합니다(감정 추정, 주제 추출, 짧은 리뷰/중복 리뷰 감지, FAQ 후보,
개선 요구사항 추출). 별점이 있으면 별점 기준, 없으면 키워드 매칭으로 감정을 추정합니다 —
정교한 NLP 감정분석 모델이 아니라 단순 휴리스틱입니다.

- 입력: `ReviewInput[]` (비어 있지 않아야 함)
- 출력: `AnalysisResult<ReviewIntelligenceDetails>`
- `mentionedAttributes`는 아직 채우지 않습니다(상품 속성 목록과 매칭하는 로직은 향후 과제).

### 4.4-b Monte Carlo Predictor (`MonteCarloHttpAdapter`)

기존 `rw_decision_engine`(Python/FastAPI, 별도 저장소 `D:\Claude\MonteCarloDecisionEngine`,
기본 포트 8765)의 `/naver-seo/simulate` 엔드포인트를 실제로 호출하는 HTTP 어댑터입니다.
그 엔드포인트는 "상품명 변경 1건"만 시뮬레이션하므로:

- `action: "CHANGE_PRODUCT_NAME"` 시나리오 + `predict(scenarios, context)`의 `context`(`NaverSeoSimulationContext`:
  productId/keyword/baseline/titleScoreBefore/titleScoreAfter)가 모두 있으면 실제 엔진을 호출합니다.
- 그 외 액션 타입이나 context가 없는 경우에는 호출자가 제공한 `estimatedImpactRange`/
  `probabilityDistribution`을 정규분포 근사로 변환한 추정치를 반환하고, `assumptions`에
  "실제 시뮬레이션이 아님"을 명시합니다. 엔진 호출이 실패해도 같은 방식으로 안전하게 대체됩니다.

```ts
import { MonteCarloHttpAdapter } from "@makeware/ai-seo-engine";

const predictor = new MonteCarloHttpAdapter({ baseUrl: "http://127.0.0.1:8765" });
const prediction = await predictor.predict(
  [{ action: "CHANGE_PRODUCT_NAME", estimatedImpactRange: { min: -0.05, max: 0.15 } }],
  { productId, keyword, baseline: { rankHistory, price }, titleScoreBefore: 60, titleScoreAfter: 80 }
);
```

### 4.5 인터페이스만 설계된 엔진 (미구현)

| 엔진 | 위치 | 상태 |
|---|---|---|
| Authority Score | `src/authority/` | 인터페이스 + 타입만 정의 |

## 5. 공통 결과 구조

```ts
interface AnalysisResult<TDetails> {
  score: number;       // 0~100 추정치
  grade: "A"|"B"|"C"|"D"|"F";
  confidence: number;  // 0~1, 점수와 별개인 "이 점수를 얼마나 믿을 수 있는가"
  summary: string;
  strengths: AnalysisFinding[];
  weaknesses: AnalysisFinding[];
  recommendations: Recommendation[];
  details: TDetails;   // 엔진별 상세 데이터
  metadata: { engineVersion, analyzedAt, inputHash?, rulesetVersion?, llmUsed };
}
```

모든 엔진이 점수만 반환하지 않고 **왜 그 점수가 나왔는지(strengths/weaknesses), 어떻게
고치면 좋을지(recommendations), 얼마나 믿을 수 있는지(confidence)**를 함께 반환합니다.

## 6. 점수 산정 방식

각 엔진은 항목별 점수(0~100)를 계산한 뒤 `computeWeightedScore`로 가중 평균을 냅니다.
가중치는 하드코딩된 단일 공식이 아니라 `ScoringConfig`로 외부에서 교체할 수 있습니다.

```ts
import { SemanticAnalyzer, DEFAULT_SEMANTIC_WEIGHTS } from "@makeware/ai-seo-engine";

const analyzer = new SemanticAnalyzer({
  weights: { ...DEFAULT_SEMANTIC_WEIGHTS, promotionalPenalty: 0.2 } // 광고성 표현에 더 큰 페널티
});
```

기본 가중치는 `scoring/weighted-score.ts`의 `DEFAULT_SEMANTIC_WEIGHTS` / `DEFAULT_CONTENT_WEIGHTS`
/ `DEFAULT_RANKING_WEIGHTS`를 참고하세요.

## 7. Confidence Score 설명

`score`(점수)와 `confidence`(신뢰도)는 별개 개념입니다. 입력이 빈약해도 점수는 계산되지만,
그 점수를 얼마나 믿을 수 있는지는 낮게 나와야 합니다. 예:

- 상품명만 입력됨 → 분석 점수는 계산되지만 신뢰도는 낮음
- 카테고리·속성·목표 키워드까지 입력됨 → 신뢰도 상승
- 순위 관측치가 3개뿐 → Ranking Change Detector 신뢰도 낮음
- 순위 관측치 100개 + 비교 기간 충분 → 신뢰도 높음

`computeConfidence`는 입력 완성도, 표본 수, 데이터 누락률, 규칙 적용 가능성, LLM-규칙 결과
일치도, 비교 기간 적절성을 조합해 0~1 값을 계산합니다. 제공되지 않은 요소는 자동으로
제외하고 나머지 가중치를 재정규화합니다.

## 8. 이 점수는 네이버 공식 점수가 아닙니다

다시 한번 명시합니다: 모든 점수/등급은 공개 데이터와 이 라이브러리의 내부 규칙에 기반한
**추정치**입니다. 네이버의 실제 검색/랭킹 알고리즘, 공식 Authority 점수, 실제 순위 예측
정확도를 주장하지 않습니다.

## 9. LLM 없이 사용하는 방법

모든 필수 엔진(Semantic/Content)은 LLM 없이 기본 동작합니다. `llmProvider`를 넘기지 않으면
규칙 기반 분석만 실행됩니다.

```ts
const analyzer = new SemanticAnalyzer(); // llmProvider 생략 = 규칙 기반만 사용
```

## 10. LLM Provider 추가 방법

`LlmProvider` 인터페이스(`src/llm/llm-provider.interface.ts`)를 구현해 주입하면 됩니다.
API 키는 엔진 내부에 저장하지 않으며, 실제 어댑터(Anthropic/OpenAI 등)는 외부에서 클라이언트를
구성해 이 인터페이스를 구현하는 별도 모듈로 만드세요.

```ts
class MyClaudeProvider implements LlmProvider {
  async analyzeSemantic(input) { /* Anthropic API 호출 */ }
  async analyzeContent(input) { /* Anthropic API 호출 */ }
}

const analyzer = new SemanticAnalyzer({ llmProvider: new MyClaudeProvider() });
```

LLM 결과(`additionalFindings`/`additionalRecommendations`)는 규칙 기반 결과에 **보강**되어
합쳐질 뿐, 최종 점수를 그대로 대체하지 않습니다(원칙: LLM 응답을 검증 없이 최종 점수로 사용하지 않음).
LLM 호출이 실패해도 규칙 기반 분석 결과는 정상 반환됩니다.

테스트/데모용으로 `MockLlmProvider`, 완전히 비활성화하려면 `NoopLlmProvider`를 제공합니다.
실제 Anthropic Claude 연동은 `AnthropicLlmProvider`로 이미 구현되어 있습니다 (API 키를
생성자 파라미터로 받을 뿐, 내부에 저장/캐시하지 않습니다):

```ts
import { AnthropicLlmProvider, SemanticAnalyzer } from "@makeware/ai-seo-engine";

const llmProvider = new AnthropicLlmProvider({ apiKey: process.env.ANTHROPIC_API_KEY! });
const analyzer = new SemanticAnalyzer({ llmProvider });
```

## 11. NaverNameSeoTracker에 연결하는 방법

`NaverNameSeoTracker`는 이미 npm workspaces 모노레포이므로 `apps/server`에서 바로 가져다
쓸 수 있습니다.

```ts
// apps/server/src/routes/index.ts (실제 코드)
import { SemanticAnalyzer } from "@makeware/ai-seo-engine";

const analyzer = new SemanticAnalyzer();
const result = await analyzer.analyze({
  productName: productRecord.seoOptimizedTitle?.trim() || productRecord.currentTitle,
  category: productRecord.category ?? undefined,
  targetKeywords: [productRecord.primaryKeyword, ...trackingKeywords].filter(Boolean)
});
```

**실제로 연결되어 있습니다** (`apps/server/package.json`의 dependencies에 `@makeware/ai-seo-engine`
추가 완료, `apps/server/src/services/ai-seo-engine-adapter.ts`에 Prisma ↔ 엔진 타입 매핑 존재):

- `POST /api/products/:id/semantic-analysis` — `SemanticAnalyzer` 호출
- `POST /api/products/:id/content-quality-analysis` — 네이버 원상품의 `detailContent`를 실시간
  조회해 `ContentQualityAnalyzer`로 분석 (`fetchNaverOriginProduct` 재사용)
- `POST /api/products/:id/ranking-change-analysis` — `RankTrackingResult`/`TitleChangeLog`를
  `ai-seo-engine-adapter.ts`의 매핑 함수로 변환해 `RankingChangeDetector` 호출

Experiment Manager는 기존 `SeoExperiment` Prisma 모델과 필드가 유사하지만 동일하지 않습니다 —
Prisma 모델 ↔ 이 패키지의 `SeoExperiment` 타입 간 매핑 어댑터는 아직 없습니다 (자동 변환 없음,
다음 작업 대상).

## 12. 향후 개발 항목

- Experiment Manager Prisma 매핑 어댑터 (다른 3개 엔진처럼 아직 연결 안 됨)
- Review Intelligence용 실제 리뷰 데이터 소스 확정 (네이버 커머스 API에 리뷰 조회 엔드포인트가
  있는지 미확인 — 분석 로직 자체는 `RuleBasedReviewIntelligence`로 이미 구현됨)
- Authority Score 실제 구현 (카테고리 집중도, 브랜드 일관성 등)
- Monte Carlo Predictor 구현 — 이미 존재하는 `rw_decision_engine`(Python/FastAPI, `D:\Claude\MonteCarloDecisionEngine`)의
  시뮬레이션 결과를 이 인터페이스 형태로 매핑하는 어댑터로 연결하는 것을 권장
- NaverNameSeoTracker `apps/server`에 실제 연결 (라우트 추가, Prisma 모델 ↔ 엔진 타입 매핑)
- 실제 Anthropic/OpenAI LLM Provider 어댑터 구현
- 가중치/규칙 설정을 파일(JSON/YAML) 또는 DB에서 로드하는 기능

## 개발/테스트 명령어

```bash
cd packages/ai-seo-engine
npm run build   # tsc --noEmit (타입 체크)
npm run test    # vitest run
```
