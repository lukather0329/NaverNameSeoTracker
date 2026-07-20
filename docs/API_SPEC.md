# API 명세 (확정본)

작성: Claude · 기준: 요구사항 전체 메뉴(B~H) + 현재 `apps/server/src/routes/index.ts` 구현 상태
표기: ✅ 구현됨 / ⚠️ 부분 구현(수정 필요) / ❌ 미구현(Codex가 다음 단계에서 구현)

베이스 URL: `/api` · 응답 포맷: JSON · 인증: 로컬 단일 사용자 도구이므로 별도 인증 없음(향후 다중 사용자 전환 시 세션 추가 검토)

## 1. 공통

| 항목 | 규칙 |
|---|---|
| 에러 응답 | `{ ok: false, message: string, code?: string }`, HTTP 상태코드와 함께 |
| 입력 검증 | 모든 라우트는 zod 스키마로 파싱 (`routes/index.ts` 상단에 이미 패턴 존재) |
| 날짜 | ISO 8601 문자열로 송수신, DB는 Prisma `DateTime` |
| 위험 작업 | 상품명 실제 반영(LIVE 모드) API는 `confirm: true` 바디 필드를 요구하고, 없으면 400 반환 — 프론트 확인 모달과 짝을 이루는 서버측 방어선 |

## 2. 대시보드

| 메서드 | 경로 | 상태 | 설명 |
|---|---|---|---|
| GET | `/snapshot` | ✅ | 대시보드 요약 + 전체 컬렉션 스냅샷 |
| GET | `/health` | ✅ | 헬스체크 |

## 3. API 계정 관리

