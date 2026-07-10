import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

type DialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function Dialog({ open, title, children, onClose }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 opacity-100 quant-transition" onClick={onClose}>
      <div className={cn("card-glass w-[min(420px,calc(100vw-24px))] p-3")} onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between border-b border-quant-line pb-2">
          <h2 className="text-sm font-medium text-quant-text">{title}</h2>
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
