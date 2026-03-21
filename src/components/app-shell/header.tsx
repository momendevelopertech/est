import type { Messages, Locale } from "@/lib/i18n";
import type { NavigationItem } from "@/lib/navigation";
import type { SessionUser } from "@/lib/auth/types";

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
    <header className="motion-shell-reveal panel relative overflow-hidden rounded-[30px] border-transparent px-4 py-4 sm:px-5 sm:py-5">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        <div className="absolute -top-24 end-0 h-48 w-48 rounded-full bg-accent/12 blur-3xl" />
        <div className="absolute -bottom-20 start-6 h-40 w-40 rounded-full bg-warning/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4 lg:gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
            {messages.app.name}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-text-primary sm:text-2xl">
            {messages.app.tagline}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {messages.roles[user.role]} · {locale === "ar" ? messages.common.rtl : messages.common.ltr}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <LocaleToggle locale={locale} messages={messages} />
          <ThemeToggle initialTheme={user.preferredTheme} messages={messages} />
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="secondary" size="sm">
              {messages.shell.signOut}
            </Button>
          </form>
        </div>
        </div>

        <div className="hidden items-center justify-between rounded-[24px] border border-border bg-surface-elevated/80 px-4 py-3 text-sm text-text-secondary lg:flex">
          <span>{messages.shell.signedInAs}</span>
          <span className="font-semibold text-text-primary">{user.name}</span>
        </div>

        <details className="motion-shell-reveal rounded-[24px] border border-border bg-surface-elevated px-4 py-3 lg:hidden">
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
