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
  accountId: string | null;
  detailSummary: string;
  testMode: "REAL" | "VALIDATION";
  outcome: "SUCCESS" | "FAILED";
};
type AccountReadinessSummary = {
  label: string;
  value: number;
  caption: string;
};
type AccountLogFocusCard = {
  label: string;
  value: number;
  caption: string;
  toneClass: string;
  filterValue: Exclude<AccountLogFilterValue, "ALL">;
};
type AccountReadinessState = "LIVE_READY" | "VALIDATION_READY" | "INCOMPLETE";
type AccountFilterValue = "ALL" | AccountReadinessState;
type AccountLogFilterValue = "ALL" | "FAILED" | "SUCCESS" | "REAL" | "VALIDATION";
type FormReadinessPreview = {
  state: AccountReadinessState;
  title: string;
  caption: string;
  missingFields: string[];
};
type FormFieldState = "required" | "optional";
type NextActionGuide = {
  title: string;
  description: string;
};
type FeedbackTone = "success" | "warning" | "error" | "info";
type FeedbackState = {
  tone: FeedbackTone;
  message: string;
};
type FieldHint = {
  placeholder: string;
  helper: string;
};
type FieldHintMap = {
  name: FieldHint;
  clientId: FieldHint;
  clientSecret: FieldHint;
  accessLicense: FieldHint;
  secretKey: FieldHint;
  customerId: FieldHint;
  storeId: FieldHint;
  channelId: FieldHint;
};
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
type ReportManagementSummary = {
  headline: string;
  points: Array<{
    label: string;
    text: string;
  }>;
  footer: string;
};

type ReportFilterPreset = {
  name: string;
  searchQuery: string;
  statusFilter: string;
  judgementFilter: string;
  windowFilter: string;
  startDateFilter: string;
  endDateFilter: string;
  sortKey: "LATEST_TRACKED" | "BEST_RANK" | "BEST_DELTA" | "BEST_UP_RATE" | "NAME";
};

const REPORT_FILTER_PRESET_STORAGE_KEY = "naver-seo-report-filter-presets";

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
    modeLabel: "실제 외부 연동 테스트",
    requiredFields: ["클라이언트 ID", "클라이언트 시크릿", "액세스 라이선스", "시크릿 키", "고객 ID"],
    note: "네이버 검색광고 실제 연결 테스트 엔드포인트를 사용합니다."
  },
  COMMERCE: {
    modeLabel: "검증 전용",
    requiredFields: ["클라이언트 ID", "클라이언트 시크릿", "액세스 라이선스", "시크릿 키", "스토어 ID 또는 채널 ID"],
    note: "커머스 실연동 어댑터는 다음 후속 작업입니다."
  },
  CUSTOM: {
    modeLabel: "검증 전용",
    requiredFields: ["클라이언트 ID", "클라이언트 시크릿"],
    note: "향후 어댑터 또는 내부 연동용으로 남겨둔 유형입니다."
  }
};
const accountSaveTimingGuides: Record<
  ApiAccountFormInput["type"],
  { recommendedMoment: string; steps: string[] }
