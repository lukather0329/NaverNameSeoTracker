# Naver Name SEO Tracker

네이버 상품명 SEO 효과를 실험하고, 상품명 변경 전후의 랭킹 변화를 추적하기 위한 로컬 실행형 관리자 도구입니다.

## 구조

- `apps/web`: React + TypeScript 관리자 UI
- `apps/server`: Express + TypeScript API 서버
- `packages/shared`: 프론트/백엔드 공유 타입
- `prisma`: SQLite 스키마, 마이그레이션, 시드
- `docs`: 운영/연동 문서
- `scripts`: 로컬 실행 보조 스크립트

## 핵심 기능

- 다중 네이버 API 계정 관리
- 상품/SEO 상품명 후보 관리
- 상품명 변경 이력과 롤백 준비 구조
- 실험 단위의 랭킹 추적 Job 관리
- Mock/Naver/Future API RankProvider 분리 구조
- 대시보드, 분석, 리포트용 API/화면 골격

## 빠른 시작

1. Node.js 24 이상 설치
2. `ENV.example`를 복사해 `.env` 생성
3. `npm install`
4. `npm run prisma:generate`
5. `npm run prisma:migrate`
6. `npm run prisma:seed`
7. `npm run dev`

상세 설치는 [INSTALL.md](/D:/Codex/NaverNameSeoTracker/INSTALL.md)에서 확인할 수 있습니다.
