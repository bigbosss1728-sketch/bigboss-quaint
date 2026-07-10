import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-8 rounded-quant border border-quant-line bg-quant-glass px-2 text-xs text-quant-text outline-none quant-transition placeholder:text-quant-disabled focus:border-quant-up",
        className,
      )}
      {...props}
    />
  );
}
