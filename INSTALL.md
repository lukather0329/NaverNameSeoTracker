# INSTALL

## 1. 요구사항

- Node.js 24+
- npm 10+
- Windows / macOS 공통 개발 가능
- Docker 불필요

## 2. 환경변수

루트의 `ENV.example`를 `.env`로 복사하고 값을 채웁니다.

## 3. 의존성 설치

```bash
npm install
```

## 4. Prisma 초기화

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## 5. 개발 실행

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:4300/api`

## 6. 배포 메모

- 초기는 SQLite 기반 로컬 배포를 전제로 합니다.
- PostgreSQL 전환 시 `DATABASE_URL`만 교체하지 말고 Prisma provider와 인덱스를 함께 검토해야 합니다.
