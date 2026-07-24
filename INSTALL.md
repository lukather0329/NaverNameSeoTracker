# INSTALL

## 1. 요구사항

- Node.js 24+
- npm 10+
- Windows / macOS 공통 개발 가능
- Docker 불필요

## 2. 환경변수

루트의 `ENV.example`를 `.env`로 복사하고 값을 채웁니다.

`.env`는 루트 하나만으로는 부족합니다. npm workspace 스크립트(`npm run dev:server`, `npm run prisma:migrate` 등)가 실제로는 `apps/server`를 작업 디렉터리로 실행되기 때문입니다. 아래 2곳에 `.env`를 둬야 합니다. 전부 `.gitignore`에 걸려 있어 머신마다 직접 만들어야 합니다.

- `./.env` (루트) — Vite(`VITE_API_BASE_URL` 등) 및 일반 참고용
- `apps/server/.env` — `DATABASE_URL="file:./dev.db"`, `ENCRYPTION_SECRET=...` 등. `npm run dev:server`와 `npm run prisma:migrate`/`prisma:generate` 모두 `apps/server`를 작업 디렉터리로 실행되므로, Prisma CLI와 서버 런타임 둘 다 이 파일을 읽습니다.

**주의:** `prisma/.env`에도 `DATABASE_URL`을 따로 넣지 마세요. Prisma CLI가 cwd(`apps/server/.env`)와 스키마 옆(`prisma/.env`) 양쪽에서 같은 변수를 발견하면 "Conflicting env vars: DATABASE_URL" 오류로 거부합니다. `DATABASE_URL`은 `apps/server/.env` 한 곳에만 두세요(`prisma/.env` 파일 자체는 있어도 되지만 비워둬야 합니다).

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
