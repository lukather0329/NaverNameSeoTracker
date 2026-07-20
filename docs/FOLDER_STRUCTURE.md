# 폴더 구조 및 개발 규칙

작성: Claude · Codex가 이미 세팅한 구조를 검증하고 규칙을 명문화한 문서

## 1. 현재 구조 (검증 완료, 유지)

```
NaverNameSeoTracker/
├─ apps/
│  ├─ web/                 React + TS (Vite)
│  │  └─ src/
│  │     ├─ components/    재사용 UI (DataGrid, StatusBadge, SparklineBars)
│  │     ├─ lib/           API 클라이언트 (api.ts)
│  │     ├─ App.tsx        화면 라우팅 + 화면별 컴포넌트 (현재 한 파일에 몰려있음 — 3장 참고)
│  │     └─ main.tsx
│  └─ server/               Express + TS
│     └─ src/
│        ├─ routes/         HTTP 계약 (index.ts)
│        ├─ services/       비즈니스 로직 (dashboard-service, rank-tracking-service)
│        ├─ providers/      RankProvider 구현체
│        ├─ jobs/           스케줄러 (tracking-scheduler.ts)
│        ├─ lib/            공용 유틸 (prisma client, mask, config)
│        ├─ app.ts          express app 조립
│        └─ server.ts       진입점 (listen)
├─ packages/
│  └─ shared/src/index.ts   프론트/백엔드 공유 타입 (DTO)
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ docs/                    설계 문서 (본 문서 포함)
└─ scripts/dev.ps1          Windows 로컬 실행 보조
```

이 구조는 요구사항 9번(root/apps/packages/prisma/docs/scripts)과 정확히 일치한다. 새 기능을 추가할 때 이 트리 밖에 파일을 만들지 않는다.

## 2. 코드 배치 규칙

- **새 API 엔드포인트**: `routes/index.ts`에 라우트 등록 → 실제 로직은 `services/<domain>-service.ts`에 함수로 분리. 라우트 파일이 너무 커지면(현재 약 220줄, 300줄 넘으면) `routes/accounts.ts`, `routes/products.ts`, `routes/experiments.ts`, `routes/tracking.ts`, `routes/reports.ts`로 분리하고 `routes/index.ts`에서 `router.use()`로 합친다.
- **새 화면**: `App.tsx`가 이미 6개 뷰(대시보드/계정/상품/실험/추적/결과)를 한 파일에 담고 있다. 상품명 적용(D), 분석(G), 리포트(H) 화면을 추가할 때는 더 이상 `App.tsx`에 누적하지 말고 `apps/web/src/views/<ViewName>View.tsx`로 분리한다. `App.tsx`는 라우팅 셸 역할만 남긴다.
- **새 RankProvider 구현체**: `providers/` 아래 `<이름>-rank-provider.ts` 파일 하나, `RankProvider` 인터페이스 구현, `services/rank-tracking-service.ts`의 `resolveProvider()`에 분기 추가.
- **공유 타입 변경**: 프론트/백엔드 어느 한쪽만 알아야 하는 타입이 아니라면 반드시 `packages/shared/src/index.ts`에 먼저 추가하고 양쪽에서 import. DTO를 각 앱에서 따로 정의하지 않는다.
- **엑셀/CSV 관련 유틸**: `apps/server/src/lib/excel.ts`, `apps/server/src/lib/csv.ts`로 신설, 라우트/서비스에서 재사용.

## 3. 네이밍 규칙

- 파일명: kebab-case (`rank-tracking-service.ts`)
- 컴포넌트 파일: PascalCase (`DataGrid.tsx`)
- Prisma 모델: PascalCase 단수형 (이미 일관됨)
- API 경로: kebab-case, 복수형 리소스명 (`/title-candidates`, `/rank-tracking-jobs`... 단 기존 코드가 `/jobs`, `/accounts`처럼 축약형을 쓰고 있으므로 축약형으로 통일: `/accounts`, `/products`, `/experiments`, `/jobs`, `/results`)
- 상태값(enum 문자열): SCREAMING_SNAKE_CASE (이미 일관됨: `RUNNING`, `CONNECTED` 등)

## 4. 브랜치/커밋 규칙

`docs/GITHUB_WORKFLOW.md`에 이미 정의된 브랜치 전략을 그대로 따른다.

- `main`: 보호 브랜치, 직접 커밋 금지
- `dev`: 통합 브랜치
- `feature/*`: 기능 단위 (`feature/api-accounts`, `feature/products`, `feature/seo-title-apply`, `feature/rank-tracking`, `feature/reports`)
- 커밋 메시지: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:` 접두사 + 한글 또는 영어 설명
- 기능 브랜치 완료 시 `dev`로 PR/머지, `dev`가 안정되면 `main`으로 머지

## 5. 환경 설정 규칙

- `.env`는 절대 커밋하지 않는다 (`.gitignore`에 이미 포함 확인됨)
- `ENV.example`은 새 환경변수 추가 시마다 함께 갱신 (현재 `ENCRYPTION_SECRET`이 있는데 실제로 안 쓰이고 있으니, 암호화 레이어 구현과 동시에 실사용 처리)
- Windows/Mac 어느 쪽에서 열어도 동작해야 하므로 `scripts/` 안의 스크립트는 셸 종속 문법(예: Windows 전용 `.ps1`)을 쓸 때 macOS/Linux용 `.sh` 대응 스크립트를 병행 작성하거나, 가능하면 Node 스크립트(`scripts/*.mjs`)로 통일해 플랫폼 무관하게 만든다.

## 6. 테스트 배치 규칙 (아직 테스트 코드 없음 — Codex 작업 필요)

- 서버: `apps/server/src/**/*.test.ts` (서비스 레이어 단위 테스트 우선 — 특히 `rank-tracking-service.ts`의 delta/status 계산 로직, `dashboard-service.ts`의 집계 로직)
- 프론트: `apps/web/src/**/*.test.tsx` (DataGrid 정렬/필터 로직 우선)
- 테스트 러너는 아직 `package.json`에 없음 — `vitest` 도입 권장 (Vite 프로젝트와 궁합이 좋고 서버/웹 양쪽에 동일하게 쓸 수 있음)
