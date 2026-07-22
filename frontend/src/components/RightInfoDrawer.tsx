import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LiveMarketSnapshot } from "./ChartWorkspace";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type RightInfoDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketSnapshot: LiveMarketSnapshot | null;
};

export function RightInfoDrawer({ open, onOpenChange, marketSnapshot }: RightInfoDrawerProps) {
  const bullishIndicators = marketSnapshot
    ? [
        `最新涨跌幅 ${marketSnapshot.changePct >= 0 ? "+" : ""}${marketSnapshot.changePct.toFixed(2)}%`,
        `当日高点 ${marketSnapshot.high.toFixed(2)}`,
        marketSnapshot.price >= (marketSnapshot.high + marketSnapshot.low) / 2 ? "收盘价位于当日区间上半部" : "收盘价尚未站上当日区间中位",
      ]
    : ["正在等待 Tushare 行情"];
  const bearishIndicators = marketSnapshot
    ? [
        `当日低点 ${marketSnapshot.low.toFixed(2)}`,
        `距当日高点 ${(((marketSnapshot.high - marketSnapshot.price) / marketSnapshot.high) * 100).toFixed(2)}%`,
        marketSnapshot.changePct < 0 ? "最新交易日收跌" : "最新交易日未收跌",
      ]
    : ["暂无真实行情可分析"];
  return (
    <>
      {open ? <div className="fixed inset-0 z-30 bg-transparent" onClick={() => onOpenChange(false)} /> : null}
      <button
        className={cn("fixed top-1/2 z-50 flex h-20 w-6 -translate-y-1/2 items-center justify-center rounded-l-quant border border-r-0 border-quant-line bg-quant-glass text-quant-muted quant-transition hover:bg-quant-glassHover hover:text-quant-text", open ? "right-80" : "right-0")}
        onClick={() => onOpenChange(!open)}
      >
        {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
      <aside
        className={cn(
          "fixed right-0 top-0 z-40 h-screen w-80 translate-x-full border-l border-quant-line bg-quant-bg p-2 quant-transition md:absolute",
          open && "translate-x-0",
        )}
      >
        <div className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
          <Card>
            <CardHeader>
              <CardTitle>标的基础行情</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-xs">
              <Info label="当前价格" value={marketSnapshot ? marketSnapshot.price.toFixed(2) : "--"} positive />
              <Info label="当日高点" value={marketSnapshot ? marketSnapshot.high.toFixed(2) : "--"} />
              <Info label="当日低点" value={marketSnapshot ? marketSnapshot.low.toFixed(2) : "--"} negative />
              <Info label="涨跌幅" value={marketSnapshot ? `${marketSnapshot.changePct >= 0 ? "+" : ""}${marketSnapshot.changePct.toFixed(2)}%` : "--"} positive={Boolean(marketSnapshot && marketSnapshot.changePct >= 0)} negative={Boolean(marketSnapshot && marketSnapshot.changePct < 0)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>标的技术指标分析</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <SignalBlock title="上涨" tone="up" indicators={bullishIndicators} />
              <SignalBlock title="下跌" tone="down" indicators={bearishIndicators} />
            </CardContent>
          </Card>
        </div>
      </aside>
    </>
  );
}

function SignalBlock({ title, tone, indicators }: { title: string; tone: "up" | "down"; indicators: string[] }) {
  const toneClass = tone === "up" ? "text-quant-up" : "text-quant-down";

  return (
    <div className="rounded-quant border border-quant-line bg-quant-glass p-2">
      <div className={cn("text-sm font-medium", toneClass)}>{title}</div>
      <div className="mt-2 space-y-1.5">
        {indicators.map((indicator) => (
          <div key={indicator} className="flex items-center gap-2 text-quant-muted">
            <span className={cn("h-1.5 w-1.5 rounded-full", tone === "up" ? "bg-quant-up" : "bg-quant-down")} />
            <span>{indicator}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="rounded-quant border border-quant-line bg-quant-glass p-2">
      <div className="text-quant-muted">{label}</div>
      <div className={cn("mono-num mt-1 text-sm", positive && "text-quant-up", negative && "text-quant-down")}>{value}</div>
    </div>
  );
}
