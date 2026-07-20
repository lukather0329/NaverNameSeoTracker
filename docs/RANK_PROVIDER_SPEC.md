# RankProvider / Scheduler 구조 확정

작성: Claude · 검증 대상: `apps/server/src/providers/*`, `apps/server/src/jobs/tracking-scheduler.ts`, `apps/server/src/services/rank-tracking-service.ts`

## 1. 인터페이스 (확정, 변경 불필요)

```ts
// providers/rank-provider.ts (현행 유지)
export interface RankLookupInput {
  keyword: string;
  productId: string;
  currentTitle: string;
}

export interface RankLookupResult {
  currentRank: number | null;   // null = 순위권 밖
  searchPage: number | null;
  foundTitle: string | null;
  foundProductRef: string | null;
}

export interface RankProvider {
  kind: "MOCK" | "NAVER_SHOPPING" | "FUTURE_API";
  lookup(input: RankLookupInput): Promise<RankLookupResult>;
}
```

이 인터페이스는 요구사항 6번(1차: 수동/HTML 기반, 추후 API/크롤링 교체 가능)과 요구사항 4번(RankProvider 인터페이스 분리)을 정확히 만족한다. `MockRankProvider`(구현 완료), `NaverShoppingRankProvider`(스텁, 의도적으로 미구현 — 아래 3장 참고), `FutureApiRankProvider`(아직 파일 없음, 추후 실제 네이버 커머스/검색 API가 랭킹 조회를 지원하게 되면 추가) 3종 구조를 그대로 확정한다.

`lookup`이 `productId`를 받는 것과 별개로, 실제 검색 결과에서 상품을 매칭하는 기준은 `smartStoreProductId` 또는 `sellerManagementCode`여야 한다(`productId`는 내부 PK라 검색 결과 HTML/API 응답에 나타나지 않음). 따라서 `RankLookupInput`에 매칭용 식별자를 추가하도록 확정한다.

```ts
export interface RankLookupInput {
  keyword: string;
  productId: string;            // 결과 저장용 내부 참조
  smartStoreProductId: string;  // 검색 결과 매칭 기준 (신규 추가 필요)
  currentTitle: string;
}
```

`rank-tracking-service.ts`에서 `provider.lookup()` 호출 시 `job.product.smartStoreProductId`를 함께 넘기도록 수정한다.

## 2. 실행 안전장치 (현재 미구현 — Codex 반영)

지금 `runTrackingJob`은 매번 순위를 조회해서 바로 저장하는 단순 구조다. 요구사항 6·7번의 "과도한 요청 방지", "동일 상품/키워드 중복 실행 방지", "실패한 작업 재시도"를 만족하려면 서비스 레이어에 다음을 추가한다.

### 2.1 중복 실행 방지

`RankTrackingJob`에 `isRunning: Boolean @default(false)` 필드를 추가하고, `runTrackingJob` 시작 시 `isRunning=true`로 잠그고 끝나면 해제한다. 스케줄러가 30분/1시간마다 전체 Job을 훑을 때, 이전 실행이 아직 안 끝난 Job은 건너뛴다. (schema 변경 필요 — `DB_SCHEMA.md`에도 반영)

```ts
export async function runTrackingJob(jobId: string) {
  const locked = await prisma.rankTrackingJob.updateMany({
    where: { id: jobId, isRunning: false },
    data: { isRunning: true }
  });
  if (locked.count === 0) return null; // 이미 실행 중, 스킵

  try {
    // ... 기존 lookup + 저장 로직
  } finally {
    await prisma.rankTrackingJob.update({ where: { id: jobId }, data: { isRunning: false } });
  }
}
```

### 2.2 재시도

조회 실패(네트워크 오류, 차단 감지) 시 `retryCount`를 증가시키고, 3회 실패하면 Job 상태를 `FAILED`로 바꾸고 `SystemLog`에 기록한다. 성공하면 `retryCount`를 0으로 리셋한다. 재시도는 즉시 재호출하지 않고 다음 스케줄 사이클로 미룬다(짧은 시간에 반복 요청하는 것 자체가 차단 위험을 높이므로).

