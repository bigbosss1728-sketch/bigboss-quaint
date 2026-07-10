import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Holding = {
  symbol: string;
  name: string;
  shares: number;
  price: number;
  value: number;
  pnl: number;
};

const portfolio = {
  totalBalance: 1288400,
  availableBalance: 426300,
  holdings: [
    { symbol: "600519.SH", name: "贵州茅台", shares: 300, price: 1688.4, value: 506520, pnl: 28400 },
    { symbol: "000001.SZ", name: "平安银行", shares: 18000, price: 10.72, value: 192960, pnl: -6200 },
    { symbol: "510300.SH", name: "沪深300ETF", shares: 50000, price: 3.64, value: 182000, pnl: 21800 },
  ] satisfies Holding[],
};

const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0,
});

export function PortfolioAssets() {
  const totalPnl = portfolio.holdings.reduce((sum, item) => sum + item.pnl, 0);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-quant-bg p-4 text-quant-text">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <div>
          <h1 className="text-lg font-semibold">持仓资产分布</h1>
          <p className="mt-1 text-xs text-quant-muted">账户余额、可用余额与当前股票持仓概览</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryCard title="总余额" value={moneyFormatter.format(portfolio.totalBalance)} icon="wallet" />
          <SummaryCard title="可用余额" value={moneyFormatter.format(portfolio.availableBalance)} icon="wallet" />
          <SummaryCard title="持仓盈亏" value={moneyFormatter.format(totalPnl)} icon={totalPnl >= 0 ? "up" : "down"} tone={totalPnl >= 0 ? "up" : "down"} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>当前持有股票</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] border-b border-quant-line px-3 py-2 text-xs text-quant-muted">
              <span>标的</span>
              <span className="text-right">持仓数量</span>
              <span className="text-right">最新价</span>
              <span className="text-right">持仓价值</span>
              <span className="text-right">盈亏</span>
            </div>
            {portfolio.holdings.map((holding) => (
              <div key={holding.symbol} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] items-center border-b border-quant-line px-3 py-2 text-sm last:border-b-0">
                <div>
                  <div className="font-medium text-quant-text">{holding.name}</div>
                  <div className="mono-num text-xs text-quant-muted">{holding.symbol}</div>
                </div>
                <span className="mono-num text-right text-quant-muted">{holding.shares.toLocaleString("zh-CN")}</span>
                <span className="mono-num text-right text-quant-muted">{holding.price.toFixed(2)}</span>
                <span className="mono-num text-right text-quant-text">{moneyFormatter.format(holding.value)}</span>
                <span className={cn("mono-num text-right", holding.pnl >= 0 ? "text-quant-up" : "text-quant-down")}>
                  {holding.pnl >= 0 ? "+" : ""}{moneyFormatter.format(holding.pnl)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function SummaryCard({ title, value, icon, tone }: { title: string; value: string; icon: "wallet" | "up" | "down"; tone?: "up" | "down" }) {
  const Icon = icon === "up" ? TrendingUp : icon === "down" ? TrendingDown : Wallet;

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-3">
        <div>
          <div className="text-xs text-quant-muted">{title}</div>
          <div className={cn("mono-num mt-2 text-xl font-semibold text-quant-text", tone === "up" && "text-quant-up", tone === "down" && "text-quant-down")}>{value}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-quant border border-quant-line bg-quant-glassHover text-quant-muted">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
