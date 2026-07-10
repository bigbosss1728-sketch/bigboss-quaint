import { Activity, CheckCircle2, Database, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const pageCopy: Record<string, string[]> = {
  模板策略: ["动量突破", "均值回归", "多因子轮动"],
  参数优化: ["窗口长度", "止损阈值", "风险预算"],
  回测报告: ["收益曲线", "最大回撤", "胜率统计"],
  委托下单: ["限价委托", "市价委托", "条件单"],
  订单管理: ["未成交", "部分成交", "已成交"],
  风控检查: ["单票敞口", "行业集中度", "回撤预警"],
  资金流水: ["入金", "出金", "交易费用"],
  成交核对: ["成交编号", "交易所回报", "清算状态"],
  费用统计: ["佣金", "印花税", "滑点成本"],
};

type MenuPageProps = {
  menuLabel: string;
  submenuLabel: string;
};

export function MenuPage({ menuLabel, submenuLabel }: MenuPageProps) {
  const items = pageCopy[submenuLabel] ?? ["实时状态", "关键指标", "处理记录"];

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-quant-bg p-4 text-quant-text">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-quant-muted">{menuLabel}</div>
            <h1 className="mt-1 text-xl font-semibold">{submenuLabel}</h1>
          </div>
          <div className="rounded-quant border border-quant-line bg-quant-glass px-3 py-2 text-xs text-quant-muted">
            运行中 · 280ms ease-out
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <InfoCard title="模块状态" value="正常" icon="check" />
          <InfoCard title="今日任务" value="18" icon="activity" />
          <InfoCard title="数据源" value="T+0" icon="database" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{submenuLabel}工作台</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {items.map((item, index) => (
              <div key={item} className="rounded-quant border border-quant-line bg-quant-glass p-3">
                <div className="flex items-center justify-between text-sm text-quant-text">
                  <span>{item}</span>
                  <SlidersHorizontal className="h-4 w-4 text-quant-muted" />
                </div>
                <div className="mono-num mt-3 text-2xl text-quant-text">{(index + 1) * 12 + 6}</div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-quant-glassHover">
                  <div className="h-full bg-quant-up" style={{ width: `${48 + index * 16}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function InfoCard({ title, value, icon }: { title: string; value: string; icon: "check" | "activity" | "database" }) {
  const Icon = icon === "check" ? CheckCircle2 : icon === "activity" ? Activity : Database;

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-3">
        <div>
          <div className="text-xs text-quant-muted">{title}</div>
          <div className="mono-num mt-2 text-2xl font-semibold text-quant-text">{value}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-quant border border-quant-line bg-quant-glassHover text-quant-text">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
