"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  label: string;
};

function getNavIcon(href: string) {
  const iconClassName = "h-4 w-4 shrink-0";

  switch (href) {
    case "/dashboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
          <path d="M4 5h7v6H4V5Zm9 0h7v10h-7V5ZM4 13h7v6H4v-6Zm9 4h7v2h-7v-2Z" fill="currentColor" />
        </svg>
      );
    case "/proctors":
    case "/team":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
          <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4 19a5 5 0 0 1 10 0v1H4v-1Zm11 1v-1a4 4 0 0 1 5-3.87V20h-5Z" fill="currentColor" />
        </svg>
      );
    case "/locations":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
          <path d="M12 22s7-6.6 7-12a7 7 0 1 0-14 0c0 5.4 7 12 7 12Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" fill="currentColor" />
        </svg>
      );
    case "/cycles":
    case "/sessions":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
          <path d="M7 3v2H5a2 2 0 0 0-2 2v2h18V7a2 2 0 0 0-2-2h-2V3h-2v2H9V3H7Zm14 8H3v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8Z" fill="currentColor" />
        </svg>
      );
    case "/reports":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
          <path d="M5 3h10l4 4v14H5V3Zm9 1.5V8h3.5L14 4.5ZM8 12h8v1.5H8V12Zm0 3h8v1.5H8V15Z" fill="currentColor" />
        </svg>
      );
    case "/notifications":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
          <path d="M12 4.5a4.5 4.5 0 0 0-4.5 4.5v2.17c0 .98-.35 1.93-.98 2.67L5 15.5h14l-1.52-1.66a3.97 3.97 0 0 1-.98-2.67V9A4.5 4.5 0 0 0 12 4.5Zm0 15a2.25 2.25 0 0 0 2.12-1.5H9.88A2.25 2.25 0 0 0 12 19.5Z" fill="currentColor" />
        </svg>
      );
    case "/settings":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
          <path d="m19.14 12.94.06-.94-.06-.94 2-1.56a.5.5 0 0 0 .12-.64l-1.9-3.3a.5.5 0 0 0-.6-.22l-2.36.96a7.6 7.6 0 0 0-1.62-.94l-.36-2.5a.5.5 0 0 0-.5-.42h-3.8a.5.5 0 0 0-.5.42l-.36 2.5c-.57.22-1.11.53-1.62.94l-2.36-.96a.5.5 0 0 0-.6.22l-1.9 3.3a.5.5 0 0 0 .12.64l2 1.56-.06.94.06.94-2 1.56a.5.5 0 0 0-.12.64l1.9 3.3c.13.23.4.32.64.22l2.32-.94c.51.4 1.06.72 1.66.95l.36 2.47c.04.25.25.43.5.43h3.8c.25 0 .46-.18.5-.43l.36-2.47c.6-.23 1.15-.55 1.66-.95l2.32.94c.24.1.5.01.64-.22l1.9-3.3a.5.5 0 0 0-.12-.64l-2-1.56ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" fill="currentColor" />
        </svg>
      );
    case "/test":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
          <path d="M7 4h10v2H7V4Zm-2 4h14v12H5V8Zm3 3v2h8v-2H8Zm0 4v2h5v-2H8Z" fill="currentColor" />
        </svg>
      );
    default:
      return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-current" aria-hidden="true" />;
  }
}

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "motion-nav-link flex items-center gap-3 rounded-[22px] border px-3.5 py-3 text-sm font-medium",
        isActive
          ? "border-transparent bg-accent text-white shadow-[0_18px_36px_-22px_rgba(15,118,110,0.9)]"
          : "border-transparent text-text-secondary hover:border-border hover:bg-surface-elevated hover:text-text-primary"
      )}
    >
      {getNavIcon(href)}
      <span className="truncate">{label}</span>
    </Link>
  );
}
