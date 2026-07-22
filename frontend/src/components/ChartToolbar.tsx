import { Camera, Download, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

type ChartToolbarProps = {
  indicatorDialogOpen: boolean;
  onOpenIndicatorDialog: () => void;
  onCloseIndicatorDialog: () => void;
  onAddIndicator: (kind: string) => void;
  onExportData: () => void;
  onScreenshot: () => void;
};

export function ChartToolbar({
  indicatorDialogOpen,
  onOpenIndicatorDialog,
  onCloseIndicatorDialog,
  onAddIndicator,
  onExportData,
  onScreenshot,
}: ChartToolbarProps) {
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-1.5 border-t border-quant-line bg-quant-glass px-4 py-2.5">
      <span className="mr-1 rounded-full bg-quant-glassHover px-3 py-1.5 text-xs font-medium text-quant-text">日线</span>
      <div className="mx-1 h-5 w-px bg-quant-line" />
      <Button variant="ghost" onClick={onOpenIndicatorDialog}>
        <Plus className="h-3.5 w-3.5" />
        添加指标
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
