import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type {
  ApiAccount,
  AppSnapshot,
  Product,
  ProductFormInput,
  RankTrackingJob,
  RankTrackingResult,
  SeoExperiment
} from "@naver-seo-tracker/shared";
import { DataGrid } from "./components/DataGrid";
import { SparklineBars } from "./components/SparklineBars";
import { StatusBadge } from "./components/StatusBadge";
import { bulkCreateProducts, createProduct, fetchSnapshot, runTrackingJob, updateProduct } from "./lib/api";

type ViewKey = "dashboard" | "accounts" | "products" | "experiments" | "tracking" | "results";

const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: "dashboard", label: "대시보드" },
  { key: "accounts", label: "API 계정" },
  { key: "products", label: "상품 목록" },
  { key: "experiments", label: "실험 관리" },
  { key: "tracking", label: "추적 작업" },
  { key: "results", label: "랭킹 결과" }
];

const defaultProductForm: ProductFormInput = {
  smartStoreProductId: "",
  originProductId: "",
  channelProductId: "",
  sellerManagementCode: "",
  currentTitle: "",
  originalTitle: "",
  seoOptimizedTitle: "",
  primaryKeyword: "",
  trackingKeywords: [],
  category: "",
  price: 0,
  productStatus: "ON_SALE",
  testStatus: "DRAFT"
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

  async function handleCreateProduct(input: ProductFormInput) {
    await createProduct(input);
    await loadSnapshot();
  }

  async function handleBulkCreateProducts(rows: ProductFormInput[]) {
    await bulkCreateProducts(rows);
    await loadSnapshot();
  }

  async function handleToggleProductStatus(product: Product) {
    await updateProduct(product.id, {
      productStatus: product.productStatus === "ON_SALE" ? "PAUSED" : "ON_SALE"
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
            {view === "accounts" && <ApiAccountsView accounts={snapshot.apiAccounts} />}
            {view === "products" && (
              <ProductsView
                products={snapshot.products}
                onCreateProduct={handleCreateProduct}
                onBulkCreateProducts={handleBulkCreateProducts}
                onToggleProductStatus={handleToggleProductStatus}
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

function ProductsView({
  products,
  onCreateProduct,
  onBulkCreateProducts,
  onToggleProductStatus
}: {
  products: Product[];
  onCreateProduct: (input: ProductFormInput) => Promise<void>;
  onBulkCreateProducts: (rows: ProductFormInput[]) => Promise<void>;
  onToggleProductStatus: (product: Product) => Promise<void>;
}) {
  const [form, setForm] = useState<ProductFormInput>(defaultProductForm);
  const [bulkText, setBulkText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await onCreateProduct(form);
      setForm(defaultProductForm);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkSubmit() {
    const rows = bulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [smartStoreProductId, currentTitle, price, primaryKeyword, trackingKeywords, sellerManagementCode, category] =
          line.split("|").map((item) => item.trim());

        return {
          smartStoreProductId,
          currentTitle,
          price: Number(price || 0),
          primaryKeyword: primaryKeyword || "",
          trackingKeywords: trackingKeywords ? trackingKeywords.split(",").map((item) => item.trim()).filter(Boolean) : [],
          sellerManagementCode: sellerManagementCode || "",
          category: category || "",
          originProductId: "",
          channelProductId: "",
          originalTitle: currentTitle,
          seoOptimizedTitle: "",
          productStatus: "ON_SALE",
          testStatus: "DRAFT"
        } satisfies ProductFormInput;
      });

    if (!rows.length) {
      return;
    }

    setSubmitting(true);

    try {
      await onBulkCreateProducts(rows);
      setBulkText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">카탈로그</p>
          <h2>상품 목록</h2>
        </div>
      </div>
      <form className="entity-form" onSubmit={handleSubmit}>
        <label>
          <span>스마트스토어 상품 ID</span>
          <input
            value={form.smartStoreProductId}
            onChange={(event) => setForm({ ...form, smartStoreProductId: event.target.value })}
            required
          />
        </label>
        <label>
          <span>판매자관리코드</span>
          <input
            value={form.sellerManagementCode ?? ""}
            onChange={(event) => setForm({ ...form, sellerManagementCode: event.target.value })}
          />
        </label>
        <label className="wide-field">
          <span>현재 상품명</span>
          <input value={form.currentTitle} onChange={(event) => setForm({ ...form, currentTitle: event.target.value })} required />
        </label>
        <label className="wide-field">
          <span>SEO 상품명</span>
          <input
            value={form.seoOptimizedTitle ?? ""}
            onChange={(event) => setForm({ ...form, seoOptimizedTitle: event.target.value })}
          />
        </label>
        <label>
          <span>대표 키워드</span>
          <input
            value={form.primaryKeyword ?? ""}
            onChange={(event) => setForm({ ...form, primaryKeyword: event.target.value })}
          />
        </label>
        <label>
          <span>추적 키워드</span>
          <input
            value={form.trackingKeywords.join(", ")}
            onChange={(event) =>
              setForm({
                ...form,
                trackingKeywords: event.target.value.split(",").map((item) => item.trim()).filter(Boolean)
              })
            }
          />
        </label>
        <label>
          <span>카테고리</span>
          <input value={form.category ?? ""} onChange={(event) => setForm({ ...form, category: event.target.value })} />
        </label>
        <label>
          <span>판매가</span>
          <input
            type="number"
            min="0"
            value={form.price}
            onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
          />
        </label>
        <label>
          <span>판매상태</span>
          <select
            value={form.productStatus}
            onChange={(event) => setForm({ ...form, productStatus: event.target.value as ProductFormInput["productStatus"] })}
          >
            <option value="ON_SALE">판매중</option>
            <option value="PAUSED">판매중지</option>
            <option value="SOLD_OUT">품절</option>
          </select>
        </label>
        <label>
          <span>테스트 상태</span>
          <select
            value={form.testStatus}
            onChange={(event) => setForm({ ...form, testStatus: event.target.value as ProductFormInput["testStatus"] })}
          >
            <option value="DRAFT">초안</option>
            <option value="RUNNING">진행중</option>
            <option value="PAUSED">보류</option>
            <option value="COMPLETED">완료</option>
            <option value="FAILED">실패</option>
          </select>
        </label>
        <button type="submit" className="action-button" disabled={submitting}>
          {submitting ? "저장 중..." : "상품 등록"}
        </button>
      </form>

      <div className="bulk-panel">
        <div>
          <p className="eyebrow">대량 입력 준비</p>
          <h3>CSV 전 단계 일괄 붙여넣기</h3>
          <p className="help-text">형식: 상품ID|상품명|판매가|대표키워드|추적키워드1,추적키워드2|판매자관리코드|카테고리</p>
        </div>
        <textarea
          className="bulk-textarea"
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder="SS-20001|대용량 텀블러 1L|25900|대용량 텀블러|대용량 텀블러,보온 텀블러|SELLER-001|주방용품"
        />
        <button type="button" className="action-button secondary" onClick={() => void handleBulkSubmit()} disabled={submitting}>
          일괄 등록
        </button>
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
            key: "productStatus",
            title: "판매상태",
            width: 120,
            render: (row) => <StatusBadge value={row.productStatus} />
          },
          {
            key: "testStatus",
            title: "테스트 상태",
            width: 130,
            render: (row) => <StatusBadge value={row.testStatus} />
          },
          {
            key: "actions",
            title: "작업",
            width: 140,
            render: (row) => (
              <button type="button" className="action-button secondary" onClick={() => void onToggleProductStatus(row)}>
                {row.productStatus === "ON_SALE" ? "판매중지" : "판매재개"}
              </button>
            )
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
