# Next Steps

## 현재 상태 (Claude 설계/리뷰 완료 시점)

- 원격 저장소: [NaverNameSeoTracker](https://github.com/lukather0329/NaverNameSeoTracker)
- 기본 브랜치: `main`, `dev`
- 기능 브랜치:
  - `feature/api-accounts`
  - `feature/products`
  - `feature/seo-title-apply`
  - `feature/rank-tracking`
  - `feature/reports`
- 현재 최근 구현 브랜치: `feature/api-accounts`
- 최근 커밋: `af888e7 docs: add company handoff checklist`
- **Claude가 설계/DB/API 명세/코드리뷰/MVP·OMS 통합 문서 작업을 완료함 (아래 "Claude 산출물" 참고)**

## Claude 산출물 (이번 라운드)

전부 `docs/` 아래에 작성/보강했다. Codex는 다음 기능을 만들기 전에 해당 문서를 먼저 확인할 것.

| 문서 | 내용 |
|---|---|
| `docs/ARCHITECTURE.md` | 전체 시스템 아키텍처, 레이어링 원칙, 스냅샷 패턴, 실험 중심 도메인 모델 |
| `docs/DB_SCHEMA.md` | ERD + 현재 스키마 검증 결과 + 반드시 고쳐야 할 6가지 (암호화, 인덱스, 키워드 저장 방식 등) |
| `docs/API_SPEC.md` | 요구사항 B~H 전 메뉴의 API 엔드포인트 명세 (구현됨/부분구현/미구현 표시) |
| `docs/FOLDER_STRUCTURE.md` | 폴더 구조 검증(변경 불필요) + 코드 배치·네이밍·브랜치 규칙 |
| `docs/RANK_PROVIDER_SPEC.md` | RankProvider 인터페이스 확정(smartStoreProductId 필드 추가 필요) + 스케줄러 안전장치 설계 |
| `docs/CODE_REVIEW.md` | 현재 코드 Critical/High/Medium/Low 이슈 + 잘한 점 + 다음 커밋 순서 제안 |
| `docs/MVP_OMS_INTEGRATION_PLAN.md` | 3개 어댑터 인터페이스(TypeScript) 확정 + 4단계 통합 로드맵 |

## Codex가 바로 이어서 할 작업 (우선순위 순)

`docs/CODE_REVIEW.md`의 "다음 커밋 순서 제안"과 동일하다.

1. **보안/신뢰성 기반**: API 시크릿 암호화(`CODE_REVIEW.md` C1), 연결 테스트 실제 API 호출로 교체(C3), `SystemLog` 공용 로거 연결(H5)
2. **핵심 기능 완성**: 실험 생성 시 키워드 저장(H1), 실험 start/pause/complete 상태 전이(H2), **상품명 변경/롤백 API + 확인모달 UI(C2 — 요구사항 D 전체, 지금 완전히 비어있음)**
3. **추적 안전장치**: 중복실행 방지 락, 재시도, 요청 간격 제어(H3), 대시보드 24시간 집계 정확도 수정(M3)
4. **그리드 고도화**: `DataGrid`에 정렬/필터/컬럼 표시숨김/행선택/엑셀내보내기 추가(H4) — 병행 가능
5. **스키마 정리**: 인덱스 추가, 키워드 테이블 분리 검토, cascade 삭제 범위 재검토(M1/M2) — 위 기능들과 한 번의 마이그레이션으로 처리

이후 요구사항 실행순서의 남은 단계(분석 화면, 리포트, 엑셀 export)는 `docs/API_SPEC.md` 8~9장 명세를 따라 진행.

## 오늘 오후 회사에서 처음 할 일 (변동 없음)

1. 저장소 받기 또는 최신화

```bash
git clone https://github.com/lukather0329/NaverNameSeoTracker.git
```

이미 로컬에 있으면:

```bash
git checkout dev
git pull
git checkout feature/api-accounts
git pull
```

2. 현재 상태 확인

```bash
git status
git branch -vv
```

3. 의존성 설치 및 Prisma 준비

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## 참고 파일

- [README.md](/D:/Codex/NaverNameSeoTracker/README.md)
- [INSTALL.md](/D:/Codex/NaverNameSeoTracker/INSTALL.md)
- [ENV.example](/D:/Codex/NaverNameSeoTracker/ENV.example)
- [docs/](/D:/Codex/NaverNameSeoTracker/docs) — 위 표의 전체 설계/리뷰 문서
