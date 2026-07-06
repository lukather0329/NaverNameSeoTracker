# MVP / OMS Integration Plan

## 통합 원칙

- 현재 앱은 독립 실행형이지만, 외부 시스템과 느슨하게 결합합니다.
- 상품 식별자는 내부 ID와 채널 ID를 분리합니다.
- SEO 제목 후보는 외부 MVP에서 가져오는 어댑터를 통해 주입합니다.

## 어댑터 포인트

- `SeoTitleSourceAdapter`
- `ProductCatalogAdapter`
- `ExperimentExportAdapter`
- `RankProvider`

## 단계별 통합

1. CSV / 수동 입력
2. MVP DB 조회 어댑터
3. MVP API 연동 어댑터
4. OMS 실험 결과 export / sync
