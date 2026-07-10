import { Layers, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { ChartBar, Timeframe } from "../types/quant";

type DrawingLine = {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
};

type SymbolOption = {
  name: string;
  code: string;
};

type LightweightChartProps = {
  bars: ChartBar[];
  timeframe: Timeframe;
  symbolName: string;
  symbolCode: string;
  symbolOptions: SymbolOption[];
  drawingEnabled: boolean;
  drawingLines: DrawingLine[];
  onSymbolChange: (symbol: SymbolOption) => void;
  onOpenIndicatorDialog: () => void;
  onDrawingLinesChange: (lines: DrawingLine[]) => void;
};

export function LightweightChart({
  bars,
  timeframe,
  symbolName,
  symbolCode,
  symbolOptions,
  drawingEnabled,
  drawingLines,
  onSymbolChange,
  onOpenIndicatorDialog,
  onDrawingLinesChange,
}: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const pendingPoint = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [symbolQuery, setSymbolQuery] = useState(`${symbolName} ${symbolCode}`);

  const candleData = useMemo<CandlestickData[]>(
    () =>
      bars.map((bar) => ({
        time: bar.time as Time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    [bars],
  );

  useEffect(() => {
    setSymbolQuery(`${symbolName} ${symbolCode}`);
  }, [symbolName, symbolCode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        attributionLogo: false,
        background: { type: ColorType.Solid, color: "#F2D398" },
        textColor: "#3C6B6E",
        fontFamily: "JetBrains Mono, Consolas, monospace",
      },
      grid: {
        vertLines: { color: "rgba(60,107,110,0.16)" },
        horzLines: { color: "rgba(60,107,110,0.16)" },
      },
      rightPriceScale: {
        borderColor: "rgba(60,107,110,0.28)",
      },
      timeScale: {
        borderColor: "rgba(60,107,110,0.28)",
      },
      crosshair: {
        vertLine: { color: "rgba(60,107,110,0.24)" },
        horzLine: { color: "rgba(60,107,110,0.24)" },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#3C6B6E",
      downColor: "#C0553A",
      wickUpColor: "#3C6B6E",
      wickDownColor: "#C0553A",
      borderVisible: false,
    });
    candleSeries.setData(candleData);


    const volumeData: HistogramData[] = bars.map((bar) => ({
      time: bar.time as Time,
      value: bar.volume,
      color: bar.close >= bar.open ? "rgba(60,107,110,0.38)" : "rgba(192,85,58,0.38)",
    }));
    chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "" }).setData(volumeData);

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    resizeObserver.observe(container);

    const screenshotHandler = () => {
      const canvas = chart.takeScreenshot();
      const link = document.createElement("a");
      link.download = `quant-chart-${timeframe}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    window.addEventListener("quant:screenshot", screenshotHandler);

    return () => {
      window.removeEventListener("quant:screenshot", screenshotHandler);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, candleData, timeframe]);

  const applySymbolQuery = () => {
    const query = symbolQuery.trim().toLowerCase();
    const match = symbolOptions.find((item) => {
      const name = item.name.toLowerCase();
      const code = item.code.toLowerCase();
      return name === query || code === query || `${name} ${code}` === query;
    });
    if (match) onSymbolChange(match);
  };

  const handleDrawingClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!drawingEnabled || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };

    if (!pendingPoint.current) {
      pendingPoint.current = point;
      return;
    }

    onDrawingLinesChange([
      ...drawingLines,
      {
        id: crypto.randomUUID(),
        start: pendingPoint.current,
        end: point,
      },
    ]);
    pendingPoint.current = null;
  };

  const zoom = (direction: "in" | "out") => {
    const chart = chartRef.current;
    if (!chart) return;

    const timeScale = chart.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (!range) return;

    const center = (range.from + range.to) / 2;
    const width = range.to - range.from;
    const nextWidth = direction === "in" ? width * 0.72 : width * 1.28;
    timeScale.setVisibleLogicalRange({
      from: center - nextWidth / 2,
      to: center + nextWidth / 2,
    });
  };

  return (
    <div className="relative h-full min-h-[300px] bg-quant-bg" onClick={handleDrawingClick}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute left-3 top-3 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-1.5 rounded-quant border border-quant-line bg-quant-glass px-2 py-1 text-xs text-quant-text">
        <input
          className="w-44 bg-transparent outline-none placeholder:text-quant-muted"
          list="symbol-options"
          value={symbolQuery}
          placeholder="输入中文名或代码"
          aria-label="选择查看标的"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => setSymbolQuery(event.target.value)}
          onBlur={applySymbolQuery}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applySymbolQuery();
              event.currentTarget.blur();
            }
          }}
        />
        <span className="text-quant-muted">· {timeframe}</span>
        <span className="mx-0.5 h-4 w-px bg-quant-glassHover" />
        <button
          className="grid h-7 w-7 place-items-center rounded-quant text-quant-muted quant-transition hover:bg-quant-glassHover hover:text-quant-text"
          aria-label="放大K线图"
          onClick={(event) => {
            event.stopPropagation();
            zoom("in");
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          className="grid h-7 w-7 place-items-center rounded-quant text-quant-muted quant-transition hover:bg-quant-glassHover hover:text-quant-text"
          aria-label="缩小K线图"
          onClick={(event) => {
            event.stopPropagation();
            zoom("out");
          }}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          className="inline-flex h-7 items-center gap-1 rounded-quant px-2 text-quant-muted quant-transition hover:bg-quant-glassHover hover:text-quant-text"
          aria-label="添加指标"
          onClick={(event) => {
            event.stopPropagation();
            onOpenIndicatorDialog();
          }}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>指标</span>
        </button>
        <datalist id="symbol-options">
          {symbolOptions.map((item) => (
            <option key={item.code} value={`${item.name} ${item.code}`} />
          ))}
        </datalist>
      </div>
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {drawingLines.map((line) => (
          <line
            key={line.id}
            x1={line.start.x * size.width}
            y1={line.start.y * size.height}
            x2={line.end.x * size.width}
            y2={line.end.y * size.height}
            stroke="rgba(60,107,110,0.65)"
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  );
}




