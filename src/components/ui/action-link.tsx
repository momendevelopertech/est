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
        "motion-button inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4.5 text-sm font-semibold tracking-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === "primary"
          ? "border border-transparent bg-accent text-[color:var(--accent-contrast)] shadow-[0_14px_32px_-18px_rgba(245,230,66,0.78)] hover:bg-accent-hover hover:shadow-[0_18px_36px_-18px_rgba(245,230,66,0.84)]"
          : "border border-border bg-surface-elevated text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.52)] hover:border-text-primary hover:bg-[color:var(--surface-strong)]",
        className
      )}
    >
      {children}
    </Link>
  );
}
