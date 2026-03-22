import { InAppNotificationBell } from "@/components/notifications/in-app-notification-bell";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/types";
import type { Locale, Messages } from "@/lib/i18n";
import type { NavigationItem } from "@/lib/navigation";

import { LocaleToggle } from "./locale-toggle";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

type SidebarProps = {
  locale: Locale;
  user: SessionUser;
  messages: Messages;
  navigation: NavigationItem[];
};

export function Sidebar({ locale, user, messages, navigation }: SidebarProps) {
  return (
    <aside className="motion-shell-reveal space-y-4 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:shrink-0 lg:space-y-0">
      <details className="panel rounded-[28px] border-transparent px-4 py-4 lg:hidden">
        <summary className="cursor-pointer list-none text-sm font-semibold text-text-primary">
          {messages.shell.menu}
        </summary>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
              {messages.app.name}
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-text-primary">
              {messages.app.tagline}
            </h1>
            <p className="mt-2 text-sm text-text-secondary">{user.name}</p>
          </div>

          <nav className="space-y-2">
            {navigation.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <InAppNotificationBell locale={locale} messages={messages} />
            <LocaleToggle locale={locale} messages={messages} />
            <ThemeToggle initialTheme={user.preferredTheme} messages={messages} />
          </div>

          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="secondary" className="w-full rounded-xl">
              {messages.shell.signOut}
            </Button>
          </form>
        </div>
      </details>

      <div className="panel hidden h-full rounded-[30px] border-transparent px-4 py-4 lg:flex lg:flex-col">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
            {messages.app.name}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-text-primary">
            {messages.app.tagline}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">{messages.roles[user.role]}</p>
        </div>

        <nav className="mt-6 flex-1 space-y-2 overflow-y-auto pe-1">
          {navigation.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="mt-5 space-y-3 border-t border-border/80 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <InAppNotificationBell locale={locale} messages={messages} />
            <LocaleToggle locale={locale} messages={messages} />
            <ThemeToggle initialTheme={user.preferredTheme} messages={messages} />
          </div>

          <div className="rounded-[22px] border border-border bg-surface-elevated px-4 py-4">
            <p className="font-semibold text-text-primary">{user.name}</p>
            <p className="mt-1 text-sm text-text-secondary">{messages.roles[user.role]}</p>
            <form action="/api/auth/logout" method="post" className="mt-3">
              <Button type="submit" variant="secondary" className="w-full rounded-xl">
                {messages.shell.signOut}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
