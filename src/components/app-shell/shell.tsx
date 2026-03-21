import type { ReactNode } from "react";

import type { SessionUser } from "@/lib/auth/types";
import type { Locale, Messages } from "@/lib/i18n";
import { getNavigation } from "@/lib/navigation";

import { Header } from "./header";
import { PageTransition } from "./page-transition";
import { Sidebar } from "./sidebar";

type ShellProps = {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
  user: SessionUser;
};

export function AppShell({ children, locale, messages, user }: ShellProps) {
  const navigation = getNavigation(messages).filter((item) =>
    item.roles.includes(user.role)
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-none gap-4 px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
      <Sidebar
        locale={locale}
        user={user}
        messages={messages}
        navigation={navigation}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <Header
          locale={locale}
          messages={messages}
          navigation={navigation}
          user={user}
        />
        <main className="min-w-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
