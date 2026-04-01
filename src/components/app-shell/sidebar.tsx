"use client";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Badge } from "@/components/ui/badge";
import type { SessionUser } from "@/lib/auth/types";
import type { Locale, Messages } from "@/lib/i18n";
import type { NavigationItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { NavLink } from "./nav-link";

type SidebarProps = {
  locale: Locale;
  user: SessionUser;
  messages: Messages;
  navigation: NavigationItem[];
  isOpen: boolean;
  onClose: () => void;
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function Sidebar({
  locale,
  user,
  messages,
  navigation,
  isOpen,
  onClose
}: SidebarProps) {
  const isRtl = locale === "ar";

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/45 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 z-50 flex w-[260px] flex-col bg-[color:var(--sidebar)] text-white shadow-[0_30px_60px_-30px_rgba(0,0,0,0.72)] transition-transform duration-300",
          isRtl
            ? "right-0 border-l border-[color:var(--sidebar-border)]"
            : "left-0 border-r border-[color:var(--sidebar-border)]",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : isRtl ? "translate-x-full" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-[color:var(--sidebar-border)] px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-14 items-center justify-center rounded-xl border border-[color:var(--sidebar-border)] bg-white/5">
              <BrandLogo className="h-7 w-10" decorative />
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--sidebar-muted)]">
                EST
              </p>
              <p className="truncate text-sm font-bold text-white">{messages.app.name}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="motion-button inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--sidebar-border)] bg-white/5 text-[color:var(--sidebar-muted)] lg:hidden"
            aria-label={messages.shell.menu}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-3 py-5">
          <div>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--sidebar-muted)]">
              {messages.shell.menu}
            </p>
            <nav className="mt-3 space-y-2">
              {navigation.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  locale={locale}
                  onNavigate={onClose}
                />
              ))}
            </nav>
          </div>
        </div>

        <div className="border-t border-[color:var(--sidebar-border)] p-4">
          <div className="rounded-2xl border border-[color:var(--sidebar-border)] bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-bold text-[color:var(--accent-contrast)]">
                {getInitials(user.name)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="accent">{messages.roles[user.role]}</Badge>
                </div>
              </div>

              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="motion-button inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--sidebar-border)] bg-white/5 text-[color:var(--sidebar-muted)] hover:bg-white/10 hover:text-accent"
                  aria-label={messages.shell.signOut}
                  title={messages.shell.signOut}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M14 7V4.5A1.5 1.5 0 0 0 12.5 3h-6A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h6a1.5 1.5 0 0 0 1.5-1.5V17M10 12h10m0 0-3-3m3 3-3 3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
