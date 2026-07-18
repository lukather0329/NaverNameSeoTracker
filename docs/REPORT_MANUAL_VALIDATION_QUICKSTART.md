# 리포트 수동 검증 빠른 시작

기준일: 2026-07-18  
대상 브랜치: `feature/reports`

## 1. 목적

이 문서는 `feature/reports` 브랜치를 `dev`로 병합하기 전에, 브라우저에서 실제로 눌러봐야 하는 핵심 검증만 빠르게 수행할 수 있도록 정리한 실행 문서입니다.

자세한 기준은 아래 문서를 함께 참고합니다.

- [REPORT_MERGE_CHECKLIST.md](/D:/Codex/NaverNameSeoTracker/REPORT_MERGE_CHECKLIST.md)
- [REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md](/D:/Codex/NaverNameSeoTracker/REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md)
- [REPORT_MERGE_VALIDATION_2026-07-18.md](/D:/Codex/NaverNameSeoTracker/REPORT_MERGE_VALIDATION_2026-07-18.md)

## 2. 시작 전 상태

자동 검증은 이미 완료되었습니다.

- `npm.cmd run prisma:generate` 통과
- `npm.cmd run prisma:seed` 통과
- `npm.cmd run build` 통과
- `http://localhost:5173` HTTP 200 확인
- `http://localhost:4300/api/snapshot` HTTP 200 확인

샘플 데이터 기준 현재 확인된 스냅샷 요약값은 다음과 같습니다.

- 상품 수: `1`
- 실험 수: `1`
- 결과 수: `2`
- 작업 수: `1`
- API 계정 수: `2`
- 로그 수: `1`
- 진행 중 실험 수: `1`
- 상승 수: `1`
- 하락 수: `1`
- 평균 순위 변화: `-3.5`

## 3. 실행 순서

```bash
cd /d/codex/NaverNameSeoTracker
git checkout feature/reports
git pull origin feature/reports
npm install
npm run prisma:generate
npm run prisma:seed
npm run build
npm run dev
```

브라우저 진입 주소:

- 웹: [http://localhost:5173](http://localhost:5173)
- 스냅샷 API: [http://localhost:4300/api/snapshot](http://localhost:4300/api/snapshot)

## 4. 가장 먼저 볼 화면

1. `리포트` 메뉴 진입
2. 상단 요약 칩과 요약 카드 렌더링 확인
3. 필터 패널, 관리 요약, 테이블 노출 확인
4. `API 계정` 메뉴 진입
5. 기존 계정 열기 또는 저장 후 검증 테스트 1회 실행
6. 계정 하단 테스트 로그 갱신 확인

## 5. 리포트 화면 빠른 검증

아래 6개만 우선 확인해도 병합 리스크를 많이 줄일 수 있습니다.

1. 상단 요약 칩에 `실험`, `추적 결과`, `효과 있음`, `악화`, `완료`, `진행 중`이 정상 표시된다.
2. `검색어`, `상품`, `실험`, `상태`, `판단`, `기간`, `정렬` 변경 시 테이블이 즉시 반응한다.
3. `적용 중인 필터` 영역이 현재 필터 상태를 즉시 반영한다.
4. 프리셋 저장 후 다시 불러오면 활성 프리셋으로 보이고 목록 상단으로 이동한다.
5. 무결과 상태를 만들면 복구용 안내 카드가 보인다.
6. `실험 리포트 CSV`, `집계 결과 CSV`가 다운로드되고 화면 필터 요약과 같은 내용이 상단에 들어간다.

## 6. API 계정 빠른 검증

1. `API 계정` 메뉴 진입 가능
2. 저장된 계정 열기 또는 새 계정 저장 가능
3. 검증 테스트 버튼 실행 가능
4. 성공 또는 실패 결과가 테스트 로그에 남음
5. SEARCH_AD 실연동 정보가 있으면 라이브 테스트 1회 수행

## 7. 결과 기록 방법

검증하면서 바로 아래 문서의 체크박스를 채웁니다.

- [REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md](/D:/Codex/NaverNameSeoTracker/REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md)

판정 기준은 단순합니다.

- 체크리스트 대부분 통과, UI 문구/레이아웃 문제 없음: `ready for dev`
- 핵심 기능 실패, CSV 불일치, API 검증 실패: `needs fixes before merge`

## 8. 검증 후 다음 액션

수동 검증이 끝나면 다음 순서로 진행합니다.

1. 수동 검증 로그 최종 체크
2. `REPORT_MERGE_CHECKLIST.md` 기준 병합 가능 여부 판정
3. 가능하면 `feature/reports`를 `dev`에 병합
4. `dev`에서 빌드와 스모크 체크 재실행
