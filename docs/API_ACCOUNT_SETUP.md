# API Account Setup

## 지원 계정 유형

- Naver Commerce API
- Naver Search Ad API
- Custom / Future Adapter

## 저장 원칙

- 키와 시크릿은 DB 저장 전 암호화 레이어를 거칩니다.
- UI에서는 마스킹된 값만 노출합니다.
- 연결 테스트는 실제 작업 실행 전 별도 버튼으로 분리합니다.

## 향후 확장

- 다중 스토어/채널 계정 매핑
- 계정별 권한 범위 표시
- 만료 예정 알림
