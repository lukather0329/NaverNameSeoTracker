# 배포 가이드

NaverNameSeoTracker를 개발 PC가 아닌 별도 서버(사내 서버, VM, 클라우드 인스턴스 등)에
올려서 상시로 돌리기 위한 절차입니다. DB는 SQLite 파일 하나로 동작하므로, 별도의
DB 서버 없이 단일 서버(Windows/Linux 모두 가능)에 Node.js만 있으면 됩니다.

## 0. 준비물

- 배포 대상 서버에 Node.js 20 이상 설치
- (선택) 몬테카를로 엔진(`C:\work\MontecarloEngine`)도 같은 서버 또는 접근 가능한 다른
  서버에 함께 배포 — 자세한 내용은 아래 "몬테카를로 엔진 배포" 절 및
  `MontecarloEngine/docs/DEPLOYMENT.md` 참고
- 네이버 오픈API(쇼핑검색)/스마트스토어 API 등 실제 서비스 계정 Client ID/Secret

## 1. 소스 업로드

로컬에서 개발한 코드를 서버로 복사합니다 (git clone, git pull, 또는 zip 업로드 등
편한 방법으로). `node_modules`, `dist`, `.env`, `prisma/dev.db` 등은 제외하고
올리는 것을 권장합니다 (서버에서 새로 설치/빌드).

## 2. 의존성 설치 및 빌드

```bash
cd NaverNameSeoTracker
npm install
npm run build
```

- `npm run build`는 `apps/server`(TypeScript → `apps/server/dist`)와
  `apps/web`(Vite → `apps/web/dist`)을 순서대로 빌드합니다.
- 빌드 산출물 경로: 서버 진입점은 `apps/server/dist/apps/server/src/server.js`
  (npm 스크립트로 등록해뒀으니 직접 경로를 외울 필요는 없습니다 — 아래 참고),
  웹 정적 파일은 `apps/web/dist`.

> **참고**: `npm install`을 새 서버(특히 이전과 다른 OS)에서 실행하면 Prisma
> 엔진 바이너리와 Vite(rollup) 네이티브 바이너리가 해당 서버 환경에 맞게 새로
> 받아집니다. 개발 PC의 `node_modules`를 그대로 복사해서 올리면 플랫폼이 달라
> 실행이 안 될 수 있으니, 반드시 서버에서 `npm install`을 새로 돌리세요.

## 3. 환경변수 설정

```bash
cp apps/server/.env.production.example apps/server/.env
```

`apps/server/.env`를 열어서 최소한 아래 두 값을 채웁니다.

- `DATABASE_URL` — SQLite 파일 경로 (예: `file:./prod.db`)
- `ENCRYPTION_SECRET` — API 계정 시크릿 암호화 키 (예: `openssl rand -hex 32`로 생성)

몬테카를로 엔진을 다른 호스트에 띄웠다면 `RW_DECISION_ENGINE_BASE_URL`도 그 주소로
바꿔주세요. 나머지 값은 기본값 그대로 둬도 됩니다. 전체 항목 설명은
`apps/server/.env.production.example` 파일 안의 주석을 참고하세요.

## 4. 데이터베이스 마이그레이션

```bash
npm run prisma:migrate:deploy
```

- 기존 `prisma migrate dev`는 개발용(대화형, 마이그레이션 자동 생성)이라
  운영 서버에서는 쓰지 않습니다. `migrate deploy`는 이미 만들어진 마이그레이션
  파일들을 순서대로 적용만 하는 운영용 명령입니다.
- 최초 배포로 DB 파일이 아직 없다면 이 명령이 새로 만들어줍니다.

## 5. 서버 실행

```bash
npm run start
```

- 이 한 프로세스가 API(`/api/*`)와 `apps/web` 정적 빌드 결과를 함께 서빙합니다
  (별도 nginx나 정적 호스팅이 없어도 됩니다). 기본 포트는 4300이며 `PORT` 환경변수로
  바꿀 수 있습니다.
- 브라우저에서 `http://<서버주소>:4300` 으로 접속하면 웹 화면이, `/api/health`로
  헬스체크가 됩니다.

### 상시 실행(재부팅/장애 시 자동 재시작)

터미널을 닫아도 계속 떠 있어야 하므로 프로세스 매니저를 붙이는 것을 권장합니다.

**Windows (NSSM 사용, 권장)**

```powershell
nssm install NaverSeoTracker "C:\Program Files\nodejs\node.exe" "dist\apps\server\src\server.js"
nssm set NaverSeoTracker AppDirectory "C:\path\to\NaverNameSeoTracker\apps\server"
nssm set NaverSeoTracker AppEnvironmentExtra NODE_ENV=production
nssm start NaverSeoTracker
```

**Linux (pm2 사용)**

```bash
npm install -g pm2
pm2 start apps/server/dist/apps/server/src/server.js --name naver-seo-tracker --cwd apps/server
pm2 save
pm2 startup
```

## 6. 배포 후 체크리스트

- [ ] `http://<서버주소>:4300/api/health` 정상 응답
- [ ] 브라우저에서 웹 화면 로드, 로그인/데이터 정상 조회
- [ ] API 계정 관리에서 네이버 계정 연결 테스트 통과
- [ ] 실험을 하나 시작해서 추적 작업이 실제로 생성되는지 확인
- [ ] (엔진을 띄웠다면) 상품목록 > 분석 실행이 정상 응답하는지 확인

## 7. 웹/서버를 분리 배포하고 싶다면

기본 설정은 Node 프로세스 하나가 API+정적 파일을 함께 서빙하지만, 원한다면
`apps/web/dist`를 별도의 정적 호스팅(nginx, S3+CDN 등)에 올리고 `apps/server`는
API 전용으로만 돌릴 수도 있습니다. 이 경우:

- 배포된 서버의 `apps/server/dist` 아래에 `apps/web/dist`가 없으면(또는
  `WEB_BUILD_DIR`가 존재하지 않는 경로로 지정되면) 정적 서빙이 자동으로
  비활성화되고 API만 응답합니다.
- 웹 쪽 빌드 시 `VITE_API_BASE_URL` 환경변수로 API 서버 주소를 지정하세요
  (`apps/web/src/lib/api.ts` 참고, 기본값은 `http://localhost:4300/api`).

## 몬테카를로 엔진 배포

`apps/server`의 "분석 실행"(정량분석) 기능은 `C:\work\MontecarloEngine`의 별도
Python(FastAPI) 서비스를 호출합니다. 이 엔진은 NaverNameSeoTracker와 완전히 독립된
프로세스이며, 다른 프로그램에서도 재사용할 계획이므로 **NaverNameSeoTracker에
포함시켜 배포하지 말고, 독립된 상시 서비스로 별도 배포**하는 것을 권장합니다.
자세한 절차는 `MontecarloEngine/docs/DEPLOYMENT.md`를 참고하세요.

요약:

1. 엔진을 상시 서비스로 한 곳(같은 서버 또는 내부망의 다른 서버)에 띄워둡니다.
2. NaverNameSeoTracker를 포함해, 엔진을 쓰는 모든 프로그램은 각자의
   `RW_DECISION_ENGINE_BASE_URL` 환경변수로 그 서비스 주소만 가리키면 됩니다.
3. 엔진 자체를 프로그램마다 따로 설치/실행할 필요가 없습니다 — 하나의 인스턴스를
   여러 프로그램이 공유해서 씁니다.