> = {
  SEARCH_AD: {
    recommendedMoment: "첫 실제 연결 테스트를 시작하기 직전에 저장하세요.",
    steps: [
      "실제 클라이언트 ID, 클라이언트 시크릿, 액세스 라이선스, 시크릿 키, 고객 ID를 준비합니다.",
      "값이 모두 확인되어 바로 테스트할 수 있을 때 계정을 저장합니다.",
      "바로 연결 테스트를 실행해 자격정보를 즉시 검증합니다."
    ]
  },
  COMMERCE: {
    recommendedMoment: "자격정보를 모은 뒤, 향후 실연동 어댑터 적용 전에 저장하세요.",
    steps: [
      "기본 자격정보와 함께 액세스 라이선스, 시크릿 키, 스토어 ID 또는 채널 ID를 준비합니다.",
      "팀이 한 곳에서 검토하고 관리해야 한다면 지금 저장하세요.",
      "COMMERCE는 현재 검증 전용이므로 실제 외부 테스트는 다음 단계로 계획하세요."
    ]
  },
  CUSTOM: {
    recommendedMoment: "기본 자격정보가 내부 검토 가능한 상태가 되면 저장하세요.",
    steps: [
      "먼저 클라이언트 ID와 클라이언트 시크릿을 준비합니다.",
      "팀이 연동 대상을 함께 관리해야 할 시점에 계정을 저장합니다.",
      "이 계정 유형에 실제 외부 연결 흐름이 생기면 이후 실연동 어댑터를 추가합니다."
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
          <p className="eyebrow">네이버쇼핑 SEO 운영 콘솔</p>
          <h1>네이버쇼핑 상품명 SEO 검증 추적기</h1>
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
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [accountFilter, setAccountFilter] = useState<AccountFilterValue>("ALL");
  const [activeOnly, setActiveOnly] = useState(false);
  const [logFilter, setLogFilter] = useState<AccountLogFilterValue>("ALL");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const accountGuide = accountTypeGuides[form.type];
  const saveTimingGuide = accountSaveTimingGuides[form.type];
  const recentAccountTestLogs: AccountTestLogViewRow[] = (systemLogs ?? [])
    .filter((row) => row.scope === "api-account-test")
    .slice(0, 8)
    .map((row) => {
      const meta = parseApiAccountTestMeta(row.metaJson);
      return {
        ...row,
        accountId: meta.accountId ?? null,
        detailSummary: formatParsedApiAccountTestMeta(meta, row.metaJson),
        testMode: meta.mode === "real" ? "REAL" : "VALIDATION",
        outcome: isApiAccountLogFailure(row.level) ? "FAILED" : "SUCCESS"
      };
    });
  const readinessSummary = buildAccountReadinessSummary(accounts, recentAccountTestLogs.length);
  const logFocusCards = buildAccountLogFocusCards(recentAccountTestLogs);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;
  const filteredLogRows = recentAccountTestLogs.filter((row) => {
    const logFilterMatch =
      logFilter === "ALL"
        ? true
        : logFilter === "FAILED" || logFilter === "SUCCESS"
          ? row.outcome === logFilter
          : row.testMode === logFilter;
    const selectedAccountMatch = !selectedAccountId || row.accountId === selectedAccountId;
    return logFilterMatch && selectedAccountMatch;
  });
  const linkedAccountIds = new Set(filteredLogRows.map((row) => row.accountId).filter((value): value is string => Boolean(value)));
  const shouldLinkAccountsToLogs = logFilter !== "ALL";
  const filteredAccounts = accounts.filter((account) => {
    const readiness = getAccountReadinessState(account);
    const readinessMatch = accountFilter === "ALL" || readiness === accountFilter;
    const activeMatch = !activeOnly || account.isActive;
    const logLinkedMatch = !shouldLinkAccountsToLogs || linkedAccountIds.has(account.id);
    return readinessMatch && activeMatch && logLinkedMatch;
  });
  const accountScopeSummary = shouldLinkAccountsToLogs
    ? `필터된 로그 ${filteredLogRows.length}건과 연결됨`
    : null;
  const logScopeSummary = selectedAccount ? `${selectedAccount.name} 계정 로그만 표시 중` : null;
  const formReadiness = buildFormReadinessPreview(form);
  const canSaveAccount = formReadiness.state !== "INCOMPLETE";
  const currentRequiredFields = getCurrentRequiredFields(form.type);
  const requiredFieldSet = new Set(currentRequiredFields);
  const nextActionGuide = buildNextActionGuide(accounts, formReadiness, form.type);
  const fieldHints = buildFieldHints(form.type);
  const accountFilterOptions: Array<{ value: AccountFilterValue; label: string }> = [
    { value: "ALL", label: `전체 (${accounts.length})` },
    { value: "LIVE_READY", label: `실테스트 가능 (${accounts.filter((account) => getAccountReadinessState(account) === "LIVE_READY").length})` },
    { value: "VALIDATION_READY", label: `검증 가능 (${accounts.filter((account) => getAccountReadinessState(account) === "VALIDATION_READY").length})` },
    { value: "INCOMPLETE", label: `미완료 (${accounts.filter((account) => getAccountReadinessState(account) === "INCOMPLETE").length})` }
  ];
  const logFilterOptions: Array<{ value: AccountLogFilterValue; label: string }> = [
    { value: "ALL", label: `전체 (${recentAccountTestLogs.length})` },
    { value: "FAILED", label: `실패 (${recentAccountTestLogs.filter((row) => row.outcome === "FAILED").length})` },
    { value: "SUCCESS", label: `성공 (${recentAccountTestLogs.filter((row) => row.outcome === "SUCCESS").length})` },
    { value: "REAL", label: `실연동 (${recentAccountTestLogs.filter((row) => row.testMode === "REAL").length})` },
    { value: "VALIDATION", label: `검증 (${recentAccountTestLogs.filter((row) => row.testMode === "VALIDATION").length})` }
  ];
  const needsAdvancedCredentials = form.type !== "CUSTOM";
  const needsCustomerId = form.type === "SEARCH_AD";
  const needsCommerceTargets = form.type === "COMMERCE";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!canSaveAccount) {
      setFeedback({
        tone: "warning",
        message: `필수 입력값을 먼저 채워주세요: ${formReadiness.missingFields.join(", ")}`
      });
      return;
    }

    setSubmitting(true);

    try {
      await onCreateAccount(form);
      setForm(defaultApiAccountForm);
      setFeedback({
        tone: "success",
        message: "API account saved."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest(accountId: string) {
    const result = await onTestAccount(accountId);
    const suffix = [result.mode ? `mode=${result.mode}` : "", result.statusCode ? `status=${result.statusCode}` : "", result.details ?? ""]
      .filter(Boolean)
      .join(" | ");
    const message = suffix ? `${result.message} (${suffix})` : result.message;
    const tone = result.ok ? (result.mode === "real" ? "success" : "info") : "error";
    setFeedback({ tone, message });
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">연결 상태</p>
          <h2>네이버 API 계정</h2>
          <p className="helper-copy">SEARCH_AD는 실제 외부 API 테스트를 수행하고, COMMERCE와 CUSTOM은 현재 검증 전용 점검만 지원합니다.</p>
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
            <strong>API 정보는 언제 저장하면 되나요?</strong>
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
          <div className="card-grid account-focus-grid">
            {logFocusCards.map((item) => {
              const isActive = logFilter === item.filterValue;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`metric-card panel compact-card focus-card ${item.toneClass}${isActive ? " active" : ""}`}
                  onClick={() => setLogFilter(isActive ? "ALL" : item.filterValue)}
                  title={isActive ? "전체 로그 보기" : `${item.label} 기준으로 로그 필터링`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.caption}</small>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="next-action-card">
        <p className="eyebrow">성과 개요</p>
        <strong>{nextActionGuide.title}</strong>
        <p>{nextActionGuide.description}</p>
      </div>
      <div className="form-checklist-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">입력 체크리스트</p>
            <h3>지금 필요한 항목</h3>
          </div>
        </div>
        <div className="guide-chip-row">
          {currentRequiredFields.map((field) => (
            <span key={field} className="guide-chip">
              {field}
            </span>
          ))}
        </div>
        {formReadiness.missingFields.length > 0 ? (
          <div className="guide-chip-row">
            {formReadiness.missingFields.map((field) => (
              <span key={field} className="guide-chip muted">
                누락: {field}
              </span>
            ))}
          </div>
        ) : (
          <p className="checklist-success">현재 흐름에서 필요한 항목이 모두 입력되었습니다.</p>
        )}
      </div>
      <form className="account-form" onSubmit={handleSubmit}>
        <label className={getFormFieldClassName(requiredFieldSet, "계정명")}>
          <span>{renderFieldLabel("계정명", requiredFieldSet)}</span>
          <input value={form.name} placeholder={fieldHints.name.placeholder} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <small className="field-helper">{fieldHints.name.helper}</small>
        </label>
        <label className="field-required">
          <span>유형 <em className="field-badge required">필수</em></span>
          <select
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as ApiAccountFormInput["type"] })}
          >
            <option value="COMMERCE">네이버 커머스 API</option>
            <option value="SEARCH_AD">네이버 검색광고 API</option>
            <option value="CUSTOM">커스텀 / 향후 어댑터</option>
          </select>
        </label>
        <label className={getFormFieldClassName(requiredFieldSet, "클라이언트 ID")}>
          <span>{renderFieldLabel("클라이언트 ID", requiredFieldSet)}</span>
          <input value={form.clientId} placeholder={fieldHints.clientId.placeholder} onChange={(event) => setForm({ ...form, clientId: event.target.value })} required />
          <small className="field-helper">{fieldHints.clientId.helper}</small>
        </label>
        <label className={getFormFieldClassName(requiredFieldSet, "클라이언트 시크릿")}>
          <span>{renderFieldLabel("클라이언트 시크릿", requiredFieldSet)}</span>
          <input value={form.clientSecret} placeholder={fieldHints.clientSecret.placeholder} onChange={(event) => setForm({ ...form, clientSecret: event.target.value })} required />
          <small className="field-helper">{fieldHints.clientSecret.helper}</small>
        </label>
        {needsAdvancedCredentials && (
          <>
            <label className={getFormFieldClassName(requiredFieldSet, "액세스 라이선스")}>
              <span>{renderFieldLabel("액세스 라이선스", requiredFieldSet)}</span>
              <input value={form.accessLicense ?? ""} placeholder={fieldHints.accessLicense.placeholder} onChange={(event) => setForm({ ...form, accessLicense: event.target.value })} />
              <small className="field-helper">{fieldHints.accessLicense.helper}</small>
            </label>
            <label className={getFormFieldClassName(requiredFieldSet, "시크릿 키")}>
              <span>{renderFieldLabel("시크릿 키", requiredFieldSet)}</span>
              <input value={form.secretKey ?? ""} placeholder={fieldHints.secretKey.placeholder} onChange={(event) => setForm({ ...form, secretKey: event.target.value })} />
              <small className="field-helper">{fieldHints.secretKey.helper}</small>
            </label>
          </>
        )}
        {needsCustomerId && (
          <label className={getFormFieldClassName(requiredFieldSet, "고객 ID")}>
            <span>{renderFieldLabel("고객 ID", requiredFieldSet)}</span>
            <input value={form.customerId ?? ""} placeholder={fieldHints.customerId.placeholder} onChange={(event) => setForm({ ...form, customerId: event.target.value })} />
            <small className="field-helper">{fieldHints.customerId.helper}</small>
          </label>
        )}
        {needsCommerceTargets && (
          <>
            <label className={getFormFieldClassName(requiredFieldSet, "스토어 ID 또는 채널 ID", "스토어 ID")}>
              <span>{renderFieldLabel("스토어 ID 또는 채널 ID", requiredFieldSet, "스토어 ID")}</span>
              <input value={form.storeId ?? ""} placeholder={fieldHints.storeId.placeholder} onChange={(event) => setForm({ ...form, storeId: event.target.value })} />
              <small className="field-helper">{fieldHints.storeId.helper}</small>
            </label>
            <label className={getFormFieldClassName(requiredFieldSet, "스토어 ID 또는 채널 ID", "채널 ID")}>
              <span>{renderFieldLabel("스토어 ID 또는 채널 ID", requiredFieldSet, "채널 ID")}</span>
              <input value={form.channelId ?? ""} placeholder={fieldHints.channelId.placeholder} onChange={(event) => setForm({ ...form, channelId: event.target.value })} />
              <small className="field-helper">{fieldHints.channelId.helper}</small>
            </label>
          </>
        )}
        <label className="checkbox-field field-optional">
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
          <span>활성화</span>
        </label>
        <button
          type="submit"
          className="action-button"
          disabled={submitting || !canSaveAccount}
          title={canSaveAccount ? "계정 저장" : formReadiness.missingFields.join(", ")}
        >
          {submitting ? "저장 중..." : canSaveAccount ? "계정 저장" : "필수 항목 입력 필요"}
        </button>
      </form>
      <div className="form-readiness-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">입력 미리보기</p>
            <h3>현재 테스트 준비 상태</h3>
          </div>
          <StatusBadge value={formReadiness.state} />
        </div>
        <p>{formReadiness.title}</p>
        <small>{formReadiness.caption}</small>
        {formReadiness.missingFields.length > 0 && (
          <div className="guide-chip-row">
            {formReadiness.missingFields.map((field) => (
              <span key={field} className="guide-chip muted">
                {field}
              </span>
            ))}
          </div>
        )}
      </div>
      {feedback && <div className={`feedback-banner ${feedback.tone}`}>{feedback.message}</div>}
      <div className="account-filter-bar">
        <div className="account-filter-chip-row">
          {accountFilterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === accountFilter ? "filter-chip active" : "filter-chip"}
              onClick={() => setAccountFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="filter-toggle">
          <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />
          <span>활성 계정만 보기</span>
        </label>
      </div>
      <div className="account-filter-summary">
        <strong>{filteredAccounts.length}</strong> / {accounts.length}개 계정 표시 중
        {accountScopeSummary && <span className="account-scope-note">{accountScopeSummary}</span>}
        {selectedAccount && (
          <button type="button" className="inline-link-button" onClick={() => setSelectedAccountId(null)}>
            선택 계정 해제
          </button>
        )}
      </div>
      <DataGrid
        columns={[
          { key: "name", title: "계정명", width: 180, sticky: true },
          { key: "type", title: "유형", width: 120 },
          { key: "clientIdMasked", title: "클라이언트 ID", width: 160 },
          { key: "clientSecretMasked", title: "클라이언트 시크릿", width: 180 },
          { key: "storeId", title: "스토어 ID", width: 140 },
          { key: "channelId", title: "채널 ID", width: 140 },
          {
            key: "readiness",
            title: "준비 상태",
            width: 150,
            render: (row) => <StatusBadge value={getAccountReadinessState(row)} />
          },
          {
            key: "readinessHint",
            title: "테스트 모드",
            width: 220,
            render: (row) => getAccountReadinessHint(row)
          },
          {
            key: "lastTestSummary",
            title: "최근 테스트",
            width: 260,
            render: (row) => row.lastTestSummary ?? "-"
          },
          {
            key: "connectionStatus",
            title: "상세",
            width: 120,
            render: (row) => <StatusBadge value={row.connectionStatus} />
          },
          {
            key: "isActive",
            title: "상세",
            width: 100,
            render: (row) => <StatusBadge value={row.isActive ? "CONNECTED" : "PAUSED"} />
          },
          {
            key: "actions",
            title: "상세",
            width: 240,
            render: (row) => {
              const readiness = getAccountReadinessState(row);
              const canTest = readiness !== "INCOMPLETE";
              const testLabel = readiness === "LIVE_READY" ? "실연동 테스트 실행" : "검증 점검 실행";

              return (
                <div className="inline-actions">
                  <button
                    type="button"
                    className="action-button secondary"
                    onClick={() => void handleTest(row.id)}
                    disabled={!canTest}
                    title={canTest ? testLabel : getAccountReadinessHint(row)}
                  >
                    {testLabel}
                  </button>
                  <button
                    type="button"
                    className="action-button secondary"
                    onClick={() => setSelectedAccountId(selectedAccountId === row.id ? null : row.id)}
                  >
                    {selectedAccountId === row.id ? "로그 전체" : "로그 보기"}
                  </button>
                  <button type="button" className="action-button secondary" onClick={() => void onToggleAccount(row)}>
                    {row.isActive ? "비활성화" : "활성화"}
                  </button>
                </div>
              );
            }
          }
        ]}
        rows={filteredAccounts}
      />
      <div className="log-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">테스트 이력</p>
            <h3>최근 API 계정 테스트 로그</h3>
          </div>
        </div>
        <div className="account-filter-bar log-filter-bar">
          <div className="account-filter-chip-row">
            {logFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === logFilter ? "filter-chip active" : "filter-chip"}
                onClick={() => setLogFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="account-filter-summary">
            <strong>{filteredLogRows.length}</strong> / {recentAccountTestLogs.length}개 로그 표시 중
            {logScopeSummary && <span className="account-scope-note">{logScopeSummary}</span>}
          </div>
        </div>
        {recentAccountTestLogs.length === 0 ? (
          <div className="empty-state-card">
            <strong>아직 API 계정 테스트 로그가 없습니다.</strong>
            <p>연결 테스트를 실행하면 최신 API 계정 이력이 여기에 표시됩니다.</p>
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
              { key: "level", title: "레벨", width: 100, render: (row) => <StatusBadge value={row.level} /> },
              { key: "outcome", title: "결과", width: 120, render: (row) => <StatusBadge value={row.outcome} /> },
              { key: "testMode", title: "모드", width: 130, render: (row) => <StatusBadge value={row.testMode} /> },
              { key: "message", title: "메시지", width: 320 },
              {
                key: "detailSummary",
                title: "상세",
                width: 360,
                render: (row) => row.detailSummary
              }
            ]}
            rows={filteredLogRows}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [judgementFilter, setJudgementFilter] = useState<string>("ALL");
  const [windowFilter, setWindowFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<"LATEST_TRACKED" | "BEST_RANK" | "BEST_DELTA" | "BEST_UP_RATE" | "NAME">("LATEST_TRACKED");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
  const [savedPresetName, setSavedPresetName] = useState("");
  const [selectedPresetName, setSelectedPresetName] = useState("");
  const [savedPresets, setSavedPresets] = useState<ReportFilterPreset[]>([]);
  const hasInvalidDateRange = Boolean(startDateFilter && endDateFilter && startDateFilter > endDateFilter);

  const filteredRows = experimentRows.filter((row) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchMatch =
      normalizedQuery.length === 0 ||
      row.name.toLowerCase().includes(normalizedQuery) ||
      row.productTitle.toLowerCase().includes(normalizedQuery);
    const statusMatch = statusFilter === "ALL" || row.status === statusFilter;
    const judgementMatch = judgementFilter === "ALL" || row.judgement === judgementFilter;
    const windowMatch = matchesTrackedWindow(row.trackedAtValue, windowFilter);
    const dateRangeMatch = matchesTrackedDateRange(row.trackedAtValue, startDateFilter, endDateFilter);
    return searchMatch && statusMatch && judgementMatch && windowMatch && dateRangeMatch;
  });
  const sortedRows = sortExperimentReportRows(filteredRows, sortKey);
  const filteredExperimentIds = new Set(sortedRows.map((row) => row.id));
  const filteredResults = snapshot.results.filter((row) => filteredExperimentIds.has(row.experimentId));
  const summaryCards = buildReportSummary(snapshot, filteredRows, filteredResults);
  const filterScopeLabel = buildTrackedScopeLabel(windowFilter, startDateFilter, endDateFilter);
  const managementSummary = buildReportManagementSummary(sortedRows, filteredResults, filterScopeLabel);

  const reportSortSummaryLabel =
    sortKey === "LATEST_TRACKED"
      ? "최신 추적순"
      : sortKey === "BEST_RANK"
        ? "최신 순위 낮은 순"
        : sortKey === "BEST_DELTA"
          ? "평균 변화량 높은 순"
          : sortKey === "BEST_UP_RATE"
            ? "상승 비율 높은 순"
            : "실험명 가나다순";

  function resetFilters() {
    setStatusFilter("ALL");
    setSearchQuery("");
    setJudgementFilter("ALL");
    setWindowFilter("ALL");
    setSortKey("LATEST_TRACKED");
    setStartDateFilter("");
    setEndDateFilter("");
    setSelectedPresetName("");
    setCopyFeedback("IDLE");
  }

  function applyQuickPreset(preset: "EFFECTIVE" | "RISK" | "COMPLETED" | "ALL") {
    setSearchQuery("");
    setCopyFeedback("IDLE");
    setStartDateFilter("");
    setEndDateFilter("");

    if (preset === "EFFECTIVE") {
      setStatusFilter("RUNNING");
      setJudgementFilter("EFFECTIVE");
      setWindowFilter("30D");
      setSortKey("BEST_DELTA");
      return;
    }

    if (preset === "RISK") {
      setStatusFilter("RUNNING");
      setJudgementFilter("WORSE");
      setWindowFilter("30D");
      setSortKey("BEST_RANK");
      return;
    }

    if (preset === "COMPLETED") {
      setStatusFilter("COMPLETED");
      setJudgementFilter("ALL");
      setWindowFilter("90D");
      setSortKey("LATEST_TRACKED");
      return;
    }

    resetFilters();
  }

  function buildCurrentFilterPreset(name: string): ReportFilterPreset {
    return {
      name,
      searchQuery,
      statusFilter,
      judgementFilter,
      windowFilter,
      startDateFilter,
      endDateFilter,
      sortKey
    };
  }

  function applySavedPreset(preset: ReportFilterPreset) {
    setSearchQuery(preset.searchQuery);
    setStatusFilter(preset.statusFilter);
    setJudgementFilter(preset.judgementFilter);
    setWindowFilter(preset.windowFilter);
    setStartDateFilter(preset.startDateFilter);
    setEndDateFilter(preset.endDateFilter);
    setSortKey(preset.sortKey);
    setSelectedPresetName(preset.name);
    setCopyFeedback("IDLE");
  }

  function handleSaveCurrentPreset() {
    const normalizedName = savedPresetName.trim();
    if (!normalizedName || hasInvalidDateRange) {
      return;
    }

    const nextPresets = [buildCurrentFilterPreset(normalizedName), ...savedPresets.filter((preset) => preset.name !== normalizedName)].slice(0, 12);
    setSavedPresets(nextPresets);
    setSelectedPresetName(normalizedName);
    setSavedPresetName("");
    persistStoredReportPresets(nextPresets);
  }

  function handleApplySelectedPreset() {
    const selectedPreset = savedPresets.find((preset) => preset.name === selectedPresetName);
    if (!selectedPreset) {
      return;
    }

    applySavedPreset(selectedPreset);
  }

  function handleDeleteSelectedPreset() {
    if (!selectedPresetName) {
      return;
    }

    const nextPresets = savedPresets.filter((preset) => preset.name !== selectedPresetName);
    setSavedPresets(nextPresets);
    setSelectedPresetName("");
    persistStoredReportPresets(nextPresets);
  }


  async function handleCopyManagementSummary() {
    if (hasInvalidDateRange) {
      setCopyFeedback("ERROR");
      return;
    }

    try {
      await copyTextToClipboard(buildManagementSummaryClipboardText(managementSummary));
      setCopyFeedback("SUCCESS");
    } catch {
      setCopyFeedback("ERROR");
    }
  }

  function handleDownloadManagementSummary() {
    if (hasInvalidDateRange) {
      setCopyFeedback("ERROR");
      return;
    }

    downloadTextFile("report-management-summary.txt", buildManagementSummaryClipboardText(managementSummary));
  }

  return (
    <section className="dashboard report-layout">
      <div className="panel report-hero">
        <div>
          <p className="eyebrow">주간 / 월간 공유</p>
          <h2>리포트 요약 및 내보내기</h2>
          <p>
            실험 성과를 한 곳에 모아 보고, 필터링된 리포트 행을 팀 리뷰용으로 내보낼 수 있습니다.
            인수인계 메모나 주간 보고에도 바로 활용할 수 있습니다.
          </p>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="action-button"
            onClick={() => downloadCsv("experiment-report.csv", buildExperimentCsv(sortedRows))}
          >
            실험 리포트 CSV
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => downloadCsv("rank-results.csv", buildResultsCsv(filteredResults, snapshot.products))}
          >
            랭킹 결과 CSV
          </button>
        </div>
      </div>
      <section className="panel report-filter-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">리포트 필터</p>
            <h3>리포트 행 필터</h3>
            <p className="helper-copy">현재 정렬: {reportSortSummaryLabel} · 범위: {filterScopeLabel}</p>
          </div>
          <div className="inline-actions">
            <span className="filter-summary">실험 {sortedRows.length}개</span>
            <button type="button" className="action-button secondary" onClick={resetFilters}>
              필터 초기화
            </button>
          </div>
        </div>
        <div className="account-filter-chip-row report-preset-row">
          <button type="button" className="filter-chip" onClick={() => applyQuickPreset("EFFECTIVE")}>
            효과 확인
          </button>
          <button type="button" className="filter-chip" onClick={() => applyQuickPreset("RISK")}>
            위험 실험
          </button>
          <button type="button" className="filter-chip" onClick={() => applyQuickPreset("COMPLETED")}>
            최근 완료
          </button>
          <button type="button" className="filter-chip" onClick={() => applyQuickPreset("ALL")}>
            전체 보기
          </button>
        </div>
        <div className="report-saved-preset-row">
          <label className="report-preset-field">
            <span>필터 저장</span>
            <input value={savedPresetName} placeholder="예: 주간 효과 점검" onChange={(event) => setSavedPresetName(event.target.value)} />
          </label>
          <button type="button" className="action-button secondary" onClick={handleSaveCurrentPreset} disabled={!savedPresetName.trim() || hasInvalidDateRange}>
            현재 필터 저장
          </button>
          <label className="report-preset-field">
            <span>저장된 프리셋</span>
            <select value={selectedPresetName} onChange={(event) => setSelectedPresetName(event.target.value)}>
              <option value="">선택</option>
              {savedPresets.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="action-button secondary" onClick={handleApplySelectedPreset} disabled={!selectedPresetName}>
            불러오기
          </button>
          <button type="button" className="action-button secondary" onClick={handleDeleteSelectedPreset} disabled={!selectedPresetName}>
            삭제
          </button>
        </div>
        <div className="report-filters">
          <label>
            <span>검색</span>
            <input
              value={searchQuery}
              placeholder="실험명 또는 상품명"
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <label>
            <span>상태</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">전체</option>
              <option value="DRAFT">초안</option>
              <option value="RUNNING">진행 중</option>
              <option value="PAUSED">일시중지</option>
              <option value="COMPLETED">완료</option>
              <option value="FAILED">실패</option>
            </select>
          </label>
          <label>
            <span>판단</span>
            <select value={judgementFilter} onChange={(event) => setJudgementFilter(event.target.value)}>
              <option value="ALL">전체</option>
              <option value="EFFECTIVE">효과 있음</option>
              <option value="LOW_EFFECT">효과 낮음</option>
              <option value="PENDING">판단 대기</option>
              <option value="WORSE">악화</option>
            </select>
          </label>
          <label>
            <span>추적 기간</span>
            <select value={windowFilter} onChange={(event) => setWindowFilter(event.target.value)}>
              <option value="ALL">전체</option>
              <option value="7D">최근 7일</option>
              <option value="30D">최근 30일</option>
              <option value="90D">최근 90일</option>
            </select>
          </label>
          <label>
            <span>시작일</span>
            <input type="date" value={startDateFilter} onChange={(event) => setStartDateFilter(event.target.value)} />
          </label>
          <label>
            <span>종료일</span>
            <input type="date" value={endDateFilter} onChange={(event) => setEndDateFilter(event.target.value)} />
          </label>
          <label>
            <span>정렬</span>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as "LATEST_TRACKED" | "BEST_RANK" | "BEST_DELTA" | "BEST_UP_RATE" | "NAME")}>
              <option value="LATEST_TRACKED">최신 추적순</option>
              <option value="BEST_RANK">최신 순위 낮은 순</option>
              <option value="BEST_DELTA">평균 변화량 높은 순</option>
              <option value="BEST_UP_RATE">상승 비율 높은 순</option>
              <option value="NAME">실험명 가나다순</option>
            </select>
          </label>
        </div>
        {hasInvalidDateRange ? (
          <div className="report-filter-warning">
            <strong>날짜 범위를 다시 확인하세요.</strong>
            <p>시작일은 종료일보다 같거나 빨라야 합니다.</p>
          </div>
        ) : null}
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
      <section className="panel report-briefing-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">관리 요약</p>
            <h3>회의 공유용 핵심 요약</h3>
            <p className="helper-copy">필터 결과를 기준으로 바로 전달할 수 있는 문장입니다.</p>
          </div>
          <div className="inline-actions">
            <button type="button" className="action-button secondary" onClick={handleDownloadManagementSummary} disabled={hasInvalidDateRange}>
              요약 TXT 다운로드
            </button>
            <button type="button" className="action-button secondary" onClick={() => void handleCopyManagementSummary()} disabled={hasInvalidDateRange}>
              {copyFeedback === "SUCCESS" ? "요약 복사 완료" : copyFeedback === "ERROR" ? "복사 다시 시도" : "요약 문구 복사"}
            </button>
          </div>
        </div>
        <div className="report-briefing-card">
          <strong>{managementSummary.headline}</strong>
          <div className="report-briefing-grid">
            {managementSummary.points.map((point) => (
              <article key={point.label} className="report-briefing-item">
                <span>{point.label}</span>
                <p>{point.text}</p>
              </article>
            ))}
          </div>
          <small>{managementSummary.footer}</small>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">성과 개요</p>
            <h2>실험 리포트 테이블</h2>
          </div>
        </div>
        {sortedRows.length === 0 ? (
          <div className="empty-state-card">
            <strong>{hasInvalidDateRange ? "잘못된 날짜 범위로 인해 리포트 행을 표시할 수 없습니다." : "현재 필터와 일치하는 리포트 행이 없습니다."}</strong>
            <p>{hasInvalidDateRange ? "시작일과 종료일을 다시 설정한 뒤 확인해보세요." : "필터를 초기화하거나 추적 기간을 넓혀 다시 확인해보세요."}</p>
          </div>
        ) : (
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
            rows={sortedRows}
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

function buildReportSummary(snapshot: AppSnapshot, experimentRows: ExperimentReportRow[], filteredResults: RankTrackingResult[]) {
  const completedCount = experimentRows.filter((item) => item.status === "COMPLETED").length;
  const effectiveCount = experimentRows.filter((item) => item.judgement === "EFFECTIVE").length;
  const activeJobs = snapshot.jobs.filter((item) => item.isEnabled).length;
  const trackedKeywords = new Set(filteredResults.map((item) => item.keyword)).size;
  const latestTrackedAt = filteredResults[0]?.trackedAt;

  return [
    {
      label: "총 실험 수",
      value: experimentRows.length,
      caption: `완료 ${completedCount}건`
    },
    {
      label: "유효 실험",
      value: effectiveCount,
      caption: `${experimentRows.length > 0 ? Math.round((effectiveCount / experimentRows.length) * 100) : 0}% 비중`
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

function loadStoredReportPresets(): ReportFilterPreset[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(REPORT_FILTER_PRESET_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistStoredReportPresets(presets: ReportFilterPreset[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(REPORT_FILTER_PRESET_STORAGE_KEY, JSON.stringify(presets));
}

function buildReportManagementSummary(
  experimentRows: ExperimentReportRow[],
  filteredResults: RankTrackingResult[],
  scopeLabel: string
): ReportManagementSummary {
  if (experimentRows.length === 0) {
    return {
      headline: "현재 필터 조건과 일치하는 실험이 없어 관리 요약을 생성할 수 없습니다.",
      points: [
        { label: "권장 조치", text: "필터를 초기화하거나 추적 기간을 넓혀 다시 확인해보세요." },
        { label: "데이터 범위", text: "실험명 검색어와 상태, 판단, 기간 조건이 모두 함께 적용됩니다." },
        { label: "다음 확인", text: "필터가 넓어진 뒤 CSV를 내려받아 주간 보고용으로 재사용할 수 있습니다." }
      ],
      footer: "필터 결과가 비어 있으므로 최신 추적 시각을 계산하지 않았습니다."
    };
  }

  const effectiveCount = experimentRows.filter((row) => row.judgement === "EFFECTIVE").length;
  const worseCount = experimentRows.filter((row) => row.judgement === "WORSE").length;
  const pendingCount = experimentRows.filter((row) => row.judgement === "PENDING").length;
  const completedCount = experimentRows.filter((row) => row.status === "COMPLETED").length;
  const runningCount = experimentRows.filter((row) => row.status === "RUNNING").length;
  const avgDeltaValues = experimentRows
    .map((row) => parseReportNumber(row.avgDelta))
    .filter((value): value is number => value !== null);
  const avgDelta =
    avgDeltaValues.length > 0 ? (avgDeltaValues.reduce((sum, value) => sum + value, 0) / avgDeltaValues.length).toFixed(1) : null;
  const bestExperiment = experimentRows
    .filter((row) => parseReportNumber(row.avgDelta) !== null)
    .sort((left, right) => compareNullableNumbers(parseReportNumber(left.avgDelta), parseReportNumber(right.avgDelta), false))[0];
  const riskExperiment = experimentRows
    .filter((row) => row.judgement === "WORSE")
    .sort((left, right) => compareNullableNumbers(parseReportNumber(left.latestRank), parseReportNumber(right.latestRank), true))[0];
  const latestTrackedAt = filteredResults
    .map((row) => parseTrackedAt(row.trackedAt))
    .filter((value): value is number => value !== null)
    .sort((left, right) => right - left)[0];

  return {
    headline: `${scopeLabel} 기준 ${experimentRows.length}개 실험 중 효과 있음 ${effectiveCount}개, 악화 ${worseCount}개, 완료 ${completedCount}개입니다.`,
    points: [
      {
        label: "운영 현황",
        text: `현재 진행 중 ${runningCount}개, 판단 대기 ${pendingCount}개이며 평균 변화량은 ${avgDelta ?? "집계 불가"}입니다.`
      },
      {
        label: "성과 포인트",
        text: bestExperiment
          ? `${bestExperiment.name} 실험이 평균 변화량 ${bestExperiment.avgDelta}로 가장 좋습니다.`
          : "아직 평균 변화량을 계산할 수 있는 실험 데이터가 충분하지 않습니다."
      },
      {
        label: "주의 포인트",
        text: riskExperiment
          ? `${riskExperiment.name} 실험은 최신 순위 ${riskExperiment.latestRank}위로 악화 판단이므로 우선 점검이 필요합니다.`
          : "현재 필터 범위에서는 악화 판단 실험이 없습니다."
      }
    ],
    footer: latestTrackedAt
      ? `최신 추적 반영 시각: ${formatDateTime(new Date(latestTrackedAt).toISOString())}`
      : "최신 추적 반영 시각을 확인할 데이터가 없습니다."
  };
}


function buildManagementSummaryClipboardText(summary: ReportManagementSummary) {
  return [summary.headline, ...summary.points.map((point) => `${point.label}: ${point.text}`), summary.footer].join("\n");
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("copy failed");
  }
}

function buildTrackedScopeLabel(windowFilter: string, startDateFilter: string, endDateFilter: string) {
  if (startDateFilter && endDateFilter) {
    return `${startDateFilter} ~ ${endDateFilter}`;
  }

  if (startDateFilter) {
    return `${startDateFilter} 이후`;
  }

  if (endDateFilter) {
    return `${endDateFilter} 이전`;
  }

  if (windowFilter === "7D") {
    return "최근 7일";
  }

  if (windowFilter === "30D") {
    return "최근 30일";
  }

  if (windowFilter === "90D") {
    return "최근 90일";
  }

  return "전체 기간";
}

function matchesTrackedDateRange(trackedAtValue: string | undefined, startDateFilter: string, endDateFilter: string) {
  if ((!startDateFilter && !endDateFilter) || !trackedAtValue) {
    return true;
  }

  const trackedAt = new Date(trackedAtValue).getTime();
  if (Number.isNaN(trackedAt)) {
    return false;
  }

  if (startDateFilter) {
    const start = new Date(`${startDateFilter}T00:00:00`).getTime();
    if (!Number.isNaN(start) && trackedAt < start) {
      return false;
    }
  }

  if (endDateFilter) {
    const end = new Date(`${endDateFilter}T23:59:59`).getTime();
    if (!Number.isNaN(end) && trackedAt > end) {
      return false;
    }
  }

  return true;
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


function sortExperimentReportRows(
  rows: ExperimentReportRow[],
  sortKey: "LATEST_TRACKED" | "BEST_RANK" | "BEST_DELTA" | "BEST_UP_RATE" | "NAME"
) {
  return rows.slice().sort((left, right) => {
    if (sortKey === "NAME") {
      return left.name.localeCompare(right.name, "ko");
    }

    if (sortKey === "BEST_RANK") {
      return compareNullableNumbers(parseReportNumber(left.latestRank), parseReportNumber(right.latestRank), true);
    }

    if (sortKey === "BEST_DELTA") {
      return compareNullableNumbers(parseReportNumber(left.avgDelta), parseReportNumber(right.avgDelta), false);
    }

    if (sortKey === "BEST_UP_RATE") {
      return compareNullableNumbers(parsePercent(left.upRate), parsePercent(right.upRate), false);
    }

    return compareNullableNumbers(parseTrackedAt(left.trackedAtValue), parseTrackedAt(right.trackedAtValue), false);
  });
}

function parseReportNumber(value: string) {
  if (value === "-") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value: string) {
  if (value === "-") {
    return null;
  }

  const parsed = Number(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTrackedAt(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function compareNullableNumbers(left: number | null, right: number | null, ascending: boolean) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return ascending ? left - right : right - left;
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

function downloadTextFile(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildFieldHints(type: ApiAccountFormInput["type"]): FieldHintMap {
  return {
    name: {
      placeholder: type === "SEARCH_AD" ? "예: 메인 검색광고 계정" : type === "COMMERCE" ? "예: 스마트스토어 커머스 계정" : "예: 내부 연동 계정",
      helper: "팀이 바로 알아볼 수 있는 이름으로 입력하세요."
    },
    clientId: {
      placeholder: "발급된 클라이언트 ID 입력",
      helper: "제공처에서 발급된 값을 그대로 입력하세요."
    },
    clientSecret: {
      placeholder: "발급된 클라이언트 시크릿 입력",
      helper: "중간 문자가 바뀌지 않도록 그대로 붙여넣으세요."
    },
    accessLicense: {
      placeholder: type === "SEARCH_AD" ? "검색광고 액세스 라이선스" : "커머스 액세스 라이선스",
      helper: type === "SEARCH_AD" ? "검색광고 실연동 테스트에 필요합니다." : "커머스 검증 및 향후 실연동 호출에 필요합니다."
    },
    secretKey: {
      placeholder: type === "SEARCH_AD" ? "검색광고 시크릿 키" : "커머스 시크릿 키",
      helper: type === "SEARCH_AD" ? "검색광고 실연동 요청 서명에 사용됩니다." : "커머스 검증 및 향후 실연동 호출에 필요합니다."
    },
    customerId: {
      placeholder: "검색광고 고객 ID",
      helper: "검색광고 실연동 테스트에서만 필요합니다."
    },
    storeId: {
      placeholder: "커머스 스토어 ID",
      helper: "스토어 기반 커머스 연동이면 이 값을 사용하세요."
    },
    channelId: {
      placeholder: "커머스 채널 ID",
      helper: "채널 기반 커머스 연동이면 이 값을 사용하세요."
    }
  };
}

function buildNextActionGuide(accounts: ApiAccount[], formReadiness: FormReadinessPreview, currentType: ApiAccountFormInput["type"]): NextActionGuide {
  const liveReadyAccounts = accounts.filter((account) => getAccountReadinessState(account) === "LIVE_READY");

  if (liveReadyAccounts.length > 0) {
    return {
      title: "검색광고 실연동 테스트를 실행하세요.",
      description: `저장된 계정 중 ${liveReadyAccounts.length}개는 실제 외부 테스트가 가능합니다. 아래 표에서 실연동 테스트를 실행하세요.`
    };
  }

  if (formReadiness.state === "LIVE_READY") {
    return {
      title: "이 계정을 저장한 뒤 실연동 테스트를 실행하세요.",
      description: "현재 SEARCH_AD 입력값은 즉시 실제 연결 점검을 실행할 수 있는 상태입니다."
    };
  }

  if (formReadiness.state === "VALIDATION_READY") {
    return {
      title: "현재 검증 흐름용으로 이 계정을 저장하세요.",
      description: currentType === "COMMERCE" ? "커머스 계정은 지금 저장하고 검증한 뒤, 이후 실연동 어댑터 테스트로 확장할 수 있습니다." : "이 계정은 현재 비실연동 검증 흐름에 사용할 수 있습니다."
    };
  }

  return {
    title: "강조된 필수 항목을 먼저 입력하세요.",
    description: `저장과 테스트를 진행하려면 필수 항목 ${formReadiness.missingFields.length}개를 더 입력해야 합니다.`
  };
}

function getFormFieldClassName(requiredFieldSet: Set<string>, requirementKey: string, fallbackKey?: string) {
  const isRequired = requiredFieldSet.has(requirementKey) || (fallbackKey ? requiredFieldSet.has(fallbackKey) : false);
  return isRequired ? "field-required" : "field-optional";
}

function renderFieldLabel(requirementKey: string, requiredFieldSet: Set<string>, displayLabel?: string) {
  const isRequired = requiredFieldSet.has(requirementKey) || (displayLabel ? requiredFieldSet.has(displayLabel) : false);
  const label = displayLabel ?? requirementKey;
  return (
    <>
      {label} <em className={isRequired ? "field-badge required" : "field-badge optional"}>{isRequired ? "필수" : "선택"}</em>
    </>
  );
}

function getCurrentRequiredFields(type: ApiAccountFormInput["type"]) {
  if (type === "SEARCH_AD") {
    return ["계정명", "클라이언트 ID", "클라이언트 시크릿", "액세스 라이선스", "시크릿 키", "고객 ID"];
  }

  if (type === "COMMERCE") {
    return ["계정명", "클라이언트 ID", "클라이언트 시크릿", "액세스 라이선스", "시크릿 키", "스토어 ID 또는 채널 ID"];
  }

  return ["계정명", "클라이언트 ID", "클라이언트 시크릿"];
}

function buildFormReadinessPreview(input: ApiAccountFormInput): FormReadinessPreview {
  const missingFields = getFormMissingFields(input);

  if (input.type === "SEARCH_AD" && missingFields.length === 0) {
    return {
      state: "LIVE_READY",
      title: "이 계정은 바로 저장 후 실제 검색광고 연결 테스트를 실행할 수 있습니다.",
      caption: "검색광고 필수 항목이 모두 입력되었습니다.",
      missingFields
    };
  }

  if (input.type !== "SEARCH_AD" && missingFields.length === 0) {
    return {
      state: "VALIDATION_READY",
      title: "이 계정은 현재 검증 흐름에 사용할 준비가 되었습니다.",
      caption: input.type === "COMMERCE" ? "커머스 실연동 호출은 아직 후속 작업입니다." : "커스텀 계정은 현재 기본 검증만 지원합니다.",
      missingFields
    };
  }

  return {
    state: "INCOMPLETE",
    title: "이 계정을 테스트하려면 추가 입력이 필요합니다.",
    caption: `필수 항목 ${missingFields.length}개가 누락되었습니다.`,
    missingFields
  };
}

function getFormMissingFields(input: ApiAccountFormInput) {
  const missingFields: string[] = [];

  if (!input.name.trim()) {
    missingFields.push("계정명");
  }

  if (!input.clientId.trim()) {
    missingFields.push("클라이언트 ID");
  }

  if (!input.clientSecret.trim()) {
    missingFields.push("클라이언트 시크릿");
  }

  if (input.type === "SEARCH_AD") {
    if (!(input.accessLicense ?? "").trim()) {
      missingFields.push("액세스 라이선스");
    }
    if (!(input.secretKey ?? "").trim()) {
      missingFields.push("시크릿 키");
    }
    if (!(input.customerId ?? "").trim()) {
      missingFields.push("고객 ID");
    }
  }

  if (input.type === "COMMERCE") {
    if (!(input.accessLicense ?? "").trim()) {
      missingFields.push("액세스 라이선스");
    }
    if (!(input.secretKey ?? "").trim()) {
      missingFields.push("시크릿 키");
    }
    if (!(input.storeId ?? "").trim() && !(input.channelId ?? "").trim()) {
      missingFields.push("스토어 ID 또는 채널 ID");
    }
  }

  return missingFields;
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
  const missingFields = getAccountMissingFields(account);

  if (account.type === "SEARCH_AD") {
    return isLiveReadySearchAdAccount(account)
      ? "실제 외부 테스트 가능"
      : `누락: ${missingFields.join(", ")}`;
  }

  if (account.type === "COMMERCE") {
    return isValidationReadyAccount(account)
      ? "검증 전용 점검 가능"
      : `누락: ${missingFields.join(", ")}`;
  }

  return isValidationReadyAccount(account)
    ? "기본 검증 가능"
    : `누락: ${missingFields.join(", ")}`;
}

function getAccountMissingFields(account: ApiAccount) {
  const missingFields: string[] = [];

  if (!account.clientIdMasked) {
    missingFields.push("클라이언트 ID");
  }

  if (!account.clientSecretMasked) {
    missingFields.push("클라이언트 시크릿");
  }

  if (account.type === "SEARCH_AD") {
    if (!account.accessLicenseMasked) {
      missingFields.push("액세스 라이선스");
    }
    if (!account.secretKeyMasked) {
      missingFields.push("시크릿 키");
    }
    if (!account.customerId) {
      missingFields.push("고객 ID");
    }
  }

  if (account.type === "COMMERCE") {
    if (!account.accessLicenseMasked) {
      missingFields.push("액세스 라이선스");
    }
    if (!account.secretKeyMasked) {
      missingFields.push("시크릿 키");
    }
    if (!account.storeId && !account.channelId) {
      missingFields.push("스토어 ID 또는 채널 ID");
    }
  }

  return missingFields;
}

function buildAccountReadinessSummary(accounts: ApiAccount[], recentLogCount: number): AccountReadinessSummary[] {
  const liveReadyCount = accounts.filter(isLiveReadySearchAdAccount).length;
  const validationReadyCount = accounts.filter(isValidationReadyAccount).length;
  const activeCount = accounts.filter((account) => account.isActive).length;

  return [
    {
      label: "저장된 계정",
      value: accounts.length,
      caption: `활성 ${activeCount}개`
    },
    {
      label: "실테스트 가능",
      value: liveReadyCount,
      caption: "SEARCH_AD 자격정보 입력 완료"
    },
    {
      label: "검증 가능",
      value: validationReadyCount,
      caption: "비실연동 점검 가능"
    },
    {
      label: "최근 테스트",
      value: recentLogCount,
      caption: "최신 연결 로그 기준"
    }
  ];
}

function buildAccountLogFocusCards(logs: AccountTestLogViewRow[]): AccountLogFocusCard[] {
  const failedCount = logs.filter((row) => row.outcome === "FAILED").length;
  const successCount = logs.filter((row) => row.outcome === "SUCCESS").length;
  const realCount = logs.filter((row) => row.testMode === "REAL").length;
  const validationCount = logs.filter((row) => row.testMode === "VALIDATION").length;

  return [
    {
      label: "검증 가능",
      value: failedCount,
      caption: failedCount > 0 ? "자격정보 또는 연결 오류를 먼저 확인하세요." : "최근 로그 구간에 실패 내역이 없습니다.",
      toneClass: "failed",
      filterValue: "FAILED"
    },
    {
      label: "검증 가능",
      value: successCount,
      caption: successCount > 0 ? "최근 연결 점검이 정상 완료되었습니다." : "아직 최근 성공 점검 기록이 없습니다.",
      toneClass: "success",
      filterValue: "SUCCESS"
    },
    {
      label: "저장된 계정",
      value: realCount,
      caption: realCount > 0 ? "실제 검색광고 점검이 실행되었습니다." : "최근 로그 구간에 실연동 테스트가 없습니다.",
      toneClass: "info",
      filterValue: "REAL"
    },
    {
      label: "검증 가능",
      value: validationCount,
      caption: "운영 자격정보 적용 전 검증용으로 활용됩니다.",
      toneClass: "warning",
      filterValue: "VALIDATION"
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

type ParsedApiAccountTestMeta = {
  accountId?: string | null;
  accountType?: string | null;
  mode?: string | null;
  statusCode?: number | null;
  details?: string | null;
};

function parseApiAccountTestMeta(metaJson?: string | null): ParsedApiAccountTestMeta {
  if (!metaJson) {
    return {};
  }

  try {
    return JSON.parse(metaJson) as ParsedApiAccountTestMeta;
  } catch {
    return {};
  }
}

function formatParsedApiAccountTestMeta(parsed: ParsedApiAccountTestMeta, fallback?: string | null) {
  const parts = [
    parsed.accountType ? `유형=${parsed.accountType}` : "",
    parsed.mode ? `모드=${parsed.mode}` : "",
    typeof parsed.statusCode === "number" ? `상태=${parsed.statusCode}` : "",
    parsed.details ? String(parsed.details).slice(0, 120) : ""
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : fallback ?? "-";
}

function isApiAccountLogFailure(level: string) {
  return ["ERROR", "FAILED", "WARN"].includes(level.toUpperCase());
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
