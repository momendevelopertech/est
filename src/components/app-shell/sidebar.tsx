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
    <aside className="motion-shell-reveal hidden w-80 shrink-0 rounded-panel border border-border bg-surface px-4 py-4 shadow-panel lg:flex lg:flex-col">
      <div className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-text-secondary">
            {messages.app.name}
          </p>
          <h1 className="mt-2 text-xl font-semibold text-text-primary">
            {messages.app.tagline}
          </h1>
        </div>
      </div>

      <nav className="mt-5 space-y-1.5">
        {navigation.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} />
        ))}
      </nav>

      <div className="mt-auto space-y-3 pt-4">
        <div className="flex items-center gap-2">
          <InAppNotificationBell locale={locale} messages={messages} />
          <LocaleToggle locale={locale} messages={messages} />
          <ThemeToggle initialTheme={user.preferredTheme} messages={messages} />
        </div>

        <div className="rounded-2xl border border-border bg-surface-elevated px-3 py-3">
          <p className="text-xs text-text-secondary">{messages.shell.signedInAs}</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{user.name}</p>
          <p className="mt-1 text-xs text-text-secondary">{messages.roles[user.role]}</p>
          <form action="/api/auth/logout" method="post" className="mt-3">
            <Button type="submit" variant="secondary" className="w-full">
              {messages.shell.signOut}
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
