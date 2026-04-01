import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border border-border bg-[color:var(--surface-strong)] text-text-secondary",
  accent: "border border-transparent bg-accent text-[color:var(--accent-contrast)]",
  success: "border border-transparent bg-success/15 text-success",
  warning: "border border-transparent bg-warning/15 text-warning",
  danger: "border border-transparent bg-danger/15 text-danger"
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
