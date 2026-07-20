# 시스템 아키텍처 설계

작성: Claude (설계 담당) · 대상: Codex(구현) 및 향후 유지보수자
관련 문서: `DB_SCHEMA.md`, `API_SPEC.md`, `RANK_PROVIDER_SPEC.md`, `FOLDER_STRUCTURE.md`, `MVP_OMS_INTEGRATION_PLAN.md`

## 1. 목표와 제약

네이버 스마트스토어 상품명을 SEO 최적화안으로 변경했을 때 실제 검색 순위가 어떻게 바뀌는지를 실험 단위로 기록·검증하는 독립 실행형 프로그램이다. 기존 MVP(상품명 생성기)·OMS와는 지금 당장 통합하지 않지만, 나중에 붙일 수 있도록 데이터 모델과 어댑터 경계를 처음부터 분리해 둔다. Docker를 쓰지 않고 Windows 회사 PC, 자택 PC, Mac에서 동일하게 `npm install` → `npm run dev`로 뜨는 것을 전제로 한다.

## 2. 전체 구조

```
apps/web      React + TypeScript 관리자 UI (Vite)
apps/server   Express + TypeScript API 서버
packages/shared  프론트/백엔드 공유 타입 (DTO, enum)
prisma        SQLite 스키마 / 마이그레이션 / seed
docs          설계 및 운영 문서
scripts       로컬 실행 보조 스크립트
```

모노레포는 npm workspaces로 묶여 있고, `apps/web`과 `apps/server`는 `packages/shared`의 타입을 공유해 프론트-백엔드 계약이 어긋나지 않게 한다. 이 구조는 이미 Codex가 초기 세팅을 완료했고, 요구사항의 "root/apps/packages/prisma/docs/scripts" 구조와 일치한다. 변경 없이 유지한다.

## 3. 서버 레이어링

서버는 4개 층으로 나눈다. 이미 코드 골격에 반영되어 있으므로 이 원칙을 계속 지켜야 한다.

```
routes/      HTTP 계약 (zod 입력 검증, req/res 매핑만 담당)
services/    비즈니스 로직 (트랜잭션 단위, 상태 전이 규칙)
providers/   외부 세계와의 경계 (RankProvider, 향후 SmartStore API 클라이언트)
lib/         공용 유틸 (prisma client, 마스킹, config)
```

라우트 핸들러는 얇게 유지하고, 실험 상태 전이나 순위 계산 같은 도메인 로직은 반드시 `services/`에 둔다. 지금 `routes/index.ts`에 상품명 변경 승인/롤백, CSV 업로드 같은 로직이 아직 없는데, 이런 기능을 추가할 때도 이 레이어링을 지켜서 라우트에 직접 Prisma 트랜잭션을 늘어놓지 않도록 한다.

## 4. 데이터 흐름 (스냅샷 패턴)

현재 프론트엔드는 `/api/snapshot` 하나로 대시보드에 필요한 모든 컬렉션을 한 번에 받아 화면을 그리는 "스냅샷 패턴"을 쓰고 있다. 초기 MVP 단계에서는 이 방식이 단순하고 충분하다. 다만 데이터가 늘어나면(랭킹 결과는 30분/1시간마다 계속 쌓임) 스냅샷 응답이 무거워지므로, 아래 원칙을 지켜 확장한다.

- 대시보드 요약 카드는 스냅샷 유지 (가볍다)
- 랭킹 결과, 리포트, 분석 화면처럼 대량/기간 조회가 필요한 화면은 스냅샷에 얹지 말고 별도 필터링 엔드포인트를 새로 만든다 (`API_SPEC.md` 4장, 7장 참고)
- 스냅샷은 페이지네이션이 없는 "현재 상태 보기"로만 제한하고, 이력 조회는 항상 전용 엔드포인트를 쓴다

## 5. 실험(Experiment) 중심 도메인 모델

이 프로그램의 핵심 단위는 상품이 아니라 "실험(SeoExperiment)"이다. 하나의 상품에 대해 여러 실험이 순차적으로 진행될 수 있고(제목 A안 실패 → B안 재시도), 각 실험은 자신만의 추적 키워드·추적 Job·결과 이력을 가진다. 화면 설계와 API 설계 모두 이 관계를 중심으로 짜여 있어야 한다.

```
Product 1 --- N SeoExperiment 1 --- N ExperimentKeyword
                     |                        |
                     +--- N RankTrackingJob ---+ (experimentId + productId + keyword)
                                |
                                +--- N RankTrackingResult
```

`TitleChangeLog`는 실험과 느슨하게 연결된다(실험 시작 전/재시도 시 여러 번 발생할 수 있는 변경 이력이므로, 실험 1:1이 아니라 상품 기준 이력으로 별도 관리). 상세 필드는 `DB_SCHEMA.md` 참고.

## 6. 랭킹 추적의 위험 통제 구조

네이버는 자동화된 크롤링에 민감하다. 아키텍처 상 랭킹 조회 로직은 반드시 `RankProvider` 인터페이스 뒤로 숨기고, 구현체 교체만으로 안전한 방식(수동/Mock) ↔ 실제 크롤링/API 방식을 스위치할 수 있어야 한다. 자세한 설계는 `RANK_PROVIDER_SPEC.md`.

- 기본값은 `MockRankProvider` 또는 수동 추적
- `ENABLE_NAVER_LIVE_PROVIDER=true`일 때만 실제 크롤링 Provider 활성화 (이미 `config.ts`에 플래그 존재, 실제 게이팅 로직은 아직 라우트/스케줄러에 연결 안 됨 — 리뷰 문서에서 지적)
- 요청 간격 제한, 재시도, 차단 감지는 Provider 내부가 아니라 Provider를 감싸는 공통 러너(`rank-tracking-service.ts`)에서 강제한다

## 7. MVP/OMS 통합 경계

지금은 독립 실행형이지만 다음 지점은 인터페이스로 분리해 나중에 실제 MVP/OMS 어댑터로 교체 가능하게 한다.

- `SeoTitleSourceAdapter`: MVP가 생성한 SEO 제목 후보를 가져오는 경계 (현재는 수동입력/CSV, 나중에 MVP DB/API)
- `ProductCatalogAdapter`: 스마트스토어/OMS 상품 카탈로그를 가져오는 경계 (현재는 CSV/수동, 나중에 커머스 API)
- `ExperimentExportAdapter`: 실험 결과를 OMS로 내보내는 경계 (JSON export)
- `RankProvider`: 랭킹 조회 경계 (이미 분리됨)

인터페이스 정의는 `MVP_OMS_INTEGRATION_PLAN.md`에 구체화한다.

## 8. 배포/실행 원칙

- Docker 금지, `npm run dev`로 web(Vite)+server(tsx watch) 동시 실행
- DB는 SQLite 단일 파일(`prisma/dev.db`), PostgreSQL로 옮길 걸 대비해 SQLite 전용 기능(예: `PRAGMA`, JSON1 함수, `AUTOINCREMENT` 강제) 사용 금지 — 현재 스키마는 이 원칙을 지키고 있음
- 환경변수는 `.env` (커밋 금지, `ENV.example`만 커밋), 시크릿은 반드시 암호화 후 저장 (현재 미구현 — `CODE_REVIEW.md` 1순위 이슈)
