import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes
} from "react";

import { cn } from "@/lib/utils";

export function DataTable({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated shadow-[var(--shadow-panel)]">
      <div className="overflow-x-auto">
        <table
          className={cn(
            "min-w-full border-separate border-spacing-0 text-sm text-text-primary",
            className
          )}
          {...props}
        />
      </div>
    </div>
  );
}

export function DataTableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "bg-[color:var(--surface-muted)] text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary",
        className
      )}
      {...props}
    />
  );
}

export function DataTableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border/80", className)} {...props} />;
}

export function DataTableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "align-top transition-colors hover:bg-[color:var(--accent-soft)]",
        className
      )}
      {...props}
    />
  );
}

export function DataTableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-border px-4 py-3.5 text-start font-bold first:ps-5 last:pe-5",
        className
      )}
      {...props}
    />
  );
}

export function DataTableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "border-b border-border/70 px-4 py-3.5 align-top text-sm leading-6 text-text-secondary first:ps-5 last:pe-5",
        className
      )}
      {...props}
    />
  );
}

export function DataTableEmptyState({
  title,
  description,
  className
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-dashed border-border bg-surface-elevated px-5 py-8 text-center shadow-[var(--shadow-soft)]",
        className
      )}
    >
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-text-secondary">{description}</p>
    </div>
  );
}
