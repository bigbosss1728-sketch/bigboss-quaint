import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-8 rounded-quant border border-quant-line bg-quant-glass px-2 text-xs text-quant-text outline-none quant-transition focus:border-quant-up",
        className,
      )}
      {...props}
    />
  );
}
