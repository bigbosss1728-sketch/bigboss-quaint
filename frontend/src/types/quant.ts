import type { ComponentType } from "react";

export type Timeframe = "分时" | "1min" | "5min" | "15min" | "日线";

export type MenuItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  children: string[];
};

export type ChartBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorKind = "MACD" | "RSI" | "布林带" | "成交量" | "均线";

export type IndicatorPanel = {
  id: string;
  kind: IndicatorKind;
  title: string;
  value: string;
  change: number;
};

export type OrderBookLevel = {
  side: "bid" | "ask";
  level: number;
  price: number;
  size: number;
};

export type PositionOrder = {
  id: string;
  status: "未平仓" | "已平仓";
  symbol: string;
  pnl: number;
  size: number;
  entryPrice: number;
};

export type StrategyParams = {
  template: string;
  initialCapital: number;
  riskRatio: number;
  stopLoss: number;
  slippage: number;
};

export type MarketSnapshot = {
  symbol: string;
  price: number;
  changePct: number;
  floatMarketCap: string;
  high: number;
  low: number;
};

export type SystemLog = {
  id: string;
  level: "signal" | "trade" | "risk";
  time: string;
  message: string;
};
