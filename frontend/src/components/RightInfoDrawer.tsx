import { ChevronLeft, ChevronRight } from "lucide-react";
import { marketSnapshot } from "../data/mockQuant";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type RightInfoDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const bullishIndicators = ["MA5 上穿 MA20", "MACD 柱体转正", "收盘价站上布林中轨"];
const bearishIndicators = ["RSI 接近 70 高位区", "上方压力位 3582.90", "放量后回落风险仍在"];

export function RightInfoDrawer({ open, onOpenChange }: RightInfoDrawerProps) {
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
              <Info label="当前价格" value={marketSnapshot.price.toFixed(2)} positive />
              <Info label="高点" value={marketSnapshot.high.toFixed(2)} />
              <Info label="低点" value={marketSnapshot.low.toFixed(2)} negative />
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

