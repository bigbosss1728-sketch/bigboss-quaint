import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-quant border border-quant-line bg-quant-glass px-1.5 text-[11px] text-quant-muted",
        className,
      )}
      {...props}
    />
  );
}
