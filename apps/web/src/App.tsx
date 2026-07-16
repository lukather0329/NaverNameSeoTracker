import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type {
  ApiAccount,
  ApiAccountFormInput,
  AppSnapshot,
  Product,
  RankTrackingJob,
  RankTrackingResult,
  SeoExperiment,
  SystemLogEntry
} from "@naver-seo-tracker/shared";
import { DataGrid } from "./components/DataGrid";
import { SparklineBars } from "./components/SparklineBars";
import { StatusBadge } from "./components/StatusBadge";
import {
  createApiAccount,
  fetchSnapshot,
  runTrackingJob,
  testApiAccountConnection,
  updateApiAccount
} from "./lib/api";

type ViewKey = "dashboard" | "accounts" | "products" | "experiments" | "tracking" | "results" | "reports";

type AccountTestLogViewRow = SystemLogEntry & {
  detailSummary: string;
};
type AccountReadinessSummary = {
  label: string;
  value: number;
  caption: string;
};
type AccountReadinessState = "LIVE_READY" | "VALIDATION_READY" | "INCOMPLETE";
type ExperimentReportRow = {
  id: string;
  name: string;
  productTitle: string;
  status: string;
  judgement: string;
  trackingInterval: string;
  keywordCount: number;
  latestRank: string;
  avgDelta: string;
  upRate: string;
  trackedAt: string;
  trackedAtValue?: string;
};

const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: "dashboard", label: "대시보드" },
  { key: "accounts", label: "API 계정" },
  { key: "products", label: "상품 목록" },
  { key: "experiments", label: "실험 관리" },
  { key: "tracking", label: "추적 작업" },
  { key: "results", label: "랭킹 결과" },
  { key: "reports", label: "리포트" }
];

const defaultApiAccountForm: ApiAccountFormInput = {
  name: "",
  type: "COMMERCE",
  clientId: "",
  clientSecret: "",
  accessLicense: "",
  secretKey: "",
  customerId: "",
  storeId: "",
  channelId: "",
  isActive: true
};
const accountTypeGuides: Record<
  ApiAccountFormInput["type"],
  { modeLabel: string; requiredFields: string[]; note: string }
> = {
  SEARCH_AD: {
    modeLabel: "Live external test",
    requiredFields: ["Client ID", "Client Secret", "Access License", "Secret Key", "Customer ID"],
    note: "Uses the Naver SearchAd live connection test endpoint."
  },
  COMMERCE: {
    modeLabel: "Validation only",
    requiredFields: ["Client ID", "Client Secret", "Access License", "Secret Key", "Store ID or Channel ID"],
    note: "Commerce live adapter is the next follow-up task."
  },
  CUSTOM: {
    modeLabel: "Validation only",
    requiredFields: ["Client ID", "Client Secret"],
    note: "Reserved for future adapters or internal integrations."
  }
};
const accountSaveTimingGuides: Record<
  ApiAccountFormInput["type"],
  { recommendedMoment: string; steps: string[] }