### 2.3 요청 간격 제한

여러 Job이 동시에 같은 스케줄에 걸리면 `Promise.allSettled(jobs.map(...))`로 전부 동시 실행되는 현재 구조는 위험하다. 최소 요청 간격(예: 키워드당 1.5~3초, `config.ts`에 `RANK_LOOKUP_MIN_INTERVAL_MS` 추가)을 두고 순차 또는 소규모 배치(동시 2~3개)로 처리하도록 큐를 둔다.

### 2.4 차단 감지

`NaverShoppingRankProvider` 구현 시(3장 참고) HTTP 응답이 CAPTCHA 페이지, 403, 비정상 리다이렉트인 경우를 감지해 `RankLookupResult` 대신 별도 예외(`RankProviderBlockedError`)를 던지도록 인터페이스를 확장한다. 서비스 레이어는 이 예외를 받으면 해당 Provider의 모든 Job을 즉시 `isEnabled=false`로 내리고 `SystemLog`에 `level=CRITICAL`로 기록 + 관리자가 화면에서 확인하고 수동으로 재활성화하게 한다. 자동 재시도로 계속 두드리지 않는다 — 이것이 요구사항 6번 "네이버 정책 위반 가능성이 있는 자동화는 별도 설정으로 제한"의 핵심이다.

## 3. NaverShoppingRankProvider 구현 가이드 (Codex, 다음 단계)

현재 스텁(`throw new Error(...)`)은 의도적으로 맞다 — 실제 네이버 검색 결과 페이지 구조 크롤링은 정책 위반 소지가 있으므로, 아래 순서로 신중하게 접근한다.

1. `ENABLE_NAVER_LIVE_PROVIDER=true`일 때만 이 Provider를 `resolveProvider()`에서 선택 가능하게 게이팅 (현재 이 플래그가 `config.ts`에 정의만 되어 있고 `rank-tracking-service.ts`에서 전혀 참조되지 않음 — 반드시 연결)
2. User-Agent는 일반 브라우저 값 고정 1개가 아니라 설정 가능한 값으로 (`config.ts`에 `RANK_LOOKUP_USER_AGENT` 추가)
3. 요청 간 랜덤 지연(2.1의 최소 간격 + 지터) 적용
4. 검색 결과 페이지에서 목표 상품을 못 찾으면(요구사항 E) `currentRank: null`, `deltaStatus: "OUT"` 처리 — 이미 `rank-tracking-service.ts`의 delta 계산 로직이 이 경우를 지원하도록 되어 있음(확인 완료)
5. 검색 결과 파싱은 별도 함수(`parseNaverShoppingSearchHtml`)로 분리해 HTML 구조가 바뀌어도 이 함수만 고치면 되게 한다

## 4. 스케줄러 구조 (확정)

`node-cron` 기반 현재 구조(`*/30 * * * *`, `0 * * * *`)를 유지한다. 다만:

- 30분 주기 cron이 정각 기준으로 도는데, 실험이 생성된 시각과 무관하게 :00/:30에만 실행된다. 요구사항이 "생성 후 30분마다"를 의미한다면 Job별 `nextRunAt`을 계산해서 1분 주기 cron으로 "지금 실행할 시간이 된 Job"만 골라 실행하는 방식으로 바꾸는 게 더 정확하다. `RankTrackingJob.nextRunAt` 필드가 이미 스키마에 있으니(현재 안 쓰임) 이 필드를 채워서 활용한다.
- 스케줄러 시작 확인: `server.ts`가 `app.listen()` 콜백에서 `startTrackingScheduler()`를 호출하고 있음(확인 완료, 정상). 다만 2.1~2.3의 잠금/재시도/간격 제어가 붙기 전까지는 이 스케줄러를 `ENABLE_NAVER_LIVE_PROVIDER=true` 환경에서 켜지 않는다.
