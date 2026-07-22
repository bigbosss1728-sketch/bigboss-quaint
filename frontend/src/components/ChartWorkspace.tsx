import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { quantApi } from "../api/quantApi";
import type { ChartBar, IndicatorKind, Timeframe } from "../types/quant";
import { ChartToolbar } from "./ChartToolbar";
import { LightweightChart } from "./LightweightChart";

type DrawingLine = {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
};

type SymbolOption = {
  name: string;
  code: string;
};

export type LiveMarketSnapshot = {
  symbol: string;
  price: number;
  changePct: number;
  high: number;
  low: number;
};

type ChartWorkspaceProps = {
  onMarketDataChange?: (snapshot: LiveMarketSnapshot | null) => void;
};

const symbolOptions: SymbolOption[] = [
  { name: "平安银行", code: "000001.SZ" },
  { name: "贵州茅台", code: "600519.SH" },
  { name: "宁德时代", code: "300750.SZ" },
  { name: "比亚迪", code: "002594.SZ" },
];

export function ChartWorkspace({ onMarketDataChange }: ChartWorkspaceProps) {
  const timeframe: Timeframe = "日线";
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolOption>(symbolOptions[0]);
  const [indicatorDialogOpen, setIndicatorDialogOpen] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorKind[]>(["成交量"]);
  const [drawingLines, setDrawingLines] = useState<DrawingLine[]>([]);
  const [chartBars, setChartBars] = useState<ChartBar[]>([]);
  const [dataStatus, setDataStatus] = useState("正在获取 Tushare 真实行情…");

  useEffect(() => {
    const controller = new AbortController();
    setDataStatus("正在获取 Tushare 真实行情…");
    quantApi
      .getStockBars(selectedSymbol.code, 240, controller.signal)
      .then((rows) => {
        const bars = rows.map((row) => ({
          time: `${row.trade_date.slice(0, 4)}-${row.trade_date.slice(4, 6)}-${row.trade_date.slice(6, 8)}`,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.vol,
        }));
        setChartBars(bars);
        setDataStatus(bars.length ? `Tushare · ${bars.length} 个交易日` : "Tushare 未返回该标的数据");
        const latest = bars.at(-1);
        const previous = bars.at(-2);
        onMarketDataChange?.(
          latest
            ? {
                symbol: selectedSymbol.code,
                price: latest.close,
                changePct: previous ? ((latest.close - previous.close) / previous.close) * 100 : 0,
                high: latest.high,
                low: latest.low,
              }
            : null,
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setChartBars([]);
        setDataStatus(error instanceof Error ? error.message : "真实行情获取失败");
        onMarketDataChange?.(null);
      });
    return () => controller.abort();
  }, [selectedSymbol, onMarketDataChange]);

  const mainBars = useMemo(() => chartBars, [chartBars]);

  const addIndicator = (kind: string) => {
    const nextKind = kind as IndicatorKind;
    setIndicators((items) => (items.includes(nextKind) ? items : [...items, nextKind]));
    setIndicatorDialogOpen(false);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(mainBars, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.download = `quant-bars-${timeframe}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const toolbar = (
    <ChartToolbar
      indicatorDialogOpen={indicatorDialogOpen}
      onOpenIndicatorDialog={() => setIndicatorDialogOpen(true)}
      onCloseIndicatorDialog={() => setIndicatorDialogOpen(false)}
      onAddIndicator={addIndicator}
      onExportData={exportData}
      onScreenshot={() => window.dispatchEvent(new Event("quant:screenshot"))}
    />
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-quant-bg p-4 text-quant-text md:p-5">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-quant border border-quant-line bg-quant-glass shadow-[0_18px_50px_rgba(0,0,0,0.07)] backdrop-blur-xl">
        <header className="flex min-h-20 items-center justify-between border-b border-quant-line bg-white/70 px-5 py-3 backdrop-blur-xl">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-quant-muted">{selectedSymbol.code}</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-quant-text">{selectedSymbol.name}</h1>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {indicators.map((indicator) => (
              <button
                key={indicator}
                className="inline-flex items-center gap-1.5 rounded-full bg-quant-glassHover px-3 py-1.5 text-xs font-medium text-[#0071E3]"
                onClick={() => setIndicators((items) => items.filter((item) => item !== indicator))}
                aria-label={`移除${indicator}`}
              >
                {indicator}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        </header>
        <section className="relative min-h-[360px] flex-1 overflow-hidden bg-white quant-transition">
          <LightweightChart
            bars={mainBars}
            indicators={indicators}
            timeframe={timeframe}
            symbolName={selectedSymbol.name}
            symbolCode={selectedSymbol.code}
            symbolOptions={symbolOptions}
            drawingEnabled={false}
            drawingLines={drawingLines}
            onSymbolChange={setSelectedSymbol}
            onOpenIndicatorDialog={() => setIndicatorDialogOpen(true)}
            onDrawingLinesChange={setDrawingLines}
          />
          <div className="pointer-events-none absolute bottom-2 right-4 z-10 rounded-quant border border-quant-line bg-quant-glass px-2 py-1 text-[11px] text-quant-muted">
            {dataStatus}
          </div>
        </section>
        {toolbar}
      </div>
    </main>
  );
}