> = {
  SEARCH_AD: {
    recommendedMoment: "Save it right before your first live connection test.",
    steps: [
      "Prepare the real Client ID, Client Secret, Access License, Secret Key, and Customer ID.",
      "Save the account once the values are confirmed and ready for immediate testing.",
      "Run Test Connection right away so you can verify the credentials while the context is fresh."
    ]
  },
  COMMERCE: {
    recommendedMoment: "Save it after credential collection, before the future live adapter rollout.",
    steps: [
      "Collect the base credentials plus Access License, Secret Key, and Store ID or Channel ID.",
      "Save the account now if you want the team to review and manage it in one place.",
      "Plan the real external test later, because COMMERCE currently runs validation-only checks."
    ]
  },
  CUSTOM: {
    recommendedMoment: "Save it when the basic credentials are ready for internal review.",
    steps: [
      "Prepare Client ID and Client Secret first.",
      "Save the account when the team needs a shared record of the integration target.",
      "Add the live adapter later if this account type gets a real external connection flow."
    ]
  }
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

  async function handleCreateApiAccount(input: ApiAccountFormInput) {
    await createApiAccount(input);
    await loadSnapshot();
  }

  async function handleTestApiAccount(accountId: string) {
    const result = await testApiAccountConnection(accountId);
    await loadSnapshot();
    return result;
  }

  async function handleToggleApiAccount(account: ApiAccount) {
    await updateApiAccount(account.id, {
      isActive: !account.isActive
    });
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
            {view === "accounts" && (
              <ApiAccountsView
                accounts={snapshot.apiAccounts}
                systemLogs={snapshot.systemLogs ?? []}
                onCreateAccount={handleCreateApiAccount}
                onTestAccount={handleTestApiAccount}
                onToggleAccount={handleToggleApiAccount}
              />
            )}
            {view === "products" && <ProductsView products={snapshot.products} />}
            {view === "experiments" && <ExperimentsView experiments={snapshot.experiments} />}
            {view === "tracking" && <TrackingJobsView jobs={snapshot.jobs} onRunJob={handleRunJob} />}
            {view === "results" && <ResultsView results={snapshot.results} products={snapshot.products} />}
            {view === "reports" && <ReportsView snapshot={snapshot} />}
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
          <article key={card.label} className="metric-card panel tone-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function ApiAccountsView({
  accounts,
  systemLogs,
  onCreateAccount,
  onTestAccount,
  onToggleAccount
}: {
  accounts: ApiAccount[];
  systemLogs: SystemLogEntry[];
  onCreateAccount: (input: ApiAccountFormInput) => Promise<void>;
  onTestAccount: (accountId: string) => Promise<{ ok: boolean; message: string; mode?: string; statusCode?: number; details?: string }>;
  onToggleAccount: (account: ApiAccount) => Promise<void>;
}) {
  const [form, setForm] = useState<ApiAccountFormInput>(defaultApiAccountForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const accountGuide = accountTypeGuides[form.type];
  const saveTimingGuide = accountSaveTimingGuides[form.type];
  const recentAccountTestLogs: AccountTestLogViewRow[] = (systemLogs ?? [])
    .filter((row) => row.scope === "api-account-test")
    .slice(0, 8)
    .map((row) => ({
      ...row,
      detailSummary: formatApiAccountTestMeta(row.metaJson)
    }));
  const readinessSummary = buildAccountReadinessSummary(accounts, recentAccountTestLogs.length);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      await onCreateAccount(form);
      setForm(defaultApiAccountForm);
      setFeedback("API account saved.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest(accountId: string) {
    const result = await onTestAccount(accountId);
    const suffix = [result.mode ? `mode=${result.mode}` : "", result.statusCode ? `status=${result.statusCode}` : "", result.details ?? ""]
      .filter(Boolean)
      .join(" | ");
    setFeedback(suffix ? `${result.message} (${suffix})` : result.message);
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Connection Status</p>
          <h2>Naver API Accounts</h2>
          <p className="helper-copy">SEARCH_AD runs a live external API test. COMMERCE and CUSTOM currently run validation-only checks.</p>
          <div className="type-guide-card">
            <strong>{accountGuide.modeLabel}</strong>
            <p>{accountGuide.note}</p>
            <div className="guide-chip-row">
              {accountGuide.requiredFields.map((field: string) => (
                <span key={field} className="guide-chip">
                  {field}
                </span>
              ))}
            </div>
          </div>
          <div className="save-timing-card">
            <strong>When should I save the API info?</strong>
            <p>{saveTimingGuide.recommendedMoment}</p>
            <ol className="guide-step-list">
              {saveTimingGuide.steps.map((step: string) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <div className="card-grid account-summary-grid">
            {readinessSummary.map((item) => (
              <article key={item.label} className="metric-card panel tone-card compact-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.caption}</small>
              </article>
            ))}
          </div>
        </div>
      </div>
      <form className="account-form" onSubmit={handleSubmit}>
        <label>
          <span>Account Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>Type</span>
          <select
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as ApiAccountFormInput["type"] })}
          >
            <option value="COMMERCE">Naver Commerce API</option>
            <option value="SEARCH_AD">Naver SearchAd API</option>
            <option value="CUSTOM">Custom / Future Adapter</option>
          </select>
        </label>
        <label>
          <span>Client ID</span>
          <input value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} required />
        </label>
        <label>
          <span>Client Secret</span>
          <input value={form.clientSecret} onChange={(event) => setForm({ ...form, clientSecret: event.target.value })} required />
        </label>
        <label>
          <span>Access License</span>
          <input value={form.accessLicense ?? ""} onChange={(event) => setForm({ ...form, accessLicense: event.target.value })} />
        </label>
        <label>
          <span>Secret Key</span>
          <input value={form.secretKey ?? ""} onChange={(event) => setForm({ ...form, secretKey: event.target.value })} />
        </label>
        <label>
          <span>Customer ID</span>
          <input value={form.customerId ?? ""} onChange={(event) => setForm({ ...form, customerId: event.target.value })} />
        </label>
        <label>
          <span>Store ID</span>
          <input value={form.storeId ?? ""} onChange={(event) => setForm({ ...form, storeId: event.target.value })} />
        </label>
        <label>
          <span>Channel ID</span>
          <input value={form.channelId ?? ""} onChange={(event) => setForm({ ...form, channelId: event.target.value })} />
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
          <span>Active</span>
        </label>
        <button type="submit" className="action-button" disabled={submitting}>
          {submitting ? "Saving..." : "Save Account"}
        </button>
      </form>
      {feedback && <div className="feedback-banner">{feedback}</div>}
      <DataGrid
        columns={[
          { key: "name", title: "Account", width: 180, sticky: true },
          { key: "type", title: "Type", width: 120 },
          { key: "clientIdMasked", title: "Client ID", width: 160 },
          { key: "clientSecretMasked", title: "Client Secret", width: 180 },
          { key: "storeId", title: "Store ID", width: 140 },
          { key: "channelId", title: "Channel ID", width: 140 },
          {
            key: "readiness",
            title: "Readiness",
            width: 150,
            render: (row) => <StatusBadge value={getAccountReadinessState(row)} />
          },
          {
            key: "readinessHint",
            title: "Test Mode",
            width: 220,
            render: (row) => getAccountReadinessHint(row)
          },
          {
            key: "lastTestSummary",
            title: "Latest Test",
            width: 260,
            render: (row) => row.lastTestSummary ?? "-"
          },
          {
            key: "connectionStatus",
            title: "Status",
            width: 120,
            render: (row) => <StatusBadge value={row.connectionStatus} />
          },
          {
            key: "isActive",
            title: "Active",
            width: 100,
            render: (row) => <StatusBadge value={row.isActive ? "CONNECTED" : "PAUSED"} />
          },
          {
            key: "actions",
            title: "Actions",
            width: 240,
            render: (row) => (
              <div className="inline-actions">
                <button type="button" className="action-button secondary" onClick={() => void handleTest(row.id)}>
                  Test Connection
                </button>
                <button type="button" className="action-button secondary" onClick={() => void onToggleAccount(row)}>
                  {row.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            )
          }
        ]}
        rows={accounts}
      />
      <div className="log-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Test History</p>
            <h3>Recent API Account Test Logs</h3>
          </div>
        </div>
        {recentAccountTestLogs.length === 0 ? (
          <div className="empty-state-card">
            <strong>No account test logs yet.</strong>
            <p>Run a connection test to populate the latest API account history.</p>
          </div>
        ) : (
          <DataGrid
            columns={[
              {
                key: "createdAt",
                title: "Time",
                width: 180,
                sticky: true,
                render: (row) => formatDateTime(row.createdAt)
              },
              { key: "level", title: "Level", width: 100, render: (row) => <StatusBadge value={row.level} /> },
              { key: "message", title: "Message", width: 420 },
              {
                key: "detailSummary",
                title: "Details",
                width: 360,
                render: (row) => row.detailSummary
              }
            ]}
            rows={recentAccountTestLogs}
          />
        )}
      </div>
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

function ReportsView({ snapshot }: { snapshot: AppSnapshot }) {
  const experimentRows = buildExperimentReportRows(snapshot.experiments, snapshot.products, snapshot.results);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [judgementFilter, setJudgementFilter] = useState<string>("ALL");
  const [windowFilter, setWindowFilter] = useState<string>("ALL");

  const filteredRows = experimentRows.filter((row) => {
    const statusMatch = statusFilter === "ALL" || row.status === statusFilter;
    const judgementMatch = judgementFilter === "ALL" || row.judgement === judgementFilter;
    const windowMatch = matchesTrackedWindow(row.trackedAtValue, windowFilter);
    return statusMatch && judgementMatch && windowMatch;
  });
  const filteredExperimentIds = new Set(filteredRows.map((row) => row.id));
  const filteredResults = snapshot.results.filter((row) => filteredExperimentIds.has(row.experimentId));
  const summaryCards = buildReportSummary(snapshot, filteredRows);

  function resetFilters() {
    setStatusFilter("ALL");
    setJudgementFilter("ALL");
    setWindowFilter("ALL");
  }

  return (
    <section className="dashboard report-layout">
      <div className="panel report-hero">
        <div>
          <p className="eyebrow">Weekly / Monthly Share</p>
          <h2>Report Summary and Export</h2>
          <p>
            Summarize experiment performance in one place and export filtered report rows for team reviews,
            handoff notes, or weekly reporting.
          </p>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="action-button"
            onClick={() => downloadCsv("experiment-report.csv", buildExperimentCsv(filteredRows))}
          >
            Experiment CSV
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => downloadCsv("rank-results.csv", buildResultsCsv(filteredResults, snapshot.products))}
          >
            Rank Result CSV
          </button>
        </div>
      </div>
      <section className="panel report-filter-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Report Filters</p>
            <h3>Filter Report Rows</h3>
          </div>
          <div className="inline-actions">
            <span className="filter-summary">{filteredRows.length} experiments</span>
            <button type="button" className="action-button secondary" onClick={resetFilters}>
              Reset Filters
            </button>
          </div>
        </div>
        <div className="report-filters">
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All</option>
              <option value="DRAFT">DRAFT</option>
              <option value="RUNNING">RUNNING</option>
              <option value="PAUSED">PAUSED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </label>
          <label>
            <span>Judgement</span>
            <select value={judgementFilter} onChange={(event) => setJudgementFilter(event.target.value)}>
              <option value="ALL">All</option>
              <option value="EFFECTIVE">EFFECTIVE</option>
              <option value="LOW_EFFECT">LOW_EFFECT</option>
              <option value="PENDING">PENDING</option>
              <option value="WORSE">WORSE</option>
            </select>
          </label>
          <label>
            <span>Tracked Window</span>
            <select value={windowFilter} onChange={(event) => setWindowFilter(event.target.value)}>
              <option value="ALL">All</option>
              <option value="7D">Last 7 days</option>
              <option value="30D">Last 30 days</option>
              <option value="90D">Last 90 days</option>
            </select>
          </label>
        </div>
      </section>
      <div className="card-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className="metric-card panel tone-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.caption}</small>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Performance Overview</p>
            <h2>Experiment Report Table</h2>
          </div>
        </div>
        {filteredRows.length === 0 ? (
          <div className="empty-state-card">
            <strong>No report rows match the current filters.</strong>
            <p>Reset the filters or widen the tracked window to bring rows back into view.</p>
          </div>
        ) : (
          <DataGrid
            columns={[
              { key: "name", title: "Experiment", width: 220, sticky: true },
              { key: "productTitle", title: "Product", width: 260 },
              {
                key: "status",
                title: "Status",
                width: 120,
                render: (row) => <StatusBadge value={row.status} />
              },
              {
                key: "judgement",
                title: "Judgement",
                width: 120,
                render: (row) => <StatusBadge value={row.judgement} />
              },
              { key: "trackingInterval", title: "Interval", width: 120 },
              { key: "keywordCount", title: "Keywords", width: 110 },
              { key: "latestRank", title: "Latest Rank", width: 110 },
              { key: "avgDelta", title: "Avg Delta", width: 120 },
              { key: "upRate", title: "Up Rate", width: 120 },
              { key: "trackedAt", title: "Last Tracked", width: 180 }
            ]}
            rows={filteredRows}
          />
        )}
      </section>
    </section>
  );
}
function buildExperimentReportRows(
  experiments: SeoExperiment[],
  products: Product[],
  results: RankTrackingResult[]
): ExperimentReportRow[] {
  return experiments.map((experiment) => {
    const product = products.find((item) => item.id === experiment.productId);
    const rows = results.filter((result) => result.experimentId === experiment.id);
    const latest = rows
      .slice()
      .sort((left, right) => new Date(right.trackedAt).getTime() - new Date(left.trackedAt).getTime())[0];
    const deltaValues = rows
      .map((row) => row.delta)
      .filter((value): value is number => typeof value === "number");
    const upCount = rows.filter((row) => row.deltaStatus === "UP").length;
    const keywordCount = new Set(rows.map((row) => row.keyword)).size;
    const avgDelta =
      deltaValues.length > 0
        ? (deltaValues.reduce((sum, value) => sum + value, 0) / deltaValues.length).toFixed(1)
        : "-";
    const upRate = rows.length > 0 ? `${Math.round((upCount / rows.length) * 100)}%` : "-";

    return {
      id: experiment.id,
      name: experiment.name,
      productTitle: product?.currentTitle ?? experiment.productId,
      status: experiment.status,
      judgement: experiment.judgement,
      trackingInterval: experiment.trackingInterval,
      keywordCount,
      latestRank: latest?.currentRank?.toString() ?? "-",
      avgDelta,
      upRate,
      trackedAt: latest ? formatDateTime(latest.trackedAt) : "-",
      trackedAtValue: latest?.trackedAt
    };
  });
}

