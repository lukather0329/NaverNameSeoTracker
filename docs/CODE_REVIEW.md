# 코드 리뷰 및 리팩토링 가이드 (1차)

작성: Claude · 대상 커밋: `af888e7` (`feature/api-accounts` 브랜치, "docs: add company handoff checklist")
범위: 초기 세팅, DB 스키마, API 계정 관리, 상품/실험/추적 골격까지 — 요구사항 실행순서 4~8, 10(일부), 11(일부)에 해당

## 총평

초기 모노레포 세팅(npm workspaces, Vite, Express, Prisma+SQLite)은 요구사항의 기술 스택·구조 지시를 정확히 따랐다. 레이어링(routes/services/providers/lib)도 처음부터 잘 분리했고, `RankProvider` 인터페이스와 Mock/Naver 구현체 분리 구조도 설계 의도를 정확히 반영했다. 다만 지금까지 구현은 **"API 계정 관리"와 뼈대 화면**까지고, 요구사항의 핵심 기능(D. SEO 상품명 적용, F의 상태 전이, G. 분석, H. 리포트)은 아직 손대지 않은 상태다. 아래는 우선순위별 지적 사항이다.

## 🔴 Critical (다음 커밋에서 바로 수정)

### C1. API 시크릿 평문 저장
`prisma/schema.prisma`의 `ApiAccount.clientSecret`/`accessLicense`/`secretKey`가 암호화 없이 그대로 저장된다. `docs/API_ACCOUNT_SETUP.md`에 이미 "저장 전 암호화"라고 문서화까지 해놓고 실제 구현이 안 됐다. `ENV.example`의 `ENCRYPTION_SECRET`도 어디서도 참조되지 않는다(코드 전체 grep 결과 사용처 없음 확인). 요구사항 14번 "API 키를 코드에 직접 넣지 말 것"의 취지에도 어긋난다. `lib/crypto.ts`를 추가해 `routes/index.ts`의 계정 생성/수정 직전 암호화, 스냅샷 응답 직전 복호화 후 마스킹하도록 고친다. (상세: `DB_SCHEMA.md` #1)

### C2. 상품명 변경/롤백 기능 전체 부재
`TitleChangeLog` 모델은 있지만 이걸 만드는 라우트가 하나도 없다. 요구사항 D 전체(변경 전/후 저장, 검증 모드, 실제 반영, 롤백, 확인 모달)가 미구현 상태다. 이건 이 프로그램의 존재 이유에 해당하는 기능이라 다음 스프린트 1순위로 둔다. (상세: `API_SPEC.md` 5장)

### C3. 연결 테스트가 형식적 체크뿐
`POST /accounts/:id/test`는 `clientId`/`clientSecret` 등 필드가 채워져 있는지만 보고 `CONNECTED`/`FAILED`를 결정한다(`routes/index.ts:133-166`). 실제 네이버 API를 호출하지 않으므로 "연결됨"이 실제 연결을 보장하지 못한다. 요구사항 B "연결 테스트 버튼"의 의도와 다르다. 최소한 네이버 커머스API의 토큰 발급 엔드포인트를 한 번 호출해보는 실제 핑 로직으로 교체 필요.

## 🟡 High (이번 스프린트 내 처리)

### H1. 실험 생성 시 추적 키워드 미저장
`experimentSchema`(routes/index.ts:44-54)에 `keywords` 필드가 없어서 `ExperimentKeyword` 테이블이 실질적으로 죽어있는 테이블이다. 실험 생성 폼/요청에 키워드 배열을 추가하고, 트랜잭션으로 `ExperimentKeyword`를 함께 생성해야 한다. (상세: `API_SPEC.md` 6장)

### H2. 실험/Job 상태 전이 API 없음
실험은 생성되면 `status: "DRAFT"`에 머무른다. `start`/`pause`/`complete` 전이 라우트가 없어서 화면에 "테스트 시작" 버튼(요구사항 8번)을 만들 수가 없다. 실험을 시작할 때 `RankTrackingJob`을 실험의 키워드 수만큼 자동 생성하는 로직도 여기서 같이 필요하다.

### H3. 랭킹 추적 중복 실행/재시도/차단 감지 없음
`rank-tracking-service.ts`는 매번 무조건 조회하고 저장한다. 동시에 여러 Job이 돌 때 잠금이 없고, `RankTrackingJob.retryCount` 필드가 있는데 실제로 증가시키는 코드가 없다. 상세 설계는 `RANK_PROVIDER_SPEC.md` 2장에 정리했다.

### H4. DataGrid가 요구사항 그리드 기능의 절반만 구현
`apps/web/src/components/DataGrid.tsx`를 확인했다. 열 고정(`sticky`)과 열 너비(버튼 클릭으로 24px씩 조절하는 방식, 마우스 드래그 아님)만 있다. 요구사항 3번이 명시한 정렬, 필터, 컬럼 표시/숨김, 행 선택, 엑셀 내보내기가 전부 빠져 있다. 지금은 각 화면이 `DataGrid`에 고정 컬럼 배열만 넘기는 구조라, 그리드 자체에 다음을 추가해야 한다.
  - 헤더 클릭 정렬 (컬럼별 asc/desc 토글)
  - 컬럼별 텍스트/범위 필터 (헤더 아래 필터 입력행)
  - 컬럼 표시/숨김 토글 메뉴
  - 행 체크박스 선택 + "선택 항목 엑셀로 내보내기"
  - 너비 조절은 버튼이 아니라 실제 드래그 핸들(`mousedown`+`mousemove`)로 교체
  이건 모든 화면(계정/상품/실험/추적/결과)이 공유하는 컴포넌트라 여기 한 곳만 고치면 전체에 적용된다. 재사용 라이브러리(`@tanstack/react-table` 등) 도입도 검토할 만하다.

### H5. SystemLog 미사용
`SystemLog` 모델에 insert하는 코드가 프로젝트 전체에 없다. 요구사항 F "실패 시 원인 로그"와 11번 "실패 로그 상세 기록"을 만족하려면 `lib/system-log.ts` 같은 공용 로거를 만들고, 상품명 변경 실패·랭킹 조회 실패·연결 테스트 실패 지점마다 호출해야 한다.

## 🟢 Medium (설계 정합성/이력)

### M1. `trackingKeywords`를 콤마 구분 문자열로 저장 (`Product.trackingKeywords`)
당장 동작은 하지만 콤마가 포함된 키워드가 들어오면 깨진다. `DB_SCHEMA.md` #3 참고.

### M2. Cascade 삭제 범위
상품 삭제 시 변경 이력까지 같이 지워지는 현재 관계 설정은 "이력은 반드시 보존" 원칙과 상충한다. `DB_SCHEMA.md` #5 참고.

### M3. 대시보드 `last24hPoints` 계산이 실제 24시간이 아님
`dashboard-service.ts:23-32`가 "최근 결과 40건을 5개씩 8묶음"으로 나누는 방식이라, 결과가 뜸하게 쌓이면 라벨(`24h, 21h, ...`)과 실제 시간이 안 맞는다. Job이 30분/1시간 주기로 계속 쌓이기 시작하면 `trackedAt` 기준으로 실제 시간 버킷(3시간 단위 8구간)을 만들도록 바꿔야 정확하다.

### M4. `RankLookupInput`에 `smartStoreProductId` 없음
`RANK_PROVIDER_SPEC.md` 1장 참고 — 검색 결과 매칭에 필요한 필드가 인터페이스에 빠져 있다.

## 🔵 Low (스타일/사소)

- `prisma/schema.prisma`의 `RankTrackingResult.jobId` 필드 들여쓰기가 다른 필드와 안 맞음(정렬만 문제, 동작엔 영향 없음)
- `apps/server/src/routes/index.ts`가 220줄 정도로 이미 여러 도메인을 한 파일에 담고 있음 — `FOLDER_STRUCTURE.md` 2장 기준(300줄 넘으면 분리)에 아직 안 걸리지만 다음 기능(상품명 변경, 리포트) 추가 전에 미리 도메인별로 쪼개는 것을 권장
- `App.tsx`도 470줄로 6개 화면을 한 파일에 담고 있음 — 다음 화면(D/G/H) 추가 전에 `views/` 디렉터리로 분리 권장 (`FOLDER_STRUCTURE.md` 2장)

## 잘한 점 (유지할 것)

- `packages/shared`로 프론트/백엔드 타입을 공유해 계약이 어긋날 여지를 없앤 것
- `RankProvider` 인터페이스를 처음부터 분리해 Mock/실제 구현을 스위치 가능하게 한 것
- SQLite 전용 기능(정수 PK, JSON1 등)을 쓰지 않아 PostgreSQL 이전 경로를 열어둔 것
- `zod`로 라우트 입력을 검증하는 패턴을 처음부터 일관되게 적용한 것
- 요구사항이 요구한 9개 테이블을 빠짐없이 스키마에 반영하고 `created_at`/`updated_at`을 전 테이블에 넣은 것

## 다음 커밋 순서 제안

1. C1 (암호화) → C3 (연결 테스트 실질화) → H5 (SystemLog 연결) — 보안/신뢰성 기반 다지기
2. H1 (실험 키워드) → H2 (상태 전이) → C2 (상품명 변경/롤백) — 핵심 기능 완성
3. H3 (추적 안전장치) → M3 (대시보드 집계 정확도)
4. H4 (DataGrid 고도화) — 병행 가능, 프론트 전담으로 분리해도 됨
5. M1/M2 (스키마 정리) — 위 기능들과 함께 마이그레이션 한 번에 처리
