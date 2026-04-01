"use client";

import { usePathname } from "next/navigation";

import { InAppNotificationBell } from "@/components/notifications/in-app-notification-bell";
import { ActionLink } from "@/components/ui/action-link";
import type { SessionUser } from "@/lib/auth/types";
import type { Locale, Messages } from "@/lib/i18n";
import type { NavigationItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { LocaleToggle } from "./locale-toggle";
import { ThemeToggle } from "./theme-toggle";

type HeaderProps = {
  locale: Locale;
  messages: Messages;
  navigation: NavigationItem[];
  user: SessionUser;
  onOpenSidebar: () => void;
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

function getSegmentLabel(segment: string, locale: Locale) {
  const segmentMap: Record<string, { ar: string; en: string }> = {
    assignments: {
      ar: "التكليفات",
      en: "Assignments"
    },
    attendance: {
      ar: "الحضور",
      en: "Attendance"
    },
    evaluations: {
      ar: "التقييمات",
      en: "Evaluations"
    },
    "waiting-list": {
      ar: "قائمة الانتظار",
      en: "Waiting list"
    },
    swaps: {
      ar: "البدائل",
      en: "Swaps"
    },
    "import-templates": {
      ar: "قوالب الاستيراد",
      en: "Import templates"
    },
    notifications: {
      ar: "الإشعارات",
      en: "Notifications"
    }
  };

  if (segmentMap[segment]) {
    return segmentMap[segment][locale];
  }

  if (/^[0-9a-f-]{10,}$/i.test(segment)) {
    return locale === "ar" ? "تفاصيل" : "Detail";
  }

  return segment.replace(/-/g, " ");
}

function resolveCurrentNavigation(
  pathname: string,
  navigation: NavigationItem[]
) {
  return [...navigation]
    .sort((left, right) => right.href.length - left.href.length)
    .find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
}

export function Header({
  locale,
  messages,
  navigation,
  user,
  onOpenSidebar
}: HeaderProps) {
  const pathname = usePathname();
  const currentSection = resolveCurrentNavigation(pathname, navigation);
  const remainingSegments = pathname
    .replace(currentSection?.href ?? "", "")
    .split("/")
    .filter(Boolean);
  const breadcrumb = [
    messages.app.name,
    currentSection?.label ?? messages.app.tagline,
    ...remainingSegments.map((segment) => getSegmentLabel(segment, locale))
  ].filter(Boolean);
  const currentTitle = breadcrumb[breadcrumb.length - 1] ?? messages.app.name;

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-surface/90 backdrop-blur-xl">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={onOpenSidebar}
              className="motion-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-elevated text-text-primary shadow-[var(--shadow-soft)] lg:hidden"
              aria-label={messages.shell.menu}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-text-muted">
                {breadcrumb.join(" / ")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-[-0.03em] text-text-primary sm:text-[1.8rem]">
                  {currentTitle}
                </h1>
                <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-text-primary">
                  {messages.roles[user.role]}
                </span>
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {messages.app.tagline}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <ActionLink
                href="/reports"
                variant={pathname.startsWith("/reports") ? "primary" : "secondary"}
              >
                {messages.nav.reports}
              </ActionLink>
              <ActionLink
                href="/sessions"
                variant={pathname.startsWith("/sessions") ? "primary" : "secondary"}
              >
                {messages.nav.sessions}
              </ActionLink>
            </div>

            <InAppNotificationBell locale={locale} messages={messages} />
            <LocaleToggle locale={locale} messages={messages} />
            <ThemeToggle initialTheme={user.preferredTheme} messages={messages} />

            <div
              className={cn(
                "flex items-center gap-3 rounded-full border border-border bg-surface-elevated px-2.5 py-2 shadow-[var(--shadow-soft)]",
                "max-sm:w-full max-sm:justify-between"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[color:var(--accent-contrast)] text-sm font-bold">
                {getInitials(user.name)}
              </div>
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-semibold text-text-primary">{user.name}</p>
                <p className="truncate text-xs text-text-muted">{messages.roles[user.role]}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
