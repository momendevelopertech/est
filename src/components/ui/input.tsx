import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-border bg-surface-elevated px-4 text-sm text-text-primary shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent",
        className
      )}
      {...props}
    />
  );
}
