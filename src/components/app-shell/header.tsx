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
    <header className="motion-shell-reveal space-y-4 rounded-panel border border-border bg-surface px-4 py-4 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
            {messages.app.name}
          </p>
          <p className="mt-1 text-sm text-text-primary">
            {messages.roles[user.role]} - {locale === "ar" ? messages.common.rtl : messages.common.ltr}
          </p>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LocaleToggle locale={locale} messages={messages} />
          <ThemeToggle initialTheme={user.preferredTheme} messages={messages} />
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="secondary" size="sm">
              {messages.shell.signOut}
            </Button>
          </form>
        </div>
      </div>

      <details className="motion-shell-reveal rounded-2xl border border-border bg-surface-elevated px-4 py-3 lg:hidden">
        <summary className="cursor-pointer list-none text-sm font-medium text-text-primary">
          {messages.shell.menu}
        </summary>
        <nav className="mt-4 space-y-2">
          {navigation.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
      </details>
    </header>
  );
}
