# MVP / OMS 통합 계획서

작성: Claude · 이전 버전(Codex 초안)의 어댑터 포인트 목록을 인터페이스 수준으로 구체화

## 1. 통합 원칙

- 지금은 완전히 독립 실행형이다. MVP/OMS와는 코드 레벨로 결합하지 않는다.
- 통합은 항상 "어댑터를 갈아끼우는" 형태로 이뤄진다 — 핵심 도메인 로직(실험/추적/분석)은 어댑터 구현이 바뀌어도 손대지 않는다.
- 상품 식별자는 내부 `id`를 외부에 노출하지 않고, `sellerManagementCode` → `channelProductId` → `smartStoreProductId` 순으로 매칭한다 (`DB_SCHEMA.md` 2장).
- 통합 전 단계에서도 인터페이스 계약(TypeScript type)은 지금 확정해 두고, 구현체만 나중에 채운다.

## 2. 어댑터 인터페이스 확정

### 2.1 SeoTitleSourceAdapter — MVP가 생성한 SEO 제목 후보 가져오기

```ts
// packages/shared/src/adapters/seo-title-source.ts
export interface SeoTitleSourceQuery {
  sellerManagementCode?: string;
  smartStoreProductId?: string;
  updatedSince?: string; // ISO date, 증분 동기화용
}

export interface SeoTitleCandidateDTO {
  sellerManagementCode?: string;
  smartStoreProductId?: string;
  title: string;
  score?: number;        // MVP가 계산한 SEO 점수(있다면)
  generatedAt: string;
  sourceMeta?: Record<string, unknown>;
}

export interface SeoTitleSourceAdapter {
  fetchCandidates(query: SeoTitleSourceQuery): Promise<SeoTitleCandidateDTO[]>;
}
```

구현 단계: 1) `ManualSeoTitleSourceAdapter`(수동 입력, 현재 구현됨) → 2) `CsvSeoTitleSourceAdapter`(CSV 업로드, 미구현 — `API_SPEC.md` 5장) → 3) `MvpDbSeoTitleSourceAdapter`(MVP SQLite/Postgres에 직접 조회) → 4) `MvpApiSeoTitleSourceAdapter`(MVP가 API를 노출하면 HTTP 클라이언트로 교체).

### 2.2 ProductCatalogAdapter — 상품 카탈로그 동기화

```ts
export interface ProductCatalogAdapter {
  listProducts(params: { updatedSince?: string }): Promise<ProductCatalogItemDTO[]>;
  getProduct(ref: { smartStoreProductId: string }): Promise<ProductCatalogItemDTO | null>;
}

export interface ProductCatalogItemDTO {
  smartStoreProductId: string;
  originProductId?: string;
  channelProductId?: string;
  sellerManagementCode?: string;
  currentTitle: string;
  price: number;
  category?: string;
  productStatus: "ON_SALE" | "PAUSED" | "SOLD_OUT";
}
```

구현 단계: 1) `CsvProductCatalogAdapter`(현재 수동 등록에 해당) → 2) `SmartStoreApiProductCatalogAdapter`(네이버 커머스API 직접 연동) → 3) `OmsProductCatalogAdapter`(기존 OMS가 이미 스마트스토어와 동기화된 상태라면 OMS DB에서 가져오는 편이 API 쿼터 절약).

### 2.3 ExperimentExportAdapter — 실험 결과를 외부로 내보내기

```ts
export interface ExperimentExportAdapter {
  exportExperiment(experimentId: string): Promise<ExperimentExportDTO>;
}

export interface ExperimentExportDTO {
  experimentId: string;
  productRef: { smartStoreProductId: string; sellerManagementCode?: string };
  beforeTitle: string;
  afterTitle: string;
  appliedAt: string | null;
  keywords: string[];
  rankSeries: Array<{
    keyword: string;
    trackedAt: string;
    rank: number | null;
    deltaStatus: "UP" | "DOWN" | "SAME" | "OUT";
  }>;
  judgement: "EFFECTIVE" | "LOW_EFFECT" | "PENDING" | "WORSE";
  summary: string | null;
}
```

1차 구현은 `JsonFileExperimentExportAdapter`(파일로 떨어뜨림, `API_SPEC.md` 9장의 `/reports/experiments/:id/json`과 동일 스키마) → 이후 OMS가 이 JSON을 받는 API를 열면 `OmsHttpExperimentExportAdapter`로 교체.

### 2.4 RankProvider — 이미 구현/확정됨

`RANK_PROVIDER_SPEC.md` 참고. MVP/OMS 통합과는 무관하게 이미 분리되어 있다.

## 3. 단계별 통합 로드맵

| 단계 | 내용 | 선행 조건 |
|---|---|---|
| 0 (현재) | CSV/수동 입력으로 독립 운영 | - |
| 1 | `MvpDbSeoTitleSourceAdapter` — MVP가 로컬에 있다면 그 SQLite 파일을 read-only로 열어 후보 조회 | MVP의 제목 후보 테이블 스키마 확인 필요 |
| 2 | `SmartStoreApiProductCatalogAdapter` — 실제 커머스API로 상품 목록/상세 동기화, 상품명 변경도 이 어댑터를 통해 반영 | 네이버 커머스API 계정 발급 완료 (API 계정 관리 화면에서 등록) |
| 3 | `OmsHttpExperimentExportAdapter` — 실험 결과를 OMS로 자동 전송, OMS 대시보드에서 SEO 실험 이력 조회 가능 | OMS 측 수신 API 스펙 확정 |
| 4 | 양방향: OMS에서 "이 상품 SEO 테스트 시작" 버튼을 누르면 이 프로그램에 실험 생성 요청 → 완료되면 결과 자동 회신 | 1~3단계 안정화 후 |

각 단계는 기존 어댑터 인터페이스의 구현체를 하나 추가하고 설정(`config.ts` 또는 DB의 어댑터 선택 설정)에서 스위치하는 것으로 끝나야 하며, `services/` 레이어의 실험/추적/분석 로직은 수정하지 않는 것이 이 설계의 성공 기준이다.

## 4. 지금 당장 해야 할 준비 작업

- 상품 등록/CSV 스키마에 `sellerManagementCode`를 필수급으로 취급해, 나중에 MVP/OMS와 매칭할 때 이 필드가 비어있는 데이터가 없도록 운영 규칙을 잡는다.
- `SeoTitleCandidate.source` 값에 이미 `"MVP_ADAPTER"`가 정의돼 있음(확인 완료) — 향후 어댑터 구현 시 이 값 그대로 사용.
- 리포트 JSON export(`API_SPEC.md` 9장)를 `ExperimentExportDTO` 스키마와 처음부터 동일하게 만들어, 화면에서 만드는 export와 향후 OMS 자동 전송이 같은 포맷을 쓰게 한다.
