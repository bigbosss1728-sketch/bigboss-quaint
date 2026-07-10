import { Camera, Download, Plus, Wand2 } from "lucide-react";
import type { Timeframe } from "../types/quant";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

type ChartToolbarProps = {
  timeframe: Timeframe;
  timeframes: Timeframe[];
  indicatorDialogOpen: boolean;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onOpenIndicatorDialog: () => void;
  onCloseIndicatorDialog: () => void;
  onAddIndicator: (kind: string) => void;
  onExportData: () => void;
  onScreenshot: () => void;
};

export function ChartToolbar({
  timeframe,
  timeframes,
  indicatorDialogOpen,
  onTimeframeChange,
  onOpenIndicatorDialog,
  onCloseIndicatorDialog,
  onAddIndicator,
  onExportData,
  onScreenshot,
}: ChartToolbarProps) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-1 border-t border-quant-line bg-quant-glass px-3 py-2">
      {timeframes.map((item) => (
        <Button key={item} variant={item === timeframe ? "active" : "ghost"} onClick={() => onTimeframeChange(item)}>
          {item}
        </Button>
      ))}
      <div className="mx-1 h-5 w-px bg-quant-line" />
      <Button variant="ghost" onClick={onOpenIndicatorDialog}>
        <Plus className="h-3.5 w-3.5" />
        添加指标
      </Button>
      <Button variant="ghost">
        <Wand2 className="h-3.5 w-3.5" />
        策略模板
      </Button>
      <Button variant="ghost" onClick={onScreenshot}>
        <Camera className="h-3.5 w-3.5" />
        截图导出
      </Button>
      <Button variant="ghost" onClick={onExportData}>
        <Download className="h-3.5 w-3.5" />
        数据导出
      </Button>

      <Dialog open={indicatorDialogOpen} title="添加副图指标" onClose={onCloseIndicatorDialog}>
        <div className="grid grid-cols-2 gap-2">
          {["MACD", "RSI", "布林带", "成交量", "均线"].map((kind) => (
            <Button key={kind} variant="ghost" onClick={() => onAddIndicator(kind)}>
              {kind}
            </Button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
