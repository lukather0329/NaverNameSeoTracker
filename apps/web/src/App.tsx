import { useEffect, useState } from "react";
import type {
  ApiAccount,
  AppSnapshot,
  Product,
  RankTrackingJob,
  RankTrackingJobFormInput,
  RankTrackingResult,
  RankProviderKind,
  SeoExperiment,
  TrackingInterval
} from "@naver-seo-tracker/shared";
import { DataGrid } from "./components/DataGrid";
import { SparklineBars } from "./components/SparklineBars";
import { StatusBadge } from "./components/StatusBadge";
import { createTrackingJob, fetchSnapshot, runTrackingJob, updateTrackingJob } from "./lib/api";

type ViewKey = "dashboard" | "accounts" | "products" | "experiments" | "tracking" | "results";

const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: "dashboard", label: "대시보드" },
  { key: "accounts", label: "API 계정" },
  { key: "products", label: "상품 목록" },
  { key: "experiments", label: "실험 관리" },
  { key: "tracking", label: "추적 작업" },
  { key: "results", label: "랭킹 결과" }
];

const defaultTrackingJobForm: RankTrackingJobFormInput = {
  experimentId: "",
  productId: "",
  keyword: "",
  interval: "30_MINUTES",
  provider: "MOCK",
  isEnabled: true
};

