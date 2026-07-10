import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export function QuantTransition({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("quant-transition", className)} {...props} />;
}
