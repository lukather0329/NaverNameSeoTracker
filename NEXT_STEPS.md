# Next Steps

## 현재 상태

- 원격 저장소: [NaverNameSeoTracker](https://github.com/lukather0329/NaverNameSeoTracker)
- 기본 브랜치: `main`, `dev`
- 기능 브랜치:
  - `feature/api-accounts`
  - `feature/products`
  - `feature/seo-title-apply`
  - `feature/rank-tracking`
  - `feature/reports`
- 현재 최근 구현 브랜치: `feature/api-accounts`
- 최근 커밋: `20ad27c feat: add API account management workflow`

## 오늘 오후 회사에서 처음 할 일

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

기대 상태:

- 현재 브랜치: `feature/api-accounts`
- working tree clean

3. 의존성 설치

```bash
npm install
```

4. Prisma 준비

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

5. 개발 서버 실행

```bash
npm run dev
```

## 우선 확인할 기능

- API 계정 화면 진입
- 계정 등록 폼 입력/저장 확인
- 연결 테스트 버튼 동작 확인
- 활성화/비활성화 토글 확인
- 서버 응답 에러 여부 확인

## 바로 이어서 할 개발 우선순위

1. `feature/api-accounts`

- API 계정 수정 UX 보강
- 입력값 검증 및 오류 메시지 개선
- 민감정보 저장 방식 검토
- 실제 네이버 API 연결 테스트 구조 구체화

2. `feature/products`

- 상품 등록/조회 화면 구체화
- CSV 업로드 골격 추가
- 상품 식별자 필드와 상태값 UI 정리

3. 이후

- `feature/seo-title-apply`
- `feature/rank-tracking`
- `feature/reports`

## Claude로 넘길 핵심 메모

- 현재 프로젝트는 초기 모노레포 구조와 기본 문서가 생성됨
- React + TypeScript 웹 / Express + TypeScript 서버 / Prisma + SQLite 골격 구성 완료
- API 계정 관리 기능은 1차 구현 및 커밋 완료
- 실제 `npm install` 및 런타임 검증은 아직 진행하지 않음
- Claude는 설계 검증, 문서 보강, 리팩토링 가이드, 실제 네이버 연동 구조 검토 중심으로 이어받으면 좋음

## 참고 파일

- [README.md](/D:/Codex/NaverNameSeoTracker/README.md)
- [INSTALL.md](/D:/Codex/NaverNameSeoTracker/INSTALL.md)
- [ENV.example](/D:/Codex/NaverNameSeoTracker/ENV.example)
- [docs/API_ACCOUNT_SETUP.md](/D:/Codex/NaverNameSeoTracker/docs/API_ACCOUNT_SETUP.md)
- [docs/MVP_OMS_INTEGRATION_PLAN.md](/D:/Codex/NaverNameSeoTracker/docs/MVP_OMS_INTEGRATION_PLAN.md)
