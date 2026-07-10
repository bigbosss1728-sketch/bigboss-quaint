import { Maximize2, X } from "lucide-react";
import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { chartBars, initialIndicators } from "../data/mockQuant";
import { cn } from "../lib/utils";
import type { ChartBar, IndicatorKind, IndicatorPanel, Timeframe } from "../types/quant";
import { ChartToolbar } from "./ChartToolbar";
import { LightweightChart } from "./LightweightChart";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type DrawingLine = {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
};

type SymbolOption = {
  name: string;
  code: string;
};

const timeframes: Timeframe[] = ["分时", "1min", "5min", "15min", "日线"];
const symbolOptions: SymbolOption[] = [
  { name: "沪深300股指期货", code: "IF2409" },
  { name: "贵州茅台", code: "600519.SH" },
  { name: "平安银行", code: "000001.SZ" },
  { name: "沪深300ETF", code: "510300.SH" },
];

export function ChartWorkspace() {
  const [topRatio, setTopRatio] = useState(68);
  const [timeframe, setTimeframe] = useState<Timeframe>("日线");
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolOption>(symbolOptions[0]);
  const [indicatorDialogOpen, setIndicatorDialogOpen] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorPanel[]>(initialIndicators);
  const [drawingLines, setDrawingLines] = useState<DrawingLine[]>([]);

  const mainBars = useMemo(() => {
    if (timeframe === "分时") return chartBars.slice(-36);
    if (timeframe === "1min") return chartBars.slice(-48);
    if (timeframe === "5min") return chartBars.slice(-60);
    if (timeframe === "15min") return chartBars.slice(-72);
    return chartBars;
  }, [timeframe]);

  const handleDragStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    const parent = event.currentTarget.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();

    const handleMove = (moveEvent: MouseEvent) => {
      const next = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setTopRatio(Math.min(78, Math.max(46, next)));
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const addIndicator = (kind: string) => {
    const nextKind = kind as IndicatorKind;
    setIndicators((items) => [
      ...items,
      {
        id: `${kind}-${Date.now()}`,
        kind: nextKind,
        title: `${kind} 指标`,
        value: kind === "成交量" ? "18.2M" : "42.8",
        change: kind === "RSI" ? -0.03 : 0.05,
      },
    ]);
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
      timeframe={timeframe}
      timeframes={timeframes}
      indicatorDialogOpen={indicatorDialogOpen}
      onTimeframeChange={setTimeframe}
      onOpenIndicatorDialog={() => setIndicatorDialogOpen(true)}
      onCloseIndicatorDialog={() => setIndicatorDialogOpen(false)}
      onAddIndicator={addIndicator}
      onExportData={exportData}
      onScreenshot={() => window.dispatchEvent(new Event("quant:screenshot"))}
    />
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-quant-bg p-3 text-quant-text">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-quant border border-quant-line bg-quant-glass">
        <section className="min-h-[260px] shrink-0 overflow-hidden bg-quant-bg quant-transition" style={{ flexBasis: `${topRatio}%` }}>
          <LightweightChart
            bars={mainBars}
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
        </section>
        {toolbar}
        <div
          className="h-px cursor-row-resize bg-quant-line quant-transition hover:bg-quant-glassHover"
          role="separator"
          onMouseDown={handleDragStart}
        />
        <section className="min-h-0 flex-1 overflow-auto bg-quant-glass p-2 quant-transition">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {indicators.map((indicator) => (
              <Card key={indicator.id} className="min-h-32">
                <CardHeader className="flex flex-row items-center justify-between px-2 py-1.5">
                  <div>
                    <CardTitle className="text-xs">{indicator.title}</CardTitle>
                    <Badge className="mt-1 bg-quant-glass">{indicator.kind}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" className="h-6 w-6 px-0">
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-6 w-6 px-0"
                      onClick={() => setIndicators((items) => items.filter((item) => item.id !== indicator.id))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-2 py-1.5">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="mono-num text-lg text-quant-text">{indicator.value}</div>
                      <div className={cn("mono-num mt-1 text-xs", indicator.change >= 0 ? "text-quant-up" : "text-quant-down")}>
                        {indicator.change >= 0 ? "+" : ""}
                        {(indicator.change * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <MiniIndicatorChart kind={indicator.kind} bars={mainBars.slice(-28)} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function MiniIndicatorChart({ kind, bars }: { kind: IndicatorKind; bars: ChartBar[] }) {
  const closes = bars.map((bar) => bar.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const scaleY = (value: number) => 54 - ((value - min) / Math.max(0.01, max - min)) * 42;
  const point = (value: number, index: number) => `${(index / Math.max(1, closes.length - 1)) * 100},${scaleY(value)}`;
  const line = closes.map(point).join(" ");

  if (kind === "成交量" || kind === "MACD") {
    return (
      <svg className="mt-2 h-16 w-full rounded-quant border border-quant-line bg-quant-glass" viewBox="0 0 100 60" preserveAspectRatio="none">
        <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(60,107,110,0.28)" strokeWidth="0.6" />
        {bars.map((bar, index) => {
          const height = kind === "MACD" ? Math.abs(Math.sin(index / 3)) * 24 + 4 : (bar.volume / Math.max(...bars.map((item) => item.volume))) * 44;
          const y = kind === "MACD" && index % 5 < 2 ? 30 : 54 - height;
          return (
            <rect
              key={bar.time}
              x={(index / bars.length) * 100}
              y={y}
              width="2"
              height={height}
              fill={index % 5 < 2 ? "rgba(192,85,58,0.58)" : "rgba(60,107,110,0.58)"}
            />
          );
        })}
      </svg>
    );
  }

  return (
    <svg className="mt-2 h-16 w-full rounded-quant border border-quant-line bg-quant-glass" viewBox="0 0 100 60" preserveAspectRatio="none">
      <line x1="0" y1="18" x2="100" y2="18" stroke="rgba(60,107,110,0.18)" strokeWidth="0.6" strokeDasharray="2 2" />
      <line x1="0" y1="42" x2="100" y2="42" stroke="rgba(60,107,110,0.18)" strokeWidth="0.6" strokeDasharray="2 2" />
      {kind === "布林带" ? (
        <>
          <polyline points={closes.map((value, index) => point(value + 1.1, index)).join(" ")} fill="none" stroke="rgba(60,107,110,0.56)" strokeWidth="1" />
          <polyline points={closes.map((value, index) => point(value - 1.1, index)).join(" ")} fill="none" stroke="rgba(60,107,110,0.56)" strokeWidth="1" />
        </>
      ) : null}
      <polyline points={line} fill="none" stroke={kind === "RSI" ? "#C0553A" : "#3C6B6E"} strokeWidth="1.6" />
    </svg>
  );
}

