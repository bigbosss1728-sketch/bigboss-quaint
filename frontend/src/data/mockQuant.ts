import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  ReceiptText,
  Settings2,
} from "lucide-react";
import type {
  ChartBar,
  IndicatorPanel,
  MarketSnapshot,
  MenuItem,
  OrderBookLevel,
  PositionOrder,
  StrategyParams,
  SystemLog,
} from "../types/quant";

export const menuItems: MenuItem[] = [
  { id: "kline", label: "K线行情分析", icon: BarChart3, children: ["主图分析"] },
  { id: "backtest", label: "策略回测模拟器", icon: Activity, children: ["模板策略", "参数优化", "回测报告"] },
  { id: "trade", label: "实盘交易", icon: BriefcaseBusiness, children: ["委托下单", "订单管理", "风控检查"] },
  { id: "position", label: "持仓资产分布", icon: Settings2, children: [] },
  { id: "ledger", label: "资金流水对账", icon: ReceiptText, children: ["资金流水", "成交核对", "费用统计"] },
];

const firstChartDate = new Date(Date.UTC(2026, 3, 1));

function chartDateAt(index: number): string {
  const date = new Date(firstChartDate);
  date.setUTCDate(firstChartDate.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
}

export const chartBars: ChartBar[] = Array.from({ length: 90 }, (_, index) => {
  const wave = Math.sin(index / 6) * 2.4;
  const trend = index * 0.08;
  const open = 112 + wave + trend;
  const close = open + Math.sin(index / 3) * 1.3;
  const noise = Math.sin(index * 1.7) * 0.6;
  return {
    time: chartDateAt(index),
    open: Number(open.toFixed(2)),
    high: Number((Math.max(open, close) + 1.2 + Math.abs(noise)).toFixed(2)),
    low: Number((Math.min(open, close) - 1.1 - Math.abs(noise)).toFixed(2)),
    close: Number(close.toFixed(2)),
    volume: Math.round(180000 + Math.sin(index / 4) * 42000 + index * 700),
  };
});

export const initialIndicators: IndicatorPanel[] = [
  { id: "macd", kind: "MACD", title: "MACD 动量", value: "0.42 / 0.31", change: 0.18 },
  { id: "rsi", kind: "RSI", title: "RSI 强弱", value: "58.6", change: 0.07 },
  { id: "vol", kind: "成交量", title: "成交量", value: "24.8M", change: -0.04 },
];

export const marketSnapshot: MarketSnapshot = {
  symbol: "IF2409",
  price: 3568.42,
  changePct: 1.26,
  floatMarketCap: "3.82T",
  high: 3582.9,
  low: 3518.2,
};

export const orderBook: OrderBookLevel[] = [
  { side: "ask", level: 5, price: 3571.8, size: 82 },
  { side: "ask", level: 4, price: 3571.2, size: 64 },
  { side: "ask", level: 3, price: 3570.6, size: 48 },
  { side: "ask", level: 2, price: 3570.0, size: 53 },
  { side: "ask", level: 1, price: 3569.4, size: 37 },
  { side: "bid", level: 1, price: 3568.8, size: 45 },
  { side: "bid", level: 2, price: 3568.2, size: 58 },
  { side: "bid", level: 3, price: 3567.6, size: 71 },
  { side: "bid", level: 4, price: 3567.0, size: 66 },
  { side: "bid", level: 5, price: 3566.4, size: 88 },
];

export const positions: PositionOrder[] = [
  { id: "P-1024", status: "未平仓", symbol: "IF2409", pnl: 12840, size: 3, entryPrice: 3526.4 },
  { id: "P-1025", status: "未平仓", symbol: "000001.SZ", pnl: -620, size: 1800, entryPrice: 10.72 },
  { id: "P-1019", status: "已平仓", symbol: "510300.SH", pnl: 2180, size: 5000, entryPrice: 3.64 },
];

export const defaultStrategyParams: StrategyParams = {
  template: "动量突破",
  initialCapital: 1000000,
  riskRatio: 12,
  stopLoss: 4,
  slippage: 0.03,
};

export const logs: SystemLog[] = [
  { id: "L1", level: "signal", time: "09:45:12", message: "IF2409 触发 15min 多头确认" },
  { id: "L2", level: "trade", time: "10:02:28", message: "策略模板加载完成：动量突破" },
  { id: "L3", level: "risk", time: "10:18:04", message: "单标的风险敞口接近阈值 12%" },
  { id: "L4", level: "signal", time: "11:03:36", message: "RSI 回落至中性区间，降低追单权重" },
];



