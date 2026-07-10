import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "ghost" | "active" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  default: "border-quant-line bg-quant-glass text-quant-text hover:bg-quant-glassHover",
  ghost: "border-transparent bg-transparent text-quant-muted hover:bg-quant-glassHover hover:text-quant-text",
  active: "border-quant-line bg-quant-glassHover text-quant-text",
  danger: "border-quant-line bg-quant-glass text-quant-down hover:bg-quant-glassHover",
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-quant border px-2.5 text-xs outline-none quant-transition focus:border-quant-up disabled:cursor-not-allowed disabled:text-quant-disabled",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
