import type { ReactNode } from "react";

import type { SessionUser } from "@/lib/auth/types";
import type { Locale, Messages } from "@/lib/i18n";
import { getNavigation } from "@/lib/navigation";

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
    <div className="mx-auto min-h-screen w-full max-w-none px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]">
      <Sidebar
        locale={locale}
        user={user}
        messages={messages}
        navigation={navigation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 pb-4">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      </div>
    </div>
  );
}
