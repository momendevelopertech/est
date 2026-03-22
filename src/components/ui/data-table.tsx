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
    <div className="overflow-x-auto">
      <table
        className={cn("min-w-full border-collapse text-sm text-text-primary", className)}
        {...props}
      />
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
        "border-b border-border bg-background/70 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary",
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
  return <tbody className={cn("divide-y divide-border/70", className)} {...props} />;
}

export function DataTableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "align-top transition-colors hover:bg-background/50",
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
      className={cn("px-4 py-3 text-start font-semibold first:ps-5 last:pe-5", className)}
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
        "px-4 py-3 align-top text-sm leading-6 text-text-secondary first:ps-5 last:pe-5",
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
        "rounded-[24px] border border-dashed border-border bg-surface-elevated px-5 py-8 text-center",
        className
      )}
    >
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-text-secondary">{description}</p>
    </div>
  );
}
