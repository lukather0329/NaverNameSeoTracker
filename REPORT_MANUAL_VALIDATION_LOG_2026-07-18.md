# Report Manual Validation Log

Validation date: 2026-07-18
Branch: `feature/reports`
Validator: `TBD`
Status: `manual checks pending`

## 1. Environment

- [x] `git checkout feature/reports`
- [x] `git pull origin feature/reports`
- [x] `npm.cmd run prisma:generate`
- [x] `npm.cmd run prisma:seed`
- [x] `npm.cmd run build`
- [ ] `npm run dev`

Notes:
- Automated validation was completed on Saturday, July 18, 2026.
- `npm.cmd run prisma:generate` passed after stopping local project dev processes.
- Browser-based checks below are still pending.

## 2. Report UI Checks

- [ ] `리포트` 화면 진입 가능
- [ ] Hero / 필터 패널 / 요약 카드 / 관리 요약 / 테이블 렌더링 정상
- [ ] 상단 요약 칩 표시 정상
  - `실험`
  - `추적 결과`
  - `효과 있음`
  - `악화`
  - `완료`
  - `진행 중`
- [ ] 좁은 폭에서 상단 요약 칩 줄바꿈 정상
- [ ] 좁은 폭에서 프리셋 입력 줄 스택 정상

Notes:

## 3. Filter Checks

- [ ] `검색` 변경 시 테이블 반영
- [ ] `상품` 변경 시 테이블 반영
- [ ] `실험` 변경 시 테이블 반영
- [ ] `상태` 변경 시 테이블 반영
- [ ] `판단` 변경 시 테이블 반영
- [ ] `기간` 변경 시 테이블 반영
- [ ] `정렬` 변경 시 테이블 반영
- [ ] `적용 중인 필터` 영역 즉시 반영
- [ ] 기본값이 아닌 정렬이 `적용 중인 필터`에 표시됨
- [ ] 상단 `필터 초기화` 버튼이 기본 상태에서 비활성화됨
- [ ] 필터 변경 후 `필터 초기화` 버튼이 활성화됨

Notes:

## 4. Preset Checks

- [ ] 새 프리셋 저장 가능
- [ ] 저장된 프리셋 불러오기 가능
- [ ] 불러온 프리셋이 활성 프리셋으로 표시됨
- [ ] 사용한 프리셋이 목록 상단으로 이동함
- [ ] 프리셋 삭제 가능
- [ ] 새로고침 후 프리셋 유지됨

Notes:

## 5. Empty-State Checks

- [ ] 무결과 상태 유도 가능
- [ ] 무결과 안내 카드 표시 정상
- [ ] `전체 필터 초기화`로 복구 가능
- [ ] 잘못된 날짜 범위 경고 표시 정상
- [ ] 빈 상태 복구 액션으로 날짜 범위 초기화 가능

Notes:

## 6. Export Checks

- [ ] `실험 리포트 CSV` 다운로드 성공
- [ ] `랭킹 결과 CSV` 다운로드 성공
- [ ] Excel에서 파일 열기 정상
- [ ] CSV 상단 필터 요약 포함 확인
- [ ] CSV 필터 요약과 화면 필터 상태 일치 확인

Notes:

## 7. API Regression Checks

- [ ] `API 계정` 화면 진입 가능
- [ ] 계정 저장 또는 기존 계정 열기 가능
- [ ] 검증 테스트 실행 가능
- [ ] 로그 이력 갱신 확인
- [ ] SEARCH_AD 실연동 테스트 가능 여부 확인

Notes:

## 8. Result

- Overall result:
  - [ ] pass
  - [ ] blocked
  - [ ] fail

- Merge recommendation:
  - [ ] ready for `dev`
  - [ ] needs fixes before merge

## 9. Open Issues

- None recorded yet.
