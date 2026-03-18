import type { Messages, Locale } from "@/lib/i18n";
import type { NavigationItem } from "@/lib/navigation";
import type { SessionUser } from "@/lib/auth/types";

import { Badge } from "@/components/ui/badge";
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
  const localeLabel =
    locale === "ar" ? messages.common.arabic : messages.common.english;

  const themeLabel =
    user.preferredTheme === "dark"
      ? messages.theme.dark
      : user.preferredTheme === "light"
        ? messages.theme.light
        : messages.theme.system;

  return (
    <header className="motion-shell-reveal space-y-4 rounded-panel border border-border bg-surface px-5 py-5 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{messages.common.protected}</Badge>
            <Badge>{localeLabel}</Badge>
            <Badge>{themeLabel}</Badge>
          </div>
          <div>
            <p className="text-sm text-text-secondary">{messages.shell.signedInAs}</p>
            <h2 className="mt-1 text-2xl font-semibold text-text-primary">
              {user.name}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {messages.shell.role}: {messages.roles[user.role]} . {messages.shell.direction}:{" "}
              {locale === "ar" ? messages.common.rtl : messages.common.ltr}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <LocaleToggle locale={locale} messages={messages} />
          <ThemeToggle initialTheme={user.preferredTheme} messages={messages} />
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="secondary">
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
