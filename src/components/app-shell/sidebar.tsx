import { Badge } from "@/components/ui/badge";
import type { Messages } from "@/lib/i18n";
import type { NavigationItem } from "@/lib/navigation";

import { NavLink } from "./nav-link";

type SidebarProps = {
  messages: Messages;
  navigation: NavigationItem[];
};

export function Sidebar({ messages, navigation }: SidebarProps) {
  return (
    <aside className="hidden w-72 shrink-0 rounded-panel border border-border bg-surface px-5 py-5 shadow-panel lg:flex lg:flex-col lg:gap-6">
      <div className="space-y-3">
        <Badge variant="accent">{messages.shell.status}</Badge>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-text-secondary">
            {messages.app.name}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">
            {messages.app.tagline}
          </h1>
        </div>
      </div>

      <nav className="space-y-2">
        {navigation.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} />
        ))}
      </nav>

      <p className="mt-auto text-sm leading-7 text-text-secondary">
        {messages.shell.localeHint}
      </p>
    </aside>
  );
}
