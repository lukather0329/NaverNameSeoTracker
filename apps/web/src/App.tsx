import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type {
  ApiAccount,
  ApiAccountFormInput,
  AppSnapshot,
  Product,
  RankTrackingJob,
  RankTrackingResult,
  SeoExperiment
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
  onCreateAccount,
  onTestAccount,
  onToggleAccount
}: {
  accounts: ApiAccount[];
  onCreateAccount: (input: ApiAccountFormInput) => Promise<void>;
  onTestAccount: (accountId: string) => Promise<{ ok: boolean; message: string; mode?: string; statusCode?: number; details?: string }>;
  onToggleAccount: (account: ApiAccount) => Promise<void>;
}) {
  const [form, setForm] = useState<ApiAccountFormInput>(defaultApiAccountForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      await onCreateAccount(form);
      setForm(defaultApiAccountForm);
      setFeedback("API 계정을 저장했습니다.");
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
          <p className="eyebrow">연결 상태</p>
          <h2>네이버 API 계정</h2>
          <p className="helper-copy">SEARCH_AD runs a live external API test. COMMERCE and CUSTOM currently run validation-only checks.</p>
        </div>
      </div>
      <form className="account-form" onSubmit={handleSubmit}>
        <label>
          <span>계정명</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>유형</span>
          <select
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as ApiAccountFormInput["type"] })}
          >
            <option value="COMMERCE">네이버 커머스API</option>
            <option value="SEARCH_AD">네이버 검색광고API</option>
            <option value="CUSTOM">기타 확장용</option>
          </select>
        </label>
        <label>
          <span>Client ID</span>
          <input
            value={form.clientId}
            onChange={(event) => setForm({ ...form, clientId: event.target.value })}
            required
          />
        </label>
        <label>
          <span>Client Secret</span>
          <input
            value={form.clientSecret}
            onChange={(event) => setForm({ ...form, clientSecret: event.target.value })}
            required
          />
        </label>
        <label>
          <span>Access License</span>
          <input
            value={form.accessLicense ?? ""}
            onChange={(event) => setForm({ ...form, accessLicense: event.target.value })}
          />
        </label>
        <label>
          <span>Secret Key</span>
          <input
            value={form.secretKey ?? ""}
            onChange={(event) => setForm({ ...form, secretKey: event.target.value })}
          />
        </label>
        <label>
          <span>Customer ID</span>
          <input
            value={form.customerId ?? ""}
            onChange={(event) => setForm({ ...form, customerId: event.target.value })}
          />
        </label>
        <label>
          <span>Store ID</span>
          <input value={form.storeId ?? ""} onChange={(event) => setForm({ ...form, storeId: event.target.value })} />
        </label>
        <label>
          <span>Channel ID</span>
          <input
            value={form.channelId ?? ""}
            onChange={(event) => setForm({ ...form, channelId: event.target.value })}
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
          />
          <span>사용 여부</span>
        </label>
        <button type="submit" className="action-button" disabled={submitting}>
          {submitting ? "저장 중..." : "계정 등록"}
        </button>
      </form>
      {feedback && <div className="feedback-banner">{feedback}</div>}
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
          },
          {
            key: "isActive",
            title: "사용",
            width: 100,
            render: (row) => <StatusBadge value={row.isActive ? "CONNECTED" : "PAUSED"} />
          },
          {
            key: "actions",
            title: "작업",
            width: 240,
            render: (row) => (
              <div className="inline-actions">
                <button type="button" className="action-button secondary" onClick={() => void handleTest(row.id)}>
                  연결 테스트
                </button>
                <button type="button" className="action-button secondary" onClick={() => void onToggleAccount(row)}>
                  {row.isActive ? "비활성화" : "활성화"}
                </button>
              </div>
            )
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
  const summaryCards = buildReportSummary(snapshot, experimentRows);

  return (
    <section className="dashboard report-layout">
      <div className="panel report-hero">
        <div>
          <p className="eyebrow">주간/월간 공유용</p>
          <h2>리포트 요약과 내보내기</h2>
          <p>
            실험 성과를 한 번에 요약하고, 운영 회의나 외부 공유용 CSV를 바로 내려받을 수 있도록 구성했습니다.
          </p>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="action-button"
            onClick={() => downloadCsv("experiment-report.csv", buildExperimentCsv(experimentRows))}
          >
            실험 리포트 CSV
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => downloadCsv("rank-results.csv", buildResultsCsv(snapshot.results, snapshot.products))}
          >
            랭킹 결과 CSV
          </button>
        </div>
      </div>
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
            <p className="eyebrow">성과 요약</p>
            <h2>실험별 리포트</h2>
          </div>
        </div>
        <DataGrid
          columns={[
            { key: "name", title: "실험명", width: 220, sticky: true },
            { key: "productTitle", title: "상품", width: 260 },
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
            { key: "trackingInterval", title: "주기", width: 120 },
            { key: "keywordCount", title: "키워드 수", width: 110 },
            { key: "latestRank", title: "최신 순위", width: 110 },
            { key: "avgDelta", title: "평균 변화량", width: 120 },
            { key: "upRate", title: "상승 비율", width: 120 },
            { key: "trackedAt", title: "마지막 추적", width: 180 }
          ]}
          rows={experimentRows}
        />
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
      trackedAt: latest ? formatDateTime(latest.trackedAt) : "-"
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
