import { PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, ConfigProvider, Flex, Row, Space, Tag, Typography } from "antd";
import { useEffect, useState } from "react";

type Rating = "A" | "B" | "C" | "D";

type DailyBar = {
  ts_code: string;
  name: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pre_close: number;
  pct_chg: number;
  vol: number;
  amount: number;
};

type StockSignal = {
  ts_code: string;
  name: string;
  trade_date: string;
  rating: Rating;
  action: string;
  score: number;
  suggested_weight: number;
  reason: string;
  bars: DailyBar[];
  indicators: string[];
};

type LatestSignalResponse = {
  source: string;
  signals: StockSignal[];
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

const ratingColors: Record<Rating, string> = {
  A: "green",
  B: "blue",
  C: "default",
  D: "red",
};

const actionLabels: Record<string, string> = {
  buy: "买入观察",
  watch: "继续观察",
  hold: "持有",
  avoid: "回避",
};

function CandlestickChart({ bars }: { bars: DailyBar[] }) {
  const visibleBars = bars.slice(-30);
  if (visibleBars.length === 0) {
    return <div className="chart-empty">暂无K线数据</div>;
  }

  const width = 320;
  const height = 140;
  const padding = 12;
  const chartHeight = height - padding * 2;
  const lows = visibleBars.map((bar) => bar.low);
  const highs = visibleBars.map((bar) => bar.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const spread = max - min || 1;
  const step = width / visibleBars.length;
  const candleWidth = Math.max(4, Math.min(10, step * 0.48));
  const yFor = (value: number) => padding + ((max - value) / spread) * chartHeight;

  return (
    <svg className="kline-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="多日K线图">
      <line className="chart-axis" x1={0} x2={width} y1={height - padding} y2={height - padding} />
      {visibleBars.map((bar, index) => {
        const x = step * index + step / 2;
        const openY = yFor(bar.open);
        const closeY = yFor(bar.close);
        const isUp = bar.close >= bar.open;
        return (
          <g key={`${bar.trade_date}-${index}`} className={isUp ? "candle-up" : "candle-down"}>
            <line x1={x} x2={x} y1={yFor(bar.high)} y2={yFor(bar.low)} />
            <rect
              x={x - candleWidth / 2}
              y={Math.min(openY, closeY)}
              width={candleWidth}
              height={Math.max(2, Math.abs(closeY - openY))}
              rx={1}
            />
          </g>
        );
      })}
    </svg>
  );
}

function App() {
  const [payload, setPayload] = useState<LatestSignalResponse | null>(null);
  const [error, setError] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [busy, setBusy] = useState(false);

  const loadLatest = () => {
    setError("");
    fetch(`${apiBaseUrl}/api/signals/latest`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<LatestSignalResponse>;
      })
      .then(setPayload)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    loadLatest();
  }, []);

  const runPipeline = () => {
    const date = tradeDate.replaceAll("-", "");
    if (!date) {
      setError("Choose a trade date before running the Tushare pipeline.");
      return;
    }

    setBusy(true);
    setError("");
    fetch(`${apiBaseUrl}/api/pipeline/run?trade_date=${date}&limit=200`, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          const detail = await response.json().catch(() => ({}));
          throw new Error(detail.detail ?? `HTTP ${response.status}`);
        }
        return response.json() as Promise<LatestSignalResponse>;
      })
      .then(setPayload)
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const signals = payload?.signals ?? [];
  const buyCount = signals.filter((item) => item.action === "buy").length;
  const watchCount = signals.filter((item) => item.action === "watch").length;
  const topTradeDate = signals[0]?.trade_date ?? "-";

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 6,
          colorPrimary: "#1677ff",
        },
      }}
    >
      <main className="app-shell">
        <Space direction="vertical" size={16} className="page-stack">
          <section className="page-header">
            <div className="page-title">
              <Typography.Title level={2}>A-Share Quant Platform</Typography.Title>
              <Typography.Text type="secondary">Daily stock pool, ratings, and trading signals</Typography.Text>
            </div>
            <Flex gap={8} wrap="wrap" align="center">
              <input
                className="date-input"
                type="date"
                value={tradeDate}
                onChange={(event) => setTradeDate(event.target.value)}
                aria-label="Trade date"
              />
              <Button icon={<ReloadOutlined />} onClick={loadLatest}>
                Refresh
              </Button>
              <Button type="primary" icon={<PlayCircleOutlined />} loading={busy} onClick={runPipeline}>
                Run Tushare
              </Button>
            </Flex>
          </section>

          {error ? <Alert type="error" message="Backend unavailable" description={error} showIcon /> : null}

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <div className="metric-label">Signal Source</div>
                <div className="metric-value">{payload?.source ?? "-"}</div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <div className="metric-label">Trade Date</div>
                <div className="metric-value">{topTradeDate}</div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <div className="metric-label">Buy Candidates</div>
                <div className="metric-value">{buyCount}</div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <div className="metric-label">Watch List</div>
                <div className="metric-value">{watchCount}</div>
              </Card>
            </Col>
          </Row>

          <section className="stock-section">
            <div className="section-heading">
              <Typography.Title level={4}>选股池</Typography.Title>
              <Typography.Text type="secondary">每只股票展示多日K线、选股原因和技术指标</Typography.Text>
            </div>
            {!payload && !error ? <Card loading /> : null}
            <div className="stock-grid">
              {signals.map((signal) => (
                <Card
                  key={signal.ts_code}
                  size="small"
                  className="stock-card"
                  title={
                    <div className="stock-title">
                      <span>{signal.name || signal.ts_code}</span>
                      <Typography.Text type="secondary">{signal.ts_code}</Typography.Text>
                    </div>
                  }
                  extra={<Tag color={ratingColors[signal.rating]}>{signal.rating}</Tag>}
                >
                  <div className="stock-summary">
                    <div>
                      <span className="stock-label">操作</span>
                      <strong>{actionLabels[signal.action] ?? signal.action}</strong>
                    </div>
                    <div>
                      <span className="stock-label">评分</span>
                      <strong>{signal.score.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="stock-label">建议仓位</span>
                      <strong>{(signal.suggested_weight * 100).toFixed(1)}%</strong>
                    </div>
                  </div>
                  <CandlestickChart bars={signal.bars} />
                  <p className="stock-reason">{signal.reason}</p>
                  <div className="indicator-list">
                    {signal.indicators.map((indicator) => (
                      <Tag key={indicator}>{indicator}</Tag>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </Space>
      </main>
    </ConfigProvider>
  );
}

export default App;
