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
    <aside className="motion-shell-reveal panel sticky top-5 hidden h-[calc(100vh-2.5rem)] shrink-0 overflow-hidden rounded-[32px] border-transparent px-4 py-4 lg:flex lg:flex-col">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
        <div className="absolute -top-16 start-8 h-36 w-36 rounded-full bg-accent/14 blur-3xl" />
        <div className="absolute bottom-12 end-0 h-44 w-44 rounded-full bg-warning/10 blur-3xl" />
      </div>

      <div className="relative space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
            {messages.app.name}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text-primary">
            {messages.app.tagline}
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-text-secondary">
            {messages.roles[user.role]}
          </p>
        </div>
      </div>

      <nav className="relative mt-6 flex-1 space-y-2 overflow-y-auto pe-1">
        {navigation.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} />
        ))}
      </nav>

      <div className="relative mt-5 space-y-3 border-t border-border/80 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <InAppNotificationBell locale={locale} messages={messages} />
          <LocaleToggle locale={locale} messages={messages} />
          <ThemeToggle initialTheme={user.preferredTheme} messages={messages} />
        </div>

        <div className="rounded-[24px] border border-border bg-surface-elevated/90 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            {messages.shell.signedInAs}
          </p>
          <p className="mt-2 text-base font-semibold text-text-primary">{user.name}</p>
          <p className="mt-1 text-sm text-text-secondary">{messages.roles[user.role]}</p>
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
