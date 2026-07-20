# API Account Setup

## 지원 계정 유형

- Naver Commerce API
- Naver Search Ad API
- Custom / Future Adapter

## 저장 원칙

- 키와 시크릿은 DB 저장 전 암호화 레이어를 거칩니다. **(현재 미구현 — `CODE_REVIEW.md` C1 참고. `ENCRYPTION_SECRET` 환경변수는 정의만 되어 있고 실제 암복호화 로직은 아직 없습니다. 다음 스프린트 1순위로 처리)**
- UI에서는 마스킹된 값만 노출합니다. (구현 완료 — `lib/mask.ts`)
- 연결 테스트는 실제 작업 실행 전 별도 버튼으로 분리합니다. (구현 완료, 다만 현재는 필드 존재 여부만 검사하는 형식적 체크 — 실제 네이버 API 호출로 교체 필요, `CODE_REVIEW.md` C3 참고)

## 향후 확장

- 다중 스토어/채널 계정 매핑
- 계정별 권한 범위 표시
- 만료 예정 알림

## 관련 문서

- 상세 설계: `ARCHITECTURE.md`, `DB_SCHEMA.md`, `API_SPEC.md` 3장
- 리뷰 이슈: `CODE_REVIEW.md`