function buildReportSummary(snapshot: AppSnapshot, experimentRows: ExperimentReportRow[]) {
  const completedCount = snapshot.experiments.filter((item) => item.status === "COMPLETED").length;
  const effectiveCount = snapshot.experiments.filter((item) => item.judgement === "EFFECTIVE").length;
  const activeJobs = snapshot.jobs.filter((item) => item.isEnabled).length;
  const trackedKeywords = new Set(snapshot.results.map((item) => item.keyword)).size;
  const latestTrackedAt = snapshot.results[0]?.trackedAt;

  return [
    {
      label: "총 실험 수",
      value: snapshot.experiments.length,
      caption: `완료 ${completedCount}건`
    },
    {
      label: "유효 실험",
      value: effectiveCount,
      caption: `${snapshot.experiments.length > 0 ? Math.round((effectiveCount / snapshot.experiments.length) * 100) : 0}% 비중`
    },
    {
      label: "활성 Job",
      value: activeJobs,
      caption: `${snapshot.jobs.length}개 중 활성`
    },
    {
      label: "추적 키워드",
      value: trackedKeywords,
      caption: latestTrackedAt ? `최근 ${formatDateTime(latestTrackedAt)}` : "추적 데이터 없음"
    },
    {
      label: "평균 변화량",
      value: snapshot.dashboard.avgRankDelta,
      caption: `${experimentRows.filter((row) => row.avgDelta !== "-").length}개 실험 반영`
    }
  ];
}

