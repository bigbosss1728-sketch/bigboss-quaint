import { PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, ConfigProvider, Flex, Row, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

type Rating = "A" | "B" | "C" | "D";

type StockSignal = {
  ts_code: string;
  name: string;
  trade_date: string;
  rating: Rating;
  action: string;
  score: number;
  suggested_weight: number;
  reason: string;
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

  const columns = useMemo<ColumnsType<StockSignal>>(
    () => [
      {
        title: "Code",
        dataIndex: "ts_code",
        width: 120,
        fixed: "left",
      },
      {
        title: "Name",
        dataIndex: "name",
        width: 140,
      },
      {
        title: "Rating",
        dataIndex: "rating",
        width: 100,
        render: (rating: Rating) => <Tag color={ratingColors[rating]}>{rating}</Tag>,
      },
      {
        title: "Action",
        dataIndex: "action",
        width: 110,
      },
      {
        title: "Score",
        dataIndex: "score",
        width: 100,
        sorter: (a, b) => a.score - b.score,
      },
      {
        title: "Weight",
        dataIndex: "suggested_weight",
        width: 110,
        render: (value: number) => `${(value * 100).toFixed(1)}%`,
      },
      {
        title: "Reason",
        dataIndex: "reason",
      },
    ],
    [],
  );

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

          <Card size="small" title="Daily Stock Pool">
            <Table
              rowKey="ts_code"
              columns={columns}
              dataSource={signals}
              loading={!payload && !error}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ x: 900 }}
              size="middle"
            />
          </Card>
        </Space>
      </main>
    </ConfigProvider>
  );
}

export default App;
