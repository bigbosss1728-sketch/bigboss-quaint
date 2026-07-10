import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Slider({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="range"
      className={cn("h-2 w-full accent-quant-up outline-none quant-transition", className)}
      {...props}
    />
  );
}