function matchesTrackedWindow(trackedAtValue: string | undefined, windowFilter: string) {
  if (windowFilter === "ALL" || !trackedAtValue) {
    return true;
  }
  const trackedAt = new Date(trackedAtValue).getTime();
  if (Number.isNaN(trackedAt)) {
    return false;
  }
  const now = Date.now();
  const thresholds: Record<string, number> = {
    "7D": 7,
    "30D": 30,
    "90D": 90
  };
  const days = thresholds[windowFilter];
  if (!days) {
    return true;
  }
  return now - trackedAt <= days * 24 * 60 * 60 * 1000;
}

function buildExperimentCsv(rows: ExperimentReportRow[]) {
  const headers = ["실험명", "상품", "상태", "판단", "주기", "키워드 수", "최신 순위", "평균 변화량", "상승 비율", "마지막 추적"];
  const lines = rows.map((row) => [
    row.name,
    row.productTitle,
    row.status,
    row.judgement,
    row.trackingInterval,
    row.keywordCount,
    row.latestRank,
    row.avgDelta,
    row.upRate,
    row.trackedAt
  ]);

  return [headers, ...lines].map((line) => line.map(escapeCsvCell).join(",")).join("\n");
}

function buildResultsCsv(results: RankTrackingResult[], products: Product[]) {
  const headers = ["키워드", "상품", "추적 시각", "현재 순위", "이전 순위", "변화량", "상태", "발견 상품명"];
  const lines = results.map((row) => [
    row.keyword,
    products.find((product) => product.id === row.productId)?.currentTitle ?? row.productId,
    formatDateTime(row.trackedAt),
    row.currentRank ?? "",
    row.previousRank ?? "",
    row.delta ?? "",
    row.deltaStatus,
    row.foundTitle ?? ""
  ]);

  return [headers, ...lines].map((line) => line.map(escapeCsvCell).join(",")).join("\n");
}

