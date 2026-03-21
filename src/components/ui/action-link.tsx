"use client";

import type { ReactNode } from "react";

import Link from "next/link";

import { cn } from "@/lib/utils";

type ActionLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export function ActionLink({
  href,
  children,
  variant = "secondary",
  className
}: ActionLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "motion-button inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4.5 text-sm font-semibold tracking-[-0.01em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === "primary"
          ? "border border-transparent bg-accent text-white shadow-[0_18px_36px_-22px_rgba(15,118,110,0.9)] hover:bg-accent-hover hover:shadow-[0_22px_42px_-22px_rgba(15,118,110,0.95)]"
          : "border border-border bg-surface-elevated text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)]",
        className
      )}
    >
      {children}
    </Link>
  );
}
