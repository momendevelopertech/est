import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "accent" | "success" | "warning";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-elevated text-text-secondary",
  accent: "bg-surface-elevated text-accent ring-1 ring-border",
  success: "bg-surface-elevated text-success ring-1 ring-border",
  warning: "bg-surface-elevated text-warning ring-1 ring-border"
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
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