export function App() {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSnapshot();
  }, []);

  async function loadSnapshot() {
    try {
      setLoading(true);
      setError(null);
      setSnapshot(await fetchSnapshot());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunJob(jobId: string) {
    await runTrackingJob(jobId);
    await loadSnapshot();
  }

  async function handleCreateTrackingJob(input: RankTrackingJobFormInput) {
    await createTrackingJob(input);
    await loadSnapshot();
  }

  async function handleToggleTrackingJob(job: RankTrackingJob) {
    await updateTrackingJob(job.id, { isEnabled: !job.isEnabled });
    await loadSnapshot();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">SEO Experiment Ops</p>
          <h1>Naver Name Tracker</h1>
          <p className="sidebar-copy">상품명 변경 전후 실험을 한 화면에서 추적하는 운영형 콘솔입니다.</p>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === view ? "nav-item active" : "nav-item"}
              onClick={() => setView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button type="button" className="refresh-button" onClick={() => void loadSnapshot()}>
          새로고침
        </button>
      </aside>
      <main className="content">
        {loading && <section className="panel">데이터를 불러오는 중입니다.</section>}
        {error && <section className="panel error-panel">{error}</section>}
        {!loading && !error && snapshot && (
          <>
            {view === "dashboard" && <DashboardView snapshot={snapshot} />}
            {view === "accounts" && <ApiAccountsView accounts={snapshot.apiAccounts} />}
            {view === "products" && <ProductsView products={snapshot.products} />}
            {view === "experiments" && <ExperimentsView experiments={snapshot.experiments} />}
            {view === "tracking" && (
              <TrackingJobsView
                jobs={snapshot.jobs}
                experiments={snapshot.experiments}
                products={snapshot.products}
                onCreateJob={handleCreateTrackingJob}
                onRunJob={handleRunJob}
                onToggleJob={handleToggleTrackingJob}
              />
            )}
            {view === "results" && <ResultsView results={snapshot.results} products={snapshot.products} />}
          </>
        )}
      </main>
    </div>
  );
}

function DashboardView({ snapshot }: { snapshot: AppSnapshot }) {
  const cards = [
    { label: "진행 중 실험", value: snapshot.dashboard.runningExperiments },
    { label: "상승", value: snapshot.dashboard.upCount },
    { label: "하락", value: snapshot.dashboard.downCount },
    { label: "유지", value: snapshot.dashboard.sameCount },
    { label: "평균 순위 변화", value: snapshot.dashboard.avgRankDelta }
  ];

  return (
    <section className="dashboard">
      <div className="hero panel">
        <div>
          <p className="eyebrow">오늘의 운영 포인트</p>
          <h2>상품명 변경 효과를 실험 단위로 관리합니다.</h2>
          <p>
            변경 로그, 추적 Job, 랭킹 결과를 느슨하게 분리해 향후 MVP/OMS 통합 시 어댑터만 교체할 수 있도록
            설계했습니다.
          </p>
        </div>
        <SparklineBars points={snapshot.dashboard.last24hPoints} />
      </div>
      <div className="card-grid">
        {cards.map((card) => (
          <article key={card.label} className="metric-card panel">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function ApiAccountsView({ accounts }: { accounts: ApiAccount[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">연결 상태</p>
          <h2>네이버 API 계정</h2>
        </div>
      </div>
      <DataGrid
        columns={[
          { key: "name", title: "계정명", width: 180, sticky: true },
          { key: "type", title: "유형", width: 120 },
          { key: "clientIdMasked", title: "Client ID", width: 160 },
          { key: "clientSecretMasked", title: "Client Secret", width: 180 },
          { key: "storeId", title: "Store ID", width: 140 },
          { key: "channelId", title: "Channel ID", width: 140 },
          {
            key: "connectionStatus",
            title: "상태",
            width: 120,
            render: (row) => <StatusBadge value={row.connectionStatus} />
          }
        ]}
        rows={accounts}
      />
    </section>
  );
}

function ProductsView({ products }: { products: Product[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">카탈로그</p>
          <h2>상품 목록</h2>
        </div>
      </div>
      <DataGrid
        columns={[
          { key: "smartStoreProductId", title: "스마트스토어 상품 ID", width: 200, sticky: true },
          { key: "sellerManagementCode", title: "판매자관리코드", width: 160 },
          { key: "currentTitle", title: "현재 상품명", width: 300 },
          { key: "seoOptimizedTitle", title: "SEO 상품명", width: 320 },
          { key: "primaryKeyword", title: "대표 키워드", width: 150 },
          {
            key: "trackingKeywords",
            title: "추적 키워드",
            width: 240,
            render: (row) => row.trackingKeywords.join(", ")
          },
          { key: "price", title: "판매가", width: 120 },
          {
            key: "testStatus",
            title: "테스트 상태",
            width: 130,
            render: (row) => <StatusBadge value={row.testStatus} />
          }
        ]}
        rows={products}
      />
    </section>
  );
}

function ExperimentsView({ experiments }: { experiments: SeoExperiment[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">실험 단위</p>
          <h2>SEO 테스트 관리</h2>
        </div>
      </div>
      <DataGrid
        columns={[
          { key: "name", title: "테스트명", width: 220, sticky: true },
          { key: "beforeTitle", title: "변경 전", width: 240 },
          { key: "afterTitle", title: "변경 후", width: 280 },
          { key: "trackingInterval", title: "주기", width: 120 },
          {
            key: "status",
            title: "상태",
            width: 120,
            render: (row) => <StatusBadge value={row.status} />
          },
          {
            key: "judgement",
            title: "판단",
            width: 120,
            render: (row) => <StatusBadge value={row.judgement} />
          },
          { key: "summary", title: "요약", width: 240 }
        ]}
        rows={experiments}
      />
    </section>
  );
}

function TrackingJobsView({
  jobs,
  experiments,
  products,
  onCreateJob,
  onRunJob,
  onToggleJob
}: {
  jobs: RankTrackingJob[];
  experiments: SeoExperiment[];
  products: Product[];
  onCreateJob: (input: RankTrackingJobFormInput) => Promise<void>;
  onRunJob: (jobId: string) => Promise<void>;
  onToggleJob: (job: RankTrackingJob) => Promise<void>;
}) {
  const [form, setForm] = useState<RankTrackingJobFormInput>(defaultTrackingJobForm);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      experimentId: current.experimentId || experiments[0]?.id || "",
      productId: current.productId || products[0]?.id || ""
    }));
  }, [experiments, products]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateJob(form);
    setForm({
      ...defaultTrackingJobForm,
      experimentId: experiments[0]?.id || "",
      productId: products[0]?.id || ""
    });
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">스케줄러</p>
          <h2>랭킹 추적 Job</h2>
        </div>
      </div>
      <form className="entity-form" onSubmit={handleSubmit}>
        <label>
          <span>실험 선택</span>
          <select
            value={form.experimentId}
            onChange={(event) => setForm((current) => ({ ...current, experimentId: event.target.value }))}
          >
            <option value="">실험 선택</option>
            {experiments.map((experiment) => (
              <option key={experiment.id} value={experiment.id}>
                {experiment.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>상품 선택</span>
          <select
            value={form.productId}
            onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}
          >
            <option value="">상품 선택</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.currentTitle}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>추적 키워드</span>
          <input
            value={form.keyword}
            onChange={(event) => setForm((current) => ({ ...current, keyword: event.target.value }))}
            placeholder="예: 네이버 상품명 최적화"
          />
        </label>
        <label>
          <span>주기</span>
          <select
            value={form.interval}
            onChange={(event) =>
              setForm((current) => ({ ...current, interval: event.target.value as TrackingInterval }))
            }
          >
            <option value="30_MINUTES">30분</option>
            <option value="60_MINUTES">60분</option>
          </select>
        </label>
        <label>
          <span>Provider</span>
          <select
            value={form.provider}
            onChange={(event) =>
              setForm((current) => ({ ...current, provider: event.target.value as RankProviderKind }))
            }
          >
            <option value="MOCK">MOCK</option>
            <option value="NAVER_SHOPPING">NAVER_SHOPPING</option>
            <option value="FUTURE_API">FUTURE_API</option>
          </select>
        </label>
        <label className="checkbox-field">
          <span>활성화</span>
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(event) => setForm((current) => ({ ...current, isEnabled: event.target.checked }))}
          />
        </label>
        <div className="inline-actions wide-field">
          <button type="submit" className="action-button">
            Job 등록
          </button>
        </div>
      </form>
      <DataGrid
        columns={[
          { key: "keyword", title: "키워드", width: 180, sticky: true },
          {
            key: "experimentId",
            title: "실험",
            width: 220,
            render: (row) => experiments.find((experiment) => experiment.id === row.experimentId)?.name ?? row.experimentId
          },
          {
            key: "productId",
            title: "상품",
            width: 260,
            render: (row) => products.find((product) => product.id === row.productId)?.currentTitle ?? row.productId
          },
          { key: "provider", title: "Provider", width: 140 },
          { key: "interval", title: "주기", width: 120 },
          {
            key: "isEnabled",
            title: "활성",
            width: 100,
            render: (row) => <StatusBadge value={row.isEnabled ? "CONNECTED" : "PAUSED"} />
          },
          {
            key: "status",
            title: "상태",
            width: 120,
            render: (row) => <StatusBadge value={row.status} />
          },
          { key: "retryCount", title: "재시도", width: 100 },
          {
            key: "actions",
            title: "실행",
            width: 220,
            render: (row) => (
              <div className="inline-actions compact-actions">
                <button type="button" className="action-button" onClick={() => void onRunJob(row.id)}>
                  즉시 추적
                </button>
                <button type="button" className="action-button secondary" onClick={() => void onToggleJob(row)}>
                  {row.isEnabled ? "비활성" : "활성"}
                </button>
              </div>
            )
          }
        ]}
        rows={jobs}
      />
    </section>
  );
}

function ResultsView({ results, products }: { results: RankTrackingResult[]; products: Product[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">실측 결과</p>
          <h2>랭킹 추적 결과</h2>
        </div>
      </div>
      <DataGrid
        columns={[
          { key: "keyword", title: "키워드", width: 180, sticky: true },
          {
            key: "productId",
            title: "상품",
            width: 260,
            render: (row) => products.find((product) => product.id === row.productId)?.currentTitle ?? row.productId
          },
          { key: "trackedAt", title: "추적 시각", width: 180 },
          { key: "currentRank", title: "현재 순위", width: 120 },
          { key: "previousRank", title: "이전 순위", width: 120 },
          { key: "delta", title: "변화량", width: 100 },
          {
            key: "deltaStatus",
            title: "상태",
            width: 120,
            render: (row) => <StatusBadge value={row.deltaStatus} />
          },
          { key: "foundTitle", title: "발견 상품명", width: 280 }
        ]}
        rows={results}
      />
    </section>
  );
}