function escapeCsvCell(value: string | number) {
  const normalized = String(value).replaceAll('"', '""');
  return `"${normalized}"`;
}

function downloadCsv(fileName: string, csvText: string) {
  const blob = new Blob([`\uFEFF${csvText}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getAccountReadinessState(account: ApiAccount): AccountReadinessState {
  if (isLiveReadySearchAdAccount(account)) {
    return "LIVE_READY";
  }

  if (isValidationReadyAccount(account)) {
    return "VALIDATION_READY";
  }

  return "INCOMPLETE";
}

function getAccountReadinessHint(account: ApiAccount) {
  if (account.type === "SEARCH_AD") {
    return isLiveReadySearchAdAccount(account) ? "Real external test available" : "Missing fields for live SearchAd test";
  }

  if (account.type === "COMMERCE") {
    return isValidationReadyAccount(account) ? "Validation-only check available" : "Add commerce credential fields";
  }

  return isValidationReadyAccount(account) ? "Basic validation available" : "Client ID and Secret required";
}

function buildAccountReadinessSummary(accounts: ApiAccount[], recentLogCount: number): AccountReadinessSummary[] {
  const liveReadyCount = accounts.filter(isLiveReadySearchAdAccount).length;
  const validationReadyCount = accounts.filter(isValidationReadyAccount).length;
  const activeCount = accounts.filter((account) => account.isActive).length;

  return [
    {
      label: "Saved Accounts",
      value: accounts.length,
      caption: `${activeCount} active`
    },
    {
      label: "Live Ready",
      value: liveReadyCount,
      caption: "SEARCH_AD credentials complete"
    },
    {
      label: "Validation Ready",
      value: validationReadyCount,
      caption: "Ready for non-live checks"
    },
    {
      label: "Recent Tests",
      value: recentLogCount,
      caption: "Latest connection log rows"
    }
  ];
}

function isLiveReadySearchAdAccount(account: ApiAccount) {
  if (account.type !== "SEARCH_AD") {
    return false;
  }

  return Boolean(account.accessLicenseMasked && account.secretKeyMasked && account.customerId);
}

function isValidationReadyAccount(account: ApiAccount) {
  if (account.type === "SEARCH_AD") {
    return isLiveReadySearchAdAccount(account);
  }

  if (account.type === "COMMERCE") {
    return Boolean(account.accessLicenseMasked && account.secretKeyMasked && (account.storeId || account.channelId));
  }

  return Boolean(account.clientIdMasked && account.clientSecretMasked);
}

function formatApiAccountTestMeta(metaJson?: string | null) {
  if (!metaJson) {
    return "-";
  }

  try {
    const parsed = JSON.parse(metaJson) as {
      accountType?: string | null;
      mode?: string | null;
      statusCode?: number | null;
      details?: string | null;
    };

    const parts = [
      parsed.accountType ? `type=${parsed.accountType}` : "",
      parsed.mode ? `mode=${parsed.mode}` : "",
      typeof parsed.statusCode === "number" ? `status=${parsed.statusCode}` : "",
      parsed.details ? String(parsed.details).slice(0, 120) : ""
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" | ") : metaJson;
  } catch {
    return metaJson;
  }
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
