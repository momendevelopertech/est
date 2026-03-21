import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "accent" | "success" | "warning";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border border-border bg-surface-elevated text-text-secondary",
  accent: "border border-accent/15 bg-accent/10 text-accent",
  success: "border border-success/15 bg-success/10 text-success",
  warning: "border border-warning/15 bg-warning/10 text-warning"
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
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors duration-200",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