| 메서드 | 경로 | 상태 | 설명 |
|---|---|---|---|
| POST | `/accounts` | ✅ | 계정 등록 (평문 저장 중 — `DB_SCHEMA.md` #1 수정 필요) |
| PUT | `/accounts/:id` | ✅ | 계정 수정 |
| POST | `/accounts/:id/test` | ✅ | 연결 테스트 (현재는 필드 존재 여부만 검사하는 형식적 체크 — 실제 네이버 API 핑 로직으로 교체 필요) |
| DELETE | `/accounts/:id` | ❌ | 계정 삭제 (소프트 삭제: `isActive=false` 처리로 대체 가능하나, 완전 삭제 버튼도 필요) |
| GET | `/accounts/:id/usage` | ❌ | 이 계정이 연결된 상품/실험 수 조회 (삭제 전 영향도 확인용) |

## 4. 상품 관리

| 메서드 | 경로 | 상태 | 설명 |
|---|---|---|---|
| POST | `/products` | ✅ | 상품 단건 등록 |
| PUT | `/products/:id` | ❌ | 상품 정보 수정 (가격, 카테고리, 추적 키워드 변경) |
| DELETE | `/products/:id` | ❌ | 상품 소프트 삭제 |
| POST | `/products/import` | ❌ | CSV/엑셀 업로드 일괄 등록. 요청은 `multipart/form-data`, 서버는 파싱 후 행별 검증 결과(성공/실패 사유)를 배열로 반환 |
| GET | `/products/export` | ❌ | 현재 상품 목록 엑셀 다운로드 |
| GET | `/products/:id` | ❌ | 상품 상세 (연결된 실험/변경이력/최근 랭킹 포함) |

CSV 업로드 컬럼 매핑은 상품 필드와 1:1 대응시키되, `내부 상품 ID`는 업로드 대상에서 제외(서버가 생성). `스마트스토어 상품 ID`는 필수, 나머지는 선택.

## 5. SEO 상품명 적용

| 메서드 | 경로 | 상태 | 설명 |
|---|---|---|---|
| POST | `/title-candidates` | ✅ | 후보 등록 (수동/CSV/MVP 어댑터 공용) |
| POST | `/title-candidates/import` | ❌ | CSV 업로드로 여러 상품의 후보를 일괄 등록 |
| POST | `/products/:id/title-change` | ❌ | **핵심 누락 기능.** 상품명 변경 실행. 바디: `{ candidateId, mode: "VALIDATION" \| "LIVE", confirm: boolean }`. `VALIDATION`이면 `TitleChangeLog`만 기록하고 실제 API 호출 없음. `LIVE`면 `confirm=true` 필수 + 실제 스마트스토어 API 호출 + 성공/실패 결과와 실패 사유를 `TitleChangeLog.result`/`reason`에 기록 + 실패 시 `SystemLog`에도 상세 기록 |
| POST | `/title-changes/:id/rollback` | ❌ | 롤백. 대상 `TitleChangeLog`의 `beforeTitle`로 되돌리는 새 `TitleChangeLog`(mode=`LIVE`, reason=`ROLLBACK`)를 생성하고 실제 반영 |
| GET | `/products/:id/title-changes` | ❌ | 특정 상품의 변경 이력 타임라인 조회 |

상품명 변경은 요구사항 D에서 "위험 작업이므로 확인 모달 필수"라고 명시했다. 서버는 모달 자체를 대신할 수 없으므로 `confirm` 플래그로 프론트의 확인 절차를 강제하고, 이 플래그 없이 LIVE 모드 요청이 오면 400으로 거부하는 것이 서버측 안전장치다.

## 6. 실험 관리

| 메서드 | 경로 | 상태 | 설명 |
|---|---|---|---|
| POST | `/experiments` | ✅ | 실험 생성 (현재 `keywords` 배열을 받지 않음 — 수정 필요, 아래 참고) |
| PUT | `/experiments/:id` | ❌ | 실험 정보 수정 (요약/판단/메모 필드 포함) |
| POST | `/experiments/:id/start` | ❌ | 상태를 `RUNNING`으로 전이 + 연결된 `RankTrackingJob` 자동 생성 |
| POST | `/experiments/:id/pause` | ❌ | 상태를 `PAUSED`로 전이, Job은 `isEnabled=false` |
| POST | `/experiments/:id/complete` | ❌ | 상태를 `COMPLETED`로 전이 + `judgement` 필수 입력 |
| POST | `/experiments/:id/keywords` | ❌ | 추적 키워드 추가 |
| DELETE | `/experiments/:id/keywords/:keywordId` | ❌ | 추적 키워드 제거 |

**수정 필요:** 현재 `experimentSchema`(routes/index.ts)는 `keywords`를 받지 않아 `ExperimentKeyword` 테이블에 아무것도 안 들어간다. 요구사항 F의 "추적 키워드" 필드가 실험 생성 시점에 채워지도록 `POST /experiments` 바디에 `keywords: string[]`를 추가하고, 생성 트랜잭션 안에서 `ExperimentKeyword`를 함께 만들도록 서비스 로직을 고친다.

## 7. 상품 랭킹 추적

| 메서드 | 경로 | 상태 | 설명 |
|---|---|---|---|
| POST | `/jobs/:id/run` | ✅ | 즉시 1회 추적 실행 |
| POST | `/jobs` | ❌ | Job 생성 (보통 실험 시작 시 자동 생성되지만, 개별 키워드 추가 시 수동 생성 경로도 필요) |
| PUT | `/jobs/:id` | ❌ | Job 설정 변경 (interval, provider, isEnabled) |
| POST | `/jobs/:id/stop` | ❌ | 추적 중지 (`isEnabled=false`) |
| GET | `/results` | ❌ | 필터 조회: `productId`, `keyword`, `experimentId`, `from`, `to`, `deltaStatus`. 스냅샷에 있는 최근 100건과 별개로 기간 지정 조회용 |
| GET | `/experiments/:id/before-after` | ❌ | 상품명 변경 시점 기준 Before/After 비교 (변경 직전 순위 vs 변경 후 N시간 순위) |

## 8. 분석 화면

| 메서드 | 경로 | 상태 | 설명 |
|---|---|---|---|
| GET | `/analysis/product/:id` | ❌ | 상품별 순위 변화 시계열 |
| GET | `/analysis/keyword/:keyword` | ❌ | 키워드별 순위 변화 (여러 상품 横단) |
| GET | `/analysis/summary?range=24h\|3d\|7d\|14d\|30d` | ❌ | 기간별 평균 순위 상승폭, 상승/하락 키워드 수 |
| GET | `/analysis/reaction-time/:experimentId` | ❌ | 상품명 변경 후 첫 순위 변동까지 걸린 시간 |
| GET | `/analysis/title-patterns` | ❌ | 성공/실패 상품명 패턴 집계 (judgement=EFFECTIVE vs WORSE 그룹의 제목 특징 비교 — 1차는 단순 키워드 빈도 집계로 시작) |

## 9. 리포트

| 메서드 | 경로 | 상태 | 설명 |
|---|---|---|---|
| GET | `/reports/experiments/export` | ❌ | 전체 테스트 결과 엑셀 다운로드 |
| GET | `/reports/products/:id/export` | ❌ | 상품별 상세 리포트 |
| GET | `/reports/keywords/:keyword/export` | ❌ | 키워드별 상세 리포트 |
| GET | `/reports/experiments/:id/before-after/export` | ❌ | 변경 전/후 비교 리포트 |
| GET | `/reports/experiments/:id/json` | ❌ | MVP/OMS 통합용 JSON export (`MVP_OMS_INTEGRATION_PLAN.md`의 `ExperimentExportAdapter` 계약과 동일 스키마) |

## 10. 시스템/운영

| 메서드 | 경로 | 상태 | 설명 |
|---|---|---|---|
| GET | `/system-logs` | ❌ | 필터(level, scope, 기간) 조회 |
| POST | `/backup` | ❌ | SQLite 파일 백업 (파일 복사 + 타임스탬프 파일명) |
| POST | `/restore` | ❌ | 백업 파일로부터 복원 (덮어쓰기 전 확인 모달 필수, 서버는 `confirm` 필드로 방어) |

## 11. 구현 우선순위 제안 (Codex 다음 스프린트)

1. 상품명 변경/롤백 (5장) — 요구사항 핵심 기능인데 완전히 비어 있음
2. 실험 keywords 입력 + start/pause/complete 상태 전이 (6장)
3. Job 생성/중지 + 결과 필터 조회 (7장)
4. CSV 업로드/다운로드 (4장, 5장)
5. 분석 (8장) → 리포트 (9장) → 시스템 로그/백업 (10장)
