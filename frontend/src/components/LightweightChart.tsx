import { Layers, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { ChartBar, IndicatorKind, Timeframe } from "../types/quant";

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
  indicators: IndicatorKind[];
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
  indicators,
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
        background: { type: ColorType.Solid, color: "#FFFFFF" },
        textColor: "#6E6E73",
        fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(0,0,0,0.045)" },
        horzLines: { color: "rgba(0,0,0,0.045)" },
      },
      rightPriceScale: {
        borderColor: "rgba(0,0,0,0.08)",
      },
      timeScale: {
        borderColor: "rgba(0,0,0,0.08)",
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 0,
        lockVisibleTimeRangeOnResize: true,
      },
      crosshair: {
        vertLine: { color: "rgba(0,113,227,0.3)" },
        horzLine: { color: "rgba(0,113,227,0.3)" },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#34C759",
      downColor: "#FF3B30",
      wickUpColor: "#34C759",
      wickDownColor: "#FF3B30",
      borderVisible: false,
    });
    candleSeries.setData(candleData);


    if (indicators.includes("成交量")) {
      const volumeData: HistogramData[] = bars.map((bar) => ({
        time: bar.time as Time,
        value: bar.volume,
        color: bar.close >= bar.open ? "rgba(52,199,89,0.28)" : "rgba(255,59,48,0.28)",
      }));
      chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume" }).setData(volumeData);
    }

    if (indicators.includes("均线")) {
      chart.addSeries(LineSeries, lineOptions("#0071E3")).setData(movingAverage(bars, 20));
    }

    if (indicators.includes("布林带")) {
      const bands = bollingerBands(bars, 20);
      chart.addSeries(LineSeries, lineOptions("#AF52DE")).setData(bands.upper);
      chart.addSeries(LineSeries, lineOptions("#AF52DE")).setData(bands.lower);
    }

    if (indicators.includes("MACD")) {
      chart.addSeries(LineSeries, lineOptions("#FF9500", "macd")).setData(macdLine(bars));
    }

    if (indicators.includes("RSI")) {
      chart.addSeries(LineSeries, lineOptions("#5856D6", "rsi")).setData(rsiLine(bars, 14));
    }

    if (bars.length > 0) {
      const lastIndex = bars.length - 1;
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, bars.length - 20),
        to: lastIndex,
      });
    }
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
  }, [bars, candleData, indicators, timeframe]);

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
    const nextWidth = Math.min(Math.max(4, direction === "in" ? width * 0.72 : width * 1.28), Math.max(4, bars.length - 1));
    let from = center - nextWidth / 2;
    let to = center + nextWidth / 2;
    if (from < 0) {
      to -= from;
      from = 0;
    }
    const lastIndex = Math.max(0, bars.length - 1);
    if (to > lastIndex) {
      from -= to - lastIndex;
      to = lastIndex;
    }
    timeScale.setVisibleLogicalRange({
      from: Math.max(0, from),
      to,
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

function lineOptions(color: string, priceScaleId?: string) {
  return {
    color,
    lineWidth: 2 as const,
    priceScaleId,
    priceLineVisible: false,
    lastValueVisible: false,
  };
}

function movingAverage(bars: ChartBar[], period: number): LineData[] {
  return bars.flatMap((bar, index) => {
    if (index < period - 1) return [];
    const values = bars.slice(index - period + 1, index + 1);
    return [{ time: bar.time as Time, value: values.reduce((sum, item) => sum + item.close, 0) / period }];
  });
}

function bollingerBands(bars: ChartBar[], period: number): { upper: LineData[]; lower: LineData[] } {
  const upper: LineData[] = [];
  const lower: LineData[] = [];
  bars.forEach((bar, index) => {
    if (index < period - 1) return;
    const values = bars.slice(index - period + 1, index + 1).map((item) => item.close);
    const average = values.reduce((sum, value) => sum + value, 0) / period;
    const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / period);
    upper.push({ time: bar.time as Time, value: average + 2 * deviation });
    lower.push({ time: bar.time as Time, value: average - 2 * deviation });
  });
  return { upper, lower };
}

function emaValues(values: number[], period: number): number[] {
  const factor = 2 / (period + 1);
  return values.reduce<number[]>((items, value, index) => {
    items.push(index === 0 ? value : value * factor + items[index - 1] * (1 - factor));
    return items;
  }, []);
}

function macdLine(bars: ChartBar[]): LineData[] {
  const closes = bars.map((bar) => bar.close);
  const fast = emaValues(closes, 12);
  const slow = emaValues(closes, 26);
  return bars.map((bar, index) => ({ time: bar.time as Time, value: fast[index] - slow[index] }));
}

function rsiLine(bars: ChartBar[], period: number): LineData[] {
  return bars.flatMap((bar, index) => {
    if (index < period) return [];
    const window = bars.slice(index - period, index + 1).map((item) => item.close);
    const changes = window.slice(1).map((value, offset) => value - window[offset]);
    const gain = changes.reduce((sum, value) => sum + Math.max(0, value), 0) / period;
    const loss = changes.reduce((sum, value) => sum + Math.max(0, -value), 0) / period;
    const value = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    return [{ time: bar.time as Time, value }];
  });
}

