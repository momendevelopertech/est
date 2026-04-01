import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[120px] w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.48)] outline-none transition-[background-color,border-color,box-shadow,color] duration-200 placeholder:text-text-muted focus:border-text-primary focus:bg-[color:var(--surface-strong)] focus:ring-4 focus:ring-accent/20",
        className
      )}
      {...props}
    />
  );
}
