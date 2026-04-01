import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatCardTone = "accent" | "success" | "warning" | "danger";

const toneClasses: Record<StatCardTone, string> = {
  accent: "bg-accent/25 text-[color:var(--accent-contrast)]",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger"
};

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  trend?: string;
  tone?: StatCardTone;
};

export function StatCard({
  icon,
  label,
  value,
  trend,
  tone = "accent"
}: StatCardProps) {
  return (
    <div className="motion-card flex items-center gap-4 rounded-[18px] border border-border bg-surface-elevated p-5 shadow-[var(--shadow-panel)]">
      <div
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
          toneClasses[tone]
        )}
      >
        <span className="flex h-6 w-6 items-center justify-center">{icon}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-text-muted">{label}</p>
        <h2 className="mt-1 text-[2rem] font-bold leading-none text-text-primary">
          {value}
        </h2>
      </div>

      {trend ? (
        <div className="rounded-full bg-[color:var(--surface-strong)] px-3 py-1 text-xs font-semibold text-text-secondary">
          {trend}
        </div>
      ) : null}
    </div>
  );
}
