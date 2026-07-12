import { useEffect, useState } from "react";
import type {
  ApiAccount,
  AppSnapshot,
  Product,
  RankTrackingJob,
  RankTrackingResult,
  SeoTitleCandidate,
  SeoTitleCandidateFormInput,
  SeoExperiment
} from "@naver-seo-tracker/shared";
import { DataGrid } from "./components/DataGrid";
import { SparklineBars } from "./components/SparklineBars";
import { StatusBadge } from "./components/StatusBadge";
import { applySeoTitle, createSeoTitleCandidate, fetchSnapshot, rollbackSeoTitle, runTrackingJob } from "./lib/api";

type ViewKey = "dashboard" | "accounts" | "products" | "seo" | "experiments" | "tracking" | "results";

const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: "dashboard", label: "대시보드" },
  { key: "accounts", label: "API 계정" },
  { key: "products", label: "상품 목록" },
  { key: "seo", label: "SEO 적용" },
  { key: "experiments", label: "실험 관리" },
  { key: "tracking", label: "추적 작업" },
  { key: "results", label: "랭킹 결과" }
];

const defaultSeoCandidateForm: SeoTitleCandidateFormInput = {
  productId: "",
  source: "MANUAL",
  title: "",
  notes: ""
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

  async function handleCreateSeoCandidate(input: SeoTitleCandidateFormInput) {
    await createSeoTitleCandidate(input);
    await loadSnapshot();
  }

  async function handleApplySeoTitle(productId: string, candidate: SeoTitleCandidate, mode: "VALIDATION" | "LIVE") {
    await applySeoTitle(productId, {
      candidateId: candidate.id,
      afterTitle: candidate.title,
      mode,
      reason: mode === "LIVE" ? "Manual live apply from SEO screen" : "Validation mode preview"
    });
    await loadSnapshot();
  }

  async function handleRollbackSeoTitle(productId: string) {
    await rollbackSeoTitle(productId);
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
            {view === "seo" && (
              <SeoTitleApplyView
                products={snapshot.products}
                candidates={snapshot.seoTitleCandidates}
                logs={snapshot.titleChangeLogs}
                onCreateCandidate={handleCreateSeoCandidate}
                onApplyTitle={handleApplySeoTitle}
                onRollbackTitle={handleRollbackSeoTitle}
              />
            )}
            {view === "experiments" && <ExperimentsView experiments={snapshot.experiments} />}
            {view === "tracking" && <TrackingJobsView jobs={snapshot.jobs} onRunJob={handleRunJob} />}
            {view === "results" && <ResultsView results={snapshot.results} />}
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

function SeoTitleApplyView({
  products,
  candidates,
  logs,
  onCreateCandidate,
  onApplyTitle,
  onRollbackTitle
}: {
  products: Product[];
  candidates: SeoTitleCandidate[];
  logs: AppSnapshot["titleChangeLogs"];
  onCreateCandidate: (input: SeoTitleCandidateFormInput) => Promise<void>;
  onApplyTitle: (productId: string, candidate: SeoTitleCandidate, mode: "VALIDATION" | "LIVE") => Promise<void>;
  onRollbackTitle: (productId: string) => Promise<void>;
}) {
  const [form, setForm] = useState<SeoTitleCandidateFormInput>(defaultSeoCandidateForm);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await onCreateCandidate(form);
      setForm(defaultSeoCandidateForm);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SEO Workflow</p>
          <h2>SEO 상품명 적용</h2>
        </div>
      </div>
      <form className="entity-form" onSubmit={handleSubmit}>
        <label>
          <span>상품</span>
          <select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} required>
            <option value="">상품 선택</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.smartStoreProductId} | {product.currentTitle}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>후보 출처</span>
          <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as SeoTitleCandidateFormInput["source"] })}>
            <option value="MANUAL">수동 입력</option>
            <option value="CSV">CSV</option>
            <option value="MVP_ADAPTER">MVP 연동</option>
          </select>
        </label>
        <label className="wide-field">
          <span>SEO 후보 상품명</span>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        </label>
        <label className="wide-field">
          <span>메모</span>
          <input value={form.notes ?? ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        <button type="submit" className="action-button" disabled={submitting}>
          {submitting ? "저장 중..." : "후보 등록"}
        </button>
      </form>
      <DataGrid
        columns={[
          {
            key: "productId",
            title: "대상 상품",
            width: 240,
            sticky: true,
            render: (row) => {
              const product = products.find((item) => item.id === row.productId);
              return product ? `${product.smartStoreProductId} | ${product.currentTitle}` : row.productId;
            }
          },
          { key: "source", title: "출처", width: 120 },
          { key: "title", title: "SEO 후보 상품명", width: 340 },
          { key: "notes", title: "메모", width: 200 },
          {
            key: "actions",
            title: "적용",
            width: 300,
            render: (row) => (
              <div className="inline-actions">
                <button type="button" className="action-button secondary" onClick={() => void onApplyTitle(row.productId, row, "VALIDATION")}>
                  검증 모드
                </button>
                <button type="button" className="action-button secondary" onClick={() => void onApplyTitle(row.productId, row, "LIVE")}>
                  실제 적용
                </button>
                <button type="button" className="action-button secondary" onClick={() => void onRollbackTitle(row.productId)}>
                  롤백
                </button>
              </div>
            )
          }
        ]}
        rows={candidates}
      />
      <DataGrid
        columns={[
          { key: "productId", title: "상품 ID", width: 180, sticky: true },
          { key: "beforeTitle", title: "변경 전", width: 280 },
          { key: "afterTitle", title: "변경 후", width: 320 },
          {
            key: "mode",
            title: "모드",
            width: 120,
            render: (row) => <StatusBadge value={row.mode} />
          },
          {
            key: "result",
            title: "결과",
            width: 140,
            render: (row) => <StatusBadge value={row.result} />
          },
          { key: "reason", title: "사유", width: 220 }
        ]}
        rows={logs}
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
  onRunJob
}: {
  jobs: RankTrackingJob[];
  onRunJob: (jobId: string) => Promise<void>;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">스케줄러</p>
          <h2>랭킹 추적 Job</h2>
        </div>
      </div>
      <DataGrid
        columns={[
          { key: "keyword", title: "키워드", width: 180, sticky: true },
          { key: "provider", title: "Provider", width: 140 },
          { key: "interval", title: "주기", width: 120 },
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
            width: 120,
            render: (row) => (
              <button type="button" className="action-button" onClick={() => void onRunJob(row.id)}>
                즉시 추적
              </button>
            )
          }
        ]}
        rows={jobs}
      />
    </section>
  );
}

function ResultsView({ results }: { results: RankTrackingResult[] }) {
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
