"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  label: string;
};

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "motion-nav-link flex items-center justify-between rounded-2xl px-3 py-3 text-sm",
        isActive
          ? "bg-accent text-white shadow-panel"
          : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
      )}
    >
      <span>{label}</span>
      {isActive ? <span className="text-xs uppercase tracking-[0.18em]">On</span> : null}
    </Link>
  );
}
