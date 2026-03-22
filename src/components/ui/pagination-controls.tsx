import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

import { Button } from "./button";

type PaginationControlsProps = {
  page: number;
  pageCount: number;
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  summaryLabel: string;
  totalLabel: string;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
};

export function PaginationControls({
  page,
  pageCount,
  total,
  hasPreviousPage,
  hasNextPage,
  summaryLabel,
  totalLabel,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext
}: PaginationControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-border bg-surface-elevated px-4 py-3">
      <span className="sr-only">{total}</span>
      <div className="space-y-1">
        <p className="text-sm text-text-secondary">{summaryLabel}</p>
        <p className="text-sm text-text-secondary">{totalLabel}</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-text-primary">
          {page} / {pageCount}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrevious}
          disabled={!hasPreviousPage}
        >
          <ChevronLeftIcon />
          {previousLabel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onNext}
          disabled={!hasNextPage}
        >
          {nextLabel}
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
