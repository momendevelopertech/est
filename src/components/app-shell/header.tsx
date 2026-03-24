import type { SessionUser } from "@/lib/auth/types";
import type { Locale, Messages } from "@/lib/i18n";
import type { NavigationItem } from "@/lib/navigation";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";

import { LocaleToggle } from "./locale-toggle";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

type HeaderProps = {
  locale: Locale;
  messages: Messages;
  navigation: NavigationItem[];
  user: SessionUser;
};

export function Header({ locale, messages, navigation, user }: HeaderProps) {
  return (
    <header className="motion-shell-reveal panel rounded-[28px] border-transparent px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-14 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-border/80 bg-[linear-gradient(155deg,var(--surface-elevated),var(--surface-strong))] shadow-[var(--shadow-soft)]">
              <div className="absolute inset-[1px] rounded-[20px] bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.18),transparent_62%)] dark:bg-[radial-gradient(circle_at_top,rgba(94,234,212,0.18),transparent_62%)]" />
              <BrandLogo className="relative z-10 h-8 w-12" decorative />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
                {messages.app.name}
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold tracking-[-0.02em] text-text-primary sm:text-xl">
                {messages.app.tagline}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:hidden">
            <LocaleToggle locale={locale} messages={messages} />
            <ThemeToggle initialTheme={user.preferredTheme} messages={messages} />
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="secondary" size="sm" className="rounded-xl px-3">
                {messages.shell.signOut}
              </Button>
            </form>
          </div>
        </div>

        <div className="hidden items-center justify-between rounded-[20px] border border-border bg-surface-elevated px-4 py-3 text-sm lg:flex">
          <div className="min-w-0">
            <p className="font-semibold text-text-primary">{user.name}</p>
            <p className="text-text-secondary">
              {messages.roles[user.role]} · {locale === "ar" ? messages.common.rtl : messages.common.ltr}
            </p>
          </div>
          <span className="text-text-secondary">{messages.shell.signedInAs}</span>
        </div>

        <details className="motion-shell-reveal rounded-[20px] border border-border bg-surface-elevated px-4 py-3 lg:hidden">
          <summary className="cursor-pointer list-none text-sm font-medium text-text-primary">
            {messages.shell.menu}
          </summary>
          <nav className="mt-4 space-y-2">
            {navigation.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
