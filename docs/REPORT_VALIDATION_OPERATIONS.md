# 리포트 검증 운영 가이드

기준일: 2026-07-18  
대상 브랜치: `feature/reports`

## 1. 목적

이 문서는 리포트 브랜치 수동 검증을 반복 수행할 때, 어떤 배치파일을 어떤 순서로 써야 하는지 빠르게 안내하는 운영용 가이드입니다.

## 2. 추천 순서

1. [리포트_수동검증_시작.bat](/D:/Codex/NaverNameSeoTracker/리포트_수동검증_시작.bat) 실행
2. 브라우저와 문서가 열리면 [리포트_스모크체크.bat](/D:/Codex/NaverNameSeoTracker/리포트_스모크체크.bat) 실행
3. `리포트` 화면과 `API 계정` 화면을 실제로 눌러보며 [REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md](/D:/Codex/NaverNameSeoTracker/REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md) 체크
4. 검증이 끝나면 [리포트_수동검증_정리.bat](/D:/Codex/NaverNameSeoTracker/리포트_수동검증_정리.bat) 실행

## 3. 배치파일 역할

- `리포트_수동검증_시작.bat`
  - `feature/reports` 체크아웃
  - `git pull origin feature/reports`
  - `npm install`
  - `npm run prisma:generate`
  - `npm run prisma:seed`
  - `npm run build`
  - `npm run dev` 실행
  - 브라우저와 검증 문서 자동 열기
- `리포트_스모크체크.bat`
  - `http://localhost:5173` 응답 확인
  - `http://localhost:4300/api/snapshot` 응답 확인
  - 스냅샷 핵심 카운트 출력
- `리포트_수동검증_정리.bat`
  - 이 저장소 경로를 사용하는 `npm run dev`, `concurrently`, `vite`, `tsx watch src/server.ts` 프로세스 정리

## 4. 스모크체크 기대값

2026년 7월 18일 기준 검증 문서에 남겨 둔 기대값은 다음과 같습니다.

- web status: `200`
- api status: `200`
- products: `1`
- experiments: `1`
- results: `2`
- jobs: `1`
- api accounts: `2`
- logs: `1`
- running experiments: `1`
- up count: `1`
- down count: `1`
- average rank delta: `-3.5`

## 5. 최종 판정 문서

- 병합 기준: [REPORT_MERGE_CHECKLIST.md](/D:/Codex/NaverNameSeoTracker/REPORT_MERGE_CHECKLIST.md)
- 수동 체크 기록: [REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md](/D:/Codex/NaverNameSeoTracker/REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md)
- 자동 검증 기록: [REPORT_MERGE_VALIDATION_2026-07-18.md](/D:/Codex/NaverNameSeoTracker/REPORT_MERGE_VALIDATION_2026-07-18.md)

## 6. 현재 남은 핵심 작업

자동 검증과 로컬 준비는 끝난 상태입니다. 남은 핵심 작업은 브라우저에서 `리포트`와 `API 계정`을 직접 눌러 보며 체크리스트를 채우는 것입니다.
